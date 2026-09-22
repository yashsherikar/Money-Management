function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

export default function DayOfMonthSelect({ value, onChange, className }) {
  return (
    <select required value={value} onChange={onChange} className={className}>
      {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
        <option key={day} value={day}>{ordinal(day)}</option>
      ))}
    </select>
  )
}
