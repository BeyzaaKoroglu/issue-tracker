import type { ReactNode } from 'react'

export function Page({ title, lede, children }: { title: string; lede?: string; children?: ReactNode }) {
  return (
    <section>
      <h1 className="font-serif text-4xl tracking-tight">{title}</h1>
      {lede ? <p className="mt-1 max-w-2xl text-sm leading-6 text-stone-500">{lede}</p> : null}
      <div className="mt-6">{children}</div>
    </section>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-line bg-white ${className}`}>{children}</div>
}

export function Button({
  children,
  tone = 'solid',
  ...props
}: { children: ReactNode; tone?: 'solid' | 'ghost' | 'danger' } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const look = {
    solid: 'bg-ink text-white hover:bg-stone-800',
    ghost: 'border border-line bg-white text-ink hover:bg-stone-50',
    danger: 'text-rose-800 hover:bg-rose-50',
  }[tone]
  return (
    <button {...props} className={`rounded-xl px-3 py-2 text-sm font-medium disabled:opacity-50 ${look} ${props.className ?? ''}`}>
      {children}
    </button>
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-stone-500">{label}</span>
      {children}
    </label>
  )
}

const control = 'w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-stone-500'

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${control} ${props.className ?? ''}`} />
}

export function Area(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${control} min-h-24 ${props.className ?? ''}`} />
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={control} />
}

export function Pill({ children, tone = 'stone' }: { children: ReactNode; tone?: string }) {
  const look: Record<string, string> = {
    stone: 'bg-stone-100 text-stone-700',
    amber: 'bg-amber-100 text-amber-900',
    green: 'bg-emerald-100 text-emerald-900',
    rose: 'bg-rose-100 text-rose-900',
    sky: 'bg-sky-100 text-sky-900',
  }
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${look[tone] ?? look.stone}`}>{children}</span>
}

export function Banner({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">{children}</div>
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="px-4 py-8 text-center text-sm text-stone-500">{children}</p>
}
