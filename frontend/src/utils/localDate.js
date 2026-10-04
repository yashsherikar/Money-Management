/** Local calendar YYYY-MM-DD (avoids UTC day-shift for IST users). */
export function localDateYmd(ms = Date.now()) {
  const d = ms instanceof Date ? ms : new Date(ms)
  const use = Number.isNaN(d.getTime()) ? new Date() : d
  const y = use.getFullYear()
  const m = String(use.getMonth() + 1).padStart(2, '0')
  const day = String(use.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
