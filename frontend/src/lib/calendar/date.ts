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

export type StudySession = {
    id: string
    title: string
    start_at: string
    end_at: string
    document_id?: string | null
}

export type TaskItem = {
    id: string
    title: string
    due_at: string | null
    status?: 'open' | 'done'
    document_id?: string | null
}

export function startOfDay(d: Date): Date {
    const x = new Date(d); x.setHours(0, 0, 0, 0); return x
}

export function endOfDay(d: Date): Date {
    const x = new Date(d); x.setHours(23, 59, 59, 999); return x
}

export function startOfWeek(d: Date): Date {
    const x = startOfDay(d)
    const day = x.getDay()
    const diff = (day + 6) % 7
    x.setDate(x.getDate() - diff)
    return x
}

export function endOfWeek(d: Date): Date {
    const x = startOfWeek(d)
    x.setDate(x.getDate() + 6)
    x.setHours(23, 59, 59, 999)
    return x
}

export function findStudyBlockStart(dueIso: string | null, minutes: number): { start: string, end: string } | null {
    if (!dueIso) return null
    const due = new Date(dueIso)
    const end = new Date(due.getTime() - 15 * 60 * 1000)
    const start = new Date(end.getTime() - minutes * 60 * 1000)
    if (start < new Date()) {
        const now = new Date()
        const newEnd = new Date(now.getTime() + minutes * 60 * 1000)
        return { start: now.toISOString(), end: newEnd.toISOString() }
    }
    return { start: start.toISOString(), end: end.toISOString() }
}


