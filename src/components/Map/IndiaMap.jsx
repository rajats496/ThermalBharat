import { useEffect, useRef, useState } from 'react'
import { CircleMarker, MapContainer, Polygon, Popup, TileLayer, Tooltip, useMap } from 'react-leaflet'
import { CITY_ZOOM, HEAT_LEVELS, INDIA_CENTER, INDIA_ZOOM } from '../../utils/constants'
import { getHeatLevel, getRiskBand, getRiskLabel } from '../../utils/calculations'
import HeatOverlay from './HeatOverlay'
import NDVIOverlay, { NDVILegend } from './NDVIOverlay'
import { convexHull } from '../../utils/mlModels'

// ── MapInitializer — dispatch native resize events (simulates DevTools opening) ──
function MapInitializer() {
  const map = useMap()
  useEffect(() => {
    // Dispatch native resize events — this is EXACTLY what opening DevTools does
    const fireResize = () => window.dispatchEvent(new Event('resize'))

    // Fire at multiple intervals to cover slow machines
    const times = [0, 100, 200, 500, 1000, 1500, 2000, 3000]
    const timers = times.map(t => setTimeout(fireResize, t))

    // Also force a compositor repaint by toggling the container width by 1px
    // This tricks the GPU into re-compositing the tile layer
    const container = map.getContainer()
    if (container) {
      const nudge = setTimeout(() => {
        const origWidth = container.style.width
        container.style.width = 'calc(100% - 1px)'
        void container.offsetHeight  // force reflow
        requestAnimationFrame(() => {
          container.style.width = origWidth || '100%'
          void container.offsetHeight
          map.invalidateSize(true)
          fireResize()
        })
      }, 300)
      timers.push(nudge)
    }

    // Listen for real resize events too
    const onResize = () => map.invalidateSize(true)
    window.addEventListener('resize', onResize)

    // ResizeObserver as backup
    let ro
    if (container && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => {
        map.invalidateSize(true)
        map.eachLayer(layer => { if (layer?.redraw) layer.redraw() })
      })
      ro.observe(container)
    }

    return () => {
      timers.forEach(clearTimeout)
      window.removeEventListener('resize', onResize)
      ro?.disconnect()
    }
  }, [map])
  return null
}

// ── MapZoomFix — tiny zoom bump forces complete tile redraw ──
function MapZoomFix() {
  const map = useMap()
  useEffect(() => {
    const t = setTimeout(() => {
      map.invalidateSize(true)
      map.eachLayer(layer => {
        if (layer?.redraw) layer.redraw()
      })

      // Next paint cycle (some browsers composite late at specific zoom/DPRs)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          map.invalidateSize(true)
          map.eachLayer(layer => {
            if (layer?.redraw) layer.redraw()
          })
        })
      })
    }, 500)
    return () => clearTimeout(t)
  }, [map])
  return null
}

// ── TilesPaintFix — wait for tile images, then force repaint ──
// This avoids changing zoom/pan (which can interfere with city flyTo).
function TilesPaintFix() {
  const map = useMap()

  useEffect(() => {
    let cancelled = false
    const container = map.getContainer()
    let lastDpr = window.devicePixelRatio

    const maxAttempts = 200 // ~20s @ 100ms
    let attempt = 0

    const tick = () => {
      if (cancelled) return
      attempt += 1

      const tiles = container.querySelectorAll('.leaflet-tile')
      if (!tiles || tiles.length === 0) {
        if (attempt < maxAttempts) setTimeout(tick, 100)
        return
      }

      // `.leaflet-tile` is an <img>. We only trigger after enough images are loaded.
      let loaded = 0
      for (let i = 0; i < tiles.length; i += 1) {
        const img = tiles[i]
        if (img && img.complete && (img.naturalWidth > 0 || img.width > 0)) loaded += 1
      }

      // At least the initial viewport tiles should be present.
      const readyThreshold = Math.min(12, tiles.length)
      if (loaded >= readyThreshold || attempt >= maxAttempts) {
        // Method: CSS repaint trick + map invalidation
        const prevTransform = container.style.transform

        container.style.willChange = 'transform'
        container.style.transform = 'translateZ(0)'

        // Force reflow
        void container.offsetHeight

        map.invalidateSize(true)
        map.eachLayer(layer => {
          if (layer?.redraw) layer.redraw()
        })

        // Run again on the next paint cycle for browsers that delay compositing.
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            map.invalidateSize(true)
            map.eachLayer(layer => {
              if (layer?.redraw) layer.redraw()
            })
          })
        })

        // Restore previous transform after a short delay.
        setTimeout(() => {
          if (cancelled) return
          container.style.transform = prevTransform
        }, 250)

        return
      }

      setTimeout(tick, 100)
    }

    const startT = setTimeout(tick, 250)
    const dprInterval = setInterval(() => {
      if (cancelled) return
      const dpr = window.devicePixelRatio
      if (dpr !== lastDpr) {
        lastDpr = dpr
        map.invalidateSize(true)
        map.eachLayer(layer => {
          if (layer?.redraw) layer.redraw()
        })
      }
    }, 500)

    return () => {
      cancelled = true
      clearTimeout(startT)
      clearInterval(dprInterval)
    }
  }, [map])

  return null
}

function MapFlyToCity({ selectedCity }) {
  const map = useMap()

  // Fire on MOUNT — covers back-navigation case where city is already selected
  useEffect(() => {
    if (!selectedCity?.latitude || !selectedCity?.longitude) return
    const t = setTimeout(() => {
      map.flyTo([selectedCity.latitude, selectedCity.longitude], CITY_ZOOM, { duration: 1.2 })
    }, 300) // small delay so map tiles are ready
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // intentionally only on mount

  // Also fire when CITY CHANGES (navbar search selects different city)
  useEffect(() => {
    if (!selectedCity?.latitude || !selectedCity?.longitude) return
    map.flyTo([selectedCity.latitude, selectedCity.longitude], CITY_ZOOM, { duration: 1.2 })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, selectedCity?.name])

  return null
}

function radiusByPopulation(population) {
  const minRadius = 7
  const maxRadius = 22
  return minRadius + Math.min(1, population / 33000000) * (maxRadius - minRadius)
}

// ── Standard city marker (heat/trees mode) ──────────────────────
function CityMarker({ city, cityData, onCityClick, isSelected }) {
  const markerRef   = useRef(null)
  const temperature = cityData?.current?.temp ?? 30
  const riskScore = cityData?.combinedRisk ?? cityData?.forecast?.[0]?.risk_level ?? 3
  const heatLevel = getHeatLevel(temperature)
  const riskLabel = getRiskLabel(riskScore)
  const pulse = temperature > HEAT_LEVELS.EXTREME.max

  // Force-open the tooltip whenever this city becomes selected
  useEffect(() => {
    if (isSelected && markerRef.current) {
      // Small delay so marker is fully positioned after fly-to
      const t = setTimeout(() => markerRef.current?.openTooltip?.(), 600)
      return () => clearTimeout(t)
    }
  }, [isSelected])

  return (
    <CircleMarker
      ref={markerRef}
      center={[city.latitude, city.longitude]}
      radius={isSelected ? radiusByPopulation(city.population) + 4 : radiusByPopulation(city.population)}
      pathOptions={{
        color: isSelected ? '#ffffff' : '#f5f6fb',
        weight: isSelected ? 2.5 : 1,
        fillColor: heatLevel.color,
        fillOpacity: 0.85,
        className: pulse ? 'city-marker-pulse' : '',
      }}
      eventHandlers={{
        click: () => onCityClick(city),
        // Also open tooltip when marker is first added if already selected
        add: (e) => { if (isSelected) setTimeout(() => e.target?.openTooltip?.(), 300) },
      }}
    >
      <Tooltip
        direction="top"
        offset={[0, -8]}
        opacity={0.97}
        permanent={isSelected}
      >
        <div className="marker-tooltip">
          <strong>{city.name} ({city.nameHindi})</strong>
          <div>{temperature}°C</div>
          {!city.hasGEEData && (
            <div className="approx-badge" title="Satellite data not available">Approximate</div>
          )}
          <span className="risk-chip" style={{ backgroundColor: getRiskBand(riskScore).color }}>
            {riskLabel.label}
          </span>
        </div>
      </Tooltip>
    </CircleMarker>
  )
}


// ── Cluster marker (heat zones mode) ────────────────────────────
function ClusterMarker({ cityData, onCityClick }) {
  const { name, nameHindi, latitude, longitude, population } = cityData
  const { color, clusterName } = cityData
  return (
    <CircleMarker
      center={[latitude, longitude]}
      radius={radiusByPopulation(population)}
      pathOptions={{ color: '#fff', weight: 1.5, fillColor: color, fillOpacity: 0.9 }}
      eventHandlers={{ click: () => onCityClick(cityData) }}
    >
      <Tooltip direction="top" offset={[0, -8]} opacity={0.97}>
        <div className="marker-tooltip">
          <strong>{name} ({nameHindi})</strong>
          <div style={{ color }}>{clusterName}</div>
        </div>
      </Tooltip>
    </CircleMarker>
  )
}

// ── Cluster hull polygon + popup ─────────────────────────────────
function ClusterHull({ clusterCities, clusterName, clusterNameHindi, color }) {
  const points = clusterCities.map(c => [c.latitude, c.longitude])
  const hull   = convexHull(points)
  if (hull.length < 3) return null

  const avgTemp  = (clusterCities.reduce((s, c) => s + (c.temperature ?? 0), 0) / clusterCities.length).toFixed(1)
  const avgAqi   = (clusterCities.reduce((s, c) => s + (c.aqi ?? 0), 0) / clusterCities.length).toFixed(0)
  const avgRisk  = (clusterCities.reduce((s, c) => s + (c.riskScore ?? 0), 0) / clusterCities.length).toFixed(1)
  const hottest  = [...clusterCities].sort((a, b) => (b.temperature ?? 0) - (a.temperature ?? 0))[0]
  const coolest  = [...clusterCities].sort((a, b) => (a.temperature ?? 0) - (b.temperature ?? 0))[0]

  return (
    <Polygon
      positions={hull}
      pathOptions={{ color, weight: 1.5, fillColor: color, fillOpacity: 0.12, dashArray: '6 4' }}
    >
      <Popup maxWidth={240}>
        <div style={{ background: '#1a1d2e', color: '#e0e4f0', borderRadius: 8, padding: 12, minWidth: 200 }}>
          <div style={{ color, fontWeight: 700, fontSize: 14, marginBottom: 6 }}>{clusterName}</div>
          <div style={{ color: '#aaa', fontSize: 11, marginBottom: 8 }}>{clusterNameHindi}</div>
          <div style={{ fontSize: 12, lineHeight: 1.8 }}>
            <div>🏙️ Cities: <strong>{clusterCities.map(c => c.cityName || c.name || 'Unknown').filter(Boolean).join(', ')}</strong></div>
            <div>🌡️ Avg temp: <strong>{avgTemp}°C</strong></div>
            <div>💨 Avg AQI: <strong>{avgAqi}</strong></div>
            <div>⚠️ Avg risk: <strong>{avgRisk}/10</strong></div>
            <div style={{ marginTop: 4 }}>
              🔴 Hottest: <strong>{hottest?.cityName || hottest?.name} ({hottest?.temperature}°C)</strong>
            </div>
            <div>🟢 Coolest: <strong>{coolest?.cityName || coolest?.name} ({coolest?.temperature}°C)</strong></div>
          </div>
          <div style={{ fontSize: 10, color: '#666', marginTop: 8 }}>
            Based on live weather data · लाइव मौसम डेटा पर आधारित
          </div>
        </div>
      </Popup>
    </Polygon>
  )
}

// ── Cluster legend ───────────────────────────────────────────────
function ClusterLegend({ clusterGroups }) {
  return (
    <div className="cluster-legend">
      <div style={{ fontWeight: 600, marginBottom: 6, fontSize: 12 }}>
        🔵 Heat Zones · गर्मी क्षेत्र
      </div>
      {clusterGroups.map(g => (
        <div key={g.color} className="cluster-legend-item">
          <span className="cluster-legend-dot" style={{ background: g.color }} />
          <span style={{ flex: 1 }}>{g.clusterName}</span>
          <span style={{ color: '#aaa', fontSize: 11 }}>{g.cities.length} cities</span>
        </div>
      ))}
      <div style={{ fontSize: 10, color: '#666', marginTop: 6 }}>
        Live weather data · लाइव डेटा
      </div>
    </div>
  )
}

// ── IndiaMap (main) ──────────────────────────────────────────────
function IndiaMap({
  cities, cityWeatherData, selectedCity, onCityClick,
  heatOverlayCity, onHideHeatOverlay, showHeatOverlay,
  mapMode, setMapMode,
  clusterData, showClusters, setShowClusters,
}) {
  const showNDVI = (mapMode === 'trees' || mapMode === 'combined') && !!selectedCity

  const [tileError, setTileError] = useState(false)
  const [mapError]  = useState(false)

  // ── JS-computed pixel height — reliable at any browser zoom level ──
  // CSS calc(100vh) fails at sub-100% zoom on some browsers/machines.
  // We read actual pixel dimensions from the DOM and set inline style.
  const [mapHeight, setMapHeight] = useState(window.innerHeight - 56)
  useEffect(() => {
    const computeHeight = () => {
      const navEl = document.querySelector('.nb-root')
      const navH  = navEl ? navEl.offsetHeight : 56
      const bnEl  = document.querySelector('.bottom-nav')
      const bnH   = (bnEl && bnEl.offsetHeight) ? bnEl.offsetHeight : 0
      setMapHeight(window.innerHeight - navH - bnH)
    }
    computeHeight()
    window.addEventListener('resize', computeHeight)
    return () => window.removeEventListener('resize', computeHeight)
  }, [])

  // ── DELAYED MOUNT: render wrapper FIRST, mount MapContainer AFTER ──
  const [showMap, setShowMap] = useState(false)
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      const t = setTimeout(() => setShowMap(true), 50)
      return () => clearTimeout(t)
    })
    return () => cancelAnimationFrame(raf)
  }, [])


  const clusterGroups = []
  if (showClusters && clusterData?.length) {
    const groups = {}
    clusterData.forEach(c => {
      if (!groups[c.clusterRank]) {
        groups[c.clusterRank] = {
          clusterRank:      c.clusterRank,
          clusterName:      c.clusterName,
          clusterNameHindi: c.clusterNameHindi,
          color:            c.color,
          cities:           [],
        }
      }
      groups[c.clusterRank].cities.push(c)
    })
    Object.values(groups).sort((a, b) => a.clusterRank - b.clusterRank).forEach(g => clusterGroups.push(g))
  }

  // Build a lookup: cityName → cluster info
  const clusterMap = {}
  if (clusterData) clusterData.forEach(c => { clusterMap[c.cityName] = c })

  const modes = [
    { id: 'heat',     label: '🌡️ Heat' },
    { id: 'trees',    label: '🌿 Trees' },
    { id: 'combined', label: '⚠️ Combined' },
  ]

  return (
    <div className="map-container" style={{ height: '100%', width: '100%', position: 'relative' }}>
      {/* View mode toggle */}
      <div className="map-mode-toggle">
        {modes.map((m) => (
          <button
            key={m.id}
            className={`map-mode-btn ${!showClusters && mapMode === m.id ? 'active' : ''}`}
            onClick={() => { setShowClusters(false); setMapMode(m.id) }}
          >
            {m.label}
          </button>
        ))}
        {clusterData?.length > 0 && (
          <button
            className={`map-mode-btn ${showClusters ? 'active cluster-active' : ''}`}
            onClick={() => setShowClusters(!showClusters)}
          >
            🔵 Heat Zones
          </button>
        )}
      </div>

      {/* NDVI legend */}
      {!showClusters && (mapMode === 'trees' || mapMode === 'combined') && (
        <div className="ndvi-legend-overlay">
          <NDVILegend mode={mapMode} />
        </div>
      )}

      {/* Cluster legend */}
      {showClusters && clusterGroups.length > 0 && (
        <div className="ndvi-legend-overlay">
          <ClusterLegend clusterGroups={clusterGroups} />
        </div>
      )}

      {/* No-city hint for tree modes */}
      {!selectedCity && !showClusters && mapMode !== 'heat' && (
        <div className="map-notice">
          🌿 Click a city marker to view green cover overlay
        </div>
      )}

      {/* Cluster loading hint */}
      {showClusters && !clusterData?.length && (
        <div className="map-notice">
          ⏳ Calculating heat zones... गर्मी क्षेत्र की गणना हो रही है...
        </div>
      )}

      {/* Fix 6: error UI if map fails to mount */}
      {mapError ? (
        <div style={{
          height: '100%', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          background: '#0d1117', color: 'white', gap: 16,
        }}>
          <span style={{ fontSize: 48 }}>🗺️</span>
          <h3 style={{ margin: 0 }}>Map Loading Failed</h3>
          <p style={{ color: '#8895b0', margin: 0 }}>Please refresh the page</p>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: '#ff4444', border: 'none', color: 'white',
              padding: '10px 24px', borderRadius: 8, cursor: 'pointer',
              fontSize: 15, fontWeight: 600,
            }}
          >🔄 Refresh Page</button>
        </div>
      ) : (
        <div
          className="map-wrapper"
          style={{ height: mapHeight, minHeight: 300, width: '100%', position: 'relative' }}
        >
          {!showMap ? (
            <div style={{
              height: '100%', width: '100%', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              background: '#080b14', color: '#8895b0',
            }}>
              <span className="spinner" style={{ marginRight: 8 }} />
              Loading map...
            </div>
          ) : (
          <MapContainer
            center={[INDIA_CENTER.lat, INDIA_CENTER.lng]}
            zoom={INDIA_ZOOM}
            zoomControl={true}
            style={{ height: '100%', width: '100%', background: '#080b14' }}
          >
            <MapInitializer />
            <MapZoomFix />

            {tileError ? (
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution="OpenStreetMap"
                detectRetina={false}
                keepBuffer={4}
                updateWhenIdle={false}
                updateWhenZooming={false}
                maxZoom={19}
                minZoom={3}
                tileSize={256}
                zoomOffset={0}
                crossOrigin={true}
              />
            ) : (
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png"
                attribution="CartoDB"
                detectRetina={false}
                keepBuffer={4}
                updateWhenIdle={false}
                updateWhenZooming={false}
                maxZoom={19}
                minZoom={3}
                tileSize={256}
                zoomOffset={0}
                crossOrigin={true}
                eventHandlers={{
                  tileerror: () => {
                    console.log('CartoDB tiles failed, switching to OSM')
                    setTileError(true)
                  }
                }}
              />
            )}

            <TilesPaintFix />

            {cities.map((city) => {
              if (showClusters && clusterMap[city.name]) {
                const cd = clusterMap[city.name]
                return (
                  <ClusterMarker
                    key={city.name}
                    cityData={{ ...city, ...cd }}
                    onCityClick={onCityClick}
                  />
                )
              }
              return (
                <CityMarker
                  key={city.name}
                  city={city}
                  cityData={cityWeatherData[city.name]}
                  onCityClick={onCityClick}
                  isSelected={selectedCity?.name === city.name}
                />
              )
            })}

            {showClusters && clusterGroups.map(g => (
              <ClusterHull
                key={g.clusterRank}
                clusterCities={g.cities}
                clusterName={g.clusterName}
                clusterNameHindi={g.clusterNameHindi}
                color={g.color}
              />
            ))}

            <MapFlyToCity selectedCity={selectedCity} />

            {!showClusters && showHeatOverlay && selectedCity && (
              <HeatOverlay city={selectedCity} visible={true} onHide={onHideHeatOverlay} />
            )}

            {!showClusters && showNDVI && <NDVIOverlay city={selectedCity} mode={mapMode} />}
          </MapContainer>
          )}
        </div>
      )}
    </div>
  )
}

export default IndiaMap
