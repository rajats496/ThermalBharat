/**
 * smsService.js — ThermalBharat Part 6
 * ======================================
 * WhatsApp alerts via Twilio Sandbox.
 * SMS feature removed (Fast2SMS requires ₹100 recharge).
 * Alert history stored in localStorage key: 'alertHistory'
 */

const MAX_HISTORY = 50

// ── Internal: log every alert to localStorage ──────────────────
function logAlert({ channel, city, message, status }) {
  try {
    const history = JSON.parse(localStorage.getItem('alertHistory') || '[]')
    history.unshift({
      id:      Date.now(),
      channel,
      city,
      preview: message.slice(0, 60),
      status,  // 'sent' | 'simulated'
      time:    new Date().toISOString(),
    })
    localStorage.setItem('alertHistory', JSON.stringify(history.slice(0, MAX_HISTORY)))
  } catch { /* ignore */ }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// WhatsApp Alert — Twilio Sandbox
// Browser cannot call Twilio API directly (CORS + auth security).
// Flow: show preview message → user forwards via WhatsApp Web link
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const SANDBOX_NUMBER = '+14155238886'   // Twilio WhatsApp sandbox
const JOIN_CODE      = 'join blanket-invented'

/**
 * Build a heatwave alert WhatsApp message.
 * Logs to history and returns preview + wa.me link.
 */
export function sendWhatsAppAlert(phoneNumber, cityName, cityNameHindi, temperature, dangerDays) {
  const waMessage =
    `⚠️ हीटवेव चेतावनी\n` +
    `${cityNameHindi || cityName} में अगले ${dangerDays} दिन ${temperature}°C+\n` +
    `खतरनाक समय: सुबह 11 — शाम 4 बजे\n` +
    `घर में रहें। पानी पीते रहें 🥤\n` +
    `लू लगे तो: 108\n` +
    `— ThermalBharat`

  logAlert({ channel: 'WhatsApp', city: cityNameHindi || cityName, message: waMessage, status: 'simulated' })

  // wa.me deep link — opens WhatsApp with pre-filled message to sandbox
  const encodedMsg  = encodeURIComponent(waMessage)
  const waLink      = `https://wa.me/${SANDBOX_NUMBER.replace('+', '')}?text=${encodedMsg}`

  return {
    success:    true,
    preview:    waMessage,
    waLink,
    joinCode:   JOIN_CODE,
    sandboxNum: SANDBOX_NUMBER,
  }
}

/**
 * Build a test alert WhatsApp message.
 */
export function sendWhatsAppTest(phoneNumber) {
  const waMessage =
    `✅ ThermalBharat Alert Test\n` +
    `आपका WhatsApp अलर्ट सक्रिय है!\n` +
    `अब आपको हीटवेव की चेतावनी मिलेगी।\n` +
    `— ThermalBharat`

  logAlert({ channel: 'WhatsApp', city: '—', message: waMessage, status: 'simulated' })

  const encodedMsg = encodeURIComponent(waMessage)
  const waLink     = `https://wa.me/${SANDBOX_NUMBER.replace('+', '')}?text=${encodedMsg}`

  return { success: true, preview: waMessage, waLink, joinCode: JOIN_CODE, sandboxNum: SANDBOX_NUMBER }
}

/**
 * Build a daily forecast WhatsApp message.
 */
export function sendWhatsAppForecast(phoneNumber, cityName, cityNameHindi, { temp, safeHours, aqi, aqiLabel }) {
  const waMessage =
    `🌅 सुबह का मौसम — ${cityNameHindi || cityName}\n` +
    `आज: ${temp}°C\n` +
    `सुरक्षित समय: ${safeHours}\n` +
    `AQI: ${aqi} — ${aqiLabel}\n` +
    `— ThermalBharat`

  logAlert({ channel: 'WhatsApp', city: cityNameHindi || cityName, message: waMessage, status: 'simulated' })

  const waLink = `https://wa.me/${SANDBOX_NUMBER.replace('+', '')}?text=${encodeURIComponent(waMessage)}`
  return { success: true, preview: waMessage, waLink }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Alert history helpers
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export function getAlertHistory() {
  try { return JSON.parse(localStorage.getItem('alertHistory') || '[]') }
  catch { return [] }
}

export function clearAlertHistory() {
  localStorage.removeItem('alertHistory')
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Registration helpers
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export function saveRegistration(reg) {
  const registrations = getRegistrations()
  const newReg = {
    id:           Date.now(),
    registeredAt: new Date().toISOString().slice(0, 10),
    active:       true,
    ...reg,
  }
  registrations.push(newReg)
  localStorage.setItem('alertRegistrations', JSON.stringify(registrations))
  return newReg
}

export function getRegistrations() {
  try { return JSON.parse(localStorage.getItem('alertRegistrations') || '[]') }
  catch { return [] }
}
