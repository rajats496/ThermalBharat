/**
 * TreePlantingCalculator.jsx — Part 4D
 * =======================================
 * Dedicated panel for auto-detected priority zones and city-wide impact estimates.
 * Uses NDVI + SUHI data to find: NDVI < 0.1 AND SUHI > 6 zones.
 */

import { useEffect, useState } from 'react'
import {
    treesNeeded as calcTreesNeeded,  // renamed to avoid collision with local computed variable
    coolingFromTrees,
    electricitySavings,
    heatIllnessReduction,
    treePlantingCost,
    carbonAbsorption,
    getNDVICategory,
    isWaterPixel,
    capTreesForCity,
} from '../../utils/calculations'
import { loadNDVIData, getUHIData } from '../../services/geeAPI'

const TARGET_NDVI = 0.30
const PIXEL_AREA_SQM = 1_000_000

// ── Reverse geocode via Nominatim ─────────────────────────────
async function reverseGeocode(lat, lon) {
    try {
        const r = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`,
            { headers: { 'Accept-Language': 'en' } }
        )
        const d = await r.json()
        const a = d.address || {}
        return (
            a.suburb || a.neighbourhood || a.village ||
            a.town || a.city_district || a.county ||
            `${lat.toFixed(2)}°N, ${lon.toFixed(2)}°E`
        )
    } catch {
        return `${lat.toFixed(2)}°N, ${lon.toFixed(2)}°E`
    }
}

// ── Format helpers (NaN-safe) ─────────────────────────────────
function fmtLakh(n) {
    const safe = isFinite(n) && n >= 0 ? n : 0
    if (safe >= 10_000_000) return `${(safe / 10_000_000).toFixed(1)} cr`
    if (safe >= 100_000) return `${(safe / 100_000).toFixed(1)} lakh`
    return safe.toLocaleString('en-IN')
}
function fmtCrore(n) {
    const safe = isFinite(n) && n >= 0 ? n : 0
    if (safe >= 10_000_000) return `₹${(safe / 10_000_000).toFixed(1)} crore`
    return `₹${safe.toLocaleString('en-IN')}`
}

// ── Priority Zone Card ────────────────────────────────────────
function PriorityZoneCard({ zone, rank, population }) {
    const cat = getNDVICategory(zone.ndvi)
    const trees = calcTreesNeeded(zone.ndvi, PIXEL_AREA_SQM) || 0
    const cooling = coolingFromTrees(trees) || 0

    return (
        <div className="priority-zone-card">
            <div className="pz-header">
                <span className="pz-rank">#{rank}</span>
                <div className="pz-location">
                    <strong>{zone.label || `Zone ${rank}`}</strong>
                    <small>{zone.lat.toFixed(3)}°N, {zone.lon.toFixed(3)}°E</small>
                </div>
                <span className="pz-badge critical">CRITICAL</span>
            </div>

            <div className="pz-stats">
                <div className="pz-stat">
                    <span className="pz-stat-label">Current NDVI</span>
                    <span className="pz-stat-value" style={{ color: cat.color }}>
                        {zone.ndvi.toFixed(2)} 🔴
                    </span>
                    <span className="pz-stat-desc">{cat.label}</span>
                </div>
                <div className="pz-stat">
                    <span className="pz-stat-label">Heat Intensity</span>
                    <span className="pz-stat-value" style={{ color: '#ff4444' }}>
                        +{zone.suhi.toFixed(1)}°C
                    </span>
                    <span className="pz-stat-desc">above rural areas</span>
                </div>
                <div className="pz-stat">
                    <span className="pz-stat-label">Trees Needed</span>
                    <span className="pz-stat-value" style={{ color: '#00cc88' }}>
                        {trees.toLocaleString('en-IN')}
                    </span>
                    <span className="pz-stat-desc">to reach 30% NDVI</span>
                </div>
                <div className="pz-stat">
                    <span className="pz-stat-label">Cooling Effect</span>
                    <span className="pz-stat-value" style={{ color: '#4488ff' }}>
                        {cooling.toFixed(1)}°C
                    </span>
                    <span className="pz-stat-desc">temperature reduction</span>
                </div>
            </div>
        </div>
    )
}

// ── City-Wide Impact Summary ──────────────────────────────────
// totalTreesRaw: the computed number stored in state (NOT the imported fn)
function CityImpactSummary({ allLowNDVI, suhiMean, population, cityName, totalTreesRaw }) {
    if (!allLowNDVI.length) return null

    // Safety guards: ensure all inputs are valid numbers before any calculation
    const pop       = (isFinite(population) && population > 0) ? population : 1_000_000
    const rawTrees  = (isFinite(totalTreesRaw) && totalTreesRaw > 0) ? totalTreesRaw : 0

    const totalTrees    = capTreesForCity(rawTrees, pop) || 0
    const totalCooling  = coolingFromTrees(totalTrees) || 0
    const elecSavings   = electricitySavings(totalCooling, pop) || 0
    const illnessReduce = heatIllnessReduction(totalCooling) || 0
    const totalCost     = treePlantingCost(totalTrees) || 0
    const carbonAbs     = carbonAbsorption(totalTrees) || 0
    const payback       = totalCooling > 0 && elecSavings > 0
        ? Math.round(totalCost / elecSavings)
        : null

    return (
        <div className="detail-card tpc-impact-card">
            <h4>🌆 City-Wide Impact — {cityName}</h4>

            <div className="tpc-impact-grid">
                <div className="tpc-impact-item">
                    <span className="tpc-impact-icon">🌳</span>
                    <span className="tpc-impact-value">{fmtLakh(totalTrees)}</span>
                    <span className="tpc-impact-label">Total trees needed</span>
                </div>
                <div className="tpc-impact-item">
                    <span className="tpc-impact-icon">🌡️</span>
                    <span className="tpc-impact-value">{totalCooling.toFixed(1)}°C</span>
                    <span className="tpc-impact-label">Total cooling</span>
                </div>
                <div className="tpc-impact-item">
                    <span className="tpc-impact-icon">👥</span>
                    <span className="tpc-impact-value">{fmtLakh(pop)}</span>
                    <span className="tpc-impact-label">People with cooler summers</span>
                </div>
                <div className="tpc-impact-item">
                    <span className="tpc-impact-icon">🏥</span>
                    <span className="tpc-impact-value">{illnessReduce.toFixed(0)}%</span>
                    <span className="tpc-impact-label">Heat illness reduction</span>
                </div>
                <div className="tpc-impact-item">
                    <span className="tpc-impact-icon">💡</span>
                    <span className="tpc-impact-value">{fmtCrore(elecSavings)}/yr</span>
                    <span className="tpc-impact-label">Electricity savings</span>
                </div>
                <div className="tpc-impact-item">
                    <span className="tpc-impact-icon">🌿</span>
                    <span className="tpc-impact-value">{fmtLakh(carbonAbs)} kg</span>
                    <span className="tpc-impact-label">CO₂ absorbed per year</span>
                </div>
                <div className="tpc-impact-item">
                    <span className="tpc-impact-icon">💰</span>
                    <span className="tpc-impact-value">{fmtCrore(totalCost)}</span>
                    <span className="tpc-impact-label">Total planting cost</span>
                </div>
                {payback !== null && (
                    <div className="tpc-impact-item">
                        <span className="tpc-impact-icon">⏱️</span>
                        <span className="tpc-impact-value">{payback} yrs</span>
                        <span className="tpc-impact-label">Payback period</span>
                    </div>
                )}
            </div>

            <p className="tpc-disclaimer">
                Estimates based on published research. Actual results depend on tree species and urban conditions.
            </p>
        </div>
    )
}

// ── Main TreePlantingCalculator ───────────────────────────────
export default function TreePlantingCalculator({ city, detailData, onTreesComputed }) {
    const [loading, setLoading]               = useState(false)
    const [priorityZones, setPriorityZones]   = useState([])
    const [allLowNDVI, setAllLowNDVI]         = useState([])
    const [noData, setNoData]                 = useState(false)
    const [suhiMean, setSuhiMean]             = useState(null)
    const [totalTreesCalc, setTotalTreesCalc] = useState(0)  // ← stores the computed NUMBER

    const population = city?.population ?? 1_000_000

    useEffect(() => {
        if (!city) return
        let cancelled = false
        setLoading(true)
        setNoData(false)
        setPriorityZones([])
        setTotalTreesCalc(0)

        async function compute() {
            const [ndviData, suhiPixels] = await Promise.all([
                loadNDVIData(city.name),
                getUHIData(city.name, '2018', 'day'),
            ])

            if (cancelled) return

            if (!ndviData?.pixels?.length) {
                setNoData(true)
                setLoading(false)
                return
            }

            // Build SUHI lookup
            const suhiMap = {}
            suhiPixels.forEach((px) => {
                const key = `${px.lat.toFixed(2)}_${px.lon.toFixed(2)}`
                suhiMap[key] = px.intensity
            })

            const suhiValues = suhiPixels.map((p) => p.intensity)
            if (suhiValues.length) {
                setSuhiMean(suhiValues.reduce((a, b) => a + b, 0) / suhiValues.length)
            }

            // Urban filter: NDVI 0.05–0.50 (exclude water/concrete/crops/forest)
            const urbanPixels = ndviData.pixels.filter(p => p.ndvi >= 0.05 && p.ndvi <= 0.50)

            // Only 15% of urban pixel is plantable
            const pixelArea    = 1_000_000 * 0.15  // 150,000 sqm per pixel
            const canopyPerTree = 20

            // City-wide intervention: urban pixels below 30% NDVI target
            const belowTargetNDVI = urbanPixels.filter((px) => px.ndvi < TARGET_NDVI)
            setAllLowNDVI(belowTargetNDVI)

            // Compute total trees needed — use a different name to avoid shadowing the import
            const computedTrees = belowTargetNDVI.reduce((total, px) => {
                const gap = Math.max(0, TARGET_NDVI - px.ndvi)
                return total + Math.round(gap * pixelArea / canopyPerTree)
            }, 0)

            console.log(`[TreeCalc][${city.name}] Urban pixels NDVI 0.05–0.50: ${urbanPixels.length}`)
            console.log(`[TreeCalc][${city.name}] Pixels below target (${TARGET_NDVI}): ${belowTargetNDVI.length}`)
            console.log(`[TreeCalc][${city.name}] computedTrees (city-wide): ${computedTrees}`)

            // Critical hotspot subset: NDVI < 0.1 land pixels
            const landPixels = ndviData.pixels.filter((px) => !isWaterPixel(px.ndvi))
            const lowNDVI    = landPixels.filter((px) => px.ndvi < 0.1)

            // Priority zones: NDVI < 0.1 AND SUHI > 6
            const criticalPixels = lowNDVI
                .map((px) => {
                    const key  = `${px.lat.toFixed(2)}_${px.lon.toFixed(2)}`
                    const suhi = suhiMap[key] ?? null
                    return { ...px, suhi }
                })
                .filter((px) => px.suhi !== null && px.suhi > 6)
                .sort((a, b) => (b.suhi - b.ndvi) - (a.suhi - a.ndvi))

            // Top 5, reverse-geocoded for display labels
            const top5    = criticalPixels.slice(0, 5)
            const labelled = await Promise.all(
                top5.map(async (px) => ({
                    ...px,
                    label: await reverseGeocode(px.lat, px.lon),
                }))
            )

            if (!cancelled) {
                setPriorityZones(labelled)
                setTotalTreesCalc(computedTrees)
                onTreesComputed?.({ totalTrees: computedTrees, suhiMean: suhiValues.length
                  ? suhiValues.reduce((a,b)=>a+b,0)/suhiValues.length
                  : null })
                setLoading(false)
            }
        }

        compute()
        return () => { cancelled = true }
    }, [city])

    if (!city) return null

    return (
        <div className="detail-card tpc-root">
            <h4>🌳 Tree Planting Calculator</h4>

            {loading && (
                <div className="suhi-loading">
                    <span className="spinner" />
                    <span>Analyzing green cover data for {city.name}...</span>
                </div>
            )}

            {!loading && noData && (
                <div className="suhi-unavailable">
                    <p>Tree & NDVI data not yet available for {city.name}.</p>
                    <p>Run <code>gee_export.py</code> to enable this feature.</p>
                    <small className="suhi-credit">
                        🌿 Tree data: Sentinel-2 ESA / Hansen Global Forest Watch
                    </small>
                </div>
            )}

            {!loading && !noData && priorityZones.length > 0 && (
                <>
                    <p className="tpc-subtitle">
                        🔴 Auto-detected critical zones: low tree cover + intense heat
                    </p>
                    {priorityZones.map((zone, i) => (
                        <PriorityZoneCard
                            key={`${zone.lat}_${zone.lon}`}
                            zone={zone}
                            rank={i + 1}
                            population={population}
                        />
                    ))}
                </>
            )}

            {!loading && !noData && priorityZones.length === 0 && (
                <p className="suhi-unavailable">
                    No zones with NDVI &lt; 0.1 AND SUHI &gt; 6°C found.
                    This city has relatively good green cover in its hottest areas!
                </p>
            )}

            {!loading && !noData && (
                <CityImpactSummary
                    allLowNDVI={allLowNDVI}
                    suhiMean={suhiMean}
                    population={population}
                    cityName={city.name}
                    totalTreesRaw={totalTreesCalc}   // ← number from state, never a fn ref
                />
            )}

            {/* Success story */}
            {!loading && (
                <div className="detail-card tpc-success-card">
                    <div className="tpc-success-icon">🌎</div>
                    <h5>Success Story — Medellín, Colombia</h5>
                    <p>
                        Planted trees in urban heat corridors → City cooled by{' '}
                        <strong>3.5°C in 6 years</strong> → Model for Indian cities facing
                        similar urban heat challenges.
                    </p>
                </div>
            )}

            <small className="suhi-credit">
                🌿 Tree data: Sentinel-2 ESA / Hansen Global Forest Watch
            </small>
        </div>
    )
}
