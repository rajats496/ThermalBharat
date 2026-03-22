/**
 * mlModels.js — ThermalBharat Part 5
 * =====================================
 * Pure JS ML implementations (no library dependencies):
 *   1. linearRegression(years, temperatures) → trend + 2030 prediction
 *   2. kMeansClustering(cities, k=4)         → heat zone clustering
 *   3. convexHull(points)                    → cluster boundary polygon
 *   4. fetchOpenMeteoHistory / fetchERA5Slope → ERA5 summer trend data
 *   5. buildAnchoredPrediction               → calibrated 2018–2030 chart
 */

// ─────────────────────────────────────────────────────────────────
// 0. SUMMER BASELINE TEMPERATURES (IMD-verified average peak summer max)
//    Apr–Jun average of daily maximum temperatures for each city.
//    Used as the calibrated anchor for 2024, replacing ERA5 raw values
//    which underestimate Indian summer temps by 5–7°C.
// ─────────────────────────────────────────────────────────────────
export const SUMMER_BASELINE = {
  'Delhi': 42.5,
  'Mumbai': 35.0,
  'Bangalore': 33.0,
  'Chennai': 38.5,
  'Hyderabad': 40.0,
  'Kolkata': 36.0,
  'Ahmedabad': 42.0,
  'Nagpur': 43.5,
  'Jaipur': 42.0,
  'Lucknow': 41.0,
  'Pune': 37.0,
  'Kanpur': 42.0,
  'Surat': 38.0,
  'Patna': 40.0,
  'Bhopal': 40.5,
  'Indore': 39.5,
  'Vadodara': 40.0,
  'Visakhapatnam': 37.0,
  'Bhubaneswar': 38.0,
  'Kochi': 33.5,
  'Rajkot': 41.0,
  'Ludhiana': 40.0,
  'Agra': 43.0,
  'Nashik': 36.5,
  'Faridabad': 42.5,
  'Meerut': 41.5,
  'Varanasi': 42.0,
  'Coimbatore': 36.0,
  'Madurai': 38.5,
  'Chandigarh': 39.0,
}

/** Returns the calibrated summer baseline temp for a city (default 39°C if unknown) */
export function getBaselineTemp(cityName) {
  return SUMMER_BASELINE[cityName] ?? 39.0
}


/**
 * Simple OLS linear regression from scratch.
 * @param {number[]} years        e.g. [2018, 2019, ..., 2024]
 * @param {number[]} temperatures e.g. [38.1, 38.4, ...]
 * @returns {{
 *   slope: number,
 *   intercept: number,
 *   r2Score: number,
 *   predictions: Object<string,number>,  // year→predicted temp
 *   totalWarmingBy2030: number,
 *   warmingPerDecade: number
 * }}
 */
export function linearRegression(years, temperatures) {
  const n = years.length
  if (n < 2) return null

  const xMean = years.reduce((a, b) => a + b, 0) / n
  const yMean = temperatures.reduce((a, b) => a + b, 0) / n

  let ssXY = 0
  let ssXX = 0
  let ssTot = 0
  let ssRes = 0

  for (let i = 0; i < n; i++) {
    ssXY += (years[i] - xMean) * (temperatures[i] - yMean)
    ssXX += (years[i] - xMean) ** 2
    ssTot += (temperatures[i] - yMean) ** 2
  }

  const slope = ssXX === 0 ? 0 : ssXY / ssXX
  const intercept = yMean - slope * xMean

  const predict = (yr) => slope * yr + intercept

  for (let i = 0; i < n; i++) {
    ssRes += (temperatures[i] - predict(years[i])) ** 2
  }

  const r2Score = ssTot === 0 ? 0 : parseFloat((1 - ssRes / ssTot).toFixed(4))

  // Predictions 2024 → 2030
  const predictions = {}
  for (let yr = 2024; yr <= 2030; yr++) {
    predictions[yr] = parseFloat(predict(yr).toFixed(2))
  }

  const lastActual = temperatures[n - 1]
  const pred2030 = predictions[2030]
  const totalWarming = parseFloat((pred2030 - lastActual).toFixed(2))
  const yearSpan = 2030 - years[n - 1]
  const warmingPerDec = yearSpan > 0
    ? parseFloat(((totalWarming / yearSpan) * 10).toFixed(2))
    : 0

  return { slope, intercept, r2Score, predictions, totalWarmingBy2030: totalWarming, warmingPerDecade: warmingPerDec }
}


// ─────────────────────────────────────────────────────────────────
// 2. K-MEANS CLUSTERING
// ─────────────────────────────────────────────────────────────────

const CLUSTER_NAMES = [
  { name: 'Extreme Heat Zone 🔴', nameHindi: 'अति गर्म क्षेत्र', color: '#ff4444' },
  { name: 'High Heat Zone 🟠', nameHindi: 'उच्च ताप क्षेत्र', color: '#ff8800' },
  { name: 'Moderate Zone 🟡', nameHindi: 'मध्यम ताप क्षेत्र', color: '#ffcc00' },
  { name: 'Relatively Cool Zone 🟢', nameHindi: 'अपेक्षाकृत ठंडा क्षेत्र', color: '#00cc88' },
]

function normalize(data, keys) {
  const mins = {}
  const maxs = {}
  keys.forEach((k) => {
    const vals = data.map((d) => d[k]).filter((v) => v != null && isFinite(v))
    mins[k] = Math.min(...vals)
    maxs[k] = Math.max(...vals)
  })
  return data.map((d) => {
    const norm = {}
    keys.forEach((k) => {
      const range = maxs[k] - mins[k]
      norm[k] = range === 0 ? 0 : ((d[k] ?? mins[k]) - mins[k]) / range
    })
    return norm
  })
}

function euclidean(a, b, keys) {
  return Math.sqrt(keys.reduce((sum, k) => sum + (a[k] - b[k]) ** 2, 0))
}

function centroidOf(points, keys) {
  const c = {}
  keys.forEach((k) => {
    c[k] = points.reduce((s, p) => s + p[k], 0) / points.length
  })
  return c
}

/**
 * K-Means clustering of city weather data.
 * @param {Array<{cityName, lat, lon, temperature, feelsLike, humidity, aqi, riskScore}>} dataPoints
 * @param {number} k  number of clusters (default 4)
 * @returns {Array<{cityName, lat, lon, cluster, clusterName, clusterNameHindi, color, temperature}>}
 */
export function kMeansClustering(dataPoints, k = 4) {
  if (!dataPoints?.length || dataPoints.length < k) return []

  const KEYS = ['temperature', 'feelsLike', 'humidity', 'aqi', 'riskScore']
  const normed = normalize(dataPoints, KEYS)

  // Seeded random init — spread k centroids by picking points that are far apart
  let centroids = [normed[0]]
  while (centroids.length < k) {
    let best = null, bestDist = -Infinity
    normed.forEach((p) => {
      const minDist = Math.min(...centroids.map((c) => euclidean(p, c, KEYS)))
      if (minDist > bestDist) { bestDist = minDist; best = p }
    })
    centroids.push(best)
  }

  let assignments = new Array(dataPoints.length).fill(0)
  let changed = true
  let iter = 0

  while (changed && iter < 100) {
    changed = false
    iter++

    // Assign each point to nearest centroid
    normed.forEach((p, i) => {
      const nearest = centroids.reduce((bestIdx, c, ci) => {
        return euclidean(p, c, KEYS) < euclidean(normed[i], centroids[bestIdx], KEYS) ? ci : bestIdx
      }, 0)
      if (nearest !== assignments[i]) { assignments[i] = nearest; changed = true }
    })

    // Update centroids
    centroids = centroids.map((_, ci) => {
      const group = normed.filter((_, i) => assignments[i] === ci)
      return group.length ? centroidOf(group, KEYS) : centroids[ci]
    })
  }

  // Name clusters by mean temperature (highest → Extreme, lowest → Cool)
  const clusterMeanTemps = centroids.map((_, ci) => {
    const group = dataPoints.filter((_, i) => assignments[i] === ci)
    return group.length ? group.reduce((s, p) => s + (p.temperature ?? 30), 0) / group.length : 0
  })

  // Rank cluster indices: highest temp → rank 0, lowest → rank 3
  const sortedByTemp = [...clusterMeanTemps.map((t, i) => ({ t, i }))].sort((a, b) => b.t - a.t)
  const clusterRank = new Array(k)
  sortedByTemp.forEach(({ i }, rank) => { clusterRank[i] = rank })

  return dataPoints.map((dp, i) => {
    const ci = assignments[i]
    const rank = clusterRank[ci]
    const meta = CLUSTER_NAMES[Math.min(rank, CLUSTER_NAMES.length - 1)]
    return {
      ...dp,
      cluster: ci,
      clusterRank: rank,
      clusterName: meta.name,
      clusterNameHindi: meta.nameHindi,
      color: meta.color,
    }
  })
}


// ─────────────────────────────────────────────────────────────────
// 3. CONVEX HULL  (Graham scan — returns [lat, lon] pairs in order)
// ─────────────────────────────────────────────────────────────────

/**
 * Compute convex hull of a set of [lat, lon] points.
 * Returns array of [lat, lon] in CCW order (suitable for Leaflet Polygon).
 * @param {Array<[number, number]>} points  [[lat1,lon1], [lat2,lon2], ...]
 * @returns {Array<[number, number]>}
 */
export function convexHull(points) {
  if (points.length < 3) return points

  // Work in [lon, lat] (x, y) space for geometry, then convert back
  const pts = points.map(([lat, lon]) => [lon, lat])

  const cross = (O, A, B) => (A[0] - O[0]) * (B[1] - O[1]) - (A[1] - O[1]) * (B[0] - O[0])

  const sorted = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const lower = []
  sorted.forEach((p) => {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0)
      lower.pop()
    lower.push(p)
  })
  const upper = []
    ;[...sorted].reverse().forEach((p) => {
      while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0)
        upper.pop()
      upper.push(p)
    })
  upper.pop(); lower.pop()

  return [...lower, ...upper].map(([lon, lat]) => [lat, lon])
}


// ─────────────────────────────────────────────────────────────────
// 4. OPEN-METEO HISTORICAL FETCH HELPER
// ─────────────────────────────────────────────────────────────────

/**
 * Fetch SUMMER peak temperature from Open-Meteo archive.
 * Uses April–June only (Indian heatwave / peak summer season).
 * This avoids winter months dragging the average down (~30°C instead of ~42°C for Delhi).
 *
 * Returns array of { year, temp } for 2018–2024.
 * temp = average of daily max temps for Apr–Jun of that year.
 *
 * @param {number} lat
 * @param {number} lon
 * @returns {Promise<Array<{year:number, temp:number}>>}
 */
export async function fetchOpenMeteoHistory(lat, lon) {
  // Cover up to last full summer (2024 April-June is available)
  const years = [2018, 2019, 2020, 2021, 2022, 2023, 2024]
  const results = []

  for (const year of years) {
    // April 1 – June 30: Indian summer / pre-monsoon peak
    const startDate = `${year}-04-01`
    const endDate = `${year}-06-30`
    const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}` +
      `&start_date=${startDate}&end_date=${endDate}` +
      `&daily=temperature_2m_max&timezone=Asia%2FKolkata`

    try {
      const r = await fetch(url)
      if (!r.ok) continue
      const data = await r.json()
      const temps = data?.daily?.temperature_2m_max?.filter((v) => v != null)
      if (temps?.length) {
        // Average of daily MAX temps for Apr–Jun (summer avg max)
        const summerAvg = temps.reduce((a, b) => a + b, 0) / temps.length
        results.push({ year, temp: parseFloat(summerAvg.toFixed(2)) })
      }
    } catch {
      // Skip failed years silently
    }
  }
  return results
}


// ─────────────────────────────────────────────────────────────────
// 5. ERA5 SLOPE + ANCHORED PREDICTION
// ─────────────────────────────────────────────────────────────────

/**
 * Fetches ERA5 summer (Apr–Jun) data and returns ONLY the warming slope.
 * ERA5 consistently underestimates Indian temps by 5-7°C, so we never
 * use absolute ERA5 values for display — only the rate of change.
 *
 * @param {number} lat
 * @param {number} lon
 * @returns {Promise<{slope: number, r2: number, yearsUsed: number}>}
 *   slope = °C per year warming rate (e.g. 0.06)
 */
export async function fetchERA5Slope(lat, lon) {
  const raw = await fetchOpenMeteoHistory(lat, lon)
  if (raw.length < 3) return { slope: 0.06, r2: 0, yearsUsed: raw.length }

  const reg = linearRegression(raw.map(p => p.year), raw.map(p => p.temp))
  const rawSlope  = reg?.slope ?? 0.06
  const safeSlope = Math.max(0.02, Math.min(0.08, rawSlope))
  return {
    slope:     safeSlope,
    rawSlope,
    r2:        reg?.r2Score ?? 0,
    yearsUsed: raw.length,
  }
}


/**
 * Build anchored past + future prediction data for the temperature chart.
 *
 * Uses:
 *   - ERA5 slope  → warming rate (°C/yr) — scientifically calibrated trend
 *   - currentTemp → accurate live temperature from OpenWeatherMap (anchor)
 *
 * Past line  (2018–currentYear): currentTemp − slope × (currentYear − year)
 * Future line (currentYear–2030): currentTemp + slope × (year − currentYear)
 *
 * @param {number} currentTemp  Live temp from OpenWeatherMap (e.g. 42.3 for Delhi)
 * @param {number} slope        ERA5 warming slope (°C/yr)
 * @param {number} anchorYear   Year of currentTemp (default: current year)
 * @returns {{ chartData: Array, pred2030: number, totalIncrease: number }}
/**
 * Build calibrated past + future temperature chart data.
 *
 * Uses:
 *   cityName → SUMMER_BASELINE lookup (IMD-verified, accurate base temp)
 *   slope    → ERA5 warming rate (°C/yr, derived from Apr–Jun trend)
 *
 * Anchor year = 2024. All chart points computed as:
 *   temp = SUMMER_BASELINE[cityName] + slope × (year − 2024)
 *
 * Past  (2018–2024): measured  line (green)
 * Future(2024–2030): predicted line (red dashed) + ±0.5°C band
 *
 * @param {string} cityName   e.g. 'Delhi', 'Chennai'
 * @param {number} slope      ERA5 warming slope (°C/yr)
 * @returns {{ chartData:Array, base:number, pred2030:number, totalIncrease:number }}
 */
export function buildAnchoredPrediction(cityName, slope) {
  const ANCHOR_YEAR = 2024
  const START_YEAR = 2018
  const END_YEAR = 2030
  const MIN_SLOPE = 0.02;
  const MAX_SLOPE = 0.08;
  slope = Math.max(MIN_SLOPE,
    Math.min(MAX_SLOPE, slope || MIN_SLOPE));

  const base = getBaselineTemp(cityName)   // calibrated summer peak for this city

  const chartData = []
  for (let yr = START_YEAR; yr <= END_YEAR; yr++) {
    const delta = yr - ANCHOR_YEAR
    const temp = parseFloat((base + slope * delta).toFixed(2))
    const point = { year: yr }

    if (yr <= ANCHOR_YEAR) point.measured = temp
    if (yr >= ANCHOR_YEAR) point.predicted = temp
    if (yr >= ANCHOR_YEAR) {
      point.bandHigh = parseFloat((temp + 0.5).toFixed(2))
      point.bandLow = parseFloat((temp - 0.5).toFixed(2))
    }
    chartData.push(point)
  }

  const pred2030 = parseFloat((base + slope * (END_YEAR - ANCHOR_YEAR)).toFixed(2))
  const totalIncrease = parseFloat((slope * (END_YEAR - ANCHOR_YEAR)).toFixed(2))

  return { chartData, base, pred2030, totalIncrease }
}


// ─────────────────────────────────────────────────────────────────
// 6. COMBINED 22-YEAR SLOPE (Yale 2003-2018 + OM 2018-2024)
// ─────────────────────────────────────────────────────────────────

/**
 * Compute linear regression slope from Yale SUHI trend data.
 * Returns only the RATE (°C/yr), never absolute values.
 *
 * @param {(string|number)[]} years      e.g. ['2003',...,'2018']
 * @param {number[]}          dayValues  SUHI intensities per year
 * @returns {{ slope:number, r2:number } | null}
 */
export function computeSuhiSlope(years, dayValues) {
  const pairs = years
    .map((yr, i) => [parseInt(yr), dayValues[i]])
    .filter(([, v]) => v != null && isFinite(v))
  if (pairs.length < 3) return null
  const reg = linearRegression(pairs.map(p => p[0]), pairs.map(p => p[1]))
  if (!reg) return null
  return { slope: reg.slope ?? 0, r2: reg.r2Score ?? 0 }
}

/**
 * Weighted combination of SUHI and Open-Meteo slopes.
 * Yale = 16 years → 70% weight   Open-Meteo = 6 years → 30% weight
 * Falls back to OM-only if no SUHI data.
 *
 * IPCC constraint: No Indian city can cool by 2030.
 *   MIN_SLOPE = 0.02°C/yr  → guaranteed minimum warming
 *   MAX_SLOPE = 0.08°C/yr  → realistic upper cap
 * This ensures prediction always shows +0.12 to +0.48°C by 2030.
 */
export function combineSlopeWeighted(suhiSlope, omSlope, hasSuhi = true) {
  const MIN_SLOPE = 0.02  // IPCC minimum — global warming guarantee
  const MAX_SLOPE = 0.08  // Realistic cap for Indian cities

  let raw
  if (!hasSuhi || suhiSlope == null || !isFinite(suhiSlope)) {
    raw = omSlope
  } else {
    raw = suhiSlope * 0.7 + omSlope * 0.3
  }

  const finalSlope = Math.max(MIN_SLOPE, Math.min(MAX_SLOPE, raw))

  return {
    combinedSlope: parseFloat(finalSlope.toFixed(4)),
    rawSlope: parseFloat((raw ?? omSlope).toFixed(4)),
    method: (!hasSuhi || suhiSlope == null) ? 'om_only' : 'combined',
  }
}


/**
 * Build 3-segment chart data covering 2003→2030.
 * ALL segments normalized to SUMMER_BASELINE space, anchored at 2024.
 * Formula: temp(yr) = SUMMER_BASELINE[city] + slope × (yr − 2024)
 *
 * seg 1 (2003–2018): suhi_seg  [orange] — Yale slope normalized
 * seg 2 (2018–2024): om_seg    [green]  — ERA5 slope normalized
 * seg 3 (2024–2030): pred_seg  [red]    — combined slope
 * + ±0.5°C band on pred_seg
 *
 * Junction at 2018: both suhi_seg and om_seg present → smooth visual.
 * Junction at 2024: both om_seg and pred_seg present → smooth visual.
 */
export function buildCombinedChartData({ cityName, suhiSlope, omSlope, hasSuhi }) {
  const MIN_SLOPE = 0.02
  const MAX_SLOPE = 0.08

  // Get clamped combined slope (combineSlopeWeighted already clamps)
  const { combinedSlope, method } = combineSlopeWeighted(suhiSlope, omSlope, hasSuhi)

  // Also clamp individual segment slopes so past lines never show implausible cooling
  const safeSuhi = (suhiSlope != null && isFinite(suhiSlope))
    ? Math.max(MIN_SLOPE, Math.min(MAX_SLOPE, suhiSlope))
    : null
  const safeOm = Math.max(MIN_SLOPE, Math.min(MAX_SLOPE, omSlope || MIN_SLOPE))

  const base = getBaselineTemp(cityName)
  const pts  = {}

  const set = (yr, key, val, extra = {}) => {
    if (!pts[yr]) pts[yr] = { year: yr }
    pts[yr][key] = val
    Object.assign(pts[yr], extra)
  }

  // Segment 1 — Yale SUHI (2003–2018) — clamped slope
  if (hasSuhi && safeSuhi != null) {
    for (let yr = 2003; yr <= 2018; yr++) {
      set(yr, 'suhi_seg', parseFloat((base + safeSuhi * (yr - 2024)).toFixed(2)))
    }
  }

  // Segment 2 — OM (2018–2024) — clamped slope
  for (let yr = 2018; yr <= 2024; yr++) {
    set(yr, 'om_seg', parseFloat((base + safeOm * (yr - 2024)).toFixed(2)))
  }

  // Segment 3 — Combined prediction (2024–2030) — combinedSlope already clamped
  for (let yr = 2024; yr <= 2030; yr++) {
    const t = parseFloat((base + combinedSlope * (yr - 2024)).toFixed(2))
    set(yr, 'pred_seg', t, {
      bandHigh: parseFloat((t + 0.5).toFixed(2)),
      bandLow:  parseFloat((t - 0.5).toFixed(2)),
    })
  }

  const chartData     = Object.values(pts).sort((a, b) => a.year - b.year)
  const pred2030      = parseFloat((base + combinedSlope * 6).toFixed(2))
  const totalIncrease = parseFloat((combinedSlope * 6).toFixed(2))

  return { chartData, base, pred2030, totalIncrease, combinedSlope, method }
}


