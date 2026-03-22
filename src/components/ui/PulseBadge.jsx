/**
 * PulseBadge — risk badge that pulses based on severity.
 * Props: riskScore (0-10), label, color
 */
export default function PulseBadge({ riskScore, label, color, style = {} }) {
  const pulseClass =
    riskScore >= 8 ? 'badge-extreme' :
    riskScore >= 6 ? 'badge-high' :
    riskScore >= 4 ? 'badge-moderate' : ''

  return (
    <span
      className={pulseClass}
      style={{
        display: 'inline-block',
        background: color || '#ff4444',
        color: '#fff',
        padding: '4px 12px',
        borderRadius: 20,
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: 0.5,
        ...style,
      }}
    >
      {label}
    </span>
  )
}
