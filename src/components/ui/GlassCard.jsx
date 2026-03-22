import { motion } from 'framer-motion'

const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.97 },
  show:   { opacity: 1, y: 0,  scale: 1,
    transition: { duration: 0.35, ease: [0.4, 0, 0.2, 1] } },
}

/**
 * GlassCard — animated glassmorphism card.
 * Props:
 *   variant: 'default' | 'red' | 'green'
 *   animate: true (use framer-motion stagger child) | false (just CSS)
 *   className, style, children
 */
export default function GlassCard({ children, variant = 'default', animate = true, className = '', style = {}, ...rest }) {
  const accentClass = variant === 'red' ? 'glass-card-red' : variant === 'green' ? 'glass-card-green' : ''

  if (animate) {
    return (
      <motion.div
        className={`glass-card ${accentClass} ${className}`}
        style={style}
        variants={cardVariants}
        {...rest}
      >
        {children}
      </motion.div>
    )
  }

  return (
    <div className={`glass-card ${accentClass} ${className}`} style={style} {...rest}>
      {children}
    </div>
  )
}
