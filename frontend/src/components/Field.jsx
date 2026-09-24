export default function Field({ label, className = '', children }) {
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <span className="text-[13px] font-bold text-muted">{label}</span>
      {children}
    </div>
  )
}
