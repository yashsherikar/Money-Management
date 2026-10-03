export default function StatCard({ label, value, sub, tone = 'default' }) {
  const toneClasses = {
    default: 'text-slate-900',
    good: 'text-emerald-600',
    bad: 'text-red-600',
  }
  const accentClasses = {
    default: 'bg-brand-500',
    good: 'bg-emerald-500',
    bad: 'bg-red-500',
  }
  return (
    <div className="relative bg-white rounded-xl border border-slate-200 p-3 sm:p-4 pl-4 sm:pl-5 overflow-hidden min-w-0 transition-transform duration-200 hover:-translate-y-0.5">
      <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${accentClasses[tone]}`} />
      <div className="text-[0.65rem] sm:text-xs font-semibold text-slate-500 uppercase tracking-[0.12em] truncate">{label}</div>
      <div className={`mt-1.5 stat-value ${toneClasses[tone]}`}>{value}</div>
      {sub && <div className="mt-1 text-[0.7rem] sm:text-xs text-slate-500 leading-snug line-clamp-2">{sub}</div>}
    </div>
  )
}
