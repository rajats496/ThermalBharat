import axios from 'axios'
import { CACHE_TTL_MS } from '../utils/constants'
import { clamp, getAQILevel, getHeatLevel, toKmPerHour } from '../utils/calculations'

const OPEN_WEATHER_BASE = 'https://api.openweathermap.org/data/2.5'
const OPEN_METEO_ARCHIVE_BASE = 'https://archive-api.open-meteo.com/v1/archive'
const OPEN_METEO_FORECAST_BASE = 'https://api.open-meteo.com/v1/forecast'
const OPEN_METEO_GEOCODE_BASE = 'https://geocoding-api.open-meteo.com/v1/search'
const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org/search'

const weatherClient = axios.create({
  baseURL: OPEN_WEATHER_BASE,
  timeout: 15000
})

const meteoClient = axios.create({
  baseURL: OPEN_METEO_ARCHIVE_BASE,
  timeout: 20000
})

const meteoForecastClient = axios.create({
  baseURL: OPEN_METEO_FORECAST_BASE,
  timeout: 20000
})

const geocodeClient = axios.create({
  baseURL: OPEN_METEO_GEOCODE_BASE,
  timeout: 15000
})

const nominatimClient = axios.create({
  baseURL: NOMINATIM_BASE,
  timeout: 15000,
  headers: {
    Accept: 'application/json'
  }
})

function cacheKey(key, payload) {
  return `thermalbharat:${key}:${JSON.stringify(payload)}`
}

function readCache(key) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) {
      return null
    }
    const parsed = JSON.parse(raw)
    if (!parsed?.timestamp || !parsed?.data) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

function writeCache(key, data) {
  try {
    localStorage.setItem(
      key,
      JSON.stringify({
        timestamp: Date.now(),
        data
      })
    )
  } catch {
    // Ignore quota errors.
  }
}

function withMeta(data, timestamp, usingCached = false, warning = '') {
  const lastUpdated = timestamp || Date.now()
  const minutes = Math.max(0, Math.floor((Date.now() - lastUpdated) / 60000))
  const meta = {
    lastUpdated,
    lastUpdatedLabel: `Last updated ${minutes} mins ago`,
    usingCached,
    warning
  }

  if (Array.isArray(data)) {
    const enrichedArray = [...data]
    enrichedArray._meta = meta
    return enrichedArray
  }

  if (data && typeof data === 'object') {
    return {
      ...data,
      _meta: meta
    }
  }

  return {
    value: data,
    _meta: meta
  }
}

async function fetchWithCache(keyName, payload, fetcher, fallbackFactory = () => null) {
  const key = cacheKey(keyName, payload)
  const cached = readCache(key)
  const keyActive = import.meta.env.VITE_OPENWEATHER_KEY

  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return withMeta(cached.data, cached.timestamp)
  }

  try {
    if (!keyActive && keyName !== 'historical') {
      throw new Error('Missing OpenWeather API key')
    }

    const freshData = await fetcher()
    writeCache(key, freshData)
    return withMeta(freshData, Date.now())
  } catch (error) {
    if (cached) {
      return withMeta(cached.data, cached.timestamp, true, 'Using cached data')
    }

    const fallbackData = fallbackFactory(error)
    return withMeta(fallbackData, Date.now(), true, 'Using fallback data')
  }
}

function fallbackBaseTemp(lat, lon) {
  const signal = Math.abs(Math.sin(lat * 0.4) + Math.cos(lon * 0.3))
  return Number((31 + signal * 8).toFixed(1))
}

function toRiskLevelFromTemp(temp) {
  const level = getHeatLevel(temp)
  if (level.label === 'Safe') {
    return 2
  }
  if (level.label === 'Caution') {
    return 4
  }
  if (level.label === 'Danger') {
    return 6
  }
  if (level.label === 'Extreme') {
    return 8
  }
  return 10
}

function riskFromComposite(temp, humidity) {
  const raw = clamp((temp - 30) / 2 + humidity / 25, 0, 10)
  return Number(raw.toFixed(1))
}

export async function getCurrentWeather(lat, lon) {
  return fetchWithCache(
    'current-weather',
    { lat, lon },
    async () => {
      const response = await weatherClient.get('/weather', {
        params: {
          lat,
          lon,
          units: 'metric',
          appid: import.meta.env.VITE_OPENWEATHER_KEY
        }
      })

      const body = response.data
      const weather = body.weather?.[0] || {}
      return {
        temp: Number(body.main.temp.toFixed(1)),
        feels_like: Number(body.main.feels_like.toFixed(1)),
        humidity: body.main.humidity,
        wind_speed: toKmPerHour(body.wind.speed || 0),
        wind_direction: body.wind.deg ?? 0,
        description: weather.description || 'Clear sky',
        icon: weather.icon || '01d',
        timestamp: body.dt ? body.dt * 1000 : Date.now()
      }
    },
    () => {
      const temp = fallbackBaseTemp(lat, lon)
      return {
        temp,
        feels_like: Number((temp + 1.8).toFixed(1)),
        humidity: 52,
        wind_speed: 8,
        wind_direction: 120,
        description: 'Estimated weather',
        icon: '01d',
        timestamp: Date.now()
      }
    }
  )
}

export async function getForecast5Days(lat, lon) {
  return fetchWithCache(
    'forecast-5d',
    { lat, lon },
    async () => {
      const response = await weatherClient.get('/forecast', {
        params: {
          lat,
          lon,
          units: 'metric',
          appid: import.meta.env.VITE_OPENWEATHER_KEY
        }
      })

      const grouped = {}
      response.data.list.forEach((entry) => {
        const dateObj = new Date(entry.dt * 1000)
        const date = dateObj.toISOString().split('T')[0]
        if (!grouped[date]) {
          grouped[date] = []
        }
        grouped[date].push(entry)
      })

      return Object.entries(grouped)
        .slice(0, 5)
        .map(([date, entries]) => {
          const temps = entries.map((item) => item.main.temp)
          const humidities = entries.map((item) => item.main.humidity)
          const midday = entries[Math.floor(entries.length / 2)]
          const maxTemp = Math.max(...temps)
          const minTemp = Math.min(...temps)
          const humidity = Math.round(humidities.reduce((sum, value) => sum + value, 0) / humidities.length)
          const riskLevel = riskFromComposite(maxTemp, humidity)

          return {
            date,
            day_name: new Date(date).toLocaleDateString('en-US', { weekday: 'long' }),
            max_temp: Number(maxTemp.toFixed(1)),
            min_temp: Number(minTemp.toFixed(1)),
            humidity,
            description: midday?.weather?.[0]?.description || 'Warm',
            icon: midday?.weather?.[0]?.icon || '01d',
            risk_level: riskLevel
          }
        })
    },
    () => {
      const base = fallbackBaseTemp(lat, lon)
      return Array.from({ length: 5 }).map((_, idx) => {
        const dateObj = new Date()
        dateObj.setDate(dateObj.getDate() + idx)
        const maxTemp = Number((base + idx * 0.2).toFixed(1))
        const minTemp = Number((maxTemp - 4.5).toFixed(1))
        return {
          date: dateObj.toISOString().split('T')[0],
          day_name: dateObj.toLocaleDateString('en-US', { weekday: 'long' }),
          max_temp: maxTemp,
          min_temp: minTemp,
          humidity: 54,
          description: 'Estimated forecast',
          icon: '01d',
          risk_level: riskFromComposite(maxTemp, 54)
        }
      })
    }
  )
}

export async function getHourlyForecast(lat, lon) {
  return fetchWithCache(
    'forecast-hourly-24',
    { lat, lon },
    async () => {
      const response = await meteoForecastClient.get('', {
        params: {
          latitude: lat,
          longitude: lon,
          hourly: 'temperature_2m,apparent_temperature,relative_humidity_2m',
          forecast_days: 2,
          timezone: 'auto'
        }
      })

      const now = Date.now()
      const hourly = response.data?.hourly || {}
      const times = hourly.time || []
      const temps = hourly.temperature_2m || []
      const apparentTemps = hourly.apparent_temperature || []
      const humidityVals = hourly.relative_humidity_2m || []

      const filtered = times
        .map((time, index) => ({
          time,
          temp: temps[index],
          feelsLike: apparentTemps[index],
          humidity: humidityVals[index]
        }))
        .filter((entry) => new Date(entry.time).getTime() >= now)
        .slice(0, 24)

      return filtered.map((item) => {
        const temp = Number(item.temp.toFixed(1))
        const feelsLike = Number(item.feelsLike.toFixed(1))
        const humidity = Math.round(item.humidity)
        const riskLevel = Number((riskFromComposite(temp, humidity) + (feelsLike - temp) * 0.1).toFixed(1))

        return {
          hour: new Date(item.time).toLocaleTimeString('en-IN', {
            hour: 'numeric',
            hour12: true
          }),
          temp,
          feels_like: feelsLike,
          humidity,
          risk_level: clamp(riskLevel, 0, 10)
        }
      })
    },
    () => {
      const base = fallbackBaseTemp(lat, lon)
      return Array.from({ length: 24 }).map((_, idx) => {
        const date = new Date(Date.now() + idx * 60 * 60 * 1000)
        const temp = Number((base - Math.sin(idx) * 2).toFixed(1))
        return {
          hour: date.toLocaleTimeString('en-IN', {
            hour: 'numeric',
            hour12: true
          }),
          temp,
          feels_like: Number((temp + 1.2).toFixed(1)),
          humidity: 50 + (idx % 4) * 3,
          risk_level: toRiskLevelFromTemp(temp)
        }
      })
    }
  )
}

const PM25_BREAKPOINTS = [
  { cLow: 0, cHigh: 12, iLow: 0, iHigh: 50 },
  { cLow: 12.1, cHigh: 35.4, iLow: 51, iHigh: 100 },
  { cLow: 35.5, cHigh: 55.4, iLow: 101, iHigh: 150 },
  { cLow: 55.5, cHigh: 150.4, iLow: 151, iHigh: 200 },
  { cLow: 150.5, cHigh: 250.4, iLow: 201, iHigh: 300 },
  { cLow: 250.5, cHigh: 350.4, iLow: 301, iHigh: 400 },
  { cLow: 350.5, cHigh: 500.4, iLow: 401, iHigh: 500 }
]

function estimateUSAQI(pm25) {
  const concentration = clamp(pm25, 0, 500.4)
  const range = PM25_BREAKPOINTS.find(
    (item) => concentration >= item.cLow && concentration <= item.cHigh
  )

  if (!range) {
    return 500
  }

  const aqi =
    ((range.iHigh - range.iLow) / (range.cHigh - range.cLow)) * (concentration - range.cLow) +
    range.iLow

  return clamp(Math.round(aqi), 0, 500)
}

function pollutantName(components = {}) {
  const keys = ['pm2_5', 'pm10', 'no2', 'o3', 'so2', 'co']
  return keys.reduce(
    (best, key) => {
      const value = components[key] ?? 0
      return value > best.value ? { name: key, value } : best
    },
    { name: 'pm2_5', value: components.pm2_5 ?? 0 }
  ).name
}

export async function getAirQuality(lat, lon) {
  return fetchWithCache(
    'air-quality',
    { lat, lon },
    async () => {
      const response = await weatherClient.get('/air_pollution', {
        params: {
          lat,
          lon,
          appid: import.meta.env.VITE_OPENWEATHER_KEY
        }
      })

      const item = response.data.list?.[0] || {}
      const components = item.components || {}
      const pm25 = Number((components.pm2_5 ?? 25).toFixed(1))
      const pm10 = Number((components.pm10 ?? 40).toFixed(1))
      const aqiValue = estimateUSAQI(pm25)
      const level = getAQILevel(aqiValue)

      return {
        aqi: item.main?.aqi ?? 3,
        aqi_value: aqiValue,
        main_pollutant: pollutantName(components),
        pm2_5: pm25,
        pm10,
        category: level.label,
        category_hindi: level.labelHindi
      }
    },
    () => {
      const pm25 = 35
      const aqiValue = estimateUSAQI(pm25)
      const level = getAQILevel(aqiValue)
      return {
        aqi: 3,
        aqi_value: aqiValue,
        main_pollutant: 'pm2_5',
        pm2_5: pm25,
        pm10: 62,
        category: level.label,
        category_hindi: level.labelHindi
      }
    }
  )
}

function generateOffsets(lat) {
  const latDelta = 2 / 111
  const lonDelta = 2 / (111 * Math.cos((lat * Math.PI) / 180))
  return [
    { label: 'N', dLat: latDelta, dLon: 0 },
    { label: 'S', dLat: -latDelta, dLon: 0 },
    { label: 'E', dLat: 0, dLon: lonDelta },
    { label: 'W', dLat: 0, dLon: -lonDelta },
    { label: 'NE', dLat: latDelta, dLon: lonDelta },
    { label: 'NW', dLat: latDelta, dLon: -lonDelta },
    { label: 'SE', dLat: -latDelta, dLon: lonDelta },
    { label: 'SW', dLat: -latDelta, dLon: -lonDelta }
  ]
}

export async function getNeighborhoodTemperatures(lat, lon, cityName) {
  return fetchWithCache(
    'neighborhood-temps',
    { lat, lon, cityName },
    async () => {
      const points = generateOffsets(lat)
      const reads = await Promise.all(
        points.map(async (point) => {
          const reading = await getCurrentWeather(lat + point.dLat, lon + point.dLon)
          const heatLevel = getHeatLevel(reading.temp)
          return {
            direction: point.label,
            temperature: reading.temp,
            risk_level: toRiskLevelFromTemp(reading.temp),
            color: heatLevel.color
          }
        })
      )

      return reads
    },
    () => {
      const base = fallbackBaseTemp(lat, lon)
      return generateOffsets(lat).map((point, index) => {
        const temp = Number((base + (index % 4) * 0.7 - 1.2).toFixed(1))
        return {
          direction: point.label,
          temperature: temp,
          risk_level: toRiskLevelFromTemp(temp),
          color: getHeatLevel(temp).color
        }
      })
    }
  )
}

export async function getHistoricalTrend(lat, lon, cityName) {
  return fetchWithCache(
    'historical-trend',
    { lat, lon, cityName },
    async () => {
      const response = await meteoClient.get('', {
        params: {
          latitude: lat,
          longitude: lon,
          start_date: '2014-01-01',
          end_date: '2024-12-31',
          daily: 'temperature_2m_max',
          timezone: 'auto'
        }
      })

      const dates = response.data?.daily?.time || []
      const maxTemps = response.data?.daily?.temperature_2m_max || []
      const yearlyMap = {}

      dates.forEach((date, index) => {
        const year = Number(date.slice(0, 4))
        if (!yearlyMap[year]) {
          yearlyMap[year] = []
        }
        yearlyMap[year].push(maxTemps[index])
      })

      const years = []
      const avgMaxTemps = []
      for (let year = 2014; year <= 2024; year += 1) {
        years.push(year)
        const yearReadings = yearlyMap[year] || []
        const avg =
          yearReadings.length > 0
            ? yearReadings.reduce((sum, value) => sum + value, 0) / yearReadings.length
            : null
        avgMaxTemps.push(avg == null ? null : Number(avg.toFixed(2)))
      }

      const first = avgMaxTemps.find((value) => value != null) ?? 0
      const last = [...avgMaxTemps].reverse().find((value) => value != null) ?? first
      const totalChange = Number((last - first).toFixed(2))

      return {
        years,
        avg_max_temps: avgMaxTemps,
        trend_direction: totalChange >= 0 ? 'warming' : 'cooling',
        total_change: totalChange
      }
    },
    () => {
      const years = Array.from({ length: 11 }).map((_, idx) => 2014 + idx)
      const base = fallbackBaseTemp(lat, lon) - 2
      const avgMaxTemps = years.map((_, idx) => Number((base + idx * 0.22).toFixed(2)))
      const totalChange = Number((avgMaxTemps.at(-1) - avgMaxTemps[0]).toFixed(2))
      return {
        years,
        avg_max_temps: avgMaxTemps,
        trend_direction: totalChange >= 0 ? 'warming' : 'cooling',
        total_change: totalChange
      }
    }
  )
}

export async function getCityWeatherBundle(city) {
  const [current, forecast, airQuality] = await Promise.all([
    getCurrentWeather(city.latitude, city.longitude),
    getForecast5Days(city.latitude, city.longitude),
    getAirQuality(city.latitude, city.longitude)
  ])
  return {
    current,
    forecast,
    airQuality
  }
}

export async function getCityDetailBundle(city) {
  const [current, forecast, hourly, airQuality, neighborhood, historical] = await Promise.all([
    getCurrentWeather(city.latitude, city.longitude),
    getForecast5Days(city.latitude, city.longitude),
    getHourlyForecast(city.latitude, city.longitude),
    getAirQuality(city.latitude, city.longitude),
    getNeighborhoodTemperatures(city.latitude, city.longitude, city.name),
    getHistoricalTrend(city.latitude, city.longitude, city.name)
  ])

  return {
    current,
    forecast,
    hourly,
    airQuality,
    neighborhood,
    historical
  }
}

export async function geocodeCityInIndia(cityName, stateName = '') {
  const normalize = (value) => (value || '').toLowerCase().replace(/[^a-z]/g, '')

  try {
    const response = await geocodeClient.get('', {
      params: {
        name: cityName,
        count: 10,
        language: 'en',
        countryCode: 'IN'
      }
    })

    const results = response.data?.results || []
    const indianResults = results.filter((item) => item.country_code === 'IN')

    let best = indianResults[0] || results[0]
    if (stateName && indianResults.length) {
      const stateNeedle = normalize(stateName)
      const stateMatched = indianResults.find(
        (item) => normalize(item.admin1) === stateNeedle || normalize(item.admin2) === stateNeedle
      )

      if (!stateMatched) {
        throw new Error('Need district-capable fallback')
      }

      best = stateMatched
    }

    if (best) {
      return {
        name: best.name,
        latitude: best.latitude,
        longitude: best.longitude,
        state: best.admin1 || 'India'
      }
    }
  } catch {
    // Use district-capable fallback below.
  }

  const query = stateName ? `${cityName}, ${stateName}, India` : `${cityName}, India`
  const fallback = await nominatimClient.get('', {
    params: {
      q: query,
      format: 'jsonv2',
      addressdetails: 1,
      countrycodes: 'in',
      limit: 10
    }
  })

  const fallbackResults = fallback.data || []
  if (!fallbackResults.length) {
    throw new Error(`Location not found for ${cityName}${stateName ? `, ${stateName}` : ''}`)
  }

  const stateNeedle = normalize(stateName)
  const bestFallback =
    (stateName
      ? fallbackResults.find((item) => normalize(item.address?.state) === stateNeedle)
      : null) || fallbackResults[0]

  const address = bestFallback.address || {}
  const resolvedName =
    address.city || address.town || address.village || address.county || address.state_district || cityName

  return {
    name: resolvedName,
    latitude: Number(bestFallback.lat),
    longitude: Number(bestFallback.lon),
    state: address.state || stateName || 'India'
  }
}
