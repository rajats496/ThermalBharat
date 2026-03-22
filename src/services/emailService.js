/**
 * emailService.js — ThermalBharat Part 6
 * =========================================
 * Automatic heatwave alert emails via Brevo (formerly Sendinblue).
 * Brevo API is CORS-friendly → works directly from browser, no backend needed.
 * Free tier: 300 emails/day, no credit card required.
 *
 * Setup: Add VITE_BREVO_KEY=your_key to .env
 */

const BREVO_URL = 'https://api.brevo.com/v3/smtp/email'
const SENDER_NAME = 'ThermalBharat'
const SENDER_EMAIL = 'www.rajatsri@gmail.com'  // must be verified in Brevo
const MAX_HISTORY = 50

// ── localStorage helpers ────────────────────────────────────────
function logAlert({ to, subject, status, preview }) {
  try {
    const history = JSON.parse(localStorage.getItem('alertHistory') || '[]')
    history.unshift({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      channel: 'Email',
      city: to,
      preview: preview?.slice(0, 60) || subject,
      status,
      time: new Date().toISOString(),
    })
    localStorage.setItem('alertHistory', JSON.stringify(history.slice(0, MAX_HISTORY)))
  } catch { /* ignore */ }
}

// ── Brevo API caller ────────────────────────────────────────────
async function sendBrevoEmail({ toEmail, toName, subject, htmlContent, textContent }) {
  const key = import.meta.env.VITE_BREVO_KEY
  if (!key || key === 'your_brevo_api_key_here')
    throw new Error('VITE_BREVO_KEY not set in .env — add real Brevo API key')

  const res = await fetch(BREVO_URL, {
    method: 'POST',
    headers: {
      'api-key': key,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      sender: { name: SENDER_NAME, email: SENDER_EMAIL },
      to: [{ email: toEmail, name: toName || toEmail }],
      subject,
      htmlContent,
      textContent,
    }),
  })

  const text = await res.text()
  let data
  try { data = JSON.parse(text) } catch { data = {} }

  if (!res.ok) {
    console.error('[Brevo] status:', res.status, '| body:', text)
    throw new Error(data.message || `Brevo error ${res.status}: ${text.slice(0, 120)}`)
  }
  return data
}

// ── HTML email templates ────────────────────────────────────────
function heatwaveEmailHTML({ cityName, cityNameHindi, temperature, dangerDays, language }) {
  const isHindi = language !== 'english'
  return `<!DOCTYPE html>
<html lang="${isHindi ? 'hi' : 'en'}">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  body{margin:0;padding:0;background:#0f1117;font-family:Arial,sans-serif;color:#c7ccda}
  .wrap{max-width:560px;margin:0 auto;background:#1a1d2e;border-radius:16px;overflow:hidden}
  .header{background:linear-gradient(135deg,#ff4444,#cc2222);padding:28px 24px;text-align:center}
  .header h1{margin:0;color:#fff;font-size:26px;letter-spacing:-0.5px}
  .header p{margin:6px 0 0;color:#ffdddd;font-size:14px}
  .body{padding:24px}
  .alert-box{background:#2a0000;border:2px solid #ff4444;border-radius:12px;padding:18px;margin-bottom:18px;text-align:center}
  .temp-big{font-size:52px;font-weight:800;color:#ff4444;line-height:1}
  .city-name{font-size:22px;font-weight:700;color:#fff;margin:8px 0 4px}
  .danger-days{font-size:15px;color:#ffaaaa}
  .tips{background:#12151f;border-radius:10px;padding:16px;margin-bottom:16px}
  .tips h3{margin:0 0 10px;color:#ff8800;font-size:14px;text-transform:uppercase;letter-spacing:0.5px}
  .tip{display:flex;align-items:flex-start;gap:10px;margin-bottom:8px;font-size:13px;color:#adb5c7}
  .tip-icon{font-size:18px;flex-shrink:0}
  .footer{background:#0f1117;padding:16px 24px;text-align:center;font-size:11px;color:#555}
  .footer a{color:#00cc88;text-decoration:none}
  .emergency-box{background:#1a2e0a;border:1px solid #00cc88;border-radius:8px;padding:12px;text-align:center;margin-bottom:16px}
  .emergency-box p{margin:0;font-size:13px;color:#00cc88;font-weight:600}
  .safe-hours{font-size:12px;color:#888;margin:4px 0 0}
</style></head>
<body><div class="wrap">
  <div class="header">
    <h1>⚠️ ${isHindi ? 'हीटवेव चेतावनी' : 'Heatwave Warning'}</h1>
    <p>ThermalBharat — India Urban Heat Island Mapper</p>
  </div>
  <div class="body">
    <div class="alert-box">
      <div class="temp-big">${temperature}°C</div>
      <div class="city-name">${isHindi ? (cityNameHindi || cityName) : cityName}</div>
      <div class="danger-days">${isHindi
      ? `अगले ${dangerDays} दिन गर्मी जारी रहेगी`
      : `Dangerous heat expected for ${dangerDays} days`}</div>
    </div>

    <div class="emergency-box">
      <p>🚑 ${isHindi ? 'आपातकालीन: 108' : 'Emergency: 108'}</p>
      <p class="safe-hours">${isHindi ? 'खतरनाक समय: सुबह 11 बजे — शाम 4 बजे' : 'Danger hours: 11 AM – 4 PM'}</p>
    </div>

    <div class="tips">
      <h3>${isHindi ? '🛡️ सुरक्षा सुझाव' : '🛡️ Safety Tips'}</h3>
      <div class="tip"><span class="tip-icon">🏠</span><span>${isHindi ? 'घर के अंदर रहें, खासकर दोपहर 11 से शाम 4 बजे तक।' : 'Stay indoors, especially 11 AM to 4 PM.'}</span></div>
      <div class="tip"><span class="tip-icon">💧</span><span>${isHindi ? 'हर घंटे कम से कम 1 गिलास पानी पीएं।' : 'Drink at least 1 glass of water every hour.'}</span></div>
      <div class="tip"><span class="tip-icon">👕</span><span>${isHindi ? 'हल्के रंग के ढीले कपड़े पहनें।' : 'Wear light-coloured, loose clothing.'}</span></div>
      <div class="tip"><span class="tip-icon">🌀</span><span>${isHindi ? 'कूलर या पंखा चलाएं और खिड़कियां बंद रखें।' : 'Use cooler/fan and keep windows shut.'}</span></div>
      <div class="tip"><span class="tip-icon">⚠️</span><span>${isHindi ? 'लक्षण: चक्कर, बेहोशी, पसीना न आना → तुरंत डॉक्टर।' : 'Signs: dizziness, fainting, no sweating → Doctor immediately.'}</span></div>
    </div>

    <div class="tips">
      <h3>📊 ${isHindi ? 'पूर्वानुमान' : 'Forecast'}</h3>
      <div class="tip"><span class="tip-icon">📅</span>
        <span>${isHindi
      ? `${cityNameHindi || cityName} में अगले ${dangerDays} दिन ${temperature}°C से अधिक तापमान रहने की संभावना।`
      : `${cityName}: temperatures above ${temperature}°C expected for the next ${dangerDays} days.`}</span>
      </div>
      <div class="tip"><span class="tip-icon">🛰️</span>
        <span>${isHindi
      ? 'यह चेतावनी Yale SUHI + ERA5 डेटा पर आधारित ML मॉडल से आई है।'
      : 'Alert generated by ML model using Yale SUHI + ERA5 satellite data.'}</span>
      </div>
    </div>
  </div>
  <div class="footer">
    <p>© 2025 ThermalBharat &nbsp;|&nbsp; <a href="#">Unsubscribe</a></p>
    <p style="margin:4px 0 0;color:#333">This is an automated heatwave alert. Do not reply.</p>
  </div>
</div></body></html>`
}

function testEmailHTML() {
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<style>
  body{margin:0;padding:0;background:#0f1117;font-family:Arial,sans-serif}
  .wrap{max-width:480px;margin:40px auto;background:#1a1d2e;border-radius:16px;padding:32px;text-align:center;color:#c7ccda}
  h1{color:#00cc88;font-size:28px;margin:0 0 8px}
  p{color:#aaa;font-size:14px;line-height:1.6}
  .badge{background:#00cc8820;border:1px solid #00cc88;border-radius:8px;padding:12px;margin:16px 0;font-size:13px;color:#00cc88}
</style></head>
<body><div class="wrap">
  <div style="font-size:48px">✅</div>
  <h1>Alert Setup Done!</h1>
  <p class="hindi-text" style="font-size:16px;color:#c7ccda">ThermalBharat अलर्ट सक्रिय हो गया!</p>
  <div class="badge">
    अब जब भी आपके शहर में हीटवेव आएगी,<br>
    आपको automatically email मिलेगी।
  </div>
  <p style="color:#555;font-size:12px">Powered by ThermalBharat — India Urban Heat Island Mapper</p>
</div></body></html>`
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Public functions
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function sendHeatwaveEmail(toEmail, toName, cityName, cityNameHindi, temperature, dangerDays, language = 'hindi') {
  const isHindi = language !== 'english'
  const subject = isHindi
    ? `⚠️ हीटवेव चेतावनी — ${cityNameHindi || cityName} — ${dangerDays} दिन`
    : `⚠️ Heatwave Warning — ${cityName} — ${dangerDays} days`

  const html = heatwaveEmailHTML({ cityName, cityNameHindi, temperature, dangerDays, language })
  const text = `Heatwave warning for ${cityName}: ${temperature}°C for ${dangerDays} days. Stay indoors 11am-4pm. Emergency: 108. - ThermalBharat`

  try {
    await sendBrevoEmail({ toEmail, toName, subject, htmlContent: html, textContent: text })
    logAlert({ to: toEmail, subject, status: 'sent', preview: text })
    return { success: true }
  } catch (err) {
    logAlert({ to: toEmail, subject, status: 'failed', preview: err.message })
    return { success: false, error: err.message }
  }
}

export async function sendTestEmail(toEmail, toName) {
  const subject = '✅ ThermalBharat Alert Setup Successful!'
  try {
    await sendBrevoEmail({
      toEmail, toName,
      subject,
      htmlContent: testEmailHTML(),
      textContent: 'ThermalBharat alert setup successful! You will receive heatwave alerts automatically.',
    })
    logAlert({ to: toEmail, subject, status: 'sent', preview: 'Test email — alert setup confirmed' })
    return { success: true }
  } catch (err) {
    logAlert({ to: toEmail, subject, status: 'failed', preview: err.message })
    return { success: false, error: err.message }
  }
}

// ── History + Registration helpers ─────────────────────────────
export function getAlertHistory() {
  try { return JSON.parse(localStorage.getItem('alertHistory') || '[]') }
  catch { return [] }
}
export function clearAlertHistory() { localStorage.removeItem('alertHistory') }

export function saveRegistration(reg) {
  const list = getRegistrations()
  const r = { id: Date.now(), registeredAt: new Date().toISOString().slice(0, 10), active: true, ...reg }
  list.push(r)
  localStorage.setItem('alertRegistrations', JSON.stringify(list))
  return r
}
export function getRegistrations() {
  try { return JSON.parse(localStorage.getItem('alertRegistrations') || '[]') }
  catch { return [] }
}
