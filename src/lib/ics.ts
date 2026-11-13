import type { OrgCalendarItem } from './types'

/** Builds an .ics file so dates can be added to Google, Apple or Samsung calendars. */
export function toIcs(items: OrgCalendarItem[], calendarName = 'PPMK Calendar'): string {
  const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/[,;]/g, (m) => `\\${m}`).replace(/\n/g, '\\n')
  const ymd = (d: string) => d.replace(/-/g, '')
  const nextDay = (d: string) => {
    const t = new Date(`${d}T00:00:00Z`)
    t.setUTCDate(t.getUTCDate() + 1)
    return t.toISOString().slice(0, 10).replace(/-/g, '')
  }
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z')
  const events = items.map((i) =>
    [
      'BEGIN:VEVENT',
      `UID:${i.id}@ppmk-hub`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${ymd(i.start_date)}`,
      `DTEND;VALUE=DATE:${nextDay(i.end_date ?? i.start_date)}`,
      `SUMMARY:${esc(i.title)}`,
      i.location ? `LOCATION:${esc(i.location)}` : '',
      i.description || i.url ? `DESCRIPTION:${esc([i.description, i.url].filter(Boolean).join('\n'))}` : '',
      'END:VEVENT',
    ]
      .filter(Boolean)
      .join('\r\n'),
  )
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//PPMK Community Hub//EN', `X-WR-CALNAME:${calendarName}`, ...events, 'END:VCALENDAR'].join('\r\n')
}

export function downloadIcs(items: OrgCalendarItem[], filename: string) {
  const blob = new Blob([toIcs(items)], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
