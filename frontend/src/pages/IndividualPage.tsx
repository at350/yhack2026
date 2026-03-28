import { useState, useRef } from 'react';
import { generatePatientTimeline } from '../api/client';
import type { TimelineEvent } from '../api/client';

interface PatientProfile {
  name: string;
  age: string;
  sex: 'male' | 'female' | 'other';
  heightFt: string;
  heightIn: string;
  weightLbs: string;
  ethnicity: string;
  smoker: boolean;
  familyHistory: string;
}

const MOCK_PATIENT: PatientProfile = {
  name: 'Marcus Williams',
  age: '52',
  sex: 'male',
  heightFt: '5',
  heightIn: '11',
  weightLbs: '218',
  ethnicity: 'African American',
  smoker: true,
  familyHistory: 'Father had Type 2 diabetes and died of heart attack at 61. Mother has hypertension.',
};

const MOCK_HISTORY = `PATIENT MEDICAL RECORD — Marcus Williams, DOB 1973-04-12

HISTORY OF PRESENT ILLNESS:
- 1995 (Age 22): Began smoking cigarettes, 1 ppd habit
- 2001 (Age 28): Annual physical — cholesterol 201 mg/dL, borderline high. Declined lifestyle counseling.
- 2008 (Age 35): Fasting glucose 108 mg/dL (pre-diabetic range). Advised weight loss. No follow-up for 3 years.
- 2011 (Age 38): Diagnosed with Type 2 Diabetes. HbA1c 7.8%. Started Metformin 500mg BID.
- 2014 (Age 41): Blood pressure 148/94 mmHg. Diagnosed with Stage 1 Hypertension. Started Lisinopril 10mg.
- 2017 (Age 44): Stress ECG — mild ischemic changes noted. Referred to cardiology. Did not attend follow-up.
- 2019 (Age 46): HbA1c 9.1% — poor glycemic control. Metformin dose increased. Added Glipizide.
- 2021 (Age 48): ER visit — chest tightness, shortness of breath. Ruled out STEMI, diagnosed unstable angina. Started aspirin, atorvastatin.
- 2023 (Age 50): Peripheral neuropathy symptoms in feet. Ophthalmology — early diabetic retinopathy bilateral.
- 2025 (Age 52): Current visit. BMI 30.4. HbA1c 8.6%. BP 152/96 on medication. Active smoker. Sedentary lifestyle.`;

const INTERVENTIONS = [
  { id: 'smoking_cessation', name: 'Smoking Cessation Program', description: 'Structured counseling, NRT patches, and pharmacotherapy (varenicline) to achieve smoking cessation within 3 months.' },
  { id: 'diabetes_management', name: 'Intensive Diabetes Management', description: 'CGM device, dietary counseling, HbA1c target <7%, medication optimization with endocrinology referral.' },
  { id: 'cardiac_rehab', name: 'Cardiac Rehabilitation', description: 'Supervised exercise program, dietary counseling, and medication adherence support for 12 weeks.' },
  { id: 'hypertension_control', name: 'Hypertension Control Protocol', description: 'Home BP monitoring, medication dose titration, low-sodium DASH diet, and monthly check-ins.' },
  { id: 'physical_activity', name: 'Structured Physical Activity', description: 'Physician-prescribed 150 min/week moderate exercise, step goals, and fitness tracker integration.' },
  { id: 'nutrition_counseling', name: 'Medical Nutrition Therapy', description: 'Registered dietitian sessions focused on glycemic index reduction, weight loss of 10% body weight.' },
];

const TYPE_CONFIG = {
  past: { color: '#6B7A99', bg: 'rgba(107,122,153,0.12)', border: 'rgba(107,122,153,0.25)', dot: '#6B7A99', label: 'Past' },
  present: { color: '#00D4AA', bg: 'rgba(0,212,170,0.12)', border: 'rgba(0,212,170,0.35)', dot: '#00D4AA', label: 'Now' },
  predicted: { color: '#FF9B3D', bg: 'rgba(255,155,61,0.1)', border: 'rgba(255,155,61,0.3)', dot: '#FF9B3D', label: 'Predicted' },
  warning: { color: '#FF5757', bg: 'rgba(255,87,87,0.1)', border: 'rgba(255,87,87,0.35)', dot: '#FF5757', label: 'Risk' },
  intervention: { color: '#60B8FF', bg: 'rgba(96,184,255,0.1)', border: 'rgba(96,184,255,0.3)', dot: '#60B8FF', label: 'Intervention' },
};

const SEVERITY_ICON: Record<string, string> = {
  low: '◦',
  medium: '●',
  high: '▲',
  critical: '⚠',
};

const CATEGORY_ICON: Record<string, string> = {
  diagnosis: '🩺',
  lifestyle: '🏃',
  medication: '💊',
  screening: '🔬',
  procedure: '🏥',
  risk_factor: '⚡',
  intervention: '✅',
  outcome: '📊',
};

export default function IndividualPage() {
  const [profile, setProfile] = useState<PatientProfile>({
    name: '', age: '', sex: 'male', heightFt: '', heightIn: '',
    weightLbs: '', ethnicity: '', smoker: false, familyHistory: '',
  });
  const [medicalHistory, setMedicalHistory] = useState('');
  const [timeline, setTimeline] = useState<TimelineEvent[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeInterventions, setActiveInterventions] = useState<Set<string>>(new Set());
  const [reloading, setReloading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function calcBMI(): string {
    const heightIn = (parseFloat(profile.heightFt) * 12) + parseFloat(profile.heightIn);
    const lbs = parseFloat(profile.weightLbs);
    if (!heightIn || !lbs) return '';
    return ((lbs / (heightIn * heightIn)) * 703).toFixed(1);
  }

  function loadMockPatient() {
    setProfile(MOCK_PATIENT);
    setMedicalHistory(MOCK_HISTORY);
  }

  async function handleGenerate() {
    if (!profile.age || !profile.name) {
      setError('Please enter at least a patient name and age.');
      return;
    }
    setLoading(true);
    setError(null);
    setTimeline(null);
    setActiveInterventions(new Set());
    try {
      const bmi = calcBMI();
      const res = await generatePatientTimeline({
        profile: {
          name: profile.name,
          age: parseInt(profile.age),
          sex: profile.sex,
          height: profile.heightFt ? `${profile.heightFt}'${profile.heightIn}"` : undefined,
          weight: profile.weightLbs ? `${profile.weightLbs} lbs` : undefined,
          bmi: bmi || undefined,
          ethnicity: profile.ethnicity || undefined,
          smoker: profile.smoker,
          familyHistory: profile.familyHistory || undefined,
        },
        medicalHistory: medicalHistory || '',
      });
      setTimeline(res.timeline);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleApplyInterventions() {
    if (!timeline || activeInterventions.size === 0) return;
    setReloading(true);
    setError(null);
    try {
      const bmi = calcBMI();
      const selectedInterventions = INTERVENTIONS.filter(i => activeInterventions.has(i.id))
        .map(i => ({ name: i.name, description: i.description }));
      const res = await generatePatientTimeline({
        profile: {
          name: profile.name,
          age: parseInt(profile.age),
          sex: profile.sex,
          height: profile.heightFt ? `${profile.heightFt}'${profile.heightIn}"` : undefined,
          weight: profile.weightLbs ? `${profile.weightLbs} lbs` : undefined,
          bmi: bmi || undefined,
          ethnicity: profile.ethnicity || undefined,
          smoker: profile.smoker,
          familyHistory: profile.familyHistory || undefined,
        },
        medicalHistory: medicalHistory || '',
        interventions: selectedInterventions,
      });
      setTimeline(res.timeline);
    } catch (err) {
      setError(String(err));
    } finally {
      setReloading(false);
    }
  }

  function toggleIntervention(id: string) {
    setActiveInterventions(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const pastEvents = timeline?.filter(e => e.type === 'past') ?? [];
  const presentEvent = timeline?.find(e => e.type === 'present');
  const futureEvents = timeline?.filter(e => e.type === 'predicted' || e.type === 'warning' || e.type === 'intervention') ?? [];
  const avoidsCount = futureEvents.filter(e => e.avoided).length;

  return (
    <div className="individual-page">
      {/* LEFT: Patient Profile Form */}
      <div className="patient-form-panel">
        <div className="patient-form-header">
          <div>
            <h2 className="patient-form-title">Patient Profile</h2>
            <p className="patient-form-subtitle">Enter demographics & medical history to generate an AI-powered health timeline</p>
          </div>
          <button className="btn-mock" onClick={loadMockPatient} title="Load demo patient">
            ⚡ Demo
          </button>
        </div>

        <div className="form-section">
          <div className="form-label">BASIC INFORMATION</div>
          <div className="form-grid-2">
            <div className="form-field">
              <label className="field-label">Full Name</label>
              <input className="field-input" placeholder="e.g. John Smith" value={profile.name}
                onChange={e => setProfile(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="form-field">
              <label className="field-label">Age</label>
              <input className="field-input" type="number" min={1} max={120} placeholder="e.g. 52"
                value={profile.age} onChange={e => setProfile(p => ({ ...p, age: e.target.value }))} />
            </div>
          </div>

          <div className="form-field">
            <label className="field-label">Biological Sex</label>
            <div className="sex-pills">
              {(['male', 'female', 'other'] as const).map(s => (
                <button key={s} className={`sex-pill${profile.sex === s ? ' active' : ''}`}
                  onClick={() => setProfile(p => ({ ...p, sex: s }))}>
                  {s === 'male' ? '♂ Male' : s === 'female' ? '♀ Female' : '⊕ Other'}
                </button>
              ))}
            </div>
          </div>

          <div className="form-grid-3">
            <div className="form-field">
              <label className="field-label">Height (ft)</label>
              <input className="field-input" type="number" min={3} max={8} placeholder="5"
                value={profile.heightFt} onChange={e => setProfile(p => ({ ...p, heightFt: e.target.value }))} />
            </div>
            <div className="form-field">
              <label className="field-label">Height (in)</label>
              <input className="field-input" type="number" min={0} max={11} placeholder="11"
                value={profile.heightIn} onChange={e => setProfile(p => ({ ...p, heightIn: e.target.value }))} />
            </div>
            <div className="form-field">
              <label className="field-label">Weight (lbs)</label>
              <input className="field-input" type="number" min={50} max={600} placeholder="180"
                value={profile.weightLbs} onChange={e => setProfile(p => ({ ...p, weightLbs: e.target.value }))} />
            </div>
          </div>

          {calcBMI() && (
            <div className="bmi-badge">
              BMI: <strong>{calcBMI()}</strong>
              <span className={`bmi-label ${parseFloat(calcBMI()) >= 30 ? 'bmi-obese' : parseFloat(calcBMI()) >= 25 ? 'bmi-overweight' : 'bmi-normal'}`}>
                {parseFloat(calcBMI()) >= 30 ? 'Obese' : parseFloat(calcBMI()) >= 25 ? 'Overweight' : 'Normal'}
              </span>
            </div>
          )}

          <div className="form-field">
            <label className="field-label">Ethnicity</label>
            <input className="field-input" placeholder="e.g. African American"
              value={profile.ethnicity} onChange={e => setProfile(p => ({ ...p, ethnicity: e.target.value }))} />
          </div>

          <label className="smoker-toggle">
            <input type="checkbox" checked={profile.smoker}
              onChange={e => setProfile(p => ({ ...p, smoker: e.target.checked }))} />
            <span className={`smoker-box${profile.smoker ? ' active' : ''}`}>{profile.smoker ? '✓' : ''}</span>
            🚬 Current smoker
          </label>

          <div className="form-field">
            <label className="field-label">Family History</label>
            <textarea className="field-input field-textarea" rows={2}
              placeholder="e.g. Father had Type 2 diabetes, Mother has hypertension..."
              value={profile.familyHistory}
              onChange={e => setProfile(p => ({ ...p, familyHistory: e.target.value }))} />
          </div>
        </div>

        <div className="form-section">
          <div className="form-label">MEDICAL RECORDS</div>

          <div className="upload-zone" onClick={() => fileInputRef.current?.click()}>
            <div className="upload-icon">📋</div>
            <div className="upload-text">Upload Medical Records (PDF)</div>
            <div className="upload-sub">or click to select file — text will be extracted</div>
            <input ref={fileInputRef} type="file" accept=".pdf,.txt" style={{ display: 'none' }}
              onChange={e => {
                const file = e.target.files?.[0];
                if (!file) return;
                // For demo: if txt, read it; if PDF show placeholder
                if (file.name.endsWith('.txt')) {
                  const reader = new FileReader();
                  reader.onload = ev => setMedicalHistory(ev.target?.result as string ?? '');
                  reader.readAsText(file);
                } else {
                  setMedicalHistory(`[PDF uploaded: ${file.name}]\nMedical records content would be extracted here.`);
                }
              }} />
          </div>

          <div className="form-field" style={{ marginTop: 8 }}>
            <label className="field-label">Or paste / type medical history</label>
            <textarea className="field-input field-textarea field-textarea-tall"
              placeholder="Paste clinical notes, diagnoses, medications, lab results..."
              value={medicalHistory}
              onChange={e => setMedicalHistory(e.target.value)} />
          </div>
        </div>

        {error && <div className="timeline-error">{error}</div>}

        <button className="btn-generate" onClick={handleGenerate} disabled={loading}>
          {loading ? (
            <><div className="btn-spinner" /> Analyzing with Claude AI...</>
          ) : (
            <>✦ Generate Health Timeline</>
          )}
        </button>
      </div>

      {/* RIGHT: Timeline */}
      <div className="timeline-panel">
        {!timeline && !loading && (
          <div className="timeline-empty">
            <div className="timeline-empty-icon">⏱</div>
            <div className="timeline-empty-title">Your patient timeline will appear here</div>
            <div className="timeline-empty-sub">Fill in the patient profile and click "Generate Health Timeline" — Claude AI will analyze the records and project a personalized chronological timeline with future predictions.</div>
            <button className="btn-mock-large" onClick={loadMockPatient}>
              ⚡ Load Demo Patient & Generate
            </button>
          </div>
        )}

        {loading && (
          <div className="timeline-loading">
            <div className="loading-orb" />
            <div className="loading-title">Analyzing patient data...</div>
            <div className="loading-sub">Claude AI is reading the medical records and building a personalized timeline</div>
          </div>
        )}

        {timeline && (
          <>
            <div className="timeline-header">
              <div>
                <h2 className="timeline-patient-name">{profile.name}'s Health Timeline</h2>
                <p className="timeline-patient-meta">
                  {profile.age}yo · {profile.sex} · BMI {calcBMI() || '—'}
                  {avoidsCount > 0 && (
                    <span className="avoided-badge">✓ {avoidsCount} outcome{avoidsCount > 1 ? 's' : ''} improved by interventions</span>
                  )}
                </p>
              </div>
            </div>

            {/* Interventions Panel */}
            <div className="intervention-strip">
              <div className="intervention-strip-label">APPLY INTERVENTIONS</div>
              <div className="intervention-chips">
                {INTERVENTIONS.map(intv => (
                  <button key={intv.id}
                    className={`intervention-chip${activeInterventions.has(intv.id) ? ' active' : ''}`}
                    onClick={() => toggleIntervention(intv.id)}
                    title={intv.description}>
                    {activeInterventions.has(intv.id) ? '✓ ' : ''}{intv.name}
                  </button>
                ))}
              </div>
              {activeInterventions.size > 0 && (
                <button className="btn-reevaluate" onClick={handleApplyInterventions} disabled={reloading}>
                  {reloading ? <><div className="btn-spinner btn-spinner-sm" /> Re-evaluating...</> : `↺ Re-evaluate with ${activeInterventions.size} intervention${activeInterventions.size > 1 ? 's' : ''}`}
                </button>
              )}
            </div>

            {/* The actual timeline */}
            <div className="timeline-scroll">
              <div className="timeline-track">

                {/* PAST */}
                {pastEvents.length > 0 && (
                  <div className="timeline-era-label">PAST HISTORY</div>
                )}
                {pastEvents.map((ev, i) => (
                  <TimelineCard key={`past-${i}`} event={ev} />
                ))}

                {/* PRESENT */}
                {presentEvent && (
                  <>
                    <div className="timeline-era-label timeline-now-label">NOW — AGE {presentEvent.age}</div>
                    <TimelineCard event={presentEvent} />
                  </>
                )}

                {/* FUTURE */}
                {futureEvents.length > 0 && (
                  <div className="timeline-era-label timeline-future-label">PROJECTED FUTURE</div>
                )}
                {futureEvents.map((ev, i) => (
                  <TimelineCard key={`future-${i}`} event={ev} />
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function TimelineCard({ event: ev }: { event: TimelineEvent }) {
  const cfg = TYPE_CONFIG[ev.type] ?? TYPE_CONFIG.past;
  return (
    <div className={`timeline-card${ev.avoided ? ' timeline-card-avoided' : ''}`}
      style={{ borderColor: cfg.border, background: cfg.bg }}>
      <div className="timeline-card-side">
        <div className="timeline-dot" style={{ background: cfg.dot, boxShadow: `0 0 8px ${cfg.dot}80` }} />
        <div className="timeline-line" />
      </div>
      <div className="timeline-card-body">
        <div className="timeline-card-meta">
          <span className="timeline-age" style={{ color: cfg.color }}>Age {ev.age}</span>
          <span className="timeline-year">{ev.year}</span>
          <span className="timeline-type-badge" style={{ color: cfg.color, borderColor: cfg.border }}>{cfg.label}</span>
          <span className="timeline-category-icon" title={ev.category}>{CATEGORY_ICON[ev.category] ?? '📌'}</span>
          <span className="timeline-severity" title={`Severity: ${ev.severity}`}>{SEVERITY_ICON[ev.severity]}</span>
        </div>
        <div className={`timeline-card-title${ev.avoided ? ' timeline-title-avoided' : ''}`} style={ ev.avoided ? {} : { color: cfg.color === '#6B7A99' ? 'var(--text-primary)' : cfg.color }}>
          {ev.avoided && <span className="avoided-strike">⟶ </span>}
          {ev.title}
          {ev.avoided && <span className="avoided-tag"> AVOIDED</span>}
        </div>
        <div className="timeline-card-desc">{ev.description}</div>
      </div>
    </div>
  );
}
