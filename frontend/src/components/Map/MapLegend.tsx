import * as d3 from 'd3';
import type { MapMode } from '../../types';
import { HEALTH_METRIC_LABELS } from '../../types';

interface Props {
  colorScale: d3.ScaleSequential<string, never> | d3.ScaleDiverging<string, never>;
  selectedMetric: string;
  mapMode: MapMode;
}

function formatLegendValue(value: number) {
  if (Math.abs(value) >= 100) return Math.round(value).toLocaleString();
  if (Math.abs(value) >= 10) return value.toFixed(1);
  if (Math.abs(value) >= 1) return value.toFixed(1);
  return value.toFixed(2);
}

export default function MapLegend({ colorScale, selectedMetric, mapMode }: Props) {
  const legendMeta = mapMode === 'vulnerability'
    ? {
      title: 'Social Vulnerability Index',
      caption: 'Use this view to find counties with less capacity to absorb shocks or service gaps.',
      lowLabel: 'Lower vulnerability',
      highLabel: 'Higher vulnerability',
    }
    : mapMode === 'equity'
      ? {
        title: 'Poverty Rate',
        caption: `Use this alongside ${HEALTH_METRIC_LABELS[selectedMetric] ?? selectedMetric} to compare health burden against economic strain.`,
        lowLabel: 'Lower poverty',
        highLabel: 'Higher poverty',
      }
      : {
        title: HEALTH_METRIC_LABELS[selectedMetric] ?? selectedMetric,
        caption: 'Read the selected health metric directly by county.',
        lowLabel: 'Lower burden',
        highLabel: 'Higher burden',
      };

  const domain = colorScale.domain();
  const lo = domain[0];
  const hi = domain[domain.length - 1];

  // Generate gradient stops
  const stops = d3.range(0, 1.01, 0.05).map(t => ({
    offset: `${t * 100}%`,
    color: colorScale(lo + (hi - lo) * t),
  }));

  const gradId = 'legend-gradient';

  return (
    <div className="map-legend">
      <svg width="0" height="0">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="0">
            {stops.map((s, i) => (
              <stop key={i} offset={s.offset} stopColor={s.color} />
            ))}
          </linearGradient>
        </defs>
      </svg>

      <div className="map-legend-copy">
        <div className="map-legend-title">{legendMeta.title}</div>
        <div className="map-legend-caption">{legendMeta.caption}</div>
      </div>

      <div className="legend-scale">
        <div className="legend-bar" style={{ background: `url(#${gradId})` }}>
          <svg width="100%" height="10" viewBox="0 0 240 10" preserveAspectRatio="none">
            <rect width="240" height="10" fill={`url(#${gradId})`} />
          </svg>
        </div>
        <div className="legend-labels">
          <span className="legend-label-group">
            <small>{legendMeta.lowLabel}</small>
            <strong>{formatLegendValue(lo)}</strong>
          </span>
          {domain.length === 3 && (
            <span className="legend-label-group legend-label-group-center">
              <small>Midpoint</small>
              <strong>{formatLegendValue(Number(domain[1]))}</strong>
            </span>
          )}
          <span className="legend-label-group legend-label-group-end">
            <small>{legendMeta.highLabel}</small>
            <strong>{formatLegendValue(hi)}</strong>
          </span>
        </div>
      </div>
    </div>
  );
}
