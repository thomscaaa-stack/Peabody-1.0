export function htmlToPlain(html: string | null | undefined): string {
    if (!html) return ''
    if (typeof document === 'undefined') return html.replace(/<[^>]+>/g, ' ').replace(/\u00A0/g, ' ')
    const div = document.createElement('div')
    div.innerHTML = html
    return (div.textContent || div.innerText || '').replace(/\u00A0/g, ' ').trim()
}

export function preview(text: string, n = 120): string {
    const t = text.replace(/\s+/g, ' ').trim()
    return t.length > n ? t.slice(0, n - 1) + '…' : t
}
