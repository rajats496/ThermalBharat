import { AQI_LEVELS, HEAT_LEVELS, RISK_THRESHOLDS } from './constants'

const dayNamesHindi = {
  Monday: 'सोमवार',
  Tuesday: 'मंगलवार',
  Wednesday: 'बुधवार',
  Thursday: 'गुरुवार',
  Friday: 'शुक्रवार',
  Saturday: 'शनिवार',
  Sunday: 'रविवार'
}

export function formatPopulation(population) {
  return new Intl.NumberFormat('en-IN').format(population)
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function pickLevel(levelMap, value) {
  return Object.values(levelMap).find((entry) => value <= entry.max) || Object.values(levelMap).at(-1)
}

export function getHeatLevel(tempC) {
  return pickLevel(HEAT_LEVELS, tempC)
}

export function getAQILevel(aqiValue) {
  return pickLevel(AQI_LEVELS, aqiValue)
}

export function getRiskBand(score) {
  return pickLevel(RISK_THRESHOLDS, score)
}

export function getRiskLabel(score) {
  if (score <= 3) {
    return { label: 'Low', labelHindi: 'कम जोखिम' }
  }
  if (score <= 5) {
    return { label: 'Medium', labelHindi: 'मध्यम जोखिम' }
  }
  if (score <= 7) {
    return { label: 'High', labelHindi: 'उच्च जोखिम' }
  }
  if (score <= 9) {
    return { label: 'Extreme', labelHindi: 'अत्यधिक जोखिम' }
  }
  return { label: 'Deadly', labelHindi: 'जानलेवा जोखिम' }
}

export function calculateCombinedRisk({ temp = 30, humidity = 50, aqi_value = 50, feels_like = 30 }) {
  const tempScore = clamp((temp - 30) / 2, 0, 10)
  const humidityScore = clamp(humidity / 10, 0, 10)
  const aqiScore = clamp(aqi_value / 50, 0, 10)
  const feelsLikeScore = clamp((feels_like - 30) / 2, 0, 10)

  const finalScore = clamp(
    tempScore * 0.4 + humidityScore * 0.2 + aqiScore * 0.2 + feelsLikeScore * 0.2,
    0,
    10
  )

  return Number(finalScore.toFixed(1))
}

export function formatLastUpdated(lastUpdatedEpochMs) {
  if (!lastUpdatedEpochMs) {
    return 'Last updated just now'
  }
  const minutes = Math.max(0, Math.floor((Date.now() - lastUpdatedEpochMs) / 60000))
  return `Last updated ${minutes} mins ago`
}

export function toKmPerHour(speedMs) {
  return Number((speedMs * 3.6).toFixed(1))
}

export function getHindiDayName(englishDayName) {
  return dayNamesHindi[englishDayName] || englishDayName
}

export function findConsecutiveHeatwaveDays(forecast = [], threshold = 43) {
  let count = 0
  let maxCount = 0
  let highestTemp = -Infinity

  forecast.forEach((day) => {
    if (day.max_temp >= threshold) {
      count += 1
      maxCount = Math.max(maxCount, count)
      highestTemp = Math.max(highestTemp, day.max_temp)
    } else {
      count = 0
    }
  })

  return {
    days: maxCount,
    highestTemp: highestTemp === -Infinity ? null : highestTemp
  }
}

export function haversineDistanceKm(lat1, lon1, lat2, lon2) {
  const toRad = (value) => (value * Math.PI) / 180
  const earthRadius = 6371
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return earthRadius * c
}

export function findNearestCoolingCenter(city, centers) {
  const cityCenters = centers.filter((center) => center.city === city.name)
  if (!cityCenters.length) {
    return null
  }

  let nearest = null
  cityCenters.forEach((center) => {
    const distance = haversineDistanceKm(city.latitude, city.longitude, center.latitude, center.longitude)
    if (!nearest || distance < nearest.distanceKm) {
      nearest = {
        ...center,
        distanceKm: distance
      }
    }
  })

  return nearest
}

// ═══════════════════════════════════════════════════════
// PART 4B — Green Cover & Tree Planting Calculations
// ═══════════════════════════════════════════════════════

/**
 * isWaterPixel -- water/ocean pixels have NDVI < -0.05
 * Threshold matches gee_export.py's NDVI < -0.05 filter.
 * @param {number} ndvi
 * @returns {boolean}
 */
export function isWaterPixel(ndvi) {
  return ndvi < -0.05
}

/**
 * treesNeeded -- how many trees required to reach target NDVI of 0.30
 * Skips water pixels (NDVI < -0.1) automatically.
 * @param {number} ndviCurrent  e.g. 0.05
 * @param {number} pixelAreaSqM default 1_000_000 (1 km2 pixel)
 * @returns {number} integer count of trees needed
 */
export function treesNeeded(ndviCurrent, pixelAreaSqM = 1_000_000) {
  // Water pixels should not contribute to tree count
  if (isWaterPixel(ndviCurrent)) return 0
  const TARGET_NDVI = 0.30
  if (ndviCurrent >= TARGET_NDVI) return 0
  const ndviGap = TARGET_NDVI - ndviCurrent
  const CANOPY_PER_TREE_SQM = 20
  return Math.round((ndviGap * pixelAreaSqM) / CANOPY_PER_TREE_SQM)
}

/**
 * capTreesForCity -- realistic cap on total trees per city
 * Small city (pop < 3M): max 50 lakh (5,000,000)
 * Large city (pop >= 3M): max 1 crore (10,000,000)
 * @param {number} totalTrees  uncapped sum
 * @param {number} population  city population
 * @returns {number} capped count
 */
export function capTreesForCity(totalTrees, population = 1_000_000) {
  const MAX_SMALL = 5_000_000   // 50 lakh
  const MAX_LARGE = 10_000_000  // 1 crore
  const cap = population >= 3_000_000 ? MAX_LARGE : MAX_SMALL
  return Math.min(totalTrees, cap)
}

/**
 * coolingFromTrees — temperature reduction from planted trees
 * @param {number} treesPlanted
 * @returns {number} °C cooling (capped at 5°C)
 */
export function coolingFromTrees(treesPlanted) {
  const COOLING_PER_TREE = 0.05 // °C per tree (research estimate)
  return Math.min(treesPlanted * COOLING_PER_TREE, 5)
}

/**
 * electricitySavings — annual electricity bill savings from cooling
 * @param {number} coolingDegrees  °C of cooling achieved
 * @param {number} population
 * @returns {number} savings in ₹ (rupees)
 */
export function electricitySavings(coolingDegrees, population) {
  const REDUCTION_PER_DEGREE = 0.02  // 2% per °C
  const AVG_MONTHLY_BILL = 800       // ₹
  const MONTHS = 12
  const householdsAffected = population / 4
  return Math.round(
    coolingDegrees * REDUCTION_PER_DEGREE * AVG_MONTHLY_BILL * MONTHS * householdsAffected
  )
}

/**
 * heatIllnessReduction — % reduction in heat-related illness (WHO research)
 * @param {number} coolingDegrees
 * @returns {number} percentage reduction (capped at 40%)
 */
export function heatIllnessReduction(coolingDegrees) {
  return Math.min(coolingDegrees * 8, 40)
}

/**
 * treePlantingCost — total cost at Indian government rate ₹1000/tree
 * @param {number} trees
 * @returns {number} cost in ₹
 */
export function treePlantingCost(trees) {
  const COST_PER_TREE = 1000 // ₹
  return trees * COST_PER_TREE
}

/**
 * carbonAbsorption — annual CO₂ absorbed by planted trees
 * @param {number} trees
 * @returns {number} kg CO₂ per year
 */
export function carbonAbsorption(trees) {
  const KG_CO2_PER_TREE = 21
  return trees * KG_CO2_PER_TREE
}

/**
 * getNDVICategory — returns label, color, and description for an NDVI value
 * @param {number} ndvi  -0.1 to 0.9
 * @returns {{ label, color, description }}
 */
export function getNDVICategory(ndvi) {
  if (ndvi < 0.1) {
    return { label: 'Concrete/Built-up', color: '#808080', description: 'Roads, buildings, low vegetation' }
  }
  if (ndvi < 0.3) {
    return { label: 'Sparse Vegetation', color: '#ffff99', description: 'Sparse grass, dry land' }
  }
  if (ndvi < 0.6) {
    return { label: 'Moderate Green', color: '#86cf6e', description: 'Parks, gardens, mixed vegetation' }
  }
  return { label: 'Dense Forest', color: '#1a7a1a', description: 'Dense forest, full tree canopy' }
}

/**
 * combinedHeatGreenScore — combined risk score from SUHI + NDVI inverse
 * High score = hottest + least green = highest priority for intervention
 * @param {number} suhi  -1.5 to 7.5
 * @param {number} ndvi  -0.1 to 0.9
 * @returns {number} 0–10 score
 */
export function combinedHeatGreenScore(suhi, ndvi) {
  // Normalize SUHI: scale -1.5–7.5 → 0–1
  const suhiNorm = Math.max(0, Math.min(1, (suhi + 1.5) / 9.0))
  // Invert NDVI: high NDVI → low risk, scale 0–0.9 → 0–1 inverted
  const ndviInv = Math.max(0, Math.min(1, 1 - ndvi / 0.9))
  return parseFloat(((suhiNorm * 0.6 + ndviInv * 0.4) * 10).toFixed(1))
}
