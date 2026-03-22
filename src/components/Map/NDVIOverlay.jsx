/**
 * NDVIOverlay.jsx — Part 4C
 * ===========================
 * Renders NDVI and/or tree cover pixels as colored circles on the Leaflet map.
 * Modes: 'trees' (NDVI overlay) | 'combined' (NDVI + UHI combined)
 *
 * Handles gracefully when no GEE data has been exported yet.
 */

import { useEffect, useState, Component } from 'react'
import { CircleMarker, Tooltip } from 'react-leaflet'
import { getNDVICategory, combinedHeatGreenScore } from '../../utils/calculations'
import { loadNDVIData, loadTreeCoverData, getUHIData } from '../../services/geeAPI'

// ── Haversine distance (km) between two lat/lon points ─────────
function haversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLon = (lon2 - lon1) * Math.PI / 180
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) *
        Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) ** 2
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

const MAX_RADIUS_KM = 15  // Only render pixels within 15km of city center

// ── Color helpers ──────────────────────────────────────────────
function ndviColor(ndvi) {
    if (ndvi < 0.1) return '#808080'
    if (ndvi < 0.3) return '#ffff99'
    if (ndvi < 0.6) return '#86cf6e'
    return '#1a7a1a'
}

function combinedColor(score) {
    if (score < 3) return '#1a7a1a'
    if (score < 5) return '#86cf6e'
    if (score < 7) return '#fd8d3c'
    if (score < 8.5) return '#e31a1c'
    return '#7b0018'
}

// ── Error Boundary to prevent entire React tree from crashing ──
class OverlayErrorBoundary extends Component {
    constructor(props) {
        super(props)
        this.state = { hasError: false }
    }
    static getDerivedStateFromError() {
        return { hasError: true }
    }
    componentDidCatch(err) {
        console.warn('[NDVIOverlay] Render error caught:', err)
    }
    render() {
        if (this.state.hasError) return null
        return this.props.children
    }
}

// ── Single pixel marker ────────────────────────────────────────
function PixelMarker({ px, index, mode }) {
    // Guard: skip pixels with missing coordinates
    if (px.lat == null || px.lon == null || isNaN(px.lat) || isNaN(px.lon)) return null

    // Guard: skip ocean/water pixels — NDVI < -0.05 = water (Bay of Bengal, Arabian Sea, etc.)
    if ((px.ndvi ?? 0) < -0.05) return null

    const ndvi = px.ndvi ?? 0
    const score = px.combinedScore ?? 5
    const color = mode === 'combined' ? combinedColor(score) : ndviColor(ndvi)
    const isCritical = mode === 'combined' && score >= 8
    const cat = getNDVICategory(ndvi)

    return (
        <CircleMarker
            key={`ndvi-${index}`}
            center={[px.lat, px.lon]}
            radius={isCritical ? 9 : 6}
            pathOptions={{
                color: isCritical ? '#ffffff' : 'transparent',
                weight: isCritical ? 1.5 : 0,
                fillColor: color,
                fillOpacity: 0.75,
            }}
        >
            <Tooltip sticky>
                <div style={{ fontSize: 12 }}>
                    {isCritical && (
                        <div style={{ color: '#ff4444', fontWeight: 700, marginBottom: 4 }}>
                            ⚠️ CRITICAL ZONE
                        </div>
                    )}
                    <strong>NDVI: {ndvi.toFixed(3)}</strong>
                    <br />
                    <span style={{ color: cat.color }}>● {cat.label}</span>
                    <br />
                    <span style={{ color: '#aaa' }}>{cat.description}</span>
                    {px.treecover != null && (
                        <>
                            <br />
                            🌳 Tree cover: {px.treecover}%
                        </>
                    )}
                    {px.suhi != null && (
                        <>
                            <br />
                            🌡️ SUHI: {Number(px.suhi).toFixed(1)}°C
                        </>
                    )}
                    {isCritical && (
                        <>
                            <br />
                            <span style={{ color: '#ffd700' }}>
                                Hot because: Low tree cover combined with dense concrete
                            </span>
                        </>
                    )}
                </div>
            </Tooltip>
        </CircleMarker>
    )
}

// ── Main NDVIOverlay ────────────────────────────────────────────
export default function NDVIOverlay({ city, mode }) {
    const [pixels, setPixels] = useState([])
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (!city || mode === 'heat') {
            setPixels([])
            return
        }
        let cancelled = false
        setLoading(true)

        async function load() {
            try {
                // Load NDVI first — if unavailable, stop early
                const ndviData = await loadNDVIData(city.name)
                if (cancelled) return
                if (!ndviData?.pixels?.length) {
                    setPixels([])
                    setLoading(false)
                    return
                }

                // Load tree cover + optionally UHI (for combined mode)
                let tcData = null
                let suhiPixels = []
                try {
                    tcData = await loadTreeCoverData(city.name)
                } catch { /* ignore */ }

                if (mode === 'combined') {
                    try {
                        suhiPixels = await getUHIData(city.name, '2018', 'day') || []
                    } catch { /* ignore */ }
                }

                if (cancelled) return

                // Build lookups
                const suhiMap = {}
                if (Array.isArray(suhiPixels)) {
                    suhiPixels.forEach((px) => {
                        const key = `${Math.round(px.lat * 100)}:${Math.round(px.lon * 100)}`
                        suhiMap[key] = px.intensity
                    })
                }

                const tcMap = {}
                if (tcData?.pixels) {
                    tcData.pixels.forEach((px) => {
                        const key = `${Math.round(px.lat * 100)}:${Math.round(px.lon * 100)}`
                        tcMap[key] = px.treecover
                    })
                }

                const merged = ndviData.pixels
                    .filter((px) => px.lat != null && px.lon != null)
                    // Urban filter: NDVI 0.05–0.50 (exclude water/concrete/crops/forest)
                    .filter((px) => (px.ndvi ?? 0) >= 0.05 && (px.ndvi ?? 0) <= 0.50)
                    // Remove pixels outside 15km of city center (rural areas, suburbs)
                    .filter((px) => haversineKm(px.lat, px.lon, city.latitude, city.longitude) <= MAX_RADIUS_KM)
                    .map((px) => {
                        const lookupKey = `${Math.round(px.lat * 100)}:${Math.round(px.lon * 100)}`
                        const suhi = suhiMap[lookupKey] ?? null
                        const tc = tcMap[lookupKey] ?? null
                        return {
                            ...px,
                            suhi,
                            treecover: tc,
                            combinedScore: mode === 'combined' && suhi !== null
                                ? combinedHeatGreenScore(suhi, px.ndvi ?? 0)
                                : null,
                        }
                    })

                setPixels(merged)
            } catch (err) {
                console.warn('[NDVIOverlay] Data load error:', err)
                setPixels([])
            }
            if (!cancelled) setLoading(false)
        }

        load()
        return () => { cancelled = true }
    }, [city, mode])

    // Don't render anything if no data
    if (mode === 'heat' || !pixels.length) return null

    return (
        <OverlayErrorBoundary>
            {pixels.map((px, i) => (
                <PixelMarker key={`ndvi-${i}`} px={px} index={i} mode={mode} />
            ))}
        </OverlayErrorBoundary>
    )
}

// ── Legend helper (used by IndiaMap) ──────────────────────────
export function NDVILegend({ mode }) {
    const items = mode === 'combined'
        ? [
            { color: '#1a7a1a', label: 'Low risk (green + cool)' },
            { color: '#86cf6e', label: 'Moderate risk' },
            { color: '#fd8d3c', label: 'High risk' },
            { color: '#e31a1c', label: 'Critical zone' },
            { color: '#7b0018', label: 'Extreme — priority' },
        ]
        : [
            { color: '#808080', label: '< 0.1 Concrete/Built-up' },
            { color: '#ffff99', label: '0.1–0.3 Sparse vegetation' },
            { color: '#86cf6e', label: '0.3–0.6 Parks & gardens' },
            { color: '#1a7a1a', label: '> 0.6 Dense forest' },
        ]

    return (
        <div className="ndvi-legend">
            {items.map(({ color, label }) => (
                <div key={color} className="heat-legend-item">
                    <span className="heat-legend-swatch" style={{ background: color }} />
                    <span>{label}</span>
                </div>
            ))}
        </div>
    )
}
