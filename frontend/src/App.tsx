import { useEffect } from 'react';
import { useStore } from './store/useStore';
import type { CountyRecord, TabId } from './types';
import USMap from './components/Map/USMap';
import MapPage from './pages/MapPage';
import IndividualPage from './pages/IndividualPage';

const STATE_ABBREV: Record<string, string> = {
  'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR',
  'California': 'CA', 'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE',
  'Florida': 'FL', 'Georgia': 'GA', 'Hawaii': 'HI', 'Idaho': 'ID',
  'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA', 'Kansas': 'KS',
  'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
  'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS',
  'Missouri': 'MO', 'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV',
  'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY',
  'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH', 'Oklahoma': 'OK',
  'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
  'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT',
  'Vermont': 'VT', 'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV',
  'Wisconsin': 'WI', 'Wyoming': 'WY', 'District of Columbia': 'DC',
};

const CT_LEGACY_COUNTY_TO_PLANNING_REGIONS: Record<string, string[]> = {
  '09001': ['09120', '09190'],
  '09003': ['09110'],
  '09005': ['09160'],
  '09007': ['09130'],
  '09009': ['09140', '09170'],
  '09011': ['09180'],
  '09013': ['09110'],
  '09015': ['09150'],
};

function safeNum(val: unknown): number {
  if (typeof val === 'number' && !isNaN(val)) return val;
  return 0;
}

// Returns null for missing/zero race-stratified values (0 is nonsensical for LE/income)
function safeN(val: unknown): number | null {
  if (typeof val === 'number' && !isNaN(val) && val > 0) return val;
  return null;
}

function preferMetric(primary: number, fallback: number): number {
  return primary > 0 ? primary : fallback;
}

function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function transformCounty(raw: Record<string, unknown>): CountyRecord {
  const g = (category: string, field: string): number =>
    safeNum((raw[category] as Record<string, unknown>)?.[field]);
  const gn = (category: string, field: string): number | null =>
    safeN((raw[category] as Record<string, unknown>)?.[field]);

  const pctPoverty      = g('Children in Poverty', '% Children in Poverty');
  const pctUninsured    = g('Uninsured', '% Uninsured');
  const pctElderly      = g('% 65 and Older', '% 65 and Over');
  const pctBlack        = g('% Non-Hispanic Black', '% Non-Hispanic Black');
  const pctHispanic     = g('% Hispanic', '% Hispanic');
  const pctWhite        = g('% Non-Hispanic White', '% Non-Hispanic White');
  const pctRural        = g('% Rural', '% Rural');
  const pctUnemployed   = g('Unemployment', '% Unemployed');
  const pctSingleParent = g('Children in Single-Parent Households', '% Children in Single-Parent Households');
  const pctHousingProb  = g('Severe Housing Problems', '% Severe Housing Problems');

  const sviSocioeconomic    = Math.min(1, (pctPoverty / 30 + pctUnemployed / 15) / 2);
  const sviHouseholdComp    = Math.min(1, (pctSingleParent / 50 + pctPoverty / 40) / 2);
  const sviMinority         = Math.min(1, (pctBlack + pctHispanic) / 100);
  const sviHousingTransport = Math.min(1, pctHousingProb / 40);
  const sviOverall = (sviSocioeconomic + sviHouseholdComp + sviMinority + sviHousingTransport) / 4;

  return {
    fips:      raw.fips as string,
    name:      raw.county as string,
    state:     STATE_ABBREV[raw.state as string] ?? (raw.state as string).slice(0, 2).toUpperCase(),
    stateName: raw.state as string,
    population: g('Population', 'Population'),
    isUrban: pctRural < 20,
    demographics: { pctPoverty, pctUninsured, pctElderly, pctBlack, pctHispanic, pctWhite },
    health: {
      obesity:            g('Adult Obesity', '% Adults with Obesity'),
      smoking:            g('Adult Smoking', '% Adults Reporting Currently Smoking'),
      diabetes:           g('Diabetes Prevalence', '% Adults with Diabetes'),
      physicalInactivity: g('Physical Inactivity', '% Physically Inactive'),
      mentalHealth:       g('Frequent Mental Distress', '% Frequent Mental Distress'),
      heartDisease:       g('Insufficient Sleep', '% Insufficient Sleep'),
      copd:               g('Excessive Drinking', '% Excessive Drinking'),
      checkups:           g('Flu Vaccinations', '% Vaccinated'),
      mortalityRate:      g('Premature Death', 'Years of Potential Life Lost Rate'),
    },
    environment: {
      aqiPM25: g('Air Pollution: Particulate Matter', 'Average Daily PM2.5'),
      aqiO3:   g('Poor Physical Health Days', 'Average Number of Physically Unhealthy Days'),
    },
    svi: {
      overall:          sviOverall,
      socioeconomic:    sviSocioeconomic,
      householdComp:    sviHouseholdComp,
      minority:         sviMinority,
      housingTransport: sviHousingTransport,
    },
    raceData: {
      // Health Outcomes
      lifeExpOverall:       gn('Life Expectancy', 'Life Expectancy'),
      lifeExpBlack:         gn('Life Expectancy', 'Life Expectancy (Non-Hispanic Black)'),
      lifeExpWhite:         gn('Life Expectancy', 'Life Expectancy (Non-Hispanic White)'),
      lifeExpHispanic:      gn('Life Expectancy', 'Life Expectancy (Hispanic (all races))'),
      lifeExpAsian:         gn('Life Expectancy', 'Life Expectancy (Non-Hispanic Asian)'),
      ypllOverall:          gn('Premature Death', 'Years of Potential Life Lost Rate'),
      ypllBlack:            gn('Premature Death', 'YPLL Rate (Non-Hispanic Black)'),
      ypllWhite:            gn('Premature Death', 'YPLL Rate (Non-Hispanic White)'),
      ypllHispanic:         gn('Premature Death', 'YPLL Rate (Hispanic (all races))'),
      // Economic Equity
      incomeOverall:        gn('Median Household Income', 'Median Household Income'),
      incomeBlack:          gn('Median Household Income', 'Household Income (Black)'),
      incomeWhite:          gn('Median Household Income', 'Household Income (White)'),
      incomeHispanic:       gn('Median Household Income', 'Household Income (Hispanic)'),
      incomeAsian:          gn('Median Household Income', 'Household Income (Asian)'),
      childPovertyOverall:  gn('Children in Poverty', '% Children in Poverty'),
      childPovertyBlack:    gn('Children in Poverty', '% Children in Poverty (Black)'),
      childPovertyWhite:    gn('Children in Poverty', '% Children in Poverty (White)'),
      childPovertyHispanic: gn('Children in Poverty', '% Children in Poverty (Hispanic)'),
      // Healthcare Access
      fluVaxOverall:        gn('Flu Vaccinations', '% Vaccinated'),
      fluVaxBlack:          gn('Flu Vaccinations', '% Vaccinated (Black)'),
      fluVaxWhite:          gn('Flu Vaccinations', '% Vaccinated (White)'),
      fluVaxHispanic:       gn('Flu Vaccinations', '% Vaccinated (Hispanic)'),
      fluVaxAsian:          gn('Flu Vaccinations', '% Vaccinated (Asian)'),
      prevHospOverall:      gn('Preventable Hospital Stays', 'Preventable Hospitalization Rate'),
      prevHospBlack:        gn('Preventable Hospital Stays', 'Preventable Hosp. Rate (Black)'),
      prevHospWhite:        gn('Preventable Hospital Stays', 'Preventable Hosp. Rate (White)'),
    },
  };
}

function aggregateCountyRecords(records: CountyRecord[]): CountyRecord {
  if (records.length === 0) {
    throw new Error('Cannot aggregate zero county records');
  }

  const totalPopulation = records.reduce((sum, record) => sum + record.population, 0);
  const weighted = (selector: (record: CountyRecord) => number): number => {
    if (totalPopulation <= 0) {
      return selector(records[0]);
    }
    return records.reduce((sum, record) => sum + selector(record) * record.population, 0) / totalPopulation;
  };

  const first = records[0];
  return {
    ...first,
    population: totalPopulation,
    isUrban: weighted(record => record.isUrban ? 0 : 1) < 0.5,
    demographics: {
      pctPoverty: roundTo(weighted(record => record.demographics.pctPoverty), 1),
      pctUninsured: roundTo(weighted(record => record.demographics.pctUninsured), 1),
      pctElderly: roundTo(weighted(record => record.demographics.pctElderly), 1),
      pctBlack: roundTo(weighted(record => record.demographics.pctBlack), 1),
      pctHispanic: roundTo(weighted(record => record.demographics.pctHispanic), 1),
      pctWhite: roundTo(weighted(record => record.demographics.pctWhite), 1),
    },
    health: {
      obesity: roundTo(weighted(record => record.health.obesity), 1),
      smoking: roundTo(weighted(record => record.health.smoking), 1),
      diabetes: roundTo(weighted(record => record.health.diabetes), 1),
      physicalInactivity: roundTo(weighted(record => record.health.physicalInactivity), 1),
      mentalHealth: roundTo(weighted(record => record.health.mentalHealth), 1),
      heartDisease: roundTo(weighted(record => record.health.heartDisease), 1),
      copd: roundTo(weighted(record => record.health.copd), 1),
      checkups: roundTo(weighted(record => record.health.checkups), 1),
      mortalityRate: roundTo(weighted(record => record.health.mortalityRate), 0),
    },
    environment: {
      aqiPM25: roundTo(weighted(record => record.environment.aqiPM25), 1),
      aqiO3: roundTo(weighted(record => record.environment.aqiO3), 1),
    },
    svi: {
      overall: roundTo(weighted(record => record.svi.overall), 3),
      socioeconomic: roundTo(weighted(record => record.svi.socioeconomic), 3),
      householdComp: roundTo(weighted(record => record.svi.householdComp), 3),
      minority: roundTo(weighted(record => record.svi.minority), 3),
      housingTransport: roundTo(weighted(record => record.svi.housingTransport), 3),
    },
    raceData: first.raceData,
  };
}

function normalizeConnecticutCounties(rawData: Record<string, unknown>[]): CountyRecord[] {
  const transformedByFips = new Map(rawData.map(record => {
    const transformed = transformCounty(record);
    return [transformed.fips, transformed] as const;
  }));

  return Object.entries(CT_LEGACY_COUNTY_TO_PLANNING_REGIONS).map(([legacyFips, regionFips]) => {
    const legacy = transformedByFips.get(legacyFips);
    if (!legacy) {
      throw new Error(`Missing Connecticut legacy county record for ${legacyFips}`);
    }

    const planningRegions = regionFips
      .map(fips => transformedByFips.get(fips))
      .filter((record): record is CountyRecord => Boolean(record));

    const fallback = planningRegions.length > 0 ? aggregateCountyRecords(planningRegions) : legacy;

    return {
      ...legacy,
      population: roundTo(preferMetric(legacy.population, fallback.population), 0),
      isUrban: legacy.population > 0 ? legacy.isUrban : fallback.isUrban,
      demographics: {
        pctPoverty: roundTo(preferMetric(legacy.demographics.pctPoverty, fallback.demographics.pctPoverty), 1),
        pctUninsured: roundTo(preferMetric(legacy.demographics.pctUninsured, fallback.demographics.pctUninsured), 1),
        pctElderly: roundTo(preferMetric(legacy.demographics.pctElderly, fallback.demographics.pctElderly), 1),
        pctBlack: roundTo(preferMetric(legacy.demographics.pctBlack, fallback.demographics.pctBlack), 1),
        pctHispanic: roundTo(preferMetric(legacy.demographics.pctHispanic, fallback.demographics.pctHispanic), 1),
        pctWhite: roundTo(preferMetric(legacy.demographics.pctWhite, fallback.demographics.pctWhite), 1),
      },
      health: {
        obesity: roundTo(preferMetric(legacy.health.obesity, fallback.health.obesity), 1),
        smoking: roundTo(preferMetric(legacy.health.smoking, fallback.health.smoking), 1),
        diabetes: roundTo(preferMetric(legacy.health.diabetes, fallback.health.diabetes), 1),
        physicalInactivity: roundTo(preferMetric(legacy.health.physicalInactivity, fallback.health.physicalInactivity), 1),
        mentalHealth: roundTo(preferMetric(legacy.health.mentalHealth, fallback.health.mentalHealth), 1),
        heartDisease: roundTo(preferMetric(legacy.health.heartDisease, fallback.health.heartDisease), 1),
        copd: roundTo(preferMetric(legacy.health.copd, fallback.health.copd), 1),
        checkups: roundTo(preferMetric(legacy.health.checkups, fallback.health.checkups), 1),
        mortalityRate: roundTo(preferMetric(legacy.health.mortalityRate, fallback.health.mortalityRate), 0),
      },
      environment: {
        aqiPM25: roundTo(preferMetric(legacy.environment.aqiPM25, fallback.environment.aqiPM25), 1),
        aqiO3: roundTo(preferMetric(legacy.environment.aqiO3, fallback.environment.aqiO3), 1),
      },
      svi: {
        overall: roundTo(fallback.svi.overall, 3),
        socioeconomic: roundTo(fallback.svi.socioeconomic, 3),
        householdComp: roundTo(fallback.svi.householdComp, 3),
        minority: roundTo(fallback.svi.minority, 3),
        housingTransport: roundTo(fallback.svi.housingTransport, 3),
      },
      raceData: legacy.raceData,
    };
  });
}

const TABS: { id: TabId; label: string; icon: string; navIcon: string }[] = [
  { id: 'individual', label: 'Individual Context', icon: '👤', navIcon: '👤' },
  { id: 'map', label: 'Population Context', icon: '🗺️', navIcon: '🗺️' },
];

export default function App() {
  const { activeTab, setActiveTab, setCounties } = useStore();

  // Load static data on mount
  useEffect(() => {
    fetch('/data/county_health_data_full.json')
      .then(r => r.json())
      .then((data: Record<string, unknown>[]) => {
        const nonConnecticutCounties = data
          .filter(record => record.state !== 'Connecticut')
          .map(transformCounty);
        const connecticutCounties = normalizeConnecticutCounties(
          data.filter(record => record.state === 'Connecticut')
        );
        setCounties([...nonConnecticutCounties, ...connecticutCounties]);
      })
      .catch(console.error);
  }, [setCounties]);

  return (
    <>
      <div className="texture-overlay" />
      <div className="app-shell">
      {/* Header */}
      <header className="app-header">
        <div className="header-left">
          <a className="logo" href="#" style={{ letterSpacing: '-0.02em', fontSize: 20 }}>
            <img className="logo-icon" src="/prophis-logo.png" alt="Prophis Home" />
            <span style={{ fontWeight: 800 }}>
              PR<span style={{ color: 'var(--text-primary)' }}>OPHIS</span>
            </span>
          </a>
          <div className="header-divider" />
          <div className="header-breadcrumb">
            <span className="breadcrumb-icon">{TABS.find(t => t.id === activeTab)?.icon}</span>
            {TABS.find(t => t.id === activeTab)?.label}
          </div>
        </div>



        <div className="header-right">
          <div className="status-badge">
            <div className="status-dot" />
            <span>3,142 counties</span>
          </div>
        </div>
      </header>

      {/* Side Nav */}
      <nav className="side-nav">
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`nav-icon-btn${activeTab === tab.id ? ' active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
            title={tab.label}
          >
            {tab.navIcon}
          </button>
        ))}
      </nav>

        {/* Global Background Map */}
        <div className={`global-map-layer ${activeTab !== 'map' ? 'map-dimmed' : ''}`}>
          <USMap />
        </div>

        {/* Page Content Layers */}
        {activeTab === 'map' && <MapPage />}
        {activeTab === 'individual' && <div className="page-full-flush"><IndividualPage /></div>}
      </div>
    </>
  );
}
