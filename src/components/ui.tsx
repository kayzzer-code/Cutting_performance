import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'
import { Check, Info } from 'lucide-react'

export function Card({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`card ${className}`.trim()} {...props} />
}

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger' }) {
  return <button className={`button button-${variant} ${className}`.trim()} {...props} />
}

export function Field({
  label,
  hint,
  suffix,
  className = '',
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string
  hint?: string
  suffix?: string
}) {
  return (
    <label className={`field ${className}`.trim()}>
      <span className="field-label">{label}</span>
      <span className="input-wrap">
        <input {...props} />
        {suffix && <span className="input-suffix">{suffix}</span>}
      </span>
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  )
}

export function SelectField({
  label,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <select aria-label={label} {...props}>{children}</select>
    </label>
  )
}

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <header className="page-header">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action && <div className="page-header-action">{action}</div>}
    </header>
  )
}

export function KpiCard({
  label,
  value,
  unit,
  detail,
  tone = 'neutral',
  icon,
}: {
  label: string
  value: string | number
  unit?: string
  detail?: string
  tone?: 'neutral' | 'good' | 'blue' | 'warning'
  icon?: ReactNode
}) {
  return (
    <Card className={`kpi-card tone-${tone}`}>
      <div className="kpi-top">
        <span>{label}</span>
        {icon && <span className="kpi-icon">{icon}</span>}
      </div>
      <div className="kpi-value">{value}{unit && <small>{unit}</small>}</div>
      {detail && <div className="kpi-detail">{detail}</div>}
    </Card>
  )
}

export function ProgressBar({ value, max, tone = 'teal' }: { value: number; max: number; tone?: 'teal' | 'blue' | 'orange' }) {
  const percent = Math.min(100, Math.max(0, max ? (value / max) * 100 : 0))
  return (
    <div className={`progress progress-${tone}`} role="progressbar" aria-valuenow={value} aria-valuemax={max}>
      <span style={{ width: `${percent}%` }} />
    </div>
  )
}

export function StatusPill({ children, tone = 'good' }: { children: ReactNode; tone?: 'good' | 'blue' | 'warning' | 'muted' }) {
  return <span className={`status-pill status-${tone}`}>{children}</span>
}

export function InfoBanner({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'success' | 'warning' }) {
  const Icon = tone === 'success' ? Check : Info
  return (
    <div className={`info-banner info-${tone}`}>
      <Icon size={18} />
      <div>{children}</div>
    </div>
  )
}
