import React, { useMemo } from 'react'
import type { UnifiedItem } from '@/lib/calendar/normalizeEvents'
import { isCompleted, isPast, startOfToday } from '@/lib/calendar/normalizeEvents'

interface Props {
    items: UnifiedItem[]
    date?: Date
}

function classForSource(source: UnifiedItem['source']): string {
    if (source === 'session') return 'bg-purple-500 text-white'
    if (source === 'canvas') return 'border border-blue-500 text-blue-700'
    return 'border border-gray-400 text-gray-700'
}

export default function MonthView({ items, date = new Date() }: Props) {
    const today = startOfToday()
    const firstOfMonth = new Date(date.getFullYear(), date.getMonth(), 1)
    const start = new Date(firstOfMonth)
    start.setDate(firstOfMonth.getDate() - ((firstOfMonth.getDay() + 6) % 7)) // Monday as first column
    const cells = useMemo(() => {
        const days: Date[] = []
        for (let i = 0; i < 42; i++) {
            const d = new Date(start)
            d.setDate(start.getDate() + i)
            days.push(d)
        }
        return days
    }, [start.getTime()])

    const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

    const itemsByDay = useMemo(() => {
        const map: Record<string, UnifiedItem[]> = {}
        for (const it of items) {
            const when = it.start || it.due_at
            if (!when) continue
            const d = new Date(when)
            const key = dayKey(d)
            if (!map[key]) map[key] = []
            map[key].push(it)
        }
        for (const k in map) map[k].sort((a, b) => new Date((a.start || a.due_at) || 0).getTime() - new Date((b.start || b.due_at) || 0).getTime())
        return map
    }, [items])

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full border border-blue-500" /> Canvas</div>
                <div className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-purple-500" /> Study Session</div>
                <div className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full border border-gray-400" /> Task</div>
            </div>
            <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
                {cells.map((d) => {
                    const key = dayKey(d)
                    const isOtherMonth = d.getMonth() !== date.getMonth()
                    const dayItems = itemsByDay[key] || []
                    return (
                        <div key={key} className={`min-h-[110px] bg-white p-1 ${isOtherMonth ? 'opacity-60' : ''}`}>
                            <div className="text-[11px] text-gray-500 mb-1">{d.getDate()}</div>
                            <div className="space-y-1">
                                {dayItems.map(it => {
                                    const faded = isPast(it) || isCompleted(it)
                                    return (
                                        <div key={`${it.source}:${it.id}`} className={`text-[11px] rounded px-1 py-0.5 truncate ${classForSource(it.source)} ${faded ? 'opacity-60' : ''}`}>
                                            {it.title}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}


