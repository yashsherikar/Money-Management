export default function StatCard({ label, value, sub, tone = 'default' }) {
  const toneClasses = {
    default: 'text-slate-900',
    good: 'text-emerald-600',
    bad: 'text-red-600',
  }
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
      <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${toneClasses[tone]}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
    </div>
  )
}
