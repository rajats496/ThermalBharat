/**
 * AlertPanel.jsx — ThermalBharat Part 6 (Email via Brevo)
 * =========================================================
 * Registration form with email + city + alert prefs.
 * On submit → sends test email via Brevo immediately.
 * Hourly check in App.jsx sends automatic heatwave emails.
 */

import { useRef, useState } from 'react'
import { indianCities } from '../../data/indianCities'
import {
  clearAlertHistory,
  getAlertHistory,
  saveRegistration,
  sendTestEmail,
} from '../../services/emailService'

// ── City autocomplete ───────────────────────────────────────────
function CityAutocomplete({ value, onChange }) {
  const [open,  setOpen]  = useState(false)
  const [query, setQuery] = useState(value || '')
  const ref = useRef(null)

  const suggestions = indianCities
    .filter(c =>
      c.name.toLowerCase().includes(query.toLowerCase()) ||
      c.nameHindi?.includes(query)
    ).slice(0, 8)

  return (
    <div className="alert-autocomplete" ref={ref}>
      <input
        className="alert-input"
        placeholder="City name / शहर"
        value={query}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={e => { setQuery(e.target.value); onChange({ name: e.target.value, nameHindi: '' }); setOpen(true) }}
      />
      {open && suggestions.length > 0 && (
        <ul className="alert-suggestions">
          {suggestions.map(c => (
            <li key={c.name} onMouseDown={() => { setQuery(c.name); onChange(c); setOpen(false) }}>
              <span>{c.name}</span>
              <span className="alert-suggestion-hindi">{c.nameHindi}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ── Alert History ───────────────────────────────────────────────
function AlertHistory() {
  const [history, setHistory] = useState(getAlertHistory)
  const fmt = (iso) => {
    try { return new Date(iso).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }) }
    catch { return iso }
  }
  return (
    <div className="alert-section">
      <div className="alert-section-header">
        <h3>📋 Email History <span className="hindi-text">अलर्ट इतिहास</span></h3>
        {history.length > 0 && (
          <button className="alert-clear-btn" onClick={() => { clearAlertHistory(); setHistory([]) }}>Clear</button>
        )}
      </div>
      {history.length === 0
        ? <p className="alert-empty">No emails sent yet.</p>
        : (
          <ul className="alert-history-list">
            {history.slice(0, 10).map(h => (
              <li key={h.id} className="alert-history-item">
                <div className="ah-top">
                  <span className="ah-channel">✉️ Email</span>
                  <span className="ah-city">{h.city}</span>
                  <span className={`ah-status ${h.status}`}>
                    {h.status === 'sent' ? '✅' : '❌'} {h.status}
                  </span>
                </div>
                <div className="ah-preview">{h.preview}</div>
                <div className="ah-time">{fmt(h.time)}</div>
              </li>
            ))}
          </ul>
        )
      }
    </div>
  )
}

// ── Main AlertPanel ─────────────────────────────────────────────
export default function AlertPanel() {
  const [open, setOpen] = useState(false)

  // Form
  const [name,       setName]       = useState('')
  const [email,      setEmail]      = useState('')
  const [city,       setCity]       = useState({ name: '', nameHindi: '' })
  const [alertTypes, setAlertTypes] = useState({ heatwave: true, daily: false, extreme: false })
  const [language,   setLanguage]   = useState('hindi')

  // UI
  const [submitting, setSubmitting] = useState(false)
  const [step,       setStep]       = useState('form') // 'form' | 'success'
  const [error,      setError]      = useState('')

  const toggleType = k => setAlertTypes(p => ({ ...p, [k]: !p[k] }))
  const validEmail = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!name.trim())        return setError('Please enter your name / नाम डालें')
    if (!validEmail(email))  return setError('Valid email address please')
    if (!city.name)          return setError('Please select a city / शहर चुनें')
    if (!Object.values(alertTypes).some(Boolean))
                             return setError('Select at least one alert type')

    setSubmitting(true)
    saveRegistration({
      name: name.trim(), email,
      city: city.name, cityHindi: city.nameHindi || city.name,
      lat: city.latitude, lon: city.longitude,
      alertTypes: Object.keys(alertTypes).filter(k => alertTypes[k]),
      language,
    })

    const result = await sendTestEmail(email, name.trim())
    if (!result.success) {
      setError(`Email failed: ${result.error}`)
      setSubmitting(false)
      return
    }
    setStep('success')
    setSubmitting(false)
  }

  return (
    <div className="alert-panel">
      <button className="alert-toggle-btn" onClick={() => setOpen(v => !v)}>
        <span>📧 Get Heatwave Alerts</span>
        <span className="hindi-text" style={{ fontSize: 11 }}>ईमेल अलर्ट पाएं</span>
        <span className="alert-chevron">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="alert-panel-body">

          {/* Form */}
          {step === 'form' && (
            <form className="alert-form" onSubmit={handleSubmit}>
              <div className="alert-field">
                <label>Name / नाम</label>
                <input className="alert-input" placeholder="Your name / आपका नाम"
                  value={name} onChange={e => setName(e.target.value)} />
              </div>

              <div className="alert-field">
                <label>Email / ईमेल</label>
                <input className="alert-input" type="email"
                  placeholder="your@email.com"
                  value={email} onChange={e => setEmail(e.target.value)} />
              </div>

              <div className="alert-field">
                <label>City / शहर</label>
                <CityAutocomplete value={city.name} onChange={setCity} />
              </div>

              <div className="alert-field">
                <label>Alert Type / प्रकार</label>
                <div className="alert-checks">
                  <label className="alert-check-label">
                    <input type="checkbox" checked={alertTypes.heatwave} onChange={() => toggleType('heatwave')} />
                    <span>हीटवेव चेतावनी <small>(3+ days &gt;43°C)</small></span>
                  </label>
                  <label className="alert-check-label">
                    <input type="checkbox" checked={alertTypes.daily} onChange={() => toggleType('daily')} />
                    <span>सुबह का पूर्वानुमान <small>(Daily forecast)</small></span>
                  </label>
                  <label className="alert-check-label">
                    <input type="checkbox" checked={alertTypes.extreme} onChange={() => toggleType('extreme')} />
                    <span>अति गर्म चेतावनी <small>(&gt;46°C)</small></span>
                  </label>
                </div>
              </div>

              <div className="alert-field">
                <label>Language / भाषा</label>
                <div className="alert-radios">
                  <label className="alert-check-label">
                    <input type="radio" name="lang" checked={language === 'hindi'} onChange={() => setLanguage('hindi')} />
                    <span>हिन्दी</span>
                  </label>
                  <label className="alert-check-label">
                    <input type="radio" name="lang" checked={language === 'english'} onChange={() => setLanguage('english')} />
                    <span>English</span>
                  </label>
                </div>
              </div>

              {error && <p className="alert-error">⚠️ {error}</p>}

              <button className="alert-submit-btn" type="submit" disabled={submitting}>
                {submitting ? '⏳ Sending test email...' : '📧 Register & Send Test Email'}
                <span className="hindi-text" style={{ display: 'block', fontSize: 11 }}>
                  रजिस्टर करें — टेस्ट ईमेल आएगा
                </span>
              </button>
            </form>
          )}

          {/* Success */}
          {step === 'success' && (
            <div className="alert-success">
              <div className="alert-success-icon">✅</div>
              <h4>Registration Successful!</h4>
              <p className="hindi-text">रजिस्ट्रेशन सफल हो गया!</p>
              <p style={{ fontSize: 12, color: '#aaa', textAlign: 'center' }}>
                Test email sent to <strong style={{ color: '#00cc88' }}>{email}</strong><br />
                Heatwave emails will be automatic from now on.
              </p>
              <button className="alert-test-btn" style={{ marginTop: 10 }}
                onClick={() => { setStep('form') }}>
                Edit Registration
              </button>
            </div>
          )}

          {/* History */}
          <AlertHistory />
        </div>
      )}
    </div>
  )
}
