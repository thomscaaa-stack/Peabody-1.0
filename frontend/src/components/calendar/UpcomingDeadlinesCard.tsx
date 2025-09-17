import React, { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Link } from 'react-router-dom'
import { useCanvasEvents, useTasks } from '@/lib/calendar/hooks'
import { startOfWeek, endOfWeek, isInNextNDays } from '@/lib/calendar/date'
import { normalizeAll } from '@/lib/calendar/normalizeEvents'
import { parseCanvasTitle, friendlyCourseTag } from '@/lib/calendar/parse'

export default function UpcomingDeadlinesCard() {
    const from = new Date()
    const to = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    const { events } = useCanvasEvents(from.toISOString(), to.toISOString())
    const { tasks } = useTasks(from.toISOString(), to.toISOString())
    const items = useMemo(() => normalizeAll({ canvas: events, tasks, sessions: [] }), [events, tasks])

    const upcoming = items.filter(it => {
        const when = it.due_at || it.start
        if (!when) return false
        const d = new Date(when)
        return d >= from && d <= to && it.status !== 'done'
    })

    const triage = useMemo(() => {
        const startOf = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
        const today = startOf(new Date())
        const tomorrow = startOf(new Date(Date.now() + 24 * 60 * 60 * 1000))
        const end = startOf(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))
        const out = { today: [] as typeof upcoming, tomorrow: [] as typeof upcoming, later: [] as typeof upcoming }
        for (const it of upcoming) {
            const when = new Date(it.due_at || it.start!)
            const d0 = startOf(when)
            if (d0.getTime() === today.getTime()) out.today.push(it)
            else if (d0.getTime() === tomorrow.getTime()) out.tomorrow.push(it)
            else if (d0 > tomorrow && d0 <= end) out.later.push(it)
        }
        // sort by time within section
        const sortBy = (arr: typeof upcoming) => arr.sort((a, b) => new Date((a.due_at || a.start)!).getTime() - new Date((b.due_at || b.start)!).getTime())
        sortBy(out.today); sortBy(out.tomorrow); sortBy(out.later)
        // cap to 5 total
        const cap = 5
        const result: Array<{ label: string, items: typeof upcoming }> = []
        let count = 0
        for (const [label, arr] of [['Today', out.today], ['Tomorrow', out.tomorrow], ['Later this week', out.later]] as const) {
            if (count >= cap) break
            const take = arr.slice(0, cap - count)
            if (take.length) result.push({ label, items: take })
            count += take.length
        }
        return result
    }, [upcoming])

    return (
        <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-medium">Upcoming Deadlines</CardTitle>
                <Link to="/calendar" className="text-xs text-blue-600 hover:underline">View Calendar →</Link>
            </CardHeader>
            <CardContent>
                <div className="space-y-2">
                    {triage.length === 0 && (
                        <div className="text-sm text-muted-foreground">Nothing due soon. Nice!</div>
                    )}
                    {triage.map(section => (
                        <div key={section.label} className="space-y-1">
                            <div className="text-xs text-muted-foreground">{section.label}</div>
                            {section.items.map(it => {
                                const { course, title } = parseCanvasTitle(it.title)
                                const tag = friendlyCourseTag(course || it.courseId || it.courseName || undefined)
                                const when = it.due_at || it.start
                                return (
                                    <div key={`${it.source}:${it.id}`} className="flex items-start justify-between rounded-lg px-2 py-1.5 hover:bg-accent">
                                        <div className="min-w-0">
                                            {tag && <Badge variant="secondary" className="mr-2">{tag}</Badge>}
                                            <span className="text-[12px] text-gray-800 line-clamp-1">{title}</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <button
                                                className="text-xs text-gray-600 hover:text-green-700"
                                                onClick={() => {
                                                    try {
                                                        const raw = localStorage.getItem('calendar:completed')
                                                        const set = new Set<string>(raw ? JSON.parse(raw) : [])
                                                        set.add(String(it.id))
                                                        localStorage.setItem('calendar:completed', JSON.stringify(Array.from(set)))
                                                    } catch { }
                                                    // force a refresh of hooks that fetch on focus
                                                    window.dispatchEvent(new Event('focus'))
                                                }}
                                                title="Mark as complete"
                                            >✓</button>
                                            <div className="text-xs text-muted-foreground whitespace-nowrap ml-2">{when ? new Date(when).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' }) : ''}</div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    )
}


