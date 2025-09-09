export function parseCanvasTitle(raw: string) {
    const bracket = /\s*\[[^\]]+\]\s*/g
    const cleaned = (raw || '').replace(bracket, '').trim()
    const courseMatch = cleaned.match(/\b[A-Z]{2,4}-[A-Z]?\d{3}\b/)
    const course = courseMatch?.[0] ?? null
    const title = course ? cleaned.replace(course, '').replace(/^[:\-–]\s*/, '').trim() : cleaned
    return { course, title }
}

export function friendlyCourseTag(courseId?: string | null) {
    if (!courseId) return null
    const m = courseId.match(/\b([A-Z]{2,4}-[A-Z]?\d{3})\b/)
    return m ? m[1] : courseId
}

export function isDueSoon(due: Date) {
    const ms = due.getTime() - Date.now()
    return ms > 0 && ms <= 24 * 60 * 60 * 1000
}


