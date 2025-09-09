import type { CalendarEvent, TaskItem, StudySession } from './date'
import { extractCourse } from './extractCourse'

export type UnifiedItem = {
    id: string
    source: 'canvas' | 'session' | 'task'
    title: string
    courseId?: string
    courseName?: string
    start?: string | null
    end?: string | null
    due_at?: string | null
    status?: 'todo' | 'in_progress' | 'done' | 'archived'
}

export function normalizeAll(args: { canvas: CalendarEvent[]; tasks: TaskItem[]; sessions: StudySession[] }): UnifiedItem[] {
    const out: UnifiedItem[] = []
    for (const e of args.canvas || []) {
        const { courseId, courseName } = extractCourse(e.title)
        out.push({ id: e.id, source: 'canvas', title: e.title, courseId, courseName, start: e.start, end: e.end })
    }
    for (const t of args.tasks || []) {
        out.push({ id: String(t.id), source: 'task', title: t.title, due_at: t.due_at, status: (t.status as any) || 'todo', courseName: 'General' })
    }
    for (const s of args.sessions || []) {
        out.push({ id: String(s.id), source: 'session', title: s.title, start: s.start_at, end: s.end_at, courseName: 'General' })
    }
    return out
}

export function isPast(item: UnifiedItem, now: Date = new Date()): boolean {
    const ref = item.end || item.due_at || item.start
    if (!ref) return false
    return new Date(ref) < new Date(now.setHours(0, 0, 0, 0))
}

export function isCompleted(item: UnifiedItem): boolean {
    return item.status === 'done'
}

export function startOfToday(): Date {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d
}


