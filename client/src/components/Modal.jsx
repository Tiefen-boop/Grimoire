export default function Modal({ open, title, children, onConfirm, onCancel, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = false }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/60" onClick={onCancel} />
      <div className="relative bg-stone-900 border border-stone-700 rounded-xl p-6 max-w-sm w-full shadow-xl">
        <h3 className="text-lg font-bold text-stone-100 mb-3">{title}</h3>
        {children && <div className="text-stone-300 text-sm mb-5">{children}</div>}
        <div className="flex gap-2 justify-end">
          {onCancel && <button type="button" onClick={onCancel} className="btn btn-secondary">{cancelLabel}</button>}
          {onConfirm && (
            <button type="button" onClick={onConfirm} className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}>
              {confirmLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
