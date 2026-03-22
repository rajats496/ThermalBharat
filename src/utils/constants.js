export const INDIA_CENTER = {
  lat: 20.5937,
  lng: 78.9629
}

export const INDIA_ZOOM = 5
export const CITY_ZOOM = 11

export const THEME_COLORS = {
  background: '#0f1117',
  navbar: '#1a1d2e',
  sidebar: '#1a1d2e',
  accent: '#ff4444',
  secondary: '#00cc88',
  text: '#ffffff',
  textMuted: '#c7ccda'
}

export const HEAT_LEVELS = {
  SAFE: {
    max: 35,
    color: '#00cc88',
    label: 'Safe',
    labelHindi: 'सुरक्षित'
  },
  CAUTION: {
    max: 38,
    color: '#ffcc00',
    label: 'Caution',
    labelHindi: 'सावधान'
  },
  DANGER: {
    max: 42,
    color: '#ff8800',
    label: 'Danger',
    labelHindi: 'खतरा'
  },
  EXTREME: {
    max: 46,
    color: '#ff4444',
    label: 'Extreme',
    labelHindi: 'अति खतरनाक'
  },
  DEADLY: {
    max: 999,
    color: '#8b0000',
    label: 'Deadly',
    labelHindi: 'जानलेवा'
  }
}

export const AQI_LEVELS = {
  GOOD: {
    max: 50,
    color: '#00cc88',
    label: 'Good',
    labelHindi: 'अच्छा'
  },
  MODERATE: {
    max: 100,
    color: '#ffcc00',
    label: 'Moderate',
    labelHindi: 'ठीक'
  },
  UNHEALTHY: {
    max: 150,
    color: '#ff8800',
    label: 'Unhealthy',
    labelHindi: 'हानिकारक'
  },
  VERY_BAD: {
    max: 200,
    color: '#ff4444',
    label: 'Very Unhealthy',
    labelHindi: 'बहुत हानिकारक'
  },
  HAZARDOUS: {
    max: 999,
    color: '#8b0000',
    label: 'Hazardous',
    labelHindi: 'खतरनाक'
  }
}

export const RISK_THRESHOLDS = {
  LOW: { max: 3, color: '#00cc88' },
  MEDIUM: { max: 5, color: '#ffcc00' },
  HIGH: { max: 7, color: '#ff8800' },
  EXTREME: { max: 9, color: '#ff4444' },
  DEADLY: { max: 10, color: '#8b0000' }
}

export const CACHE_TTL_MS = 60 * 60 * 1000

export const INDIAN_STATES = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
  'Andaman and Nicobar Islands',
  'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Jammu and Kashmir',
  'Ladakh',
  'Lakshadweep',
  'Puducherry'
]
