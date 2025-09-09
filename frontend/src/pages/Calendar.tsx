import React, { useEffect, useMemo, useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { absoluteTooltip, CalendarEvent, startOfWeek, endOfWeek } from '@/lib/calendar/date'
import QuickTaskInput from '@/components/calendar/QuickTaskInput'
import { useCanvasEvents, useTasks } from '@/lib/calendar/hooks'
import MonthView from '@/components/calendar/MonthView'
import WeekView from '@/components/calendar/WeekView'
import { normalizeAll, type UnifiedItem } from '@/lib/calendar/normalizeEvents'
import AgendaView from '@/components/calendar/AgendaView'

export default function CalendarPage() {
    const initial = (() => {
        const qp = new URLSearchParams(window.location.search).get('view') as any
        const saved = localStorage.getItem('calendar:lastView') as any
        return (qp && ['month', 'week', 'agenda'].includes(qp)) ? qp : (saved || 'month')
    })()
    const [tab, setTab] = useState<'agenda' | 'week' | 'month'>(initial)
    const weekStart = startOfWeek(new Date()).toISOString()
    const weekEnd = endOfWeek(new Date()).toISOString()
    const { events, loading, error } = useCanvasEvents(weekStart, weekEnd)
    const { tasks, refresh: refreshTasks } = useTasks(weekStart, weekEnd)

    return (
        <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">Calendar</h1>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => window.location.reload()}>Refresh</Button>
                </div>
            </div>

            <Tabs value={tab} onValueChange={(v) => { localStorage.setItem('calendar:lastView', v); setTab(v as any) }}>
                <TabsList>
                    <TabsTrigger value="month">Month</TabsTrigger>
                    <TabsTrigger value="week">Week</TabsTrigger>
                    <TabsTrigger value="agenda">Agenda</TabsTrigger>
                </TabsList>
                <TabsContent value="agenda">
                    {loading && <div className="space-y-2 mt-4"><div className="h-4 bg-muted rounded animate-pulse" /><div className="h-4 bg-muted rounded animate-pulse" /></div>}
                    {error && <div className="text-sm text-red-600 mt-2">{error}</div>}
                    {!loading && !error && (
                        <div className="mt-4 space-y-4">
                            <QuickTaskInput onCreated={refreshTasks} />
                            <AgendaView items={normalizeAll({ canvas: events, tasks: tasks, sessions: [] }) as UnifiedItem[]} />
                        </div>
                    )}
                </TabsContent>
                <TabsContent value="week">
                    <WeekView items={normalizeAll({ canvas: events, tasks: tasks, sessions: [] }) as UnifiedItem[]} />
                </TabsContent>
                <TabsContent value="month">
                    <MonthView items={normalizeAll({ canvas: events, tasks: tasks, sessions: [] }) as UnifiedItem[]} />
                </TabsContent>
            </Tabs>
        </div>
    )
}


