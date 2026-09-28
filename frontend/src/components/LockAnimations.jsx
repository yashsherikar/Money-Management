const BRAND = '#226DFF'
const SUCCESS = '#00C9AE'
const SCANNING = '#6366f1'
const IDLE = '#5C6E82'

/** Draw-on checkmark, shown on successful unlock. */
export function Checkmark() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" style={{ overflow: 'visible' }}>
      <path
        d="M6 17l7 7L26 9"
        stroke={SUCCESS}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ strokeDasharray: 36, strokeDashoffset: 0, animation: 'drawCheck 0.45s cubic-bezier(0.22,1,0.36,1) forwards' }}
      />
    </svg>
  )
}

/** Rings that expand outward from the icon on success. */
export function RippleBurst() {
  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center" style={{ borderRadius: 'inherit' }}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="absolute rounded-full border-2"
          style={{ width: 120, height: 120, borderColor: SUCCESS, animation: `rippleBurst 0.9s cubic-bezier(0,0.5,0.5,1) ${i * 0.18}s forwards`, opacity: 0 }}
        />
      ))}
    </div>
  )
}

/** Sweeping scan line shown while a biometric check is in flight. */
export function ScanLine() {
  return (
    <div
      className="absolute left-0 right-0 h-[3px] rounded-full opacity-80 pointer-events-none"
      style={{ background: SCANNING, animation: 'scanLine 0.6s ease-in-out infinite alternate', top: '20%' }}
    />
  )
}

/** Full-screen flash on unlock — a quick flourish, not meant to be looked at directly. */
export function UnlockFlash({ visible }) {
  if (!visible) return null
  return <div className="fixed inset-0 pointer-events-none z-50" style={{ animation: 'unlockFlash 0.7s ease-out forwards' }} />
}

/** Lock icon that morphs open on success, tinted per phase; `variant` swaps the inner
 *  glyph between a fingerprint (biometric) and three dots (PIN). */
export function LockIcon({ variant, phase }) {
  const open = phase === 'success' || phase === 'burst'
  const scanning = phase === 'scanning'
  const color = open ? SUCCESS : scanning ? SCANNING : IDLE

  return (
    <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
      <path
        d={open ? 'M18 24 C18 14 30 10 36 16' : 'M18 24 V18 C18 11.4 22.5 7 28 7 C33.5 7 38 11.4 38 18 V24'}
        stroke={color}
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ transition: 'stroke 0.3s, d 0.45s cubic-bezier(0.34,1.56,0.64,1)' }}
      />
      <rect
        x="12" y="24" width="32" height="24" rx="6"
        fill={open ? 'rgba(0,201,174,0.18)' : scanning ? 'rgba(99,102,241,0.1)' : 'rgba(92,110,130,0.12)'}
        stroke={color}
        strokeWidth="2.5"
        style={{ transition: 'all 0.35s ease' }}
      />
      {variant === 'fingerprint' ? (
        <path
          d="M28 30c-2.2 0-4 1.8-4 4v2m8-6c2.2 0 4 1.8 4 4v2m-8-9v9m-4-6.5c0-2.2 1.8-4 4-4s4 1.8 4 4"
          stroke={color}
          strokeWidth="1.6"
          strokeLinecap="round"
          fill="none"
          style={{ opacity: phase === 'idle' ? 0.55 : 1, transition: 'opacity 0.3s ease, stroke 0.3s ease' }}
        />
      ) : (
        [0, 1, 2].map((i) => (
          <circle
            key={i}
            cx={21 + i * 7} cy={36} r="2.8"
            fill={color}
            style={{
              opacity: open ? 1 : 0.6,
              transition: `all 0.3s ease ${i * 0.07}s`,
              transform: open ? 'scale(1.2)' : 'scale(1)',
              transformOrigin: `${21 + i * 7}px 36px`,
            }}
          />
        ))
      )}
    </svg>
  )
}

/** The circular icon container: background/border/glow/scale all react to phase. */
export function LockIconStage({ variant, phase, onClick }) {
  const scanning = phase === 'scanning'
  const success = phase === 'success' || phase === 'burst'
  return (
    <div
      onClick={onClick}
      className={`relative flex items-center justify-center rounded-[60px] size-[120px] select-none ${onClick ? 'cursor-pointer' : ''}`}
      style={{
        background: success ? 'rgba(0,201,174,0.15)' : scanning ? 'rgba(99,102,241,0.08)' : 'rgba(34,109,255,0.08)',
        border: `2px solid ${success ? '#00C9AE' : scanning ? '#6366f1' : 'rgba(34,109,255,0.25)'}`,
        boxShadow: success
          ? '0 0 0 10px rgba(0,201,174,0.12), 0 0 40px rgba(0,201,174,0.2)'
          : scanning
          ? '0 0 0 6px rgba(99,102,241,0.1)'
          : 'none',
        transform: scanning ? 'scale(1.04)' : success ? 'scale(1.08)' : 'scale(1)',
        transition: 'all 0.4s cubic-bezier(0.34,1.56,0.64,1)',
      }}
    >
      {scanning && <ScanLine />}
      {phase === 'burst' && <RippleBurst />}
      {success ? <Checkmark /> : <LockIcon variant={variant} phase={phase} />}
      {scanning && (
        <div
          className="absolute inset-[-6px] rounded-[66px] pointer-events-none"
          style={{ border: '2px dashed rgba(99,102,241,0.4)', animation: 'spinRing 1.2s linear infinite' }}
        />
      )}
    </div>
  )
}

export const BRAND_COLOR = BRAND
export const SUCCESS_COLOR = SUCCESS
