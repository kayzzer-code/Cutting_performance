const dayFormatter = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})

const shortFormatter = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
})

export function isoDate(date = new Date()): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}

export function fromIso(value: string): Date {
  return new Date(`${value}T12:00:00`)
}

export function isIsoDate(value: string | null | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = fromIso(value)
  return !Number.isNaN(date.getTime()) && isoDate(date) === value
}

export function addDays(value: string, amount: number): string {
  const date = fromIso(value)
  date.setDate(date.getDate() + amount)
  return isoDate(date)
}

export function startOfWeek(value: string): string {
  const date = fromIso(value)
  const day = date.getDay() || 7
  date.setDate(date.getDate() - day + 1)
  return isoDate(date)
}

export function weekDates(value: string): string[] {
  const monday = startOfWeek(value)
  return Array.from({ length: 7 }, (_, index) => addDays(monday, index))
}

export function formatLongDate(value: string): string {
  const label = dayFormatter.format(fromIso(value))
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export function formatShortDate(value: string): string {
  return shortFormatter.format(fromIso(value)).replace('.', '')
}

export function formatDayName(value: string): string {
  const label = new Intl.DateTimeFormat('fr-FR', { weekday: 'long' }).format(fromIso(value))
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export function formatCompactDate(value: string): string {
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' })
    .format(fromIso(value))
    .replace('.', '')
}
