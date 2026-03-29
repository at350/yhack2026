import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load county data (shared across routes)
let _countyData: CountyRecord[] | null = null;

export interface CountyRecord {
  fips: string;
  name: string;
  state: string;
  stateName: string;
  population: number;
  isUrban: boolean;
  demographics: {
    pctPoverty: number;
    pctUninsured: number;
    pctElderly: number;
    pctBlack: number;
    pctHispanic: number;
    pctWhite: number;
  };
  health: {
    obesity: number;
    smoking: number;
    diabetes: number;
    physicalInactivity: number;
    mentalHealth: number;
    heartDisease: number; // mapped from Insufficient Sleep %
    copd: number;         // mapped from Excessive Drinking %
    checkups: number;     // mapped from Flu Vaccinations %
    mortalityRate: number; // mapped from YPLL Rate
  };
  environment: {
    aqiPM25: number;
    aqiO3: number; // mapped from avg physically unhealthy days
  };
  svi: {
    overall: number;
    socioeconomic: number;
    householdComp: number;
    minority: number;
    housingTransport: number;
  };
}

// State name → abbreviation lookup
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

// Connecticut's source file contains two incompatible geographies:
// legacy counties (09001–09015), which match the map geometry but miss several fields,
// and newer planning regions (09110–09190), which have the full metric set.
// Keep the legacy county FIPS so the county borders remain unchanged on the map,
// and backfill missing values from the closest planning-region geography.
const CT_LEGACY_COUNTY_TO_PLANNING_REGIONS: Record<string, string[]> = {
  '09001': ['09120', '09190'], // Fairfield
  '09003': ['09110'],          // Hartford
  '09005': ['09160'],          // Litchfield
  '09007': ['09130'],          // Middlesex
  '09009': ['09140', '09170'], // New Haven
  '09011': ['09180'],          // New London
  '09013': ['09110'],          // Tolland
  '09015': ['09150'],          // Windham
};

function safeNum(val: unknown): number {
  if (typeof val === 'number' && !isNaN(val)) return val;
  return 0;
}

function preferMetric(primary: number, fallback: number): number {
  return primary > 0 ? primary : fallback;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transformCounty(raw: any): CountyRecord {
  const g = (category: string, field: string): number =>
    safeNum((raw[category] as Record<string, unknown>)?.[field]);

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

  // Compute SVI-like composite scores (0-1 normalized)
  const sviSocioeconomic    = Math.min(1, (pctPoverty / 30 + pctUnemployed / 15) / 2);
  const sviHouseholdComp    = Math.min(1, (pctSingleParent / 50 + pctPoverty / 40) / 2);
  const sviMinority         = Math.min(1, (pctBlack + pctHispanic) / 100);
  const sviHousingTransport = Math.min(1, pctHousingProb / 40);
  const sviOverall = (sviSocioeconomic + sviHouseholdComp + sviMinority + sviHousingTransport) / 4;

  return {
    fips:      raw.fips,
    name:      raw.county,
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
    return records.reduce(
      (sum, record) => sum + selector(record) * record.population,
      0
    ) / totalPopulation;
  };

  return {
    ...records[0],
    population: totalPopulation,
    isUrban: weighted(record => record.isUrban ? 0 : 1) < 0.5,
    demographics: {
      pctPoverty: weighted(record => record.demographics.pctPoverty),
      pctUninsured: weighted(record => record.demographics.pctUninsured),
      pctElderly: weighted(record => record.demographics.pctElderly),
      pctBlack: weighted(record => record.demographics.pctBlack),
      pctHispanic: weighted(record => record.demographics.pctHispanic),
      pctWhite: weighted(record => record.demographics.pctWhite),
    },
    health: {
      obesity: weighted(record => record.health.obesity),
      smoking: weighted(record => record.health.smoking),
      diabetes: weighted(record => record.health.diabetes),
      physicalInactivity: weighted(record => record.health.physicalInactivity),
      mentalHealth: weighted(record => record.health.mentalHealth),
      heartDisease: weighted(record => record.health.heartDisease),
      copd: weighted(record => record.health.copd),
      checkups: weighted(record => record.health.checkups),
      mortalityRate: weighted(record => record.health.mortalityRate),
    },
    environment: {
      aqiPM25: weighted(record => record.environment.aqiPM25),
      aqiO3: weighted(record => record.environment.aqiO3),
    },
    svi: {
      overall: weighted(record => record.svi.overall),
      socioeconomic: weighted(record => record.svi.socioeconomic),
      householdComp: weighted(record => record.svi.householdComp),
      minority: weighted(record => record.svi.minority),
      housingTransport: weighted(record => record.svi.housingTransport),
    },
  };
}

function normalizeConnecticutCounties(raw: any[]): CountyRecord[] {
  const transformedByFips = new Map(raw.map(record => {
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
      population: preferMetric(legacy.population, fallback.population),
      isUrban: legacy.population > 0 ? legacy.isUrban : fallback.isUrban,
      demographics: {
        pctPoverty: preferMetric(legacy.demographics.pctPoverty, fallback.demographics.pctPoverty),
        pctUninsured: preferMetric(legacy.demographics.pctUninsured, fallback.demographics.pctUninsured),
        pctElderly: preferMetric(legacy.demographics.pctElderly, fallback.demographics.pctElderly),
        pctBlack: preferMetric(legacy.demographics.pctBlack, fallback.demographics.pctBlack),
        pctHispanic: preferMetric(legacy.demographics.pctHispanic, fallback.demographics.pctHispanic),
        pctWhite: preferMetric(legacy.demographics.pctWhite, fallback.demographics.pctWhite),
      },
      health: {
        obesity: preferMetric(legacy.health.obesity, fallback.health.obesity),
        smoking: preferMetric(legacy.health.smoking, fallback.health.smoking),
        diabetes: preferMetric(legacy.health.diabetes, fallback.health.diabetes),
        physicalInactivity: preferMetric(legacy.health.physicalInactivity, fallback.health.physicalInactivity),
        mentalHealth: preferMetric(legacy.health.mentalHealth, fallback.health.mentalHealth),
        heartDisease: preferMetric(legacy.health.heartDisease, fallback.health.heartDisease),
        copd: preferMetric(legacy.health.copd, fallback.health.copd),
        checkups: preferMetric(legacy.health.checkups, fallback.health.checkups),
        mortalityRate: preferMetric(legacy.health.mortalityRate, fallback.health.mortalityRate),
      },
      environment: {
        aqiPM25: preferMetric(legacy.environment.aqiPM25, fallback.environment.aqiPM25),
        aqiO3: preferMetric(legacy.environment.aqiO3, fallback.environment.aqiO3),
      },
      svi: fallback.svi,
    };
  });
}

export interface Intervention {
  id: string;
  name: string;
  category: string;
  icon: string;
  description: string;
  costPerCapita: number;
  effects: Record<string, number>;
  targetableBy: string[];
  timeHorizon: string;
  evidenceLevel: string;
  qalyWeight: number;
}

let _interventions: Intervention[] | null = null;

function resolveDataPath(filename: string): string {
  // Try multiple locations to handle different cwd contexts
  const candidates = [
    path.resolve(process.cwd(), 'frontend/public/data', filename),
    path.resolve(process.cwd(), '../frontend/public/data', filename),
    path.resolve(__dirname, '../../../frontend/public/data', filename),
    path.resolve(__dirname, '../../frontend/public/data', filename),
  ];
  for (const p of candidates) {
    try { readFileSync(p); return p; } catch { /* try next */ }
  }
  throw new Error(`Cannot find data file: ${filename}. Checked: ${candidates.join(', ')}`);
}

export function getCountyData(): CountyRecord[] {
  if (!_countyData) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw: any[] = JSON.parse(readFileSync(resolveDataPath('county_health_data_full.json'), 'utf-8'));
    const nonConnecticutCounties = raw
      .filter((record: any) => record.state !== 'Connecticut')
      .map(transformCounty);
    const connecticutCounties = normalizeConnecticutCounties(
      raw.filter((record: any) => record.state === 'Connecticut')
    );
    _countyData = [...nonConnecticutCounties, ...connecticutCounties];
  }
  return _countyData!;
}

export function getInterventions(): Intervention[] {
  if (!_interventions) {
    _interventions = JSON.parse(readFileSync(resolveDataPath('interventions.json'), 'utf-8'));
  }
  return _interventions!;
}

export interface InterventionInput {
  id: string;
  budget: number;
  targeting: string; // 'all' | 'low_income' | 'elderly' | 'minority' | 'rural' | 'uninsured'
}

export interface SimulationResult {
  fips: string;
  name: string;
  state: string;
  population: number;
  baseline: Record<string, number>;
  projected: Record<string, number>;
  absoluteChange: Record<string, number>;
  pctChange: Record<string, number>;
  qalysGained: number;
  costPerQaly: number;
  equityScore: number;
  confidenceInterval: { lower: Record<string, number>; upper: Record<string, number> };
}

// Targeting multiplier: how much more effective an intervention is when targeted
const TARGETING_MULTIPLIERS: Record<string, (county: CountyRecord) => number> = {
  all: () => 1.0,
  low_income: (c) => 1.0 + (c.demographics.pctPoverty / 40) * 0.6,
  elderly: (c) => 1.0 + (c.demographics.pctElderly / 30) * 0.5,
  minority: (c) => 1.0 + ((c.demographics.pctBlack + c.demographics.pctHispanic) / 80) * 0.5,
  rural: (c) => c.isUrban ? 0.7 : 1.4,
  uninsured: (c) => 1.0 + (c.demographics.pctUninsured / 30) * 0.6,
};

// QALY weights by health indicator
// heartDisease = Insufficient Sleep %, copd = Excessive Drinking %, checkups = Flu Vaccination %
const QALY_WEIGHTS: Record<string, number> = {
  obesity: 0.04,
  smoking: 0.08,
  diabetes: 0.07,
  physicalInactivity: 0.04,
  mentalHealth: 0.09,
  heartDisease: 0.06, // insufficient sleep
  copd: 0.07,         // excessive drinking
  checkups: -0.03,    // improving flu vaccination is positive
};

// Saturation: diminishing returns function
function saturation(spendPerCapita: number, k = 0.015): number {
  return 1 - Math.exp(-k * spendPerCapita);
}

export function simulateCounty(
  county: CountyRecord,
  interventionInputs: InterventionInput[],
  interventionDefs: Intervention[],
  timeHorizonYears: number
): SimulationResult {
  const defMap = new Map(interventionDefs.map(d => [d.id, d]));
  const baseline = { ...county.health };
  const projected = { ...county.health };

  let totalQalys = 0;
  let totalCost = 0;

  for (const input of interventionInputs) {
    const def = defMap.get(input.id);
    if (!def) continue;

    const spendPerCapita = input.budget / county.population;
    totalCost += input.budget;

    // Targeting multiplier
    const targetKey = input.targeting || 'all';
    const targetMult = (TARGETING_MULTIPLIERS[targetKey] ?? TARGETING_MULTIPLIERS.all)(county);

    // Saturation factor
    const sat = saturation(spendPerCapita);

    // Time horizon scaling
    const timeScale = Math.sqrt(timeHorizonYears / 5); // normalize around 5 years

    for (const [indicator, effectSize] of Object.entries(def.effects)) {
      if (!(indicator in projected)) continue;
      const rawEffect = effectSize * sat * targetMult * timeScale;
      projected[indicator as keyof typeof projected] += rawEffect;

      // Clamp to realistic bounds
      if (indicator === 'checkups') {
        // Flu vaccination: clamp to [5, 90]
        (projected as Record<string, number>)[indicator] = Math.min(90, Math.max(5, projected[indicator as keyof typeof projected] as number));
      } else {
        (projected as Record<string, number>)[indicator] = Math.max(0, projected[indicator as keyof typeof projected] as number);
      }
    }

    // QALY calculation
    for (const [ind, w] of Object.entries(QALY_WEIGHTS)) {
      const delta = def.effects[ind] ?? 0;
      if (delta !== 0) {
        const improvement = Math.abs(delta) * sat * targetMult * timeScale;
        totalQalys += improvement * w * county.population * 0.01; // pct point → proportion
      }
    }
    totalQalys *= def.qalyWeight;
  }

  const absoluteChange: Record<string, number> = {};
  const pctChange: Record<string, number> = {};
  for (const key of Object.keys(baseline)) {
    const b = (baseline as Record<string, number>)[key];
    const p = (projected as Record<string, number>)[key];
    absoluteChange[key] = Math.round((p - b) * 100) / 100;
    pctChange[key] = b !== 0 ? Math.round(((p - b) / b) * 10000) / 100 : 0;
  }

  // Equity score: bonus for targeting high-SVI counties
  const equityScore = Math.round(
    50 + county.svi.overall * 30 + (county.demographics.pctPoverty / 40) * 20
  );

  // Confidence interval: ±15% on projected
  const ci = {
    lower: {} as Record<string, number>,
    upper: {} as Record<string, number>,
  };
  for (const key of Object.keys(projected)) {
    const p = (projected as Record<string, number>)[key];
    ci.lower[key] = Math.round(p * 0.87 * 10) / 10;
    ci.upper[key] = Math.round(p * 1.13 * 10) / 10;
  }

  return {
    fips: county.fips,
    name: county.name,
    state: county.state,
    population: county.population,
    baseline,
    projected,
    absoluteChange,
    pctChange,
    qalysGained: Math.round(totalQalys),
    costPerQaly: totalQalys > 0 ? Math.round(totalCost / totalQalys) : 0,
    equityScore,
    confidenceInterval: ci,
  };
}
