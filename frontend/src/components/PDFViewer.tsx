import React, { useState, useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight, Search, X, Loader2 } from 'lucide-react'
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist'
import workerSrc from 'pdfjs-dist/build/pdf.worker.mjs?url'
import { supabase } from '@/lib/supabase'
import { highlightSearchTerms, extractPageText } from '@/lib/pdf'
import type { Document, DocumentPage } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'

// Configure PDF.js worker (Vite bundler-safe)
GlobalWorkerOptions.workerSrc = workerSrc as unknown as string

interface PDFViewerProps {
    document: Document
    onClose?: () => void
}

export default function PDFViewer({ document, onClose }: PDFViewerProps) {
    const [currentPage, setCurrentPage] = useState(1)
    const [totalPages, setTotalPages] = useState(0)
    const [pages, setPages] = useState<DocumentPage[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [searchResults, setSearchResults] = useState<number[]>([])
    const [currentSearchIndex, setCurrentSearchIndex] = useState(0)
    const [pdfUrl, setPdfUrl] = useState<string | null>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)

    // Fetch document pages
    useEffect(() => {
        const fetchPages = async () => {
            try {
                const { data, error } = await supabase
                    .from('document_pages')
                    .select('*')
                    .eq('document_id', document.id)
                    .order('page_number')

                if (error) throw error

                setPages(data || [])
                setTotalPages(data?.length || 0)
            } catch (err) {
                console.error('Error fetching pages:', err)
            } finally {
                setLoading(false)
            }
        }

        fetchPages()
    }, [document.id])

    // Get signed URL for PDF
    useEffect(() => {
        const getPdfUrl = async () => {
            try {
                const { data, error } = await supabase.storage
                    .from('documents')
                    .createSignedUrl(document.file_path, 3600) // 1 hour

                if (error) throw error
                setPdfUrl(data.signedUrl)
            } catch (err) {
                console.error('Error getting PDF URL:', err)
            }
        }

        getPdfUrl()
    }, [document.file_path])

    // Render current page
    useEffect(() => {
        if (!pdfUrl || !canvasRef.current) return

        const renderPage = async () => {
            try {
                const pdf = await getDocument(pdfUrl).promise
                const page = await pdf.getPage(currentPage)

                const canvas = canvasRef.current!
                const context = canvas.getContext('2d')!

                const viewport = page.getViewport({ scale: 1.5 })
                canvas.height = viewport.height
                canvas.width = viewport.width

                const renderContext: any = {
                    canvas,
                    canvasContext: context,
                    viewport
                }

                await page.render(renderContext).promise
            } catch (err) {
                console.error('Error rendering page:', err)
            }
        }

        renderPage()
    }, [pdfUrl, currentPage])

    // Search functionality
    const handleSearch = () => {
        if (!searchTerm.trim()) {
            setSearchResults([])
            setCurrentSearchIndex(0)
            return
        }

        const results: number[] = []
        pages.forEach((page, index) => {
            if (page.text.toLowerCase().includes(searchTerm.toLowerCase())) {
                results.push(page.page_number)
            }
        })

        setSearchResults(results)
        setCurrentSearchIndex(0)

        if (results.length > 0) {
            setCurrentPage(results[0])
        }
    }

    const nextSearchResult = () => {
        if (searchResults.length === 0) return

        const nextIndex = (currentSearchIndex + 1) % searchResults.length
        setCurrentSearchIndex(nextIndex)
        setCurrentPage(searchResults[nextIndex])
    }

    const prevSearchResult = () => {
        if (searchResults.length === 0) return

        const prevIndex = currentSearchIndex === 0
            ? searchResults.length - 1
            : currentSearchIndex - 1
        setCurrentSearchIndex(prevIndex)
        setCurrentPage(searchResults[prevIndex])
    }

    const clearSearch = () => {
        setSearchTerm('')
        setSearchResults([])
        setCurrentSearchIndex(0)
    }

    const goToPage = (page: number) => {
        if (page >= 1 && page <= totalPages) {
            setCurrentPage(page)
        }
    }

    const currentPageData = pages.find(p => p.page_number === currentPage)

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        )
    }

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b bg-white">
                <div className="flex items-center space-x-4">
                    <h2 className="text-lg font-semibold">{document.title}</h2>
                    <span className="text-sm text-gray-500">
                        Page {currentPage} of {totalPages}
                    </span>
                </div>

                <Button variant="ghost" size="sm" onClick={onClose}>
                    <X className="w-4 h-4" />
                </Button>
            </div>

            {/* Search Bar */}
            <div className="p-4 border-b bg-gray-50">
                <div className="flex items-center space-x-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <Input
                            placeholder="Search in document..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            className="pl-10"
                        />
                    </div>

                    <Button onClick={handleSearch} size="sm">
                        Search
                    </Button>

                    {searchResults.length > 0 && (
                        <div className="flex items-center space-x-2 text-sm text-gray-600">
                            <span>{currentSearchIndex + 1} of {searchResults.length}</span>
                            <Button variant="ghost" size="sm" onClick={prevSearchResult}>
                                <ChevronLeft className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={nextSearchResult}>
                                <ChevronRight className="w-4 h-4" />
                            </Button>
                        </div>
                    )}

                    {searchTerm && (
                        <Button variant="ghost" size="sm" onClick={clearSearch}>
                            <X className="w-4 h-4" />
                        </Button>
                    )}
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden">
                {/* PDF Viewer */}
                <div className="flex-1 flex flex-col">
                    {/* Page Navigation */}
                    <div className="flex items-center justify-center space-x-2 p-2 bg-white border-b">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => goToPage(currentPage - 1)}
                            disabled={currentPage <= 1}
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </Button>

                        <Input
                            type="number"
                            value={currentPage}
                            onChange={(e) => goToPage(parseInt(e.target.value) || 1)}
                            className="w-16 text-center"
                            min={1}
                            max={totalPages}
                        />

                        <span className="text-sm text-gray-500">of {totalPages}</span>

                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => goToPage(currentPage + 1)}
                            disabled={currentPage >= totalPages}
                        >
                            <ChevronRight className="w-4 h-4" />
                        </Button>
                    </div>

                    {/* PDF Canvas */}
                    <div className="flex-1 overflow-auto bg-gray-100 p-4">
                        <div className="flex justify-center">
                            <canvas
                                ref={canvasRef}
                                className="shadow-lg border border-gray-200"
                            />
                        </div>
                    </div>
                </div>

                {/* Text Panel */}
                <div className="w-80 border-l bg-white overflow-hidden">
                    <div className="p-4 border-b">
                        <h3 className="font-semibold">Page Text</h3>
                    </div>

                    <div className="p-4 overflow-y-auto h-full">
                        {currentPageData ? (
                            <div
                                className="text-sm leading-relaxed"
                                dangerouslySetInnerHTML={{
                                    __html: searchTerm
                                        ? highlightSearchTerms(currentPageData.text, searchTerm)
                                        : extractPageText(currentPageData.text, 2000)
                                }}
                            />
                        ) : (
                            <p className="text-gray-500">No text available for this page.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
