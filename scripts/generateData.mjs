// generateData.mjs — Generates synthetic county health data using REAL FIPS codes from TopoJSON
// Run: node scripts/generateData.mjs
import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      const chunks = [];
      res.on('data', d => chunks.push(d));
      res.on('end', () => resolve(JSON.parse(Buffer.concat(chunks).toString())));
      res.on('error', reject);
    }).on('error', reject);
  });
}


// State FIPS prefix → state abbreviation mapping
const FIPS_TO_STATE = {
  '01':'AL','02':'AK','04':'AZ','05':'AR','06':'CA','08':'CO','09':'CT','10':'DE',
  '11':'DC','12':'FL','13':'GA','15':'HI','16':'ID','17':'IL','18':'IN','19':'IA',
  '20':'KS','21':'KY','22':'LA','23':'ME','24':'MD','25':'MA','26':'MI','27':'MN',
  '28':'MS','29':'MO','30':'MT','31':'NE','32':'NV','33':'NH','34':'NJ','35':'NM',
  '36':'NY','37':'NC','38':'ND','39':'OH','40':'OK','41':'OR','42':'PA','44':'RI',
  '45':'SC','46':'SD','47':'TN','48':'TX','49':'UT','50':'VT','51':'VA','53':'WA',
  '54':'WV','55':'WI','56':'WY'
};

// State-level health baselines
const STATE_ANCHORS = {
  AL: { name:'Alabama',       obesity:38.0, smoking:19.2, diabetes:14.5, physicalInactivity:31.2, mentalHealth:16.8, heartDisease:8.1, copd:9.4,  checkups:71.2, pctPoverty:16.8, pctUninsured:10.1, pctElderly:17.2, pctBlack:26.8, pctHispanic:4.2,  aqiPM25:9.8,  aqiO3:43, svi:0.58 },
  AK: { name:'Alaska',        obesity:31.1, smoking:17.8, diabetes:9.2,  physicalInactivity:22.8, mentalHealth:14.2, heartDisease:5.8, copd:6.1,  checkups:65.2, pctPoverty:10.2, pctUninsured:13.4, pctElderly:11.8, pctBlack:3.2,  pctHispanic:6.8,  aqiPM25:5.2,  aqiO3:38, svi:0.42 },
  AZ: { name:'Arizona',       obesity:32.2, smoking:14.8, diabetes:11.8, physicalInactivity:25.8, mentalHealth:15.2, heartDisease:6.2, copd:6.8,  checkups:70.1, pctPoverty:14.0, pctUninsured:10.8, pctElderly:18.0, pctBlack:4.8,  pctHispanic:31.2, aqiPM25:8.4,  aqiO3:52, svi:0.48 },
  AR: { name:'Arkansas',      obesity:37.4, smoking:20.4, diabetes:13.8, physicalInactivity:30.8, mentalHealth:16.2, heartDisease:8.4, copd:9.8,  checkups:70.8, pctPoverty:17.2, pctUninsured:9.8,  pctElderly:17.8, pctBlack:15.6, pctHispanic:7.8,  aqiPM25:9.2,  aqiO3:44, svi:0.56 },
  CA: { name:'California',    obesity:27.8, smoking:11.2, diabetes:10.8, physicalInactivity:21.4, mentalHealth:14.8, heartDisease:5.8, copd:5.8,  checkups:74.8, pctPoverty:12.0, pctUninsured:7.2,  pctElderly:14.8, pctBlack:5.8,  pctHispanic:39.4, aqiPM25:10.8, aqiO3:54, svi:0.44 },
  CO: { name:'Colorado',      obesity:25.8, smoking:14.2, diabetes:8.4,  physicalInactivity:20.8, mentalHealth:15.8, heartDisease:5.2, copd:5.4,  checkups:74.2, pctPoverty:9.8,  pctUninsured:8.4,  pctElderly:14.8, pctBlack:4.2,  pctHispanic:21.2, aqiPM25:6.8,  aqiO3:51, svi:0.38 },
  CT: { name:'Connecticut',   obesity:28.4, smoking:11.8, diabetes:10.4, physicalInactivity:23.8, mentalHealth:15.8, heartDisease:6.2, copd:7.2,  checkups:76.8, pctPoverty:9.8,  pctUninsured:5.8,  pctElderly:17.8, pctBlack:10.8, pctHispanic:16.2, aqiPM25:7.8,  aqiO3:48, svi:0.34 },
  DE: { name:'Delaware',      obesity:32.8, smoking:15.4, diabetes:12.2, physicalInactivity:26.2, mentalHealth:16.2, heartDisease:7.2, copd:8.2,  checkups:75.8, pctPoverty:11.2, pctUninsured:6.8,  pctElderly:18.8, pctBlack:22.4, pctHispanic:8.8,  aqiPM25:9.2,  aqiO3:49, svi:0.38 },
  DC: { name:'D.C.',          obesity:24.8, smoking:14.2, diabetes:11.2, physicalInactivity:22.4, mentalHealth:17.4, heartDisease:6.8, copd:7.2,  checkups:82.4, pctPoverty:16.4, pctUninsured:3.8,  pctElderly:12.8, pctBlack:45.8, pctHispanic:11.4, aqiPM25:8.4,  aqiO3:47, svi:0.38 },
  FL: { name:'Florida',       obesity:31.2, smoking:14.8, diabetes:12.8, physicalInactivity:25.4, mentalHealth:15.8, heartDisease:6.8, copd:8.2,  checkups:72.4, pctPoverty:13.2, pctUninsured:12.4, pctElderly:21.8, pctBlack:16.4, pctHispanic:26.8, aqiPM25:7.8,  aqiO3:50, svi:0.46 },
  GA: { name:'Georgia',       obesity:33.8, smoking:16.4, diabetes:13.2, physicalInactivity:27.8, mentalHealth:15.8, heartDisease:7.2, copd:8.4,  checkups:71.4, pctPoverty:14.8, pctUninsured:12.8, pctElderly:14.2, pctBlack:31.8, pctHispanic:9.8,  aqiPM25:9.4,  aqiO3:51, svi:0.52 },
  HI: { name:'Hawaii',        obesity:23.8, smoking:12.8, diabetes:10.4, physicalInactivity:20.4, mentalHealth:12.8, heartDisease:5.2, copd:4.8,  checkups:76.8, pctPoverty:9.4,  pctUninsured:4.8,  pctElderly:18.4, pctBlack:2.4,  pctHispanic:10.4, aqiPM25:4.2,  aqiO3:36, svi:0.32 },
  ID: { name:'Idaho',         obesity:31.8, smoking:15.2, diabetes:10.2, physicalInactivity:23.4, mentalHealth:14.8, heartDisease:6.2, copd:6.8,  checkups:70.2, pctPoverty:11.8, pctUninsured:12.8, pctElderly:16.8, pctBlack:0.8,  pctHispanic:12.8, aqiPM25:7.8,  aqiO3:47, svi:0.40 },
  IL: { name:'Illinois',      obesity:32.8, smoking:15.4, diabetes:11.8, physicalInactivity:26.2, mentalHealth:15.8, heartDisease:6.8, copd:8.2,  checkups:73.4, pctPoverty:12.4, pctUninsured:7.8,  pctElderly:15.8, pctBlack:14.4, pctHispanic:17.2, aqiPM25:9.2,  aqiO3:47, svi:0.44 },
  IN: { name:'Indiana',       obesity:36.8, smoking:19.2, diabetes:12.8, physicalInactivity:29.4, mentalHealth:16.8, heartDisease:7.8, copd:9.2,  checkups:72.4, pctPoverty:13.2, pctUninsured:8.8,  pctElderly:16.8, pctBlack:9.8,  pctHispanic:7.4,  aqiPM25:10.2, aqiO3:47, svi:0.48 },
  IA: { name:'Iowa',          obesity:34.8, smoking:16.8, diabetes:10.8, physicalInactivity:27.2, mentalHealth:14.8, heartDisease:6.8, copd:7.8,  checkups:73.4, pctPoverty:11.2, pctUninsured:5.8,  pctElderly:18.2, pctBlack:3.8,  pctHispanic:5.8,  aqiPM25:7.4,  aqiO3:45, svi:0.38 },
  KS: { name:'Kansas',        obesity:34.2, smoking:17.2, diabetes:11.4, physicalInactivity:27.8, mentalHealth:14.8, heartDisease:7.2, copd:7.8,  checkups:72.8, pctPoverty:11.8, pctUninsured:9.4,  pctElderly:17.2, pctBlack:5.8,  pctHispanic:11.8, aqiPM25:7.8,  aqiO3:46, svi:0.40 },
  KY: { name:'Kentucky',      obesity:37.4, smoking:22.8, diabetes:14.2, physicalInactivity:31.8, mentalHealth:18.4, heartDisease:8.8, copd:10.8, checkups:71.8, pctPoverty:17.2, pctUninsured:8.0,  pctElderly:17.8, pctBlack:8.4,  pctHispanic:3.4,  aqiPM25:9.8,  aqiO3:46, svi:0.58 },
  LA: { name:'Louisiana',     obesity:38.2, smoking:19.8, diabetes:14.8, physicalInactivity:32.4, mentalHealth:16.4, heartDisease:8.8, copd:8.8,  checkups:70.2, pctPoverty:19.6, pctUninsured:10.4, pctElderly:14.8, pctBlack:32.8, pctHispanic:5.2,  aqiPM25:9.8,  aqiO3:48, svi:0.62 },
  ME: { name:'Maine',         obesity:31.8, smoking:16.8, diabetes:11.2, physicalInactivity:26.4, mentalHealth:17.2, heartDisease:6.8, copd:8.4,  checkups:74.8, pctPoverty:11.8, pctUninsured:6.4,  pctElderly:21.8, pctBlack:1.8,  pctHispanic:1.8,  aqiPM25:5.8,  aqiO3:42, svi:0.38 },
  MD: { name:'Maryland',      obesity:32.8, smoking:12.8, diabetes:12.4, physicalInactivity:26.2, mentalHealth:15.8, heartDisease:6.8, copd:7.4,  checkups:77.8, pctPoverty:9.0,  pctUninsured:6.4,  pctElderly:15.8, pctBlack:30.2, pctHispanic:10.4, aqiPM25:9.2,  aqiO3:50, svi:0.34 },
  MA: { name:'Massachusetts', obesity:27.8, smoking:13.2, diabetes:10.4, physicalInactivity:22.8, mentalHealth:16.8, heartDisease:6.2, copd:7.2,  checkups:78.2, pctPoverty:9.8,  pctUninsured:3.8,  pctElderly:17.8, pctBlack:8.4,  pctHispanic:12.8, aqiPM25:7.8,  aqiO3:45, svi:0.32 },
  MI: { name:'Michigan',      obesity:34.8, smoking:17.4, diabetes:12.8, physicalInactivity:28.4, mentalHealth:17.2, heartDisease:7.8, copd:9.2,  checkups:73.8, pctPoverty:14.2, pctUninsured:5.8,  pctElderly:17.8, pctBlack:14.0, pctHispanic:4.8,  aqiPM25:9.4,  aqiO3:47, svi:0.46 },
  MN: { name:'Minnesota',     obesity:31.8, smoking:14.8, diabetes:9.8,  physicalInactivity:24.2, mentalHealth:14.8, heartDisease:5.8, copd:6.8,  checkups:74.8, pctPoverty:9.6,  pctUninsured:5.2,  pctElderly:15.8, pctBlack:6.8,  pctHispanic:5.4,  aqiPM25:7.2,  aqiO3:43, svi:0.36 },
  MS: { name:'Mississippi',   obesity:40.8, smoking:21.2, diabetes:16.8, physicalInactivity:34.2, mentalHealth:17.4, heartDisease:9.8, copd:10.4, checkups:68.8, pctPoverty:19.8, pctUninsured:11.4, pctElderly:16.2, pctBlack:37.8, pctHispanic:3.2,  aqiPM25:9.4,  aqiO3:44, svi:0.68 },
  MO: { name:'Missouri',      obesity:35.4, smoking:20.2, diabetes:12.8, physicalInactivity:29.4, mentalHealth:16.8, heartDisease:7.8, copd:9.4,  checkups:71.8, pctPoverty:13.4, pctUninsured:9.2,  pctElderly:17.4, pctBlack:11.8, pctHispanic:4.2,  aqiPM25:9.2,  aqiO3:46, svi:0.48 },
  MT: { name:'Montana',       obesity:28.2, smoking:18.4, diabetes:9.0,  physicalInactivity:23.2, mentalHealth:16.4, heartDisease:6.2, copd:7.2,  checkups:69.8, pctPoverty:12.8, pctUninsured:10.8, pctElderly:19.4, pctBlack:0.6,  pctHispanic:3.8,  aqiPM25:6.4,  aqiO3:44, svi:0.42 },
  NE: { name:'Nebraska',      obesity:33.8, smoking:15.8, diabetes:10.4, physicalInactivity:26.8, mentalHealth:14.2, heartDisease:6.4, copd:6.8,  checkups:73.2, pctPoverty:10.8, pctUninsured:8.4,  pctElderly:16.8, pctBlack:4.8,  pctHispanic:10.8, aqiPM25:7.2,  aqiO3:44, svi:0.38 },
  NV: { name:'Nevada',        obesity:30.2, smoking:18.2, diabetes:11.4, physicalInactivity:26.2, mentalHealth:16.4, heartDisease:6.8, copd:7.4,  checkups:68.4, pctPoverty:12.8, pctUninsured:12.4, pctElderly:14.8, pctBlack:9.8,  pctHispanic:28.4, aqiPM25:8.4,  aqiO3:50, svi:0.46 },
  NH: { name:'New Hampshire', obesity:30.4, smoking:14.8, diabetes:10.2, physicalInactivity:24.8, mentalHealth:16.8, heartDisease:6.4, copd:7.2,  checkups:76.2, pctPoverty:7.8,  pctUninsured:7.8,  pctElderly:18.8, pctBlack:1.4,  pctHispanic:3.8,  aqiPM25:5.8,  aqiO3:43, svi:0.28 },
  NJ: { name:'New Jersey',    obesity:29.8, smoking:12.8, diabetes:11.4, physicalInactivity:25.2, mentalHealth:15.4, heartDisease:6.8, copd:7.2,  checkups:77.4, pctPoverty:9.4,  pctUninsured:7.8,  pctElderly:16.8, pctBlack:13.8, pctHispanic:21.4, aqiPM25:9.8,  aqiO3:50, svi:0.34 },
  NM: { name:'New Mexico',    obesity:32.8, smoking:16.8, diabetes:12.4, physicalInactivity:27.4, mentalHealth:17.2, heartDisease:6.8, copd:7.4,  checkups:68.8, pctPoverty:18.2, pctUninsured:11.8, pctElderly:18.4, pctBlack:2.4,  pctHispanic:49.8, aqiPM25:6.4,  aqiO3:50, svi:0.54 },
  NY: { name:'New York',      obesity:28.8, smoking:13.2, diabetes:11.2, physicalInactivity:25.2, mentalHealth:16.4, heartDisease:6.8, copd:7.4,  checkups:76.8, pctPoverty:13.0, pctUninsured:6.4,  pctElderly:16.8, pctBlack:15.8, pctHispanic:19.2, aqiPM25:9.2,  aqiO3:48, svi:0.40 },
  NC: { name:'North Carolina',obesity:34.2, smoking:17.2, diabetes:13.4, physicalInactivity:28.4, mentalHealth:16.2, heartDisease:7.4, copd:8.8,  checkups:72.4, pctPoverty:14.8, pctUninsured:11.2, pctElderly:16.8, pctBlack:21.4, pctHispanic:9.8,  aqiPM25:8.8,  aqiO3:50, svi:0.48 },
  ND: { name:'North Dakota',  obesity:33.4, smoking:17.8, diabetes:10.2, physicalInactivity:26.2, mentalHealth:14.2, heartDisease:6.4, copd:6.4,  checkups:71.4, pctPoverty:10.4, pctUninsured:8.8,  pctElderly:16.8, pctBlack:3.2,  pctHispanic:3.8,  aqiPM25:5.8,  aqiO3:42, svi:0.38 },
  OH: { name:'Ohio',          obesity:35.8, smoking:20.2, diabetes:13.2, physicalInactivity:29.8, mentalHealth:17.4, heartDisease:8.2, copd:9.8,  checkups:73.8, pctPoverty:14.2, pctUninsured:6.8,  pctElderly:17.8, pctBlack:12.8, pctHispanic:3.8,  aqiPM25:9.8,  aqiO3:48, svi:0.48 },
  OK: { name:'Oklahoma',      obesity:36.8, smoking:19.8, diabetes:14.2, physicalInactivity:30.4, mentalHealth:16.8, heartDisease:8.4, copd:9.4,  checkups:70.2, pctPoverty:16.4, pctUninsured:13.8, pctElderly:16.4, pctBlack:7.4,  pctHispanic:10.8, aqiPM25:8.4,  aqiO3:47, svi:0.52 },
  OR: { name:'Oregon',        obesity:30.4, smoking:15.8, diabetes:10.2, physicalInactivity:22.8, mentalHealth:17.4, heartDisease:5.8, copd:6.8,  checkups:71.8, pctPoverty:12.2, pctUninsured:8.4,  pctElderly:18.4, pctBlack:2.4,  pctHispanic:12.8, aqiPM25:8.8,  aqiO3:50, svi:0.42 },
  PA: { name:'Pennsylvania',  obesity:33.8, smoking:17.4, diabetes:12.4, physicalInactivity:27.8, mentalHealth:17.4, heartDisease:7.8, copd:9.2,  checkups:75.8, pctPoverty:12.4, pctUninsured:5.8,  pctElderly:18.8, pctBlack:10.8, pctHispanic:7.8,  aqiPM25:9.8,  aqiO3:48, svi:0.42 },
  RI: { name:'Rhode Island',  obesity:30.8, smoking:14.8, diabetes:11.4, physicalInactivity:25.8, mentalHealth:17.2, heartDisease:7.2, copd:8.2,  checkups:77.4, pctPoverty:11.2, pctUninsured:5.4,  pctElderly:17.8, pctBlack:7.8,  pctHispanic:15.4, aqiPM25:7.8,  aqiO3:46, svi:0.36 },
  SC: { name:'South Carolina',obesity:36.8, smoking:18.4, diabetes:14.2, physicalInactivity:29.8, mentalHealth:16.8, heartDisease:8.4, copd:9.2,  checkups:71.4, pctPoverty:15.8, pctUninsured:11.8, pctElderly:19.2, pctBlack:26.4, pctHispanic:5.8,  aqiPM25:8.8,  aqiO3:50, svi:0.54 },
  SD: { name:'South Dakota',  obesity:32.8, smoking:18.4, diabetes:10.4, physicalInactivity:26.4, mentalHealth:14.8, heartDisease:6.8, copd:6.8,  checkups:71.8, pctPoverty:13.2, pctUninsured:10.2, pctElderly:17.8, pctBlack:2.0,  pctHispanic:3.8,  aqiPM25:6.0,  aqiO3:43, svi:0.44 },
  TN: { name:'Tennessee',     obesity:37.2, smoking:20.8, diabetes:14.2, physicalInactivity:30.8, mentalHealth:17.2, heartDisease:8.8, copd:10.2, checkups:71.8, pctPoverty:15.4, pctUninsured:10.4, pctElderly:17.2, pctBlack:16.8, pctHispanic:5.4,  aqiPM25:9.4,  aqiO3:50, svi:0.52 },
  TX: { name:'Texas',         obesity:35.2, smoking:14.2, diabetes:13.8, physicalInactivity:28.8, mentalHealth:14.8, heartDisease:7.2, copd:7.4,  checkups:68.4, pctPoverty:14.8, pctUninsured:17.8, pctElderly:13.4, pctBlack:12.4, pctHispanic:39.8, aqiPM25:9.2,  aqiO3:52, svi:0.50 },
  UT: { name:'Utah',          obesity:26.8, smoking:8.8,  diabetes:8.4,  physicalInactivity:21.4, mentalHealth:14.8, heartDisease:5.2, copd:5.2,  checkups:74.2, pctPoverty:8.8,  pctUninsured:9.4,  pctElderly:11.4, pctBlack:1.2,  pctHispanic:13.4, aqiPM25:9.8,  aqiO3:56, svi:0.34 },
  VT: { name:'Vermont',       obesity:28.8, smoking:14.8, diabetes:9.4,  physicalInactivity:23.4, mentalHealth:17.8, heartDisease:5.8, copd:7.2,  checkups:76.8, pctPoverty:9.8,  pctUninsured:6.4,  pctElderly:19.8, pctBlack:1.2,  pctHispanic:1.8,  aqiPM25:4.8,  aqiO3:40, svi:0.28 },
  VA: { name:'Virginia',      obesity:32.2, smoking:14.8, diabetes:11.4, physicalInactivity:26.2, mentalHealth:15.2, heartDisease:6.8, copd:7.8,  checkups:74.8, pctPoverty:10.8, pctUninsured:9.2,  pctElderly:16.4, pctBlack:19.4, pctHispanic:9.8,  aqiPM25:8.8,  aqiO3:50, svi:0.40 },
  WA: { name:'Washington',    obesity:29.4, smoking:13.8, diabetes:10.2, physicalInactivity:22.4, mentalHealth:16.4, heartDisease:5.8, copd:6.4,  checkups:73.4, pctPoverty:10.4, pctUninsured:7.4,  pctElderly:15.8, pctBlack:4.2,  pctHispanic:12.4, aqiPM25:7.8,  aqiO3:49, svi:0.38 },
  WV: { name:'West Virginia', obesity:40.2, smoking:24.8, diabetes:15.8, physicalInactivity:34.8, mentalHealth:19.8, heartDisease:10.2,copd:13.4, checkups:70.4, pctPoverty:19.0, pctUninsured:7.4,  pctElderly:19.8, pctBlack:3.8,  pctHispanic:1.4,  aqiPM25:10.2, aqiO3:47, svi:0.64 },
  WI: { name:'Wisconsin',     obesity:33.8, smoking:15.4, diabetes:10.4, physicalInactivity:26.4, mentalHealth:15.8, heartDisease:6.8, copd:7.8,  checkups:74.8, pctPoverty:10.8, pctUninsured:5.8,  pctElderly:17.8, pctBlack:6.4,  pctHispanic:7.2,  aqiPM25:8.4,  aqiO3:45, svi:0.38 },
  WY: { name:'Wyoming',       obesity:31.4, smoking:18.2, diabetes:9.2,  physicalInactivity:24.4, mentalHealth:15.4, heartDisease:6.2, copd:6.8,  checkups:69.8, pctPoverty:10.2, pctUninsured:11.4, pctElderly:16.8, pctBlack:1.0,  pctHispanic:10.2, aqiPM25:5.8,  aqiO3:46, svi:0.34 },
};

function rand(mean, std) {
  const u1 = Math.random(), u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1 + 1e-10)) * Math.cos(2 * Math.PI * u2);
  return mean + std * z;
}
function clamp(val, min, max) { return Math.min(Math.max(val, min), max); }

// Fetch TopoJSON and extract real FIPS + county names
const TOPO_URL = 'https://cdn.jsdelivr.net/npm/us-atlas@3/counties-albers-10m.json';

console.log('Fetching TopoJSON...');
const topo = await httpsGet(TOPO_URL);
const geoms = topo.objects.counties.geometries;
console.log(`Got ${geoms.length} county geometries from TopoJSON`);


// Build list from real TopoJSON FIPS + names
const allCounties = [];
// Track per-state county index for urban/rural gradient
const stateCounters = {};

for (const geom of geoms) {
  const fips = String(geom.id).padStart(5, '0');
  const stateFips = fips.slice(0, 2);
  const stateAbbr = FIPS_TO_STATE[stateFips];
  if (!stateAbbr || !STATE_ANCHORS[stateAbbr]) continue; // skip unknown

  const stateData = STATE_ANCHORS[stateAbbr];
  if (!stateCounters[stateAbbr]) stateCounters[stateAbbr] = 0;
  const idx = stateCounters[stateAbbr]++;

  // Use real county name from TopoJSON if available
  const countyName = geom.properties?.name
    ? `${geom.properties.name} ${stateAbbr === 'LA' ? 'Parish' : stateAbbr === 'AK' ? 'Borough' : 'County'}`
    : `County ${fips}`;

  // Urban/rural gradient based on county index within state
  const totalForState = geoms.filter(g => String(g.id).padStart(5,'0').slice(0,2) === stateFips).length;
  const urbanRatio = 1 - (idx / Math.max(totalForState, 1));
  const urbanBonus = (urbanRatio - 0.5) * 4;

  const pop = urbanRatio > 0.7
    ? Math.round(rand(200000, 130000))
    : urbanRatio > 0.3
    ? Math.round(rand(48000, 28000))
    : Math.round(rand(14000, 9000));

  const obesity          = clamp(rand(stateData.obesity + urbanBonus * -1.5, 4.2), 18, 55);
  const smoking          = clamp(rand(stateData.smoking + urbanBonus * -1.2, 3.8), 6, 35);
  const diabetes         = clamp(rand(stateData.diabetes + urbanBonus * -0.8, 2.8), 5, 25);
  const physInactivity   = clamp(rand(stateData.physicalInactivity + urbanBonus * -2.0, 4.8), 14, 50);
  const mentalHealth     = clamp(rand(stateData.mentalHealth + urbanBonus * -0.5, 2.8), 8, 28);
  const heartDisease     = clamp(rand(stateData.heartDisease + urbanBonus * -0.4, 1.8), 2.5, 18);
  const copd             = clamp(rand(stateData.copd + urbanBonus * -0.5, 2.2), 2, 22);
  const checkups         = clamp(rand(stateData.checkups + urbanBonus * 1.5, 5.2), 55, 92);
  const pctPoverty       = clamp(rand(stateData.pctPoverty + urbanBonus * -2.5, 4.2), 4, 42);
  const pctUninsured     = clamp(rand(stateData.pctUninsured + urbanBonus * -2.0, 3.4), 2, 32);
  const pctElderly       = clamp(rand(stateData.pctElderly + urbanBonus * -1.0, 3.2), 8, 38);
  const pctBlack         = clamp(rand(stateData.pctBlack, stateData.pctBlack * 0.5 + 2), 0, 85);
  const pctHispanic      = clamp(rand(stateData.pctHispanic, stateData.pctHispanic * 0.4 + 2), 0, 95);
  const aqiPM25          = clamp(rand(stateData.aqiPM25, 2.8), 1, 22);
  const aqiO3            = clamp(rand(stateData.aqiO3, 5.4), 25, 75);
  const svi              = clamp(rand(stateData.svi, 0.12), 0.02, 0.98);
  const mortalityRate    = clamp(850 + (obesity-30)*8 + (smoking-15)*12 + (diabetes-11)*15 - (checkups-72)*3 + rand(0,40), 550, 1400);

  allCounties.push({
    fips,
    name: countyName,
    state: stateAbbr,
    stateName: stateData.name,
    population: Math.max(800, pop),
    isUrban: urbanRatio > 0.6,
    demographics: {
      pctPoverty:   Math.round(pctPoverty * 10) / 10,
      pctUninsured: Math.round(pctUninsured * 10) / 10,
      pctElderly:   Math.round(pctElderly * 10) / 10,
      pctBlack:     Math.round(pctBlack * 10) / 10,
      pctHispanic:  Math.round(pctHispanic * 10) / 10,
      pctWhite:     Math.round(clamp(100 - pctBlack - pctHispanic - rand(5,4), 5, 95) * 10) / 10,
    },
    health: {
      obesity:           Math.round(obesity * 10) / 10,
      smoking:           Math.round(smoking * 10) / 10,
      diabetes:          Math.round(diabetes * 10) / 10,
      physicalInactivity:Math.round(physInactivity * 10) / 10,
      mentalHealth:      Math.round(mentalHealth * 10) / 10,
      heartDisease:      Math.round(heartDisease * 10) / 10,
      copd:              Math.round(copd * 10) / 10,
      checkups:          Math.round(checkups * 10) / 10,
      mortalityRate:     Math.round(mortalityRate),
    },
    environment: {
      aqiPM25: Math.round(aqiPM25 * 10) / 10,
      aqiO3:   Math.round(aqiO3 * 10) / 10,
    },
    svi: {
      overall:          Math.round(svi * 1000) / 1000,
      socioeconomic:    Math.round(clamp(rand(svi, 0.12), 0, 1) * 1000) / 1000,
      householdComp:    Math.round(clamp(rand(svi, 0.12), 0, 1) * 1000) / 1000,
      minority:         Math.round(clamp(rand(svi, 0.12), 0, 1) * 1000) / 1000,
      housingTransport: Math.round(clamp(rand(svi, 0.12), 0, 1) * 1000) / 1000,
    },
  });
}

console.log(`Generated ${allCounties.length} counties across ${Object.keys(stateCounters).length} states`);

const outputDir = path.join(__dirname, '../frontend/public/data');
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, 'counties_health.json'), JSON.stringify(allCounties));
console.log(`✅ Wrote ${allCounties.length} counties to frontend/public/data/counties_health.json`);
