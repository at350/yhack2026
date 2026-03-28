import { Router } from 'express';

const router = Router();

const LAVA_FORWARD_URL = 'https://api.lavapayments.com/v1/forward?u=https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-6';

function getLavaToken(): string {
  const token = process.env.LAVA_FORWARD_TOKEN;
  if (!token) throw new Error('LAVA_FORWARD_TOKEN is not set in environment');
  return token;
}

function getLavaSecret(): string {
  const secret = process.env.LAVA_SECRET_KEY;
  if (!secret) throw new Error('LAVA_SECRET_KEY is not set in environment');
  return secret;
}

// POST /api/ai/summarize — streaming summary via Claude + Lava
router.post('/summarize', async (req, res) => {
  try {
    const { simulationSummary, interventions, objective, countyCount } = req.body;
    const prompt = buildPrompt(simulationSummary, interventions, objective, countyCount);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const claudeRes = await fetch(LAVA_FORWARD_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getLavaToken()}`,
        'x-api-key': getLavaSecret(),
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 1024,
        stream: true,
        system: `You are a public health policy expert and data scientist. You analyze simulation results from PulsePolicy, a decision-support tool for public health interventions. Your summaries are clear, evidence-based, and equity-focused. Write in a professional but accessible tone. Use specific numbers from the data. Structure your response with clear sections.`,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!claudeRes.ok || !claudeRes.body) {
      const errText = await claudeRes.text();
      res.write(`data: ${JSON.stringify({ error: `Claude API error: ${claudeRes.status} ${errText}` })}\n\n`);
      res.end();
      return;
    }

    const reader = claudeRes.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? ''; // keep incomplete last line

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const raw = line.slice(6).trim();
          if (raw === '[DONE]' || !raw) continue;
          try {
            const event = JSON.parse(raw);
            // Claude streaming events: content_block_delta carries text
            if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
              const text = event.delta.text ?? '';
              if (text) res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
            }
            if (event.type === 'message_stop') {
              res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
            }
          } catch { /* skip malformed lines */ }
        }
      }
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err: unknown) {
    console.error('Claude/Lava error:', err);
    res.write(`data: ${JSON.stringify({ error: String(err) })}\n\n`);
    res.end();
  }
});

// POST /api/ai/insight — non-streaming quick insight
router.post('/insight', async (req, res) => {
  try {
    const { county, metric, value, percentile } = req.body;

    const claudeRes = await fetch(LAVA_FORWARD_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getLavaToken()}`,
        'x-api-key': getLavaSecret(),
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 150,
        messages: [{
          role: 'user',
          content: `In 2 sentences, explain the public health significance of ${county} having a ${metric} rate of ${value}% (${percentile}th percentile nationally). Focus on impact and actionable framing.`,
        }],
      }),
    });

    if (!claudeRes.ok) {
      const err = await claudeRes.text();
      return res.status(claudeRes.status).json({ error: err });
    }

    const data = await claudeRes.json() as { content: Array<{ text: string }> };
    return res.json({ insight: data.content[0]?.text ?? '' });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});

function buildPrompt(summary: Record<string, unknown>, interventions: Record<string, unknown>[], objective: string, countyCount: number): string {
  return `
Analyze the following public health simulation results and write a comprehensive policy summary.

**Objective:** ${objective || 'General public health improvement'}

**Interventions Selected:**
${Array.isArray(interventions) ? interventions.map((i) => `- ${i.name || i.id}: $${Number(i.budget || 0).toLocaleString()} budget, targeting ${i.targeting || 'all populations'}`).join('\n') : 'None specified'}

**Simulation Results (${countyCount} counties analyzed):**
- Total QALYs Gained: ${summary?.totalQalysGained?.toLocaleString?.() || 'N/A'}
- Cost per QALY: $${summary?.avgCostPerQaly?.toLocaleString?.() || 'N/A'}
- Gini Coefficient (health disparity): ${summary?.giniCoefficient || 'N/A'}
- Total Budget: $${summary?.budgetTotal?.toLocaleString?.() || 'N/A'}
- Time Horizon: ${summary?.timeHorizonYears || 5} years

Please provide:
1. **Key Findings** (2-3 bullet points on most impactful outcomes)
2. **Equity Analysis** (who benefits most, disparity implications)
3. **Cost-Effectiveness** (value for money assessment)
4. **Priority Recommendations** (2-3 actionable next steps)
5. **Risks & Limitations** (caveats about the model)

Keep the total response under 600 words. Use specific numbers. Be direct and evidence-based.
`.trim();
}

// POST /api/ai/patient-timeline — generate a branchable timeline from patient data + medical history
router.post('/patient-timeline', async (req, res) => {
  try {
    const { profile, medicalHistory, interventions } = req.body;
    // interventions is optional — set when re-evaluating after applying them

    const currentYear = new Date().getFullYear();
    const birthYear = currentYear - (profile.age || 40);

    const systemPrompt = `You are a clinical AI assistant and public health expert embedded in Prophis, a preventive health platform. Your job is to analyze a patient's medical history and demographic data, then construct a realistic chronological health timeline. You must return ONLY valid JSON — no prose, no explanation, no markdown. The JSON must be an array of timeline event objects.

Each event object must have these exact fields:
- "age": number (patient age when event occurred or is predicted)
- "year": number (calendar year)
- "type": one of "past" | "present" | "predicted" | "intervention" | "warning"
- "title": string (short event title, max 8 words)
- "description": string (1-2 sentence clinical description)
- "severity": one of "low" | "medium" | "high" | "critical"
- "category": one of "diagnosis" | "lifestyle" | "medication" | "screening" | "procedure" | "risk_factor" | "intervention" | "outcome"
- "avoided": boolean (true only when an intervention prevents a previously predicted bad outcome)

Rules:
- Past events: derive from the medical history provided. Be specific with ages/years.
- Present event: exactly ONE event with type "present" at the patient's current age.
- Predicted future: project 15 years forward. Include realistic disease progressions, complications, and mortality risk based on the patient's specific risk factors.
- If interventions are provided, re-project the future showing improved outcomes. Mark prevented events as type "predicted" with avoided=true.
- Always include 3-5 past events, 1 present, and 5-8 future predictions.
- Order all events by age ascending.`;

    const interventionNote = interventions?.length
      ? `\n\nThe following preventive interventions have now been APPLIED to this patient. Re-project the future accordingly, showing improved outcomes and marking any previously bad predictions as avoided:\n${interventions.map((i: Record<string, string>) => `- ${i.name}: ${i.description}`).join('\n')}`
      : '';

    const userPrompt = `Patient Profile:
- Name: ${profile.name || 'Patient'}
- Age: ${profile.age} years old (born ~${birthYear})
- Sex: ${profile.sex}
- Height: ${profile.height || 'not provided'}
- Weight: ${profile.weight || 'not provided'}
- BMI: ${profile.bmi || 'not provided'}
- Ethnicity: ${profile.ethnicity || 'not provided'}
- Smoking Status: ${profile.smoker ? 'Current smoker' : 'Non-smoker'}
- Family History: ${profile.familyHistory || 'None reported'}

Medical History (from uploaded records or patient entry):
${medicalHistory || 'No medical history provided. Generate a realistic timeline based on demographics and risk factors.'}
${interventionNote}

Generate the timeline JSON array now.`;

    const claudeRes = await fetch(LAVA_FORWARD_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getLavaToken()}`,
        'x-api-key': getLavaSecret(),
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    if (!claudeRes.ok) {
      const err = await claudeRes.text();
      return res.status(claudeRes.status).json({ error: `Claude API error: ${claudeRes.status} ${err}` });
    }

    const data = await claudeRes.json() as { content: Array<{ text: string }> };
    const rawText = data.content[0]?.text ?? '[]';

    // Strip markdown code fences if present
    const cleaned = rawText.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();

    let timeline: unknown[];
    try {
      timeline = JSON.parse(cleaned);
    } catch {
      return res.status(500).json({ error: 'Failed to parse Claude timeline response', raw: rawText });
    }

    return res.json({ timeline });
  } catch (err) {
    console.error('patient-timeline error:', err);
    return res.status(500).json({ error: String(err) });
  }
});

export default router;

