import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation,
} from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import './styles/tokens.css'
import './styles/animations.css'
import './styles/components.css'
import CityDetailPanel   from './components/Dashboard/CityDetailPanel'
import CompareModal      from './components/Dashboard/CompareModal'
import HeatwaveBanner    from './components/Dashboard/HeatwaveBanner'
import PredictionsPanel  from './components/Dashboard/PredictionsPanel'
import MethodologyModal  from './components/Dashboard/MethodologyModal'
import Navbar            from './components/Navbar/Navbar'
import Sidebar           from './components/Sidebar/Sidebar'
import IndiaMap          from './components/Map/IndiaMap'
import StatusBar         from './components/Dashboard/StatusBar'
import BottomNav         from './components/ui/BottomNav'
import OfflineBanner     from './components/ui/OfflineBanner'

// ── Lazy-loaded heavy pages (code-split for faster initial load) ──
const CityDetailPage  = lazy(() => import('./components/Dashboard/CityDetailPage'))
const ComparePage     = lazy(() => import('./components/Dashboard/ComparePage'))
const PredictionsPage = lazy(() => import('./components/Dashboard/PredictionsPage'))
const MethodologyPage = lazy(() => import('./components/Dashboard/MethodologyPage'))

// Shared skeleton fallback shown while lazy chunks load
const PageSkeleton = () => (
  <div style={{ padding: 40, display: 'flex', flexDirection: 'column', gap: 16 }}>
    {[1,2,3].map(i => <div key={i} className="skeleton-card" style={{ height: 80 }} />)}
  </div>
)
import { indianCities }  from './data/indianCities'
import { coolingCenters } from './data/coolingCenters'
import { geocodeCityInIndia, getCityDetailBundle, getCityWeatherBundle } from './services/weatherAPI'
import {
  calculateCombinedRisk,
  findConsecutiveHeatwaveDays,
  findNearestCoolingCenter,
} from './utils/calculations'
import { kMeansClustering } from './utils/mlModels'
import { getRegistrations, sendHeatwaveEmail } from './services/emailService'

// ── Inner app (needs access to router context) ──────────────────
function AppInner() {
  const navigate = useNavigate()

  const [cities,            setCities]           = useState(indianCities)
  const [selectedCityName,  setSelectedCityName] = useState('')
  const [cityWeatherData,   setCityWeatherData]  = useState({})
  const [cityDetailsData,   setCityDetailsData]  = useState({})
  const [isCompareOpen,     setIsCompareOpen]    = useState(false)
  const [loadingCount,      setLoadingCount]     = useState(0)
  const [isLoadingCities,   setIsLoadingCities]  = useState(false)
  const [heatwaveAlerts,    setHeatwaveAlerts]   = useState([])
  const [dismissedAlerts,   setDismissedAlerts]  = useState([])
  const [heatOverlayCity,   setHeatOverlayCity]  = useState(null)
  const [showHeatOverlay,   setShowHeatOverlay]  = useState(false)
  const [mapMode,           setMapMode]          = useState('heat')
  const [clusterData,       setClusterData]      = useState([])
  const [showClusters,      setShowClusters]     = useState(false)
  const [showPredictions,   setShowPredictions]  = useState(false)
  const [showMethodology,   setShowMethodology]  = useState(false)

  const handleSetMapMode = (mode) => {
    setMapMode(mode)
    if (mode === 'heat') {
      if (selectedCity) setShowHeatOverlay(true)
    } else {
      setHeatOverlayCity(null)
      setShowHeatOverlay(false)
    }
  }

  const selectedCity = cities.find(c => c.name === selectedCityName) || null

  const cityRiskScores = useMemo(() => {
    const scores = {}
    Object.entries(cityWeatherData).forEach(([cityName, data]) => {
      const current = data.current
      const aqi = data.airQuality?.aqi_value ?? 90
      if (current) {
        scores[cityName] = calculateCombinedRisk({
          temp: current.temp, feels_like: current.feels_like,
          humidity: current.humidity, aqi_value: aqi,
        })
      }
    })
    return scores
  }, [cityWeatherData])

  const nearestCenterByCity = useMemo(() => {
    const map = {}
    cities.forEach(city => {
      const nearest = findNearestCoolingCenter(city, coolingCenters)
      if (nearest) map[city.name] = nearest
    })
    return map
  }, [cities])

  // ── Load all city weather in batches ──────────────────────────
  useEffect(() => {
    let isMounted = true
    const loadCityBatches = async () => {
      setIsLoadingCities(true)
      const batchSize = 5
      const collected = {}
      for (let i = 0; i < cities.length; i += batchSize) {
        const batch = cities.slice(i, i + batchSize)
        const results = await Promise.all(
          batch.map(async (city) => {
            const bundle = await getCityWeatherBundle(city)
            return { cityName: city.name, bundle }
          })
        )
        results.forEach(({ cityName, bundle }) => {
          const aqiValue = bundle.airQuality?.aqi_value ?? 90
          const combinedRisk = calculateCombinedRisk({
            temp: bundle.current.temp, feels_like: bundle.current.feels_like,
            humidity: bundle.current.humidity, aqi_value: aqiValue,
          })
          collected[cityName] = { ...bundle, combinedRisk }
        })
        if (!isMounted) return
        setLoadingCount(Math.min(i + batch.length, cities.length))
        setCityWeatherData(prev => ({ ...prev, ...collected }))
      }
      if (!isMounted) return

      const alerts = []
      Object.entries(collected).forEach(([cityName, payload]) => {
        const streak = findConsecutiveHeatwaveDays(payload.forecast, 43)
        if (streak.days >= 3) alerts.push({ cityName, days: streak.days, temp: streak.highestTemp || 43 })
      })
      setHeatwaveAlerts(alerts)
      setIsLoadingCities(false)
    }
    loadCityBatches()
    const refreshHandle = setInterval(loadCityBatches, 60 * 60 * 1000)
    return () => { isMounted = false; clearInterval(refreshHandle) }
  }, [cities])

  // ── K-Means clustering ─────────────────────────────────────────
  useEffect(() => {
    if (isLoadingCities || Object.keys(cityWeatherData).length < cities.length) return
    const dataPoints = cities.map(city => {
      const w = cityWeatherData[city.name]
      return {
        cityName: city.name, nameHindi: city.nameHindi,
        latitude: city.latitude, longitude: city.longitude,
        population: city.population,
        temperature: w?.current?.temp ?? 30, feelsLike: w?.current?.feels_like ?? 30,
        humidity: w?.current?.humidity ?? 50, aqi: w?.airQuality?.aqi_value ?? 90,
        riskScore: w?.combinedRisk ?? 5,
      }
    })
    setClusterData(kMeansClustering(dataPoints, 4))
  }, [isLoadingCities, cityWeatherData, cities])

  // ── Heatwave email alerts ──────────────────────────────────────
  useEffect(() => {
    const checkAlerts = async () => {
      const registrations = getRegistrations().filter(r => r.active)
      if (!registrations.length) return
      for (const reg of registrations) {
        const cityData = (
          Object.values(cityWeatherData).find(d => d.city === reg.city) ||
          cityWeatherData[reg.city]
        )
        const forecast = cityData?.forecast || []
        const current  = cityData?.current
        if (!current) continue
        const dangerDays  = forecast.filter(d => (d.max_temp ?? d.temp) > 43).length
        const extremeDays = forecast.filter(d => (d.max_temp ?? d.temp) > 46).length
        const shouldAlert =
          (reg.alertTypes?.includes('heatwave') && dangerDays  >= 3) ||
          (reg.alertTypes?.includes('extreme')  && extremeDays >= 1)
        if (shouldAlert && reg.email) {
          const temp = Math.round(current.temp)
          const days = extremeDays >= 1 ? extremeDays : dangerDays
          await sendHeatwaveEmail(reg.email, reg.name, reg.city, reg.cityHindi, temp, days, reg.language)
        }
      }
    }
    if (!isLoadingCities && Object.keys(cityWeatherData).length > 0) checkAlerts()
    const alertHandle = setInterval(checkAlerts, 60 * 60 * 1000)
    return () => clearInterval(alertHandle)
  }, [isLoadingCities, cityWeatherData])

  // ── Load city detail when selected ────────────────────────────
  useEffect(() => {
    if (!selectedCity) return
    const loadDetail = async () => {
      if (cityDetailsData[selectedCity.name]) return
      const detailBundle = await getCityDetailBundle(selectedCity)
      const combinedRisk = calculateCombinedRisk({
        temp: detailBundle.current.temp, feels_like: detailBundle.current.feels_like,
        humidity: detailBundle.current.humidity, aqi_value: detailBundle.airQuality.aqi_value,
      })
      setCityDetailsData(prev => ({ ...prev, [selectedCity.name]: { ...detailBundle, combinedRisk } }))
      setCityWeatherData(prev => ({
        ...prev,
        [selectedCity.name]: {
          ...prev[selectedCity.name],
          current: detailBundle.current, forecast: detailBundle.forecast,
          airQuality: detailBundle.airQuality, hourly: detailBundle.hourly,
          combinedRisk,
        },
      }))
    }
    loadDetail()
  }, [cityDetailsData, selectedCity])

  const loadingProgressText = isLoadingCities
    ? `Loading cities... ${loadingCount}/${cities.length}`
    : 'All city weather loaded'

  const selectedDetailData = cityDetailsData[selectedCity?.name] || cityWeatherData[selectedCity?.name]

  const addCustomCity = async ({ cityName, stateName }) => {
    const name = cityName
    const norm = v => (v || '').toLowerCase().replace(/\s+/g, ' ').trim()
    const existing = cities.find(c => {
      return norm(c.name) === norm(name) && (!stateName || norm(c.state) === norm(stateName))
    })
    if (existing) { setSelectedCityName(existing.name); return }
    try {
      const geocoded    = await geocodeCityInIndia(name, stateName)
      const displayName = `${geocoded.name}, ${geocoded.state}`
      const customCity  = {
        name: displayName, nameHindi: geocoded.name,
        latitude: geocoded.latitude, longitude: geocoded.longitude,
        state: geocoded.state, population: 1_000_000, hasGEEData: false,
      }
      setCities(prev => [...prev, customCity])
      setSelectedCityName(customCity.name)
      const bundle = await getCityWeatherBundle(customCity)
      const combinedRisk = calculateCombinedRisk({
        temp: bundle.current.temp, feels_like: bundle.current.feels_like,
        humidity: bundle.current.humidity, aqi_value: bundle.airQuality?.aqi_value ?? 90,
      })
      setCityWeatherData(prev => ({ ...prev, [customCity.name]: { ...bundle, combinedRisk } }))
    } catch (error) {
      throw new Error(error?.message || 'City not found in India. Please try another name.')
    }
  }

  // Shared navbar props — passed to Navbar everywhere
  const navbarProps = {
    cities,
    selectedCityName,
    onCityChange: (name) => { setSelectedCityName(name); navigate(`/city/${encodeURIComponent(name)}`) },
    onOpenCompare:      () => setIsCompareOpen(true),
    onOpenPredictions:  () => setShowPredictions(true),
    onOpenMethodology:  () => setShowMethodology(true),
    loadingProgressText,
    onAddCustomCity: addCustomCity,
    showClusters,
    onToggleClusters: () => setShowClusters(v => !v),
    clusterReady: clusterData.length > 0,
  }

  const location = useLocation()

  // Page transition variants
  const pageVariants = {
    initial: { opacity: 0, y: 18, scale: 0.98 },
    animate: { opacity: 1, y: 0,  scale: 1,
      transition: { duration: 0.35, ease: [0.4, 0, 0.2, 1] } },
    exit:    { opacity: 0, y: -10,
      transition: { duration: 0.2 } },
  }

  const PageWrap = ({ children }) => (
    <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit"
      style={{ minHeight: '100vh' }}>
      {children}
    </motion.div>
  )

  return (
    <div className="app-shell">

      {/* ── Offline detection banner ──────────────── */}
      <OfflineBanner />

      {/* ── Heatwave ticker banner ─────────────────── */}
      <HeatwaveBanner
        alerts={heatwaveAlerts}
        dismissed={dismissedAlerts}
        onDismiss={(cityName) => setDismissedAlerts(prev => [...prev, cityName])}
      />

      {/* ── Navbar ────────────────────────────────── */}
      <Navbar {...navbarProps} />

      {/* ── Page routes (animated) ────────────────── */}
      <AnimatePresence mode="wait" initial={false}>
      <Routes location={location} key={location.pathname}>


        {/* Main map page */}
        <Route path="/" element={
          <main className="layout-main" style={{ display: 'flex', flex: '1 1 0', minHeight: 0, height: 'calc(100vh - 56px)', overflow: 'hidden' }}>
            <Sidebar
              cities={cities}
              cityRiskScores={cityRiskScores}
              nearestCenterByCity={nearestCenterByCity}
            />
            <section className="map-section" aria-label="India heat map" style={{ height: 'calc(100vh - 56px)', minHeight: 400, position: 'relative', flex: '1 1 0', overflow: 'hidden' }}>
              {isLoadingCities && (
                <div className="map-loading">
                  <span className="spinner" aria-hidden="true" />
                  <span>Fetching weather data for markers...</span>
                </div>
              )}
              <IndiaMap
                cities={cities}
                cityWeatherData={cityWeatherData}
                selectedCity={selectedCity}
                onCityClick={city => {
                  setSelectedCityName(city.name)
                  navigate(`/city/${encodeURIComponent(city.name)}`)
                }}
                heatOverlayCity={heatOverlayCity}
                showHeatOverlay={showHeatOverlay}
                onHideHeatOverlay={() => { setHeatOverlayCity(null); setShowHeatOverlay(false) }}
                mapMode={mapMode}
                setMapMode={handleSetMapMode}
                clusterData={clusterData}
                showClusters={showClusters}
                setShowClusters={setShowClusters}
              />
            </section>

            {selectedCity && !selectedDetailData ? (
              <aside className="detail-panel detail-skeleton">
                <div className="skeleton-line wide" />
                <div className="skeleton-line mid"  />
                <div className="skeleton-card" />
                <div className="skeleton-card" />
                <div className="skeleton-card" />
              </aside>
            ) : (
              <CityDetailPanel
                city={selectedCity}
                detailData={selectedDetailData}
                nearestCenter={nearestCenterByCity[selectedCity?.name]}
                onClose={() => setSelectedCityName('')}
                onShowHeatOverlay={(city) => {
                  setHeatOverlayCity(city)
                  setShowHeatOverlay(true)
                  handleSetMapMode('heat')
                  setShowClusters(false)
                }}
              />
            )}
          </main>
        } />

        {/* City detail full page */}
        <Route path="/city/:cityName" element={
          <Suspense fallback={<PageSkeleton />}>
            <CityDetailPage
              cities={cities}
              cityDetailsData={cityDetailsData}
              cityWeatherData={cityWeatherData}
              nearestCenterByCity={nearestCenterByCity}
              onShowHeatOverlay={(city) => {
                setHeatOverlayCity(city)
                setShowHeatOverlay(true)
                handleSetMapMode('heat')
                setShowClusters(false)
              }}
            />
          </Suspense>
        } />

        {/* Compare full page */}
        <Route path="/compare" element={
          <Suspense fallback={<PageSkeleton />}>
            <ComparePage cities={cities} cityWeatherData={cityWeatherData} cityDetailsData={cityDetailsData} />
          </Suspense>
        } />

        {/* 2030 Predictions full page */}
        <Route path="/predict" element={
          <Suspense fallback={<PageSkeleton />}>
            <PredictionsPage cityWeatherData={cityWeatherData} />
          </Suspense>
        } />

        {/* Methodology full page */}
        <Route path="/methodology" element={
          <Suspense fallback={<PageSkeleton />}><MethodologyPage /></Suspense>
        } />

        {/* About page */}
        <Route path="/about" element={
          <main className="layout-main about-page">
            <div className="about-card detail-card">
              <h2>🌡️ ThermalBharat</h2>
              <p className="hindi-text">भारत का शहरी ताप मानचित्र</p>
              <p>An open-source urban heat island mapper for India's 30 largest cities. Uses Yale YCEO satellite SUHI data, Sentinel-2 NDVI, Open-Meteo ERA5 climate trends, and K-Means ML clustering to analyze and predict urban heat.</p>
              <h3>Data Sources</h3>
              <ul>
                <li>🛰️ Yale YCEO — Surface Urban Heat Island dataset</li>
                <li>🌿 Sentinel-2 — NDVI vegetation index</li>
                <li>🌡️ Open-Meteo ERA5 — Historical temperature trends</li>
                <li>☁️ OpenWeatherMap — Live weather data</li>
                <li>🌲 Hansen Global Forest Change — Land mask</li>
              </ul>
              <h3>Built With</h3>
              <ul>
                <li>React + Vite + Leaflet</li>
                <li>Google Earth Engine (GEE) exports</li>
                <li>Custom K-Means ML (no library)</li>
                <li>Framer Motion animations</li>
              </ul>
            </div>
          </main>
        } />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </AnimatePresence>

      {/* ── Status bar ─────────────────────────────────── */}
      <StatusBar />

      {/* ── Modals (global) ────────────────────────────── */}
      <CompareModal
        isOpen={isCompareOpen}
        onClose={() => setIsCompareOpen(false)}
        cities={cities}
        cityWeatherData={cityWeatherData}
        cityDetailsData={cityDetailsData}
      />

      {showPredictions && (
        <PredictionsPanel
          onClose={() => setShowPredictions(false)}
          cityWeatherData={cityWeatherData}
        />
      )}

      {showMethodology && (
        <MethodologyModal onClose={() => setShowMethodology(false)} />
      )}

      {/* ── Bottom nav (mobile only, shown via CSS) ── */}
      <BottomNav />
    </div>
  )
}

// ── Root: wrap everything in BrowserRouter ────────────────────────
export default function App() {
  return (
    <BrowserRouter>
      <AppInner />
    </BrowserRouter>
  )
}
