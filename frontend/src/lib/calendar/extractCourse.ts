export function extractCourse(title: string): { courseId?: string, courseName?: string } {
    if (!title) return { courseName: 'General' }
    // Match patterns like [FA25-BL-SPEA-V370-8424] Course Name ...
    const bracket = title.match(/\[([^\]]+)\]/)
    const courseId = bracket?.[1]
    let courseName: string | undefined
    // After bracket, try to capture a course name segment before a dash
    const after = title.replace(/\[[^\]]+\]\s*/, '')
    if (after) {
        const seg = after.split(' - ')[0].trim()
        if (seg) courseName = seg
    }
    return { courseId, courseName: courseName || courseId || 'General' }
}


