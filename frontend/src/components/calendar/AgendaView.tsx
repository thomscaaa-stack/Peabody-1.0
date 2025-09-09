import React, { useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import type { UnifiedItem } from '@/lib/calendar/normalizeEvents'
import { isCompleted, isPast } from '@/lib/calendar/normalizeEvents'
import { parseCanvasTitle, friendlyCourseTag } from '@/lib/calendar/parse'
import { getCourseColor } from '@/lib/calendar/colors'

interface Props { items: UnifiedItem[] }

export default function AgendaView({ items }: Props) {
    const groups = useMemo(() => {
        const map: Record<string, UnifiedItem[]> = {}
        for (const it of items) {
            const when = it.due_at || it.start || it.end
            if (!when) continue
            const d = new Date(when)
            if (isNaN(d.getTime())) continue
            const key = new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString()
            if (!map[key]) map[key] = []
            map[key].push(it)
        }
        return Object.entries(map)
            .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
            .map(([k, arr]) => ({ key: k, date: new Date(k), items: arr.sort((a, b) => new Date((a.start || a.due_at) || 0).getTime() - new Date((b.start || b.due_at) || 0).getTime()) }))
    }, [items])

    const statusChip = (it: UnifiedItem) => {
        const whenIso = it.due_at || it.start || it.end
        const due = whenIso ? new Date(whenIso) : null
        if (!due) return null
        const now = Date.now()
        if (isCompleted(it)) return <Badge variant="secondary">Submitted</Badge>
        if (due.getTime() < now) return <Badge variant="destructive">Overdue</Badge>
        if (due.getTime() - now <= 24 * 60 * 60 * 1000) return <Badge variant="outline">Due soon</Badge>
        return <Badge>Upcoming</Badge>
    }

    return (
        <div className="space-y-4">
            {groups.map(g => (
                <div key={g.key}>
                    <div className="text-sm font-semibold text-muted-foreground sticky top-0 bg-background">{g.date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</div>
                    <div className="space-y-2 mt-2">
                        {g.items.map(it => {
                            const { course, title } = parseCanvasTitle(it.title)
                            const tag = friendlyCourseTag(course || it.courseId || it.courseName || undefined)
                            const color = getCourseColor(course || it.courseId || undefined)
                            const faded = isPast(it) || isCompleted(it)
                            return (
                                <div key={`${it.source}:${it.id}`} className={`rounded-xl border pl-2 pr-2 py-2 ${faded ? 'opacity-60' : ''}`}>
                                    <div className="flex items-center gap-2">
                                        <div className={`w-0.5 self-stretch rounded ${color.border}`} />
                                        {tag && <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium bg-secondary`}>{tag}</span>}
                                        <div className="flex-1 text-sm font-medium line-clamp-2">{title}</div>
                                        <div className="text-xs text-muted-foreground whitespace-nowrap">{(() => { const w = it.due_at || it.start || it.end; return w ? new Date(w).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'All day' })()}</div>
                                        <div>{statusChip(it)}</div>
                                    </div>
                                    {/* Secondary line placeholder */}
                                </div>
                            )
                        })}
                        {g.items.length === 0 && (
                            <div className="text-sm text-muted-foreground">No items for this date. Enjoy the free time.</div>
                        )}
                    </div>
                </div>
            ))}
        </div>
    )
}


