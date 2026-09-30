import { useEffect, useState } from 'react'

const BACKSPACE = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 4H8l-7 8 7 8h13a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1z" />
    <line x1="18" y1="9" x2="12" y2="15" /><line x1="12" y1="9" x2="18" y2="15" />
  </svg>
)

export function PinDots({ length = 4, value, success, error }) {
  return (
    <div className={`flex gap-4 items-center justify-center ${error ? 'animate-shake' : ''}`}>
      {Array.from({ length }).map((_, i) => {
        const filled = i < value
        return (
          <span
            key={i}
            className="rounded-full"
            style={{
              width: 16, height: 16,
              background: filled ? '#226DFF' : 'transparent',
              border: `2px solid ${filled ? '#226DFF' : '#5C6E82'}`,
              transform: success && filled ? 'scale(1.35)' : 'scale(1)',
              boxShadow: success && filled ? '0 0 0 4px rgba(0,201,174,0.2)' : 'none',
              transition: `all 0.25s cubic-bezier(0.34,1.56,0.64,1) ${i * 0.05}s`,
            }}
          />
        )
      })}
    </div>
  )
}

export default function PinPad({ length = 4, onComplete, error, onErrorShown, success }) {
  const [digits, setDigits] = useState([])
  const [tapped, setTapped] = useState(null)

  useEffect(() => {
    if (digits.length === length) {
      onComplete(digits.join(''))
      setDigits([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [digits])

  useEffect(() => {
    if (!error) return undefined
    const t = setTimeout(() => onErrorShown?.(), 420)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error])

  function press(d) {
    setTapped(d)
    setTimeout(() => setTapped(null), 150)
    if (digits.length < length) setDigits((v) => [...v, d])
  }

  return (
    <div className="flex flex-col items-center gap-8 w-full">
      <PinDots length={length} value={digits.length} success={success} error={error} />
      <div className="grid grid-cols-3 gap-4 w-full">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => press(d)}
            className="h-20 rounded-2xl bg-field text-2xl font-semibold text-slate-900"
            style={{
              transform: tapped === d ? 'scale(0.9)' : 'scale(1)',
              background: tapped === d ? 'rgba(34,109,255,0.18)' : undefined,
              boxShadow: tapped === d ? '0 0 0 2px rgba(34,109,255,0.5) inset' : undefined,
              transition: 'transform 0.12s cubic-bezier(0.34,1.56,0.64,1), background 0.12s, box-shadow 0.12s',
            }}
          >
            {d}
          </button>
        ))}
        <div />
        <button
          type="button"
          onClick={() => press('0')}
          className="h-20 rounded-2xl bg-field text-2xl font-semibold text-slate-900"
          style={{
            transform: tapped === '0' ? 'scale(0.9)' : 'scale(1)',
            background: tapped === '0' ? 'rgba(34,109,255,0.18)' : undefined,
            boxShadow: tapped === '0' ? '0 0 0 2px rgba(34,109,255,0.5) inset' : undefined,
            transition: 'transform 0.12s cubic-bezier(0.34,1.56,0.64,1), background 0.12s, box-shadow 0.12s',
          }}
        >
          0
        </button>
        <button
          type="button"
          onClick={() => setDigits((v) => v.slice(0, -1))}
          className="h-20 rounded-2xl flex items-center justify-center text-muted"
          aria-label="Backspace"
        >
          {BACKSPACE}
        </button>
      </div>
    </div>
  )
}
