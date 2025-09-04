import React, { useEffect, useMemo, useRef, useState } from 'react'
import { X, ZoomIn, ZoomOut, Maximize, Minimize } from 'lucide-react'
import { GlobalWorkerOptions, getDocument, PDFDocumentProxy } from 'pdfjs-dist'
import workerSrc from 'pdfjs-dist/build/pdf.worker.mjs?url'
import type { Document as PdfDocument } from '@/lib/types'
import { supabase } from '@/lib/supabase'

// Configure worker (bundler-safe)
GlobalWorkerOptions.workerSrc = workerSrc as unknown as string

interface PDFReaderProps {
    document: PdfDocument
    onClose?: () => void
}

type FitMode = 'fitWidth' | 'actual' | 'fitPage'

export default function PDFReader({ document, onClose }: PDFReaderProps) {
    const containerRef = useRef<HTMLDivElement>(null)
    const [pdfUrl, setPdfUrl] = useState<string | null>(null)
    const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null)
    const [numPages, setNumPages] = useState(0)
    const [scale, setScale] = useState(1.0)
    const [fitMode, setFitMode] = useState<FitMode>('fitWidth')
    const pageCanvasRefs = useRef<Array<HTMLCanvasElement | null>>([])
    const [currentPage, setCurrentPage] = useState(1)

    // Signed URL
    useEffect(() => {
        const getPdfUrl = async () => {
            try {
                const { data, error } = await supabase.storage
                    .from('documents')
                    .createSignedUrl(document.file_path, 3600)
                if (error) throw error
                setPdfUrl(data.signedUrl)
            } catch (e) {
                console.error('PDFReader: signed URL error', e)
            }
        }
        getPdfUrl()
    }, [document.file_path])

    // Load PDF
    useEffect(() => {
        let cancelled = false
        const load = async () => {
            if (!pdfUrl) return
            try {
                const proxy = await getDocument(pdfUrl).promise
                if (cancelled) return
                setPdf(proxy)
                setNumPages(proxy.numPages)
            } catch (e) {
                console.error('PDFReader: load error', e)
            }
        }
        load()
        return () => { cancelled = true }
    }, [pdfUrl])

    // Fit calculations
    const computeFitWidthScale = async () => {
        if (!pdf || !containerRef.current) return
        try {
            const page = await pdf.getPage(1)
            const unscaled = page.getViewport({ scale: 1 })
            const width = containerRef.current.clientWidth - 32
            const next = Math.max(0.5, Math.min(3, width / unscaled.width))
            setScale(next)
        } catch (_) { }
    }
    const computeFitPageScale = async () => {
        if (!pdf || !containerRef.current) return
        try {
            const page = await pdf.getPage(1)
            const unscaled = page.getViewport({ scale: 1 })
            const width = containerRef.current.clientWidth - 32
            const height = containerRef.current.clientHeight - 32
            const next = Math.max(0.5, Math.min(3, Math.min(width / unscaled.width, height / unscaled.height)))
            setScale(next)
        } catch (_) { }
    }

    useEffect(() => {
        if (fitMode === 'fitWidth') computeFitWidthScale()
        if (fitMode === 'fitPage') computeFitPageScale()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fitMode, pdf, containerRef.current?.clientWidth, containerRef.current?.clientHeight])

    // Render a page
    const renderPage = async (index: number) => {
        if (!pdf) return
        const canvas = pageCanvasRefs.current[index]
        if (!canvas) return
        try {
            const page = await pdf.getPage(index + 1)
            const viewport = page.getViewport({ scale })
            const ctx = canvas.getContext('2d')!
            canvas.width = viewport.width
            canvas.height = viewport.height
            await page.render({ canvasContext: ctx, viewport, canvas } as any).promise
        } catch (e) {
            console.error('PDFReader: render error', e)
        }
    }

    // Lazy render on intersection
    useEffect(() => {
        if (!pdf || numPages === 0) return
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                const idx = Number((entry.target as HTMLElement).dataset.index)
                if (entry.isIntersecting) {
                    renderPage(idx)
                }
            })
        }, { root: containerRef.current, threshold: 0.1 })

        pageCanvasRefs.current.forEach((el, i) => {
            if (el) observer.observe(el)
        })
        return () => observer.disconnect()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pdf, numPages, scale])

    // Track current page based on scroll
    useEffect(() => {
        const root = containerRef.current
        if (!root) return
        const handler = () => {
            let closest = 1
            let minDist = Infinity
            pageCanvasRefs.current.forEach((c, i) => {
                if (!c) return
                const rect = c.getBoundingClientRect()
                const rootRect = root.getBoundingClientRect()
                const center = rect.top + rect.height / 2
                const rootCenter = rootRect.top + rootRect.height / 2
                const dist = Math.abs(center - rootCenter)
                if (dist < minDist) { minDist = dist; closest = i + 1 }
            })
            setCurrentPage(closest)
        }
        root.addEventListener('scroll', handler)
        handler()
        return () => root.removeEventListener('scroll', handler)
    }, [])

    // Keyboard shortcuts
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === '+' || e.key === '=') { setFitMode('actual'); setScale((s) => Math.min(3, s + 0.1)) }
            else if (e.key === '-') { setFitMode('actual'); setScale((s) => Math.max(0.5, s - 0.1)) }
            else if (e.key === '0' || e.key.toLowerCase() === 'f') { setFitMode('fitWidth') }
            else if (e.key.toLowerCase() === 'p') { setFitMode('fitPage') }
            else if (e.key === 'PageDown' || e.key === 'ArrowRight') { scrollToPage(currentPage + 1) }
            else if (e.key === 'PageUp' || e.key === 'ArrowLeft') { scrollToPage(currentPage - 1) }
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentPage])

    const scrollToPage = (page: number) => {
        if (!containerRef.current) return
        const clamped = Math.max(1, Math.min(numPages, page))
        const canvas = pageCanvasRefs.current[clamped - 1]
        if (canvas) {
            canvas.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
    }

    const pages = useMemo(() => Array.from({ length: numPages }), [numPages])

    return (
        <div className="relative h-full w-full bg-gray-100 group">
            {/* Minimal header overlay (hidden until hover) */}
            <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 rounded-full bg-white/90 shadow px-3 py-1 border opacity-0 group-hover:opacity-100 transition-opacity">
                <button className="p-1 hover:text-blue-600" onClick={() => { setFitMode('actual'); setScale((s) => Math.max(0.5, s - 0.1)) }} title="Zoom out (−)"><ZoomOut className="w-4 h-4" /></button>
                <div className="text-xs tabular-nums w-16 text-center">{Math.round(scale * 100)}%</div>
                <button className="p-1 hover:text-blue-600" onClick={() => { setFitMode('actual'); setScale((s) => Math.min(3, s + 0.1)) }} title="Zoom in (+)"><ZoomIn className="w-4 h-4" /></button>
                {fitMode === 'fitWidth' ? (
                    <button className="p-1 hover:text-blue-600" onClick={() => setFitMode('actual')} title="Actual size"><Minimize className="w-4 h-4" /></button>
                ) : (
                    <button className="p-1 hover:text-blue-600" onClick={() => setFitMode('fitWidth')} title="Fit width"><Maximize className="w-4 h-4" /></button>
                )}
                <button className="p-1 hover:text-blue-600" onClick={() => setFitMode('fitPage')} title="Fit page">FP</button>
                <div className="mx-2 text-xs text-gray-500">{currentPage} / {numPages || '—'}</div>
                {onClose && (
                    <button className="p-1 hover:text-red-600" onClick={onClose} title="Close"><X className="w-4 h-4" /></button>
                )}
            </div>

            {/* Pages container */}
            <div ref={containerRef} className="h-full w-full overflow-auto px-4 py-8">
                <div className="mx-auto max-w-full" style={{ background: 'transparent' }}>
                    {pages.map((_, i) => (
                        <div key={i} className="flex justify-center mb-6">
                            <canvas
                                ref={(el) => (pageCanvasRefs.current[i] = el)}
                                data-index={i}
                                className="bg-white shadow border rounded"
                            />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}


