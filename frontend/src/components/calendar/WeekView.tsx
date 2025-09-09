import React, { useMemo } from 'react'
import type { UnifiedItem } from '@/lib/calendar/normalizeEvents'
import { startOfWeek, endOfWeek } from '@/lib/calendar/date'
import { isCompleted, isPast } from '@/lib/calendar/normalizeEvents'

interface Props {
    items: UnifiedItem[]
    date?: Date
}

function classForSource(source: UnifiedItem['source']): string {
    if (source === 'session') return 'bg-purple-500 text-white'
    if (source === 'canvas') return 'border border-blue-500 text-blue-700 bg-white'
    return 'border border-gray-400 text-gray-700 bg-white'
}

export default function WeekView({ items, date = new Date() }: Props) {
    const start = startOfWeek(date)
    const hours = Array.from({ length: 24 }, (_, i) => i)
    const days = Array.from({ length: 7 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i))

    const itemsByDay = useMemo(() => {
        const map: Record<string, UnifiedItem[]> = {}
        const key = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
        for (const it of items) {
            const when = it.start || it.due_at
            if (!when) continue
            const d = new Date(when)
            const k = key(d)
            if (!map[k]) map[k] = []
            map[k].push(it)
        }
        return map
    }, [items, start.getTime()])

    return (
        <div className="grid" style={{ gridTemplateColumns: '60px repeat(7, 1fr)' }}>
            <div />
            {days.map(d => (
                <div key={d.toDateString()} className="text-center text-xs text-gray-600 py-1 border-b">{d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</div>
            ))}
            {hours.map(h => (
                <React.Fragment key={h}>
                    <div className="text-xs text-gray-400 border-r pr-1 h-12">{h}:00</div>
                    {days.map(day => {
                        const k = `${day.getFullYear()}-${day.getMonth() + 1}-${day.getDate()}`
                        const dayItems = (itemsByDay[k] || []).filter(it => (it.start && new Date(it.start).getHours() === h) || (!it.start && it.due_at && new Date(it.due_at).getHours() === h))
                        return (
                            <div key={`${k}-${h}`} className="relative h-12 border-b border-l">
                                {dayItems.map(it => {
                                    const faded = isPast(it) || isCompleted(it)
                                    return (
                                        <div key={`${it.source}:${it.id}`} className={`absolute left-1 right-1 top-1 bottom-1 rounded px-1 text-[11px] overflow-hidden ${classForSource(it.source)} ${faded ? 'opacity-60' : ''}`}>
                                            {it.title}
                                        </div>
                                    )
                                })}
                            </div>
                        )
                    })}
                </React.Fragment>
            ))}
        </div>
    )
}


