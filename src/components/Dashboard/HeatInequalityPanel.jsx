/**
 * HeatInequalityPanel.jsx — ThermalBharat Part 7, Feature 1
 * ===========================================================
 * Compares live temperatures between rich and poor neighborhoods
 * for 30 major Indian cities using real data + OWM API + GEE Data.
 */

import { useEffect, useState } from 'react'
import { getCurrentWeather } from '../../services/weatherAPI'
import { loadCityData, loadNDVIData } from '../../services/geeAPI'

// ── Hardcoded real neighborhood data (10 cities) ────────────────
const NEIGHBORHOOD_DATA = {
  Delhi: {
    rich: { name: 'Lutyens Delhi', nameHindi: 'लुटियंस दिल्ली', lat: 28.6129, lon: 77.2295, avgIncome: '₹5L+/month' },
    poor: { name: 'Seemapuri',     nameHindi: 'सीमापुरी',        lat: 28.6862, lon: 77.3200, avgIncome: '₹8K/month'  },
  },
  Mumbai: {
    rich: { name: 'Malabar Hill', nameHindi: 'मालाबार हिल', lat: 18.9548, lon: 72.7979, avgIncome: '₹8L+/month' },
    poor: { name: 'Dharavi',      nameHindi: 'धारावी',      lat: 19.0407, lon: 72.8543, avgIncome: '₹6K/month'  },
  },
  Bangalore: {
    rich: { name: 'Koramangala', nameHindi: 'कोरमंगला', lat: 12.9352, lon: 77.6245, avgIncome: '₹3L+/month' },
    poor: { name: 'Ejipura',     nameHindi: 'एजीपुरा',   lat: 12.9398, lon: 77.6177, avgIncome: '₹7K/month'  },
  },
  Chennai: {
    rich: { name: 'Boat Club Road', nameHindi: 'बोट क्लब रोड', lat: 13.0418, lon: 80.2341, avgIncome: '₹4L+/month' },
    poor: { name: 'Vyasarpadi',     nameHindi: 'व्यासरपाडी',    lat: 13.1127, lon: 80.2707, avgIncome: '₹6K/month'  },
  },
  Hyderabad: {
    rich: { name: 'Jubilee Hills', nameHindi: 'जुबली हिल्स', lat: 17.4326, lon: 78.4071, avgIncome: '₹4L+/month' },
    poor: { name: 'Yakutpura',     nameHindi: 'याकुतपुरा',   lat: 17.3616, lon: 78.5105, avgIncome: '₹5K/month'  },
  },
  Kolkata: {
    rich: { name: 'Alipore', nameHindi: 'अलीपुर', lat: 22.5272, lon: 88.3362, avgIncome: '₹3L+/month' },
    poor: { name: 'Topsia',  nameHindi: 'टॉप्सिया', lat: 22.5508, lon: 88.3832, avgIncome: '₹5K/month'  },
  },
  Ahmedabad: {
    rich: { name: 'Bodakdev',   nameHindi: 'बोडकदेव',   lat: 23.0510, lon: 72.5136, avgIncome: '₹2L+/month' },
    poor: { name: 'Behrampura', nameHindi: 'बेहरामपुरा', lat: 22.9927, lon: 72.5773, avgIncome: '₹6K/month'  },
  },
  Nagpur: {
    rich: { name: 'Dharampeth', nameHindi: 'धरमपेठ', lat: 21.1424, lon: 79.0604, avgIncome: '₹1.5L+/month' },
    poor: { name: 'Indora',     nameHindi: 'इंदोरा',  lat: 21.1632, lon: 79.1023, avgIncome: '₹5K/month'   },
  },
  Pune: {
    rich: { name: 'Koregaon Park', nameHindi: 'कोरेगाव पार्क', lat: 18.5362, lon: 73.8938, avgIncome: '₹3L+/month' },
    poor: { name: 'Tadiwala Road', nameHindi: 'तडीवाला रोड',   lat: 18.5247, lon: 73.8553, avgIncome: '₹6K/month'  },
  },
  Jaipur: {
    rich: { name: 'Civil Lines', nameHindi: 'सिविल लाइन्स', lat: 26.9124, lon: 75.7873, avgIncome: '₹2L+/month' },
    poor: { name: 'Ramganj',     nameHindi: 'रामगंज',        lat: 26.9198, lon: 75.8426, avgIncome: '₹5K/month'  },
  },
}

// ───────────────────────────────────────────────────────────────
// Get nearest SUHI value
function getNearestSUHI(geeData, lat, lon) {
  if (!geeData?.pixels?.length) return 0

  const nearest = geeData.pixels.reduce((closest, pixel) => {
    const dist = Math.sqrt(Math.pow(pixel.lat - lat, 2) + Math.pow(pixel.lon - lon, 2))
    return dist < closest.dist ? { pixel, dist } : closest
  }, { pixel: null, dist: Infinity }).pixel

  return nearest?.day?.['2018'] || 0
}

// Get nearest NDVI value
function getNearestNDVI(ndviData, lat, lon) {
  if (!ndviData?.pixels?.length) return 0

  const nearest = ndviData.pixels.reduce((closest, pixel) => {
    const dist = Math.sqrt(Math.pow(pixel.lat - lat, 2) + Math.pow(pixel.lon - lon, 2))
    return dist < closest.dist ? { pixel, dist } : closest
  }, { pixel: null, dist: Infinity }).pixel

  return nearest?.ndvi || 0
}

// Auto detect areas for remaining 20 cities based on NDVI
async function getAutoNeighborhoods(cityName, ndviData, geeData) {
  if (!ndviData?.pixels?.length) return null

  // Filter valid urban pixels
  const urbanPixels = ndviData.pixels.filter(p => p.ndvi >= 0.05 && p.ndvi <= 0.70)

  if (urbanPixels.length < 2) return null

  // Rich area = highest NDVI = most green = likely affluent
  const richPixel = [...urbanPixels].sort((a,b) => b.ndvi - a.ndvi)[0]

  // Poor area = lowest NDVI = most concrete = likely dense
  const poorPixel = [...urbanPixels].sort((a,b) => a.ndvi - b.ndvi)[0]

  return {
    rich: {
      name: "High Green Cover Area",
      nameHindi: "हरित क्षेत्र",
      lat: richPixel.lat,
      lon: richPixel.lon,
      avgIncome: "N/A",
      autoDetected: true
    },
    poor: {
      name: "Low Green Cover Area",
      nameHindi: "कम हरित क्षेत्र",
      lat: poorPixel.lat,
      lon: poorPixel.lon,
      avgIncome: "N/A",
      autoDetected: true
    }
  }
}

// ───────────────────────────────────────────────────────────────
function NeighborhoodCard({ hood, type, data, loading }) {
  const isRich  = type === 'rich'
  const border  = isRich ? '#00cc88' : '#ff4444'
  const icon    = isRich ? (hood.autoDetected ? '🌿' : '🏛️') : (hood.autoDetected ? '🏗️' : '🏚️')
  const label   = isRich ? 'Affluent Area' : 'Low-income Area'
  const labelHi = isRich ? 'संपन्न क्षेत्र' : 'निम्न-आय क्षेत्र'

  return (
    <div className="ineq-card" style={{ borderColor: border }}>
      <div className="ineq-card-header" style={{ color: border }}>
        {icon} {hood.name}
        <span className="hindi-text"> — {hood.nameHindi}</span>
      </div>
      {!hood.autoDetected && <div className="ineq-label">{label} <span className="hindi-text">({labelHi})</span></div>}
      
      <div className="ineq-stats">
        <div className="ineq-stat">
          <span className="ineq-stat-label">🌡️ Live Temp</span>
          <span className="ineq-stat-val" style={{ color: border }}>
            {loading ? '—' : data?.temp !== null && data?.temp !== undefined ? `${data.temp}°C` : 'N/A'}
          </span>
        </div>
        <div className="ineq-stat">
          <span className="ineq-stat-label">🔥 SUHI Intensity</span>
          <span className="ineq-stat-val">
            {loading ? '—' : data?.suhi !== null && data?.suhi !== undefined ? `+${data.suhi}°C` : 'N/A'}
          </span>
        </div>
        <div className="ineq-stat">
          <span className="ineq-stat-label">🌳 Tree Cover</span>
          <span className="ineq-stat-val">
            {loading ? '—' : data?.treePercent !== null && data?.treePercent !== undefined ? `${data.treePercent}%` : 'N/A'}
          </span>
        </div>
        {!hood.autoDetected && (
          <div className="ineq-stat">
            <span className="ineq-stat-label">💰 Avg Income</span>
            <span className="ineq-stat-val">{hood.avgIncome}</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main component ──────────────────────────────────────────────
export default function HeatInequalityPanel({ cityName }) {
  const [hoods, setHoods] = useState(null)
  const [richData, setRichData] = useState(null)
  const [poorData, setPoorData] = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [noData, setNoData] = useState(false)

  useEffect(() => {
    let cancelled = false
    setHoods(null); setRichData(null); setPoorData(null); setLoading(true); setNoData(false)

    async function getNeighborhoodsAndData() {
      try {
        const hardcoded = NEIGHBORHOOD_DATA[cityName]
        const [geeData, ndviData] = await Promise.all([
          loadCityData(cityName).catch(() => null),
          loadNDVIData(cityName).catch(() => null)
        ])

        if (cancelled) return

        const detectedHoods = hardcoded || await getAutoNeighborhoods(cityName, ndviData, geeData)

        if (!detectedHoods) {
          if (!cancelled) {
            setNoData(true)
            setLoading(false)
          }
          return
        }

        if (!cancelled) setHoods(detectedHoods)

        const [richDataRes, poorDataRes] = await Promise.all([
          Promise.all([
            getCurrentWeather(detectedHoods.rich.lat, detectedHoods.rich.lon).catch(() => null),
            getNearestSUHI(geeData, detectedHoods.rich.lat, detectedHoods.rich.lon),
            getNearestNDVI(ndviData, detectedHoods.rich.lat, detectedHoods.rich.lon)
          ]),
          Promise.all([
            getCurrentWeather(detectedHoods.poor.lat, detectedHoods.poor.lon).catch(() => null),
            getNearestSUHI(geeData, detectedHoods.poor.lat, detectedHoods.poor.lon),
            getNearestNDVI(ndviData, detectedHoods.poor.lat, detectedHoods.poor.lon)
          ])
        ])

        if (!cancelled) {
          setRichData({
            temp: richDataRes[0]?.temp ?? null,
            suhi: richDataRes[1] ? Number(richDataRes[1].toFixed(1)) : null,
            treePercent: Math.max(0, Math.round(richDataRes[2] * 100))
          })
          setPoorData({
            temp: poorDataRes[0]?.temp ?? null,
            suhi: poorDataRes[1] ? Number(poorDataRes[1].toFixed(1)) : null,
            treePercent: Math.max(0, Math.round(poorDataRes[2] * 100))
          })
          setLoading(false)
        }

      } catch (err) {
        console.error(err)
        if (!cancelled) setLoading(false)
      }
    }

    getNeighborhoodsAndData()
    return () => { cancelled = true }
  }, [cityName])

  if (noData) {
    return (
      <div className="detail-card ineq-panel">
        <h4>⚖️ Heat Inequality <span className="hindi-text">— ताप असमानता</span></h4>
        <div style={{ textAlign: 'center', margin: '20px 0', fontSize: '13px', color: '#888' }}>
          Satellite data loading...
          <br/>
          <span className="hindi-text">उपग्रह डेटा लोड हो रहा है...</span>
          <br/><br/>
          Run <code>gee_export.py</code> to enable this feature for {cityName}.
        </div>
      </div>
    )
  }

  if (!hoods && !loading) return null

  // Use the new dynamic values, fallback to 0 if null for math.
  // Actually, wait until the data is loaded to show the gap properly.
  const gap = (!loading && poorData?.temp != null && richData?.temp != null)
    ? Math.abs(poorData.temp - richData.temp).toFixed(1)
    : null

  return (
    <div className="detail-card ineq-panel">
      <h4>
        ⚖️ Heat Inequality
        <span className="hindi-text"> — ताप असमानता</span>
      </h4>
      <p className="ineq-subtitle">
        How heat affects rich vs poor neighborhoods in {cityName}
      </p>

      {loading && (
        <div style={{ textAlign: 'center', margin: '20px 0', fontSize: '13px', color: '#888' }}>
          ⏳ Fetching live data...
          <br/>
          <span className="hindi-text">लाइव डेटा लोड हो रहा है...</span>
        </div>
      )}

      {hoods && !loading && (
        <div className="ineq-grid">
          <NeighborhoodCard hood={hoods.rich} type="rich" data={richData} loading={loading} />
          <NeighborhoodCard hood={hoods.poor} type="poor" data={poorData} loading={loading} />
        </div>
      )}

      {gap !== null && !loading && hoods && (
        <div className="ineq-gap">
          <div className="ineq-gap-number">+{gap}°C</div>
          <div className="ineq-gap-label">Temperature Injustice — ताप असमानता</div>
          <p className="ineq-gap-quote">
            "The people with least resources suffer most from heat."
            <br />
            <span className="hindi-text">
              "जिनके पास सबसे कम संसाधन हैं, वे सबसे ज्यादा गर्मी झेलते हैं।"
            </span>
          </p>
        </div>
      )}

      {hoods?.rich?.autoDetected && !loading && (
        <div style={{ textAlign: 'center', marginTop: '15px', fontSize: '12px', color: '#888' }}>
          ℹ️ Areas auto-detected from satellite vegetation data
          <br/>
          <span className="hindi-text">उपग्रह डेटा से स्वतः पहचाना गया</span>
        </div>
      )}
    </div>
  )
}
