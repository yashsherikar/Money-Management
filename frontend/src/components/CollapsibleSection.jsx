export default function CollapsibleSection({ title, addLabel, open, onOpen, children, className = '' }) {
  return (
    <div className={`bg-white rounded-xl p-5 mb-6 ${className}`}>
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">{title}</h2>
        {!open && (
          <button onClick={onOpen} className="text-sm text-brand-600 font-medium">{addLabel}</button>
        )}
      </div>
      <div
        className="grid transition-[grid-template-rows] duration-300 ease-out"
        style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden" aria-hidden={!open}>
          <div className="mt-4">{children}</div>
        </div>
      </div>
    </div>
  )
}
