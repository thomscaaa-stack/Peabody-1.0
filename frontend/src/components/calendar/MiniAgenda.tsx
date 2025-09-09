import React from 'react'
import { Button } from '@/components/ui/button'
import { absoluteTooltip, CalendarEvent, formatDateRange, isInNextNDays } from '@/lib/calendar/date'
import { extractCourse } from '@/lib/calendar/extractCourse'
import { parseCanvasTitle, friendlyCourseTag } from '@/lib/calendar/parse'
import { RefreshCcw, Calendar as CalendarIcon } from 'lucide-react'

type Status = 'connected' | 'refreshing' | 'needs_reconnect'

interface MiniAgendaProps {
    events: CalendarEvent[]
    status: Status
    onRefresh: () => void
    onPlanSession?: (event: CalendarEvent) => void
    onCreateTaskFromEvent?: (event: CalendarEvent) => void
}

function groupByDay(events: CalendarEvent[]) {
    const byKey: Record<string, { startISO: string, label: string, items: CalendarEvent[] }> = {}
    for (const e of events) {
        if (!e.start) continue
        const d = new Date(e.start)
        const yyyy = d.getFullYear()
        const mm = String(d.getMonth() + 1).padStart(2, '0')
        const dd = String(d.getDate()).padStart(2, '0')
        const key = `${yyyy}-${mm}-${dd}`
        if (!byKey[key]) byKey[key] = { startISO: new Date(`${yyyy}-${mm}-${dd}T00:00:00Z`).toISOString(), label: labelForDate(d), items: [] }
        byKey[key].items.push(e)
    }
    const ordered = Object.values(byKey).sort((a, b) => new Date(a.startISO).getTime() - new Date(b.startISO).getTime())
    for (const g of ordered) {
        g.items.sort((a, b) => (a.start ? new Date(a.start).getTime() : 0) - (b.start ? new Date(b.start).getTime() : 0))
    }
    return ordered
}

function labelForDate(d: Date): string {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const dd = new Date(d); dd.setHours(0, 0, 0, 0)
    const diff = (dd.getTime() - today.getTime()) / (24 * 60 * 60 * 1000)
    if (diff === 0) return 'Today'
    if (diff === 1) return 'Tomorrow'
    if (diff <= 7) return 'This Week'
    return dd.toLocaleDateString()
}

function SourceDot({ kind }: { kind: 'canvas' | 'session' | 'task' }) {
    const color = kind === 'canvas' ? 'bg-blue-500' : kind === 'session' ? 'bg-purple-500' : 'bg-gray-400'
    return <span className={`inline-block h-2 w-2 rounded-full ${color}`} />
}

export default function MiniAgenda({ events, status, onRefresh, onPlanSession, onCreateTaskFromEvent }: MiniAgendaProps) {
    // Filter to only future (including rest of today) next 7 days, then triage into Today/Tomorrow/Later
    const next7 = events.filter(e => isInNextNDays(e.start, 7))
    const startOf = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
    const today = startOf(new Date())
    const tomorrow = startOf(new Date(Date.now() + 24 * 60 * 60 * 1000))
    const endOfWeek = startOf(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))
    const triage = { today: [] as CalendarEvent[], tomorrow: [] as CalendarEvent[], later: [] as CalendarEvent[] }
    for (const e of next7) {
        if (!e.start) continue
        const dd = startOf(new Date(e.start))
        if (dd.getTime() === today.getTime()) triage.today.push(e)
        else if (dd.getTime() === tomorrow.getTime()) triage.tomorrow.push(e)
        else if (dd > tomorrow && dd <= endOfWeek) triage.later.push(e)
    }
    const statusLabel = status === 'connected' ? 'Connected' : status === 'refreshing' ? 'Refreshing' : 'Needs reconnect'

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold">This week</h3>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${status === 'connected' ? 'bg-green-100 text-green-800' : status === 'refreshing' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>{statusLabel}</span>
                </div>
                <Button variant="ghost" size="icon" onClick={onRefresh} aria-label="Refresh">
                    <RefreshCcw className="h-4 w-4" />
                </Button>
            </div>

            {triage.today.length === 0 && triage.tomorrow.length === 0 && triage.later.length === 0 && (
                <div className="rounded-2xl border p-3 text-sm flex items-center justify-between">
                    <span className="text-muted-foreground">No upcoming items.</span>
                    <Button variant="outline" size="sm"><CalendarIcon className="h-4 w-4 mr-1" /> Plan a study session</Button>
                </div>
            )}

            <div className="space-y-2 max-h-64 overflow-auto pr-1">
                {(() => {
                    const renderSection = (label: string, arr: CalendarEvent[]) => (
                        <div className="space-y-1" key={label}>
                            <div className="text-xs text-muted-foreground mt-1">{label}</div>
                            {arr.map(evt => {
                                const parsed = parseCanvasTitle(evt.title)
                                const tag = friendlyCourseTag(parsed.course)
                                const right = evt.allDay ? 'All day' : (evt.start ? new Date(evt.start).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' }) : '')
                                return (
                                    <div key={`canvas:${evt.id || (evt.start || '') + ':' + evt.title}`} className="rounded-lg px-2 py-1.5 hover:bg-accent">
                                        <div className="text-[11px] font-medium inline-block rounded-full px-2 py-0.5 bg-secondary mr-2">{tag || 'General'}</div>
                                        <span className="text-[12px] text-gray-800 line-clamp-1">{parsed.title}</span>
                                        <span className="float-right text-[11px] text-gray-500">{right}</span>
                                    </div>
                                )
                            })}
                        </div>
                    )
                    const sections: JSX.Element[] = []
                    const cap = 6
                    let count = 0
                    const pushWithCap = (label: string, arr: CalendarEvent[]) => {
                        if (!arr.length || count >= cap) return
                        const remaining = cap - count
                        const slice = arr.sort((a, b) => new Date(a.start || 0).getTime() - new Date(b.start || 0).getTime()).slice(0, remaining)
                        sections.push(renderSection(label, slice))
                        count += slice.length
                    }
                    pushWithCap('Today', triage.today)
                    pushWithCap('Tomorrow', triage.tomorrow)
                    pushWithCap('Later this week', triage.later)
                    return <>{sections}</>
                })()}
                <div className="text-[11px] text-blue-600 hover:underline cursor-pointer">View all →</div>
            </div>
        </div>
    )
}


