# 🌡️ ThermalBharat
### भारत का शहरी ताप मानचित्र
**Mapping India's Urban Heat, One City at a Time**

[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)](https://vitejs.dev)
[![Leaflet](https://img.shields.io/badge/Leaflet-1.9-199900?logo=leaflet&logoColor=white)](https://leafletjs.com)
[![Framer Motion](https://img.shields.io/badge/Framer_Motion-12-black?logo=framer&logoColor=white)](https://www.framer.com/motion)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## 📌 About

**ThermalBharat** is an open-source urban heat island (UHI) analytics platform for India's 30 largest cities. It combines live weather data, satellite imagery, ML-based temperature predictions, and interactive maps to help citizens, researchers, and policymakers understand India's growing urban heat crisis.

> Built as a research and public-awareness tool — no sign-up required, fully free.

---

## 🚀 Live Demo

**[thermalbharat.vercel.app](https://thermalbharat.vercel.app)**  
*(Deploy your own with one click below)*

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yourusername/thermalbharat)

---

## ✨ Features

| # | Feature | Description |
|---|---|---|
| 1 | 🗺️ **Interactive India Map** | Dark CartoDB base map with color-coded heat markers for all 30 cities |
| 2 | 🌡️ **Live Weather Data** | Real-time temperature, AQI, humidity, wind via OpenWeatherMap |
| 3 | 📊 **City Detail Pages** | Full-page analysis: temperature trends, safe hours, 5-day forecast |
| 4 | ⚖️ **City Comparison** | Side-by-side animated bar-chart comparison of any two cities |
| 5 | 🔮 **2030 ML Predictions** | ERA5 climate trend extrapolation per city using linear regression |
| 6 | 🌿 **NDVI Tree Analysis** | Satellite-derived tree cover with tree-planting calculator |
| 7 | 🔥 **SUHI Overlays** | Surface Urban Heat Island intensity from Yale YCEO dataset |
| 8 | 🔵 **K-Means Clustering** | Custom JS ML groups cities into heat risk zones |
| 9 | 📖 **Methodology Page** | Research-paper-style documentation with sticky TOC |
| 10 | 📱 **Fully Responsive** | Mobile-first with bottom nav, hamburger menu, safe area support |

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite 5 |
| Routing | React Router v6 |
| Map | Leaflet + react-leaflet |
| Animations | Framer Motion v12 |
| Charts | Recharts |
| Fonts | Inter, JetBrains Mono, Noto Sans Devanagari |
| Weather API | OpenWeatherMap |
| Climate Data | Open-Meteo ERA5 Archive |
| Satellite Data | Yale YCEO, Sentinel-2, Hansen GFC |
| Deployment | Vercel |

---

## 📦 Run Locally

### Prerequisites
- Node.js 18+
- npm 9+
- Free [OpenWeatherMap API key](https://openweathermap.org/api)

### Steps

```bash
# 1. Clone the repo
git clone https://github.com/yourusername/thermalbharat.git
cd thermalbharat

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env.local
# Edit .env.local and add your VITE_OPENWEATHER_API_KEY

# 4. Start dev server
npm run dev
# → Open http://localhost:5173

# 5. Build for production
npm run build
```

---

## 🌐 Deploy to Vercel

1. Fork this repo
2. Go to [vercel.com/new](https://vercel.com/new) and import your fork
3. Add environment variable: `VITE_OPENWEATHER_API_KEY`
4. Click **Deploy** — done ✅

The included `vercel.json` handles SPA routing automatically.

---

## 🛰️ GEE Export Guide

NDVI and SUHI data are pre-exported from Google Earth Engine. To regenerate:

```bash
# 1. Open Google Earth Engine Code Editor
# 2. Upload gee_export.py logic as a GEE script (Python API)
# 3. Export results as GeoJSON to public/data/gee/

python gee_export.py
```

Exported files go to `public/data/gee/`:
- `cities_index.json` — city coordinates index
- `{city}_ndvi.geojson` — NDVI grid per city

---

## 📚 Data Sources

| Source | Dataset | Usage |
|---|---|---|
| [Yale YCEO](https://yceo.yale.edu/research/global-surface-uhi-explorer) | Global Surface UHI | SUHI intensity 2003–2018 |
| [Sentinel-2 ESA](https://sentinel.esa.int/web/sentinel/missions/sentinel-2) | NDVI via Google Earth Engine | Tree cover analysis |
| [Open-Meteo ERA5](https://open-meteo.com/en/docs/historical-weather-api) | Historical climate (1940–present) | Temperature trend slopes |
| [OpenWeatherMap](https://openweathermap.org/api) | Current weather + AQI + forecast | Live data |
| [Hansen GFC](https://glad.earthengine.app/view/global-forest-change) | Global Forest Change | Land mask for NDVI |
| [OSM Nominatim](https://nominatim.org/) | Geocoding | Custom city search |

---

## 📑 Research References

- Chakraborty, T. & Lee, X. (2019). *A simplified urban heat island intensity index.* Science of the Total Environment. [→](https://doi.org/10.1016/j.scitotenv.2019.01.189)
- Peng, S. et al. (2012). *Surface Urban Heat Island Across 419 Global Big Cities.* Environmental Science & Technology. [→](https://doi.org/10.1021/es2030438)
- Mukherjee, S. & Mishra, A. (2018). *Increase in compound events from 2000–2016 over India.* Earth's Future. [→](https://doi.org/10.1029/2017EF000774)
- Hansen, M.C. et al. (2013). *High-Resolution Global Maps of 21st-Century Forest Cover Change.* Science. [→](https://doi.org/10.1126/science.1244693)

---

## 🤝 Contributing

Contributions welcome! Please:

1. Fork the repo & create a feature branch
2. Follow the existing code style (no logic in CSS, no CSS in JS)
3. Run `npm run build` before submitting — it must pass ✅
4. Open a Pull Request with a clear description

**Good first issues:**
- Add more cities (edit `src/data/indianCities.js`)
- Improve Hindi translations
- Add new data sources

---

## 📄 License

MIT © 2025 ThermalBharat Contributors

---

*Made with ❤️ for India's urban future | भारत के शहरी भविष्य के लिए*
