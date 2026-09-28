import { useEffect, useState } from 'react'

const BACKSPACE = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 4H8l-7 8 7 8h13a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1z" />
    <line x1="18" y1="9" x2="12" y2="15" /><line x1="12" y1="9" x2="18" y2="15" />
  </svg>
)

export default function PinPad({ title, subtitle, length = 4, onComplete, error, onErrorShown }) {
  const [digits, setDigits] = useState([])

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
    if (digits.length < length) setDigits((v) => [...v, d])
  }

  return (
    <div className="flex flex-col items-center gap-8">
      <div className="text-center">
        <h2 className="text-lg font-bold">{title}</h2>
        {subtitle && <p className="text-sm text-muted mt-1">{subtitle}</p>}
      </div>
      <div className={`flex gap-4 ${error ? 'animate-shake' : ''}`}>
        {Array.from({ length }).map((_, i) => (
          <span
            key={i}
            className={`w-4 h-4 rounded-full border-2 transition-all duration-150 ${
              i < digits.length ? 'bg-brand-500 border-brand-500 scale-110' : 'border-brand-500 bg-transparent'
            }`}
          />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-4 w-full max-w-xs">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => press(d)}
            className="h-16 rounded-full bg-field text-xl font-semibold text-slate-900"
          >
            {d}
          </button>
        ))}
        <div />
        <button type="button" onClick={() => press('0')} className="h-16 rounded-full bg-field text-xl font-semibold text-slate-900">0</button>
        <button
          type="button"
          onClick={() => setDigits((v) => v.slice(0, -1))}
          className="h-16 rounded-full flex items-center justify-center text-muted"
          aria-label="Backspace"
        >
          {BACKSPACE}
        </button>
      </div>
    </div>
  )
}
