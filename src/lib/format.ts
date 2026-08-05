import type { Lang } from './i18n'

/**
 * Every number, currency and date in the app is formatted here.
 * Western digits are kept in Arabic (`ar-SA-u-nu-latn`) so amounts stay scannable
 * next to Latin reference numbers.
 */

const localeFor = (lang: Lang) => (lang === 'ar' ? 'ar-SA-u-nu-latn' : 'en-GB')

export function formatNumber(value: number, lang: Lang, opts: Intl.NumberFormatOptions = {}) {
  return new Intl.NumberFormat(localeFor(lang), opts).format(value)
}

export function formatCurrency(value: number, lang: Lang, compact = false) {
  return new Intl.NumberFormat(localeFor(lang), {
    style: 'currency',
    currency: 'SAR',
    maximumFractionDigits: compact ? 1 : 0,
    notation: compact ? 'compact' : 'standard',
  }).format(value)
}

export function formatPercent(value: number, lang: Lang, digits = 0) {
  return new Intl.NumberFormat(localeFor(lang), {
    style: 'percent',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value / 100)
}

export function formatDate(iso: string, lang: Lang, opts?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(localeFor(lang), {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...opts,
  }).format(new Date(iso))
}

/**
 * Formats exactly the parts you ask for, with no default day/month/year merged
 * in — use this for chips and axis labels that want a weekday or month alone.
 */
export function formatDatePart(iso: string, lang: Lang, opts: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(localeFor(lang), opts).format(new Date(iso))
}

export function formatDateTime(iso: string, lang: Lang) {
  return formatDate(iso, lang, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatTime(iso: string, lang: Lang) {
  return new Intl.DateTimeFormat(localeFor(lang), {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

/** "3 days ago" / "in 2 days" — used across timelines and due dates. */
export function formatRelative(iso: string, lang: Lang) {
  const diffMs = new Date(iso).getTime() - Date.now()
  const diffDays = Math.round(diffMs / 86_400_000)
  const rtf = new Intl.RelativeTimeFormat(localeFor(lang), { numeric: 'auto' })

  if (Math.abs(diffDays) < 1) {
    const diffHours = Math.round(diffMs / 3_600_000)
    return rtf.format(diffHours, 'hour')
  }
  if (Math.abs(diffDays) < 30) return rtf.format(diffDays, 'day')
  return rtf.format(Math.round(diffDays / 30), 'month')
}

export function daysBetween(iso: string, other = new Date()) {
  return Math.round((other.getTime() - new Date(iso).getTime()) / 86_400_000)
}

/** IBAN shown as `SA·· ···· ···· 4821` — never the full number in a list view. */
export function maskIban(iban: string) {
  return `${iban.slice(0, 2)}•• •••• •••• ${iban.slice(-4)}`
}

export function groupIban(iban: string) {
  return iban.replace(/(.{4})/g, '$1 ').trim()
}

export function initialsOf(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
}
