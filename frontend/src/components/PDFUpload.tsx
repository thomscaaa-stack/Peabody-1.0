import React, { useState, useCallback, useRef } from 'react'
import { Upload, FileText, X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { parsePDF, chunkText, validatePDFFile, formatFileSize } from '@/lib/pdf'
import { batchProcessEmbeddings } from '@/lib/ai'
import type { Document, UploadProgress } from '@/lib/types'
import {
    createDocumentRecord,
    uploadFileToStorage,
    updateDocumentStatus,
    finalizeDocument
} from '@/lib/document-utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useToast } from '@/components/ui/use-toast'

interface PDFUploadProps {
    onUploadComplete?: (document: Document) => void
    onProgress?: (progress: UploadProgress) => void
}

export default function PDFUpload({ onUploadComplete, onProgress }: PDFUploadProps) {
    const [isDragOver, setIsDragOver] = useState(false)
    const [isUploading, setIsUploading] = useState(false)
    const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null)
    const [error, setError] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const { toast } = useToast()

    const updateProgress = useCallback((stage: UploadProgress['stage'], progress: number, message: string) => {
        const progressData: UploadProgress = { stage, progress, message }
        setUploadProgress(progressData)
        onProgress?.(progressData)
    }, [onProgress])

    const handleFileSelect = useCallback(async (file: File) => {
        setError(null)

        // Validate file
        const validation = validatePDFFile(file)
        if (!validation.valid) {
            setError(validation.error!)
            toast({
                title: "Invalid file",
                description: validation.error,
                variant: "destructive"
            })
            return
        }

        setIsUploading(true)
        updateProgress('upload', 0, 'Starting upload...')

        try {
            // Validate file has required properties
            if (!file.name || !file.size || !file.type) {
                throw new Error('Invalid file: missing required properties (name, size, or type)')
            }

            // Get current user
            const { data: { user }, error: userError } = await supabase.auth.getUser()
            if (userError || !user) {
                throw new Error('User not authenticated')
            }

            // Phase A: Create document record with correct schema
            updateProgress('upload', 10, 'Creating document record...')
            const { doc: document, filePath, docId } = await createDocumentRecord(file, user.id)

            // Phase B: Upload file to storage using the same filePath
            updateProgress('upload', 30, 'Uploading file to storage...')
            await uploadFileToStorage(file, filePath, document.file_type)

            // Update status to processing
            updateProgress('upload', 50, 'File uploaded, processing PDF...')
            await updateDocumentStatus(docId, 'processing')

            // Parse PDF
            updateProgress('processing', 60, 'Extracting text from PDF...')
            const parsedDoc = await parsePDF(file)

            // Store pages
            updateProgress('processing', 70, 'Storing document pages...')
            const pageInserts = parsedDoc.pages.map(page => ({
                document_id: docId,
                page_number: page.pageNumber,
                text: page.text,
                token_count: page.tokenCount
            }))

            const { error: pagesError } = await supabase
                .from('document_pages')
                .insert(pageInserts)

            if (pagesError) {
                console.error('Pages insertion failed:', pagesError)
                throw new Error(`Failed to store document pages: ${pagesError.message}`)
            }

            // Server-side embeddings & chunk storage
            updateProgress('embedding', 80, 'Generating embeddings...')
            const { data: sessionRes } = await supabase.auth.getSession()
            const accessToken = sessionRes?.session?.access_token
            const res = await fetch(`/api/documents/${docId}/embed`, {
                method: 'POST',
                headers: { Authorization: accessToken ? `Bearer ${accessToken}` : '' }
            })
            if (!res.ok) {
                const msg = await res.text().catch(() => 'Embedding failed')
                throw new Error(msg || 'Embedding failed')
            }

            // Finalize document
            updateProgress('embedding', 95, 'Finalizing document...')
            const finalDoc = await finalizeDocument(docId, parsedDoc.pageCount, parsedDoc.metadata)

            updateProgress('embedding', 100, 'Upload complete!')

            toast({
                title: "Upload successful",
                description: `${file.name} has been processed and is ready for use.`,
            })

            onUploadComplete?.(finalDoc)

        } catch (err) {
            console.error('Upload error:', err)
            const errorMessage = err instanceof Error ? err.message : 'Upload failed'
            setError(errorMessage)

            // Provide specific error messages based on the error type
            let toastTitle = "Upload failed"
            let toastDescription = errorMessage

            if (errorMessage.includes('create document record')) {
                toastTitle = "Document Creation Failed"
                toastDescription = "Failed to create document record. Please try again."
            } else if (errorMessage.includes('upload file to storage')) {
                toastTitle = "File Upload Failed"
                toastDescription = "Failed to upload file to storage. Please check your connection and try again."
            } else if (errorMessage.includes('store document pages') || errorMessage.includes('store document chunks')) {
                toastTitle = "Processing Failed"
                toastDescription = "Failed to process document content. Please try again."
            } else if (errorMessage.includes('Only PDF files are allowed')) {
                toastTitle = "Invalid File Type"
                toastDescription = "Please select a PDF file to upload."
            } else if (errorMessage.includes('File size exceeds')) {
                toastTitle = "File Too Large"
                toastDescription = "Please select a file smaller than 100MB."
            }

            toast({
                title: toastTitle,
                description: toastDescription,
                variant: "destructive"
            })
        } finally {
            setIsUploading(false)
            setUploadProgress(null)
        }
    }, [updateProgress, onUploadComplete, toast])

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setIsDragOver(true)
    }, [])

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setIsDragOver(false)
    }, [])

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setIsDragOver(false)

        const files = Array.from(e.dataTransfer.files)
        const pdfFile = files.find(file => file.type === 'application/pdf')

        if (pdfFile) {
            handleFileSelect(pdfFile)
        } else {
            setError('Please drop a PDF file')
        }
    }, [handleFileSelect])

    const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            handleFileSelect(file)
        }
    }, [handleFileSelect])

    const handleBrowseClick = useCallback(() => {
        fileInputRef.current?.click()
    }, [])

    return (
        <div className="w-full max-w-2xl mx-auto">
            <Card className={`border-2 border-dashed transition-colors ${isDragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
                }`}>
                <CardContent className="p-8">
                    <div className="text-center">
                        {!isUploading ? (
                            <>
                                <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                                    <Upload className="w-8 h-8 text-gray-600" />
                                </div>

                                <h3 className="text-lg font-semibold mb-2">
                                    Upload PDF Document
                                </h3>

                                <p className="text-gray-600 mb-6">
                                    Drag and drop your PDF file here, or click to browse
                                </p>

                                <div className="space-y-4">
                                    <Button
                                        onClick={handleBrowseClick}
                                        disabled={isUploading}
                                        className="w-full"
                                    >
                                        <FileText className="w-4 h-4 mr-2" />
                                        Choose PDF File
                                    </Button>

                                    <p className="text-sm text-gray-500">
                                        Maximum file size: 100MB
                                    </p>
                                </div>

                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".pdf"
                                    onChange={handleFileInputChange}
                                    className="hidden"
                                />
                            </>
                        ) : (
                            <div className="space-y-4">
                                <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                                    <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                                </div>

                                <h3 className="text-lg font-semibold">
                                    {uploadProgress?.message || 'Processing...'}
                                </h3>

                                <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div
                                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                        style={{ width: `${uploadProgress?.progress || 0}%` }}
                                    />
                                </div>

                                <p className="text-sm text-gray-600">
                                    {uploadProgress?.progress}% complete
                                </p>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {error && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center">
                    <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
                    <span className="text-red-800">{error}</span>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setError(null)}
                        className="ml-auto"
                    >
                        <X className="w-4 h-4" />
                    </Button>
                </div>
            )}
        </div>
    )
}
