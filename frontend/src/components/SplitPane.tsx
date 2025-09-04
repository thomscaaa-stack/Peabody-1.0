import React from 'react'

interface SplitPaneProps {
    left: React.ReactNode
    right: React.ReactNode
    storageKey?: string
    minLeft?: number
    minRight?: number
}

export default function SplitPane({ left, right, storageKey = 'split_width', minLeft = 280, minRight = 320 }: SplitPaneProps) {
    const containerRef = React.useRef<HTMLDivElement>(null)
    const [leftWidth, setLeftWidth] = React.useState<number>(() => {
        const saved = localStorage.getItem(storageKey)
        return saved ? Number(saved) : 560
    })

    React.useEffect(() => {
        localStorage.setItem(storageKey, String(leftWidth))
    }, [leftWidth, storageKey])

    const onMouseDown = (e: React.MouseEvent) => {
        e.preventDefault()
        const startX = e.clientX
        const startWidth = leftWidth
        const node = containerRef.current
        if (!node) return
        const total = node.clientWidth
        const onMove = (ev: MouseEvent) => {
            const dx = ev.clientX - startX
            let next = startWidth + dx
            next = Math.max(minLeft, Math.min(total - minRight, next))
            setLeftWidth(next)
        }
        const onUp = () => {
            window.removeEventListener('mousemove', onMove)
            window.removeEventListener('mouseup', onUp)
        }
        window.addEventListener('mousemove', onMove)
        window.addEventListener('mouseup', onUp)
    }

    return (
        <div ref={containerRef} className="h-full w-full flex overflow-hidden">
            <div style={{ width: leftWidth }} className="h-full overflow-hidden">
                {left}
            </div>
            <div
                onMouseDown={onMouseDown}
                className="w-1 flex-shrink-0 cursor-col-resize bg-gray-200 hover:bg-gray-300"
                title="Drag to resize"
            />
            <div className="flex-1 min-w-0 h-full overflow-hidden">
                {right}
            </div>
        </div>
    )
}


