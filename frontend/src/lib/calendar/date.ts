export function isInNextNDays(iso: string | null, days: number): boolean {
    if (!iso) return false
    const now = new Date()
    const end = new Date(now.getTime() + days * 24 * 60 * 60 * 1000)
    const d = new Date(iso)
    return d >= now && d <= end
}

export function formatDateRange(startIso: string | null, endIso: string | null, allDay: boolean): string {
    if (!startIso) return 'TBD'
    const start = new Date(startIso)
    const end = endIso ? new Date(endIso) : null
    const dateFmt = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
    const timeFmt = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })
    const dateStr = dateFmt.format(start)
    if (allDay || !end) return `${dateStr} • All day`
    const sameDay = start.toDateString() === end.toDateString()
    const rangeStr = sameDay
        ? `${timeFmt.format(start)}–${timeFmt.format(end)}`
        : `${dateFmt.format(start)} ${timeFmt.format(start)} → ${dateFmt.format(end)} ${timeFmt.format(end)}`
    return `${dateStr} • ${rangeStr}`
}

export function absoluteTooltip(iso: string | null): string {
    if (!iso) return ''
    const d = new Date(iso)
    return d.toLocaleString()
}

export type CalendarEvent = {
    id: string
    title: string
    description: string
    location: string
    start: string | null
    end: string | null
    url: string | null
    allDay: boolean
}


