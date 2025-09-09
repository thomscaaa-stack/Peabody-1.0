import React from 'react'
import { Button } from '@/components/ui/button'
import { absoluteTooltip, CalendarEvent, formatDateRange, isInNextNDays } from '@/lib/calendar/date'
import { ExternalLink } from 'lucide-react'

interface UpcomingListProps {
    token: string
    events: CalendarEvent[]
    onRefresh: () => void
    onDisconnect: () => void
    loading: boolean
    error: string | null
}

export default function UpcomingList({ token, events, onRefresh, onDisconnect, loading, error }: UpcomingListProps) {
    const filtered = events.filter(e => isInNextNDays(e.start, 14))

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Upcoming (Next 14 Days)</h3>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading}>Refresh</Button>
                    <Button variant="ghost" size="sm" onClick={onDisconnect}>Disconnect</Button>
                </div>
            </div>

            {loading && (
                <div className="space-y-2">
                    <div className="h-4 bg-muted rounded animate-pulse" />
                    <div className="h-4 bg-muted rounded animate-pulse" />
                    <div className="h-4 bg-muted rounded animate-pulse" />
                </div>
            )}

            {error && (
                <div className="text-sm text-red-600">{error}</div>
            )}

            {!loading && !error && filtered.length === 0 && (
                <div className="text-sm text-muted-foreground">No upcoming items.</div>
            )}

            <div className="max-h-64 overflow-auto space-y-2 pr-1">
                {filtered.map(evt => (
                    <div key={evt.id} className="rounded-2xl border p-2 hover:shadow-sm">
                        <div className="flex items-start justify-between gap-2">
                            <div>
                                <div className="text-sm font-medium truncate" title={evt.title}>{evt.title}</div>
                                <div className="text-xs text-muted-foreground" title={absoluteTooltip(evt.start)}>
                                    {formatDateRange(evt.start, evt.end, evt.allDay)}
                                </div>
                                {evt.location && (
                                    <div className="text-xs text-muted-foreground truncate">{evt.location}</div>
                                )}
                            </div>
                            {evt.url && (
                                <a className="text-muted-foreground hover:text-foreground" href={evt.url} target="_blank" rel="noreferrer">
                                    <ExternalLink className="h-4 w-4" />
                                </a>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}


