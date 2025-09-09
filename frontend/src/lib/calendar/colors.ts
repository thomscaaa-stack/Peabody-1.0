const palette = [
    'blue', 'purple', 'indigo', 'emerald', 'orange', 'rose', 'amber', 'teal', 'cyan', 'pink'
]

function hash(str: string): number {
    let h = 0
    for (let i = 0; i < str.length; i++) h = Math.imul(31, h) + str.charCodeAt(i) | 0
    return Math.abs(h)
}

export function getCourseColor(courseId?: string | null) {
    const key = courseId || 'general'
    const idx = hash(key) % palette.length
    const color = palette[idx]
    return {
        dot: `bg-${color}-500`,
        border: `border-${color}-500`,
        text: `text-${color}-700`,
        pill: `bg-${color}-100 text-${color}-800`
    }
}


