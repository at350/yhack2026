import type { CountyRecord } from '../../types';
import { HEALTH_METRIC_LABELS, HEALTH_METRIC_UNITS } from '../../types';
import { useStore } from '../../store/useStore';

interface Props {
  county: CountyRecord;
  onClose: () => void;
}

const METRICS = ['obesity', 'smoking', 'diabetes', 'physicalInactivity', 'mentalHealth', 'heartDisease', 'copd', 'checkups'];

export default function CountyModal({ county, onClose }: Props) {
  const { patientContext, selectedMetric } = useStore();
  const isMatchedCounty = patientContext?.matchedCountyFips === county.fips;
  const selectedMetricLabel = HEALTH_METRIC_LABELS[selectedMetric] ?? selectedMetric;
  const summaryCopy = isMatchedCounty
    ? 'This county is the patient anchor. Use it as the baseline for local burden and community conditions when comparing other counties.'
    : `Use this county to compare ${selectedMetricLabel.toLowerCase()} and community conditions against the patient anchor or a nearby peer.`;

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal fade-in">
        <div className="modal-header">
          <div className="modal-header-copy">
            <h2 style={{ fontSize: 20, marginBottom: 4 }}>{county.name}</h2>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              {county.stateName} · Pop. {county.population.toLocaleString()}
            </div>
            <div className="modal-header-tags">
              <span className={`modal-context-chip${isMatchedCounty ? ' active' : ''}`}>
                {isMatchedCounty ? 'Patient anchor county' : 'Comparison county'}
              </span>
              <span className="modal-context-chip">{selectedMetricLabel} in focus</span>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-context-summary">
          {summaryCopy}
        </div>

        {/* Health Indicators */}
        <div className="section-label" style={{ marginBottom: 12 }}>Health Indicators</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          {METRICS.map(m => {
            const val = (county.health as Record<string, number>)[m];
            const unit = HEALTH_METRIC_UNITS[m] ?? '%';
            const pctRange = m === 'checkups' ? [10, 70] : m === 'mortalityRate' ? [3000, 20000] : m === 'heartDisease' ? [25, 60] : [5, 50];
            const pct = ((val - Number(pctRange[0])) / (Number(pctRange[1]) - Number(pctRange[0]))) * 100;
            return (
              <div key={m} className="impact-bar-row">
                <span className="impact-bar-label">{HEALTH_METRIC_LABELS[m]}</span>
                <div className="impact-bar-track">
                  <div
                    className={`impact-bar-fill ${m === 'checkups' ? 'bar-positive' : 'bar-negative'}`}
                    style={{ width: `${Math.max(4, Math.min(100, pct))}%` }}
                  />
                </div>
                <span className="impact-bar-val">
                  {val.toFixed(1)}{unit}
                </span>
              </div>
            );
          })}
        </div>

        {/* Demographics */}
        <div className="section-label" style={{ marginBottom: 12 }}>Demographics & Vulnerability</div>
        <div className="metrics-grid" style={{ marginBottom: 20 }}>
          <div className="metric-tile">
            <div className="metric-tile-value">{county.demographics.pctPoverty}%</div>
            <div className="metric-tile-label">Below Poverty Line</div>
          </div>
          <div className="metric-tile">
            <div className="metric-tile-value">{county.demographics.pctUninsured}%</div>
            <div className="metric-tile-label">Uninsured</div>
          </div>
          <div className="metric-tile">
            <div className="metric-tile-value">{county.demographics.pctElderly}%</div>
            <div className="metric-tile-label">Age 65+</div>
          </div>
          <div className="metric-tile">
            <div className="metric-tile-value" style={{ color: 'var(--accent-purple)' }}>
              {county.svi.overall.toFixed(3)}
            </div>
            <div className="metric-tile-label">SVI Score</div>
          </div>
          <div className="metric-tile">
            <div className="metric-tile-value">{county.environment.aqiPM25}</div>
            <div className="metric-tile-label">PM₂.₅ AQI</div>
          </div>
          <div className="metric-tile">
            <div className="metric-tile-value">{county.environment.aqiO3.toFixed(1)}</div>
            <div className="metric-tile-label">Avg Unhealthy Days</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
