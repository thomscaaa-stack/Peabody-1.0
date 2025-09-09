import { useEffect, useState } from 'react'
import type { CalendarEvent } from './date'
import { supabase } from '@/lib/supabase'

export function useCanvasEvents(fromIso?: string, toIso?: string) {
    const [events, setEvents] = useState<CalendarEvent[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    useEffect(() => {
        const t = localStorage.getItem('canvasIcsToken')
        if (!t) { setEvents([]); return }
        const load = async () => {
            try {
                setLoading(true)
                setError(null)
                const res = await fetch(`/api/feeds/events?token=${encodeURIComponent(t)}`)
                if (!res.ok) throw new Error('Failed to load events')
                const data = await res.json()
                setEvents(Array.isArray(data?.events) ? data.events : [])
            } catch (e: any) {
                setError(e?.message || 'Failed to load events')
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [fromIso, toIso])
    return { events, loading, error }
}

export function useStudySessions(fromIso?: string, toIso?: string) {
    const [sessions, setSessions] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    useEffect(() => {
        const load = async () => {
            try {
                setLoading(true)
                setError(null)
                const { data: { user } } = await supabase.auth.getUser()
                if (!user) { setSessions([]); return }
                const q = supabase
                    .from('study_sessions')
                    .select('*')
                    .gte('start_at', fromIso || new Date(Date.now() - 7 * 864e5).toISOString())
                    .lte('end_at', toIso || new Date(Date.now() + 30 * 864e5).toISOString())
                    .order('start_at', { ascending: true })
                const { data, error } = await q
                if (error) throw error
                setSessions(data || [])
            } catch (e: any) {
                setError('Failed to load study sessions')
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [fromIso, toIso])
    return { sessions, loading, error }
}

export function useTasks(fromIso?: string, toIso?: string) {
    const [tasks, setTasks] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const load = async () => {
        try {
            setLoading(true)
            setError(null)
            const { data: sessionRes } = await supabase.auth.getSession()
            const accessToken = sessionRes?.session?.access_token
            if (!accessToken) { setTasks([]); return }
            const u = new URL('/api/calendar/tasks', window.location.origin)
            if (fromIso) u.searchParams.set('from', fromIso)
            if (toIso) u.searchParams.set('to', toIso)
            const res = await fetch(u.toString(), { headers: { Authorization: `Bearer ${accessToken}` } })
            if (res.status === 404) { console.warn('tasks endpoint not found'); setTasks([]); return }
            if (!res.ok) throw new Error('Failed to load tasks')
            const data = await res.json()
            setTasks(Array.isArray(data?.tasks) ? data.tasks : [])
        } catch (e: any) {
            setError(e?.message || 'Failed to load tasks')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { load() }, [fromIso, toIso])

    return { tasks, loading, error, refresh: load }
}


