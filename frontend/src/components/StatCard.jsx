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
    <div className="relative bg-white rounded-xl border border-slate-200 p-4 pl-5 overflow-hidden">
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${accentClasses[tone]}`} />
      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</div>
      <div className={`mt-1.5 text-2xl font-bold tracking-tight ${toneClasses[tone]}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
    </div>
  )
}
