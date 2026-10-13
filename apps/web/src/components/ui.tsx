import type { ApplicationStatus } from '@jobpilot/shared'
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'quiet' | 'danger' }) {
  const styles = {
    primary: 'bg-pine text-white hover:bg-[#0f4a2d]',
    quiet: 'bg-transparent text-ink ring-1 ring-line hover:bg-moss dark:text-[#E6EFEA] dark:ring-[#2C3B34]',
    danger: 'bg-clay text-white',
  }[variant]
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60 ${styles} ${className}`}
      {...props}
    />
  )
}

export function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: ReactNode
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-muted dark:text-[#B7C9C0]">{label}</span>
      {children}
      {error ? <span className="mt-1 block text-clay">{error}</span> : null}
    </label>
  )
}

const control = 'w-full border border-line bg-white px-3 py-2 text-ink outline-none dark:border-[#2C3B34] dark:bg-night dark:text-[#E6EFEA]'

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={control} {...props} />
}

export function TextArea({ className = '', ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${control} min-h-28 font-serif ${className}`} {...props} />
}

export function SelectInput(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={control} {...props} />
}

export function Modal({
  title,
  open,
  onClose,
  children,
}: {
  title: string
  open: boolean
  onClose: () => void
  children: ReactNode
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/40 p-4 sm:items-center" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        className="max-h-[90vh] w-full max-w-lg overflow-auto bg-paper p-5 shadow-slip dark:bg-panel"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 id="dialog-title" className="text-xl">
            {title}
          </h2>
          <button type="button" className="text-sm text-muted" onClick={onClose}>
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function EmptyState({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="border border-dashed border-line px-4 py-8 text-center dark:border-[#2C3B34]">
      <p>{title}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  )
}

export function Spinner({ label }: { label: string }) {
  return (
    <p className="px-4 py-10 text-sm text-muted" role="status">
      {label}
    </p>
  )
}

export const STATUS_STRIPE: Record<ApplicationStatus, string> = {
  WISHLIST: 'bg-mist',
  APPLIED: 'bg-sea',
  INTERVIEW: 'bg-pine',
  OFFER: 'bg-amber',
  REJECTED: 'bg-clay',
}
