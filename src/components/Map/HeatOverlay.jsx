/**
 * HeatOverlay.jsx — Satellite UHI Heat Map Overlay for Leaflet
 * =============================================================
 * Renders colored circle markers for each sampled pixel.
 * Includes year slider, day/night toggle, hotspot detection,
 * and a clear button.
 *
 * Color scale (SUHI intensity, -1.5 to 7.5):
 *   < 0        → #313695  (deep blue — cooler than rural)
 *   0 – 1.5    → #74add1  (light blue)
 *   1.5 – 3    → #fed976  (yellow)
 *   3 – 4.5    → #fd8d3c  (orange)
 *   4.5 – 6    → #e31a1c  (red)
 *   > 6        → #b10026  (dark red)
 */

import { useEffect, useRef, useState } from 'react'
import { CircleMarker, Marker, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'
import {
    getUHIData,
    getHottestZones,
    getCoolestZones,
    loadNDVIData,
} from '../../services/geeAPI'

// ── Constants ──────────────────────────────────────────────────
const YEARS = [
    '2003', '2004', '2005', '2006', '2007', '2008',
    '2009', '2010', '2011', '2012', '2013', '2014',
    '2015', '2016', '2017', '2018',
]

function suhiColor(intensity) {
    if (intensity < 0) return '#313695'
    if (intensity < 1.5) return '#74add1'
    if (intensity < 3.0) return '#fed976'
    if (intensity < 4.5) return '#fd8d3c'
    if (intensity < 6.0) return '#e31a1c'
    return '#b10026'
}

function makeHotIcon(type) {
    const bg = type === 'hot' ? '#e31a1c' : '#00cc88'
    const emoji = type === 'hot' ? '🔴' : '🟢'
    return L.divIcon({
        className: '',
        html: `<div style="
      background:${bg};
      border:2px solid #fff;
      border-radius:50%;
      width:20px;height:20px;
      display:flex;align-items:center;justify-content:center;
      font-size:12px;
      box-shadow:0 2px 8px rgba(0,0,0,.6);
    ">${emoji}</div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
    })
}

// ── Reverse-geocode with Nominatim (free, no API key) ──────────
async function reverseGeocode(lat, lon) {
    try {
        const r = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`,
            { headers: { 'Accept-Language': 'en' } }
        )
        const data = await r.json()
        const addr = data.address || {}
        return (
            addr.suburb ||
            addr.neighbourhood ||
            addr.village ||
            addr.town ||
            addr.city_district ||
            addr.county ||
            `${lat.toFixed(2)}°N, ${lon.toFixed(2)}°E`
        )
    } catch {
        return `${lat.toFixed(2)}°N, ${lon.toFixed(2)}°E`
    }
}

// ── Build a land-pixel lookup set from NDVI data ──────────────
// Key format: `${Math.round(lat * 2)}_${Math.round(lon * 2)}`
// This snaps coordinates to a ~0.5° grid so UHI 1km pixels align.
function buildLandSet(ndviPixels) {
    const set = new Set()
    if (!ndviPixels) return set
    ndviPixels.forEach((px) => {
        // Use rounded coords at 0.5° precision for matching
        set.add(`${Math.round(px.lat * 2)}_${Math.round(px.lon * 2)}`)
    })
    return set
}

// ── Cross-filter UHI pixels against NDVI land set ─────────────
// If landSet is empty (NDVI not yet exported), filter is skipped.
function filterOceanPixels(uhiPixels, landSet) {
    if (landSet.size === 0) return uhiPixels
    return uhiPixels.filter((px) => {
        const key = `${Math.round(px.lat * 2)}_${Math.round(px.lon * 2)}`
        return landSet.has(key)
    })
}

// ── MapPixels: renders the circle markers (land only) ──────────
function MapPixels({ pixels }) {
    return pixels.map((px, i) => (
        <CircleMarker
            key={`${px.lat}_${px.lon}_${i}`}
            center={[px.lat, px.lon]}
            radius={6}
            pathOptions={{
                color: 'transparent',
                fillColor: suhiColor(px.intensity),
                fillOpacity: 0.7,
                weight: 0,
            }}
        >
            <Tooltip sticky>
                <span style={{ fontSize: 12 }}>
                    SUHI: <strong>{px.intensity.toFixed(2)}°C</strong><br />
                    <span style={{ color: '#aaa' }}>
                        {px.lat.toFixed(3)}°N, {px.lon.toFixed(3)}°E
                    </span>
                </span>
            </Tooltip>
        </CircleMarker>
    ))
}

// ── HotspotMarkers: renders special hotspot/coolspot markers ───
function HotspotMarkers({ hotspots, coolspots }) {
    return (
        <>
            {hotspots.map((pt, i) => (
                <Marker
                    key={`hot-${i}`}
                    position={[pt.lat, pt.lon]}
                    icon={makeHotIcon('hot')}
                >
                    <Tooltip permanent={false} direction="top">
                        <div style={{ fontSize: 12, maxWidth: 180 }}>
                            🔴 <strong>HOTTEST #{pt.rank}</strong><br />
                            {pt.label || `${pt.lat.toFixed(2)}°N, ${pt.lon.toFixed(2)}°E`}<br />
                            <span style={{ color: '#e31a1c', fontWeight: 700 }}>
                                {pt.intensity.toFixed(1)}°C above rural areas
                            </span>
                        </div>
                    </Tooltip>
                </Marker>
            ))}
            {coolspots.map((pt, i) => (
                <Marker
                    key={`cool-${i}`}
                    position={[pt.lat, pt.lon]}
                    icon={makeHotIcon('cool')}
                >
                    <Tooltip permanent={false} direction="top">
                        <div style={{ fontSize: 12, maxWidth: 180 }}>
                            🟢 <strong>COOLEST #{pt.rank}</strong><br />
                            {pt.label || `${pt.lat.toFixed(2)}°N, ${pt.lon.toFixed(2)}°E`}<br />
                            <span style={{ color: '#00cc88', fontWeight: 700 }}>
                                {pt.intensity.toFixed(1)}°C above rural areas
                            </span>
                        </div>
                    </Tooltip>
                </Marker>
            ))}
        </>
    )
}

// ── HeatOverlay (main) ─────────────────────────────────────────
export default function HeatOverlay({ city, visible, onHide }) {
    const [selectedYear, setSelectedYear] = useState('2018')
    const [timeOfDay, setTimeOfDay] = useState('day')
    const [pixels, setPixels] = useState([])
    const [loading, setLoading] = useState(false)
    const [hotspots, setHotspots] = useState([])
    const [coolspots, setCoolspots] = useState([])
    const [hotspotsLoading, setHotspotsLoading] = useState(false)
    const [noData, setNoData] = useState(false)
    const abortRef = useRef(false)

    // Load pixel data whenever city / year / timeOfDay changes
    // Cross-filters UHI pixels against NDVI land mask to remove ocean pixels
    // (coastal cities: Chennai → Bay of Bengal, Mumbai/Kochi → Arabian Sea, etc.)
    useEffect(() => {
        if (!visible || !city) return
        let cancelled = false
        setLoading(true)
        setNoData(false)

        Promise.all([
            getUHIData(city.name, selectedYear, timeOfDay),
            loadNDVIData(city.name),
        ]).then(([uhi, ndviData]) => {
            if (cancelled) return
            // Build a land-coordinate set from NDVI pixels.
            // If NDVI data isn't exported yet, landSet is empty → no filtering (safe fallback).
            const landSet = buildLandSet(ndviData?.pixels)
            const landOnly = filterOceanPixels(uhi, landSet)
            setPixels(landOnly)
            setNoData(landOnly.length === 0)
            setLoading(false)
        })

        return () => { cancelled = true }
    }, [city, selectedYear, timeOfDay, visible])

    // Load hotspots once when city is first shown (always 2018 daytime)
    useEffect(() => {
        if (!visible || !city) return
        let cancelled = false
        setHotspotsLoading(true)

        Promise.all([
            getHottestZones(city.name, '2018', 3),
            getCoolestZones(city.name, '2018', 3),
        ]).then(async ([hot, cool]) => {
            if (cancelled) return
            // Reverse geocode labels in parallel
            const labelledHot = await Promise.all(
                hot.map(async (pt) => ({
                    ...pt,
                    label: await reverseGeocode(pt.lat, pt.lon),
                }))
            )
            const labelledCool = await Promise.all(
                cool.map(async (pt) => ({
                    ...pt,
                    label: await reverseGeocode(pt.lat, pt.lon),
                }))
            )
            if (!cancelled) {
                setHotspots(labelledHot)
                setCoolspots(labelledCool)
                setHotspotsLoading(false)
            }
        })

        return () => { cancelled = true }
    }, [city, visible])

    if (!visible || !city) return null

    const hottestVal = hotspots[0]?.intensity ?? null
    const coolestVal = coolspots[0]?.intensity ?? null
    const tempDiff = hottestVal !== null && coolestVal !== null
        ? (hottestVal - coolestVal).toFixed(1)
        : null

    return (
        <>
            {/* Pixel circles */}
            {!loading && <MapPixels pixels={pixels} />}

            {/* Hotspot/coolspot markers */}
            {!hotspotsLoading && (
                <HotspotMarkers hotspots={hotspots} coolspots={coolspots} />
            )}

            {/* Controls panel (positioned absolute over the map) */}
            <div className="heat-overlay-controls" style={{ pointerEvents: 'none' }}>
                {/* Left panel: controls */}
                <div className="heat-control-card" style={{ pointerEvents: 'all' }}>
                    <div className="heat-control-header">
                        <span>🛰️ Satellite Heat Map</span>
                        <button
                            className="heat-clear-btn"
                            onClick={onHide}
                            title="Clear overlay"
                        >
                            ✕ Clear
                        </button>
                    </div>

                    {/* Day / Night toggle */}
                    <div className="heat-toggle-row">
                        <button
                            className={`heat-toggle-btn ${timeOfDay === 'day' ? 'active' : ''}`}
                            onClick={() => setTimeOfDay('day')}
                        >
                            ☀️ Daytime
                        </button>
                        <button
                            className={`heat-toggle-btn ${timeOfDay === 'night' ? 'active' : ''}`}
                            onClick={() => setTimeOfDay('night')}
                        >
                            🌙 Nighttime
                        </button>
                    </div>
                    {timeOfDay === 'night' && (
                        <p className="heat-night-note">
                            🌙 Cities showing heat at night give residents no relief from heat
                        </p>
                    )}

                    {/* Year slider */}
                    <div className="heat-year-row">
                        <span style={{ fontSize: 11, color: '#aaa' }}>2003</span>
                        <input
                            type="range"
                            min={0}
                            max={YEARS.length - 1}
                            value={YEARS.indexOf(selectedYear)}
                            onChange={(e) => setSelectedYear(YEARS[parseInt(e.target.value)])}
                            className="heat-slider"
                        />
                        <span style={{ fontSize: 11, color: '#aaa' }}>2018</span>
                    </div>
                    <div className="heat-year-label">
                        📅 Showing: <strong>{selectedYear}</strong>
                        {loading && <span className="heat-loading-dot">⏳</span>}
                    </div>

                    {/* Color legend */}
                    <div className="heat-legend">
                        {[
                            { color: '#313695', label: '< 0°C (cooler)' },
                            { color: '#74add1', label: '0 – 1.5°C' },
                            { color: '#fed976', label: '1.5 – 3°C' },
                            { color: '#fd8d3c', label: '3 – 4.5°C' },
                            { color: '#e31a1c', label: '4.5 – 6°C' },
                            { color: '#b10026', label: '> 6°C' },
                        ].map(({ color, label }) => (
                            <div key={color} className="heat-legend-item">
                                <span className="heat-legend-swatch" style={{ background: color }} />
                                <span>{label}</span>
                            </div>
                        ))}
                    </div>

                </div>

                {/* Hotspot cards */}
                {!hotspotsLoading && (hotspots.length > 0 || coolspots.length > 0) && (
                    <div className="heat-hotspot-card" style={{ pointerEvents: 'all' }}>
                        {hotspots[0] && (
                            <div className="hotspot-item hot">
                                🔴 <strong>HOTTEST</strong>{' '}
                                {hotspots[0].label}<br />
                                <span>{hotspots[0].intensity.toFixed(1)}°C above rural areas</span>
                            </div>
                        )}
                        {coolspots[0] && (
                            <div className="hotspot-item cool">
                                🟢 <strong>COOLEST</strong>{' '}
                                {coolspots[0].label}<br />
                                <span>{coolspots[0].intensity.toFixed(1)}°C above rural areas</span>
                            </div>
                        )}
                        {tempDiff && (
                            <div className="hotspot-diff">
                                📊 Difference: <strong>{tempDiff}°C</strong>{' '}
                                between hottest and coolest zones
                            </div>
                        )}
                    </div>
                )}

                {/* No data message */}
                {noData && !loading && (
                    <div className="heat-no-data-card" style={{ pointerEvents: 'all' }}>
                        <p>Satellite data not yet available for this city.</p>
                        <p>Showing live weather data only.</p>
                        <small>Run <code>gee_export.py</code> to generate data.</small>
                    </div>
                )}

                {/* Data source credit */}
                <div className="heat-credit">
                    🛰️ Satellite data: Yale YCEO / NASA MODIS Global UHI Dataset (2003-2018) | Resolution: 1km
                </div>
            </div>
        </>
    )
}
