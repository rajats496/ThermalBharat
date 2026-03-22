/**
 * geeAPI.js — ThermalBharat GEE Data Service
 * ============================================
 * Lazy-loads Yale YCEO UHI JSON files exported by gee_export.py.
 * Caches all loaded data in memory — never fetches same city twice.
 *
 * BAND SWAP NOTE (dataset quirk — applied in gee_export.py):
 *   pixel.day   = daytime SUHI intensity   (was 'Nighttime' band)
 *   pixel.night = nighttime SUHI intensity (was 'Daytime' band)
 *
 * Value range: -1.5 (cooler than rural) to 7.5 (much hotter)
 */

// ── In-memory cache
let citiesIndexCache = null
const cityDataCache = {}

// Base path for GEE JSON files
// Vite serves the public/ folder at the root, so files in public/data/gee/
// are accessible at /data/gee/ in both dev and production.
const DATA_BASE = '/data/gee'

// ─────────────────────────────────────────
// loadCitiesIndex
// ─────────────────────────────────────────
/**
 * Load cities_index.json once and cache.
 * @returns {Promise<object|null>}  The index object, or null on failure.
 */
export async function loadCitiesIndex() {
  if (citiesIndexCache) return citiesIndexCache

  try {
    const response = await fetch(`${DATA_BASE}/cities_index.json`)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    citiesIndexCache = await response.json()
    return citiesIndexCache
  } catch {
    // cities_index.json not yet generated — silently return null
    return null
  }
}

// ─────────────────────────────────────────
// loadCityData
// ─────────────────────────────────────────
/**
 * Lazy-load a city's UHI JSON.  Caches result so same city is never re-fetched.
 * @param {string} cityName  e.g. 'Delhi'
 * @returns {Promise<object|null>}
 */
export async function loadCityData(cityName) {
  const key = cityName.toLowerCase()
  if (cityDataCache[key]) return cityDataCache[key]

  // Check the index first
  const index = await loadCitiesIndex()
  if (!index) return null

  const entry = index.cities?.find(
    (c) => c.name.toLowerCase() === key
  )
  if (!entry?.available) return null

  try {
    const response = await fetch(`${DATA_BASE}/${entry.file}`)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = await response.json()
    cityDataCache[key] = data
    return data
  } catch {
    return null
  }
}

// ─────────────────────────────────────────
// getUHIData
// ─────────────────────────────────────────
/**
 * Get array of {lat, lon, intensity} for all sampled pixels.
 * @param {string} cityName
 * @param {string} year      e.g. '2018'
 * @param {'day'|'night'} timeOfDay
 * @returns {Promise<Array<{lat:number, lon:number, intensity:number}>>}
 */
export async function getUHIData(cityName, year, timeOfDay = 'day') {
  const data = await loadCityData(cityName)
  if (!data?.pixels) return []

  return data.pixels
    .filter((px) => px[timeOfDay]?.[year] !== undefined)
    .map((px) => ({
      lat: px.lat,
      lon: px.lon,
      intensity: px[timeOfDay][year],
    }))
}

// ─────────────────────────────────────────
// getHottestZones
// ─────────────────────────────────────────
/**
 * Return top N hottest pixels for a given city/year/daytime.
 * @param {string} cityName
 * @param {string} year
 * @param {number} topN
 * @returns {Promise<Array<{lat, lon, intensity, rank}>>}
 */
export async function getHottestZones(cityName, year = '2018', topN = 3) {
  const pixels = await getUHIData(cityName, year, 'day')
  return pixels
    .sort((a, b) => b.intensity - a.intensity)
    .slice(0, topN)
    .map((px, i) => ({ ...px, rank: i + 1 }))
}

// ─────────────────────────────────────────
// getCoolestZones
// ─────────────────────────────────────────
/**
 * Return top N coolest pixels.
 * @param {string} cityName
 * @param {string} year
 * @param {number} topN
 * @returns {Promise<Array<{lat, lon, intensity, rank}>>}
 */
export async function getCoolestZones(cityName, year = '2018', topN = 3) {
  const pixels = await getUHIData(cityName, year, 'day')
  return pixels
    .sort((a, b) => a.intensity - b.intensity)
    .slice(0, topN)
    .map((px, i) => ({ ...px, rank: i + 1 }))
}

// ─────────────────────────────────────────
// getTemperatureTrend
// ─────────────────────────────────────────
/**
 * Year-by-year average SUHI for day and night.
 * Also computes totalWarming and warmingPerDecade.
 *
 * @param {string} cityName
 * @returns {Promise<{
 *   years: string[],
 *   dayValues: number[],
 *   nightValues: number[],
 *   totalWarming: number,
 *   warmingPerDecade: number
 * }|null>}
 */
export async function getTemperatureTrend(cityName) {
  const data = await loadCityData(cityName)
  if (!data?.stats) return null

  const years = data.years ?? Object.keys(data.stats).sort()

  const dayValues = []
  const nightValues = []

  for (const yr of years) {
    const s = data.stats[yr]
    if (s) {
      dayValues.push(s.day_mean ?? null)
      nightValues.push(s.night_mean ?? null)
    } else {
      dayValues.push(null)
      nightValues.push(null)
    }
  }

  // Compute warming from first to last available year
  const validDay = dayValues.filter((v) => v !== null)
  const first = validDay[0] ?? 0
  const last = validDay[validDay.length - 1] ?? 0
  const totalWarming = parseFloat((last - first).toFixed(2))
  const totalYears = years.length > 1 ? (parseInt(years[years.length - 1]) - parseInt(years[0])) : 15
  const warmingPerDecade = parseFloat(((totalWarming / totalYears) * 10).toFixed(2))

  return {
    years,
    dayValues,
    nightValues,
    totalWarming,
    warmingPerDecade,
  }
}

// ─────────────────────────────────────────
// getCityStats
// ─────────────────────────────────────────
/**
 * Return stats for a given city and year.
 * @param {string} cityName
 * @param {string} year
 * @returns {Promise<{
 *   day_mean, day_max, day_min,
 *   night_mean, night_max, night_min
 * }|null>}
 */
export async function getCityStats(cityName, year = '2018') {
  const data = await loadCityData(cityName)
  return data?.stats?.[year] ?? null
}

// ─────────────────────────────────────────
// isCityAvailable
// ─────────────────────────────────────────
/**
 * Quick check whether a city has exported GEE data.
 * @param {string} cityName
 * @returns {Promise<boolean>}
 */
export async function isCityAvailable(cityName) {
  const index = await loadCitiesIndex()
  if (!index) return false
  const key = cityName.toLowerCase()
  return index.cities?.some(
    (c) => c.name.toLowerCase() === key && c.available
  ) ?? false
}

// ─────────────────────────────────────────
// Part 4 — NDVI Data Loading
// ─────────────────────────────────────────

const ndviCache = {}
const tcCache = {}

/**
 * loadNDVIData — lazy-load Sentinel-2 NDVI JSON for a city.
 * @param {string} cityName
 * @returns {Promise<{city,date,pixels}|null>}
 */
export async function loadNDVIData(cityName) {
  const key = cityName.toLowerCase()
  if (ndviCache[key]) return ndviCache[key]

  const index = await loadCitiesIndex()
  if (!index) return null

  const entry = index.cities?.find((c) => c.name.toLowerCase() === key)
  if (!entry?.ndviAvailable) return null

  const filename = entry.ndviFile || `${key.replace(/ /g, '_')}_ndvi.json`
  try {
    const r = await fetch(`${DATA_BASE}/${filename}`)
    if (!r.ok) return null
    const data = await r.json()
    ndviCache[key] = data
    return data
  } catch {
    return null
  }
}

/**
 * loadTreeCoverData — lazy-load Hansen tree cover JSON for a city.
 * @param {string} cityName
 * @returns {Promise<{city,year,pixels}|null>}
 */
export async function loadTreeCoverData(cityName) {
  const key = cityName.toLowerCase()
  if (tcCache[key]) return tcCache[key]

  const index = await loadCitiesIndex()
  if (!index) return null

  const entry = index.cities?.find((c) => c.name.toLowerCase() === key)
  if (!entry?.tcAvailable) return null

  const filename = entry.treecoverFile || `${key.replace(/ /g, '_')}_treecover.json`
  try {
    const r = await fetch(`${DATA_BASE}/${filename}`)
    if (!r.ok) return null
    const data = await r.json()
    tcCache[key] = data
    return data
  } catch {
    return null
  }
}

/**
 * isCityNDVIAvailable — quick availability check for NDVI data.
 * @param {string} cityName
 * @returns {Promise<boolean>}
 */
export async function isCityNDVIAvailable(cityName) {
  const index = await loadCitiesIndex()
  if (!index) return false
  const key = cityName.toLowerCase()
  return index.cities?.some(
    (c) => c.name.toLowerCase() === key && c.ndviAvailable
  ) ?? false
}

/**
 * isCityTCAvailable — quick availability check for tree cover data.
 * @param {string} cityName
 * @returns {Promise<boolean>}
 */
export async function isCityTCAvailable(cityName) {
  const index = await loadCitiesIndex()
  if (!index) return false
  const key = cityName.toLowerCase()
  return index.cities?.some(
    (c) => c.name.toLowerCase() === key && c.tcAvailable
  ) ?? false
}

