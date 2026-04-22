'use client'

export function TemSerialPrintButton({
  label = 'In tem',
  disabled = false,
  variant = 'primary',
}: {
  label?: string
  disabled?: boolean
  variant?: 'primary' | 'plain'
}) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      disabled={disabled}
      className={
        variant === 'plain'
          ? 'text-sm font-semibold text-[var(--color-text)] disabled:cursor-not-allowed disabled:opacity-50'
          : 'app-primary rounded-xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50'
      }
    >
      {label}
    </button>
  )
}
