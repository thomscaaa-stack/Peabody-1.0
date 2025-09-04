import React, { useState, useEffect } from 'react'
import { FileText, Search, Trash2, Eye, Calendar, HardDrive } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatFileSize } from '@/lib/pdf'
import type { Document } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface DocumentListProps {
    onDocumentSelect?: (document: Document) => void
    onDocumentDelete?: (documentId: string) => void
    refreshTrigger?: number
}

export default function DocumentList({ onDocumentSelect, onDocumentDelete, refreshTrigger }: DocumentListProps) {
    const [documents, setDocuments] = useState<Document[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [error, setError] = useState<string | null>(null)

    const fetchDocuments = async () => {
        try {
            setLoading(true)
            const { data: { user } } = await supabase.auth.getUser()

            if (!user) {
                setError('User not authenticated')
                return
            }

            const { data, error } = await supabase
                .from('documents')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })

            if (error) throw error

            setDocuments(data || [])
        } catch (err) {
            console.error('Error fetching documents:', err)
            setError('Failed to load documents')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchDocuments()
    }, [refreshTrigger])

    const handleDelete = async (documentId: string) => {
        try {
            // Delete from storage
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const document = documents.find(d => d.id === documentId)
            if (document) {
                await supabase.storage
                    .from('documents')
                    .remove([document.file_path])
            }

            // Delete from database (cascade will handle pages and chunks)
            const { error } = await supabase
                .from('documents')
                .delete()
                .eq('id', documentId)

            if (error) throw error

            // Update local state
            setDocuments(prev => prev.filter(d => d.id !== documentId))
            onDocumentDelete?.(documentId)
        } catch (err) {
            console.error('Error deleting document:', err)
            setError('Failed to delete document')
        }
    }

    const getStatusColor = (status: Document['status']) => {
        switch (status) {
            case 'ready':
                return 'bg-green-100 text-green-800'
            case 'processing':
                return 'bg-yellow-100 text-yellow-800'
            case 'error':
                return 'bg-red-100 text-red-800'
            default:
                return 'bg-gray-100 text-gray-800'
        }
    }

    const getStatusIcon = (status: Document['status']) => {
        switch (status) {
            case 'ready':
                return '✓'
            case 'processing':
                return '⟳'
            case 'error':
                return '✗'
            default:
                return '○'
        }
    }

    const filteredDocuments = documents.filter(doc =>
        doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.file_name.toLowerCase().includes(searchTerm.toLowerCase())
    )

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-800">{error}</p>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchDocuments}
                    className="mt-2"
                >
                    Retry
                </Button>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center space-x-2">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                        placeholder="Search documents..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                    />
                </div>
            </div>

            {filteredDocuments.length === 0 ? (
                <Card>
                    <CardContent className="p-8 text-center">
                        <FileText className="mx-auto w-12 h-12 text-gray-400 mb-4" />
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                            {searchTerm ? 'No documents found' : 'No documents yet'}
                        </h3>
                        <p className="text-gray-600">
                            {searchTerm ? 'Try adjusting your search terms' : 'Upload your first PDF to get started'}
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4">
                    {filteredDocuments.map((document) => (
                        <Card
                            key={document.id}
                            className="hover:shadow-md transition-shadow cursor-pointer"
                            onClick={() => onDocumentSelect?.(document)}
                        >
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-3 flex-1">
                                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                                            <FileText className="w-5 h-5 text-blue-600" />
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-semibold text-gray-900 truncate">
                                                {document.title}
                                            </h3>
                                            <p className="text-sm text-gray-500 truncate">
                                                {document.file_name}
                                            </p>

                                            <div className="flex items-center space-x-4 mt-2">
                                                <div className="flex items-center space-x-1 text-xs text-gray-500">
                                                    <Calendar className="w-3 h-3" />
                                                    <span>
                                                        {new Date(document.created_at).toLocaleDateString()}
                                                    </span>
                                                </div>

                                                <div className="flex items-center space-x-1 text-xs text-gray-500">
                                                    <HardDrive className="w-3 h-3" />
                                                    <span>{formatFileSize(document.file_size)}</span>
                                                </div>

                                                {document.page_count && (
                                                    <span className="text-xs text-gray-500">
                                                        {document.page_count} pages
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center space-x-2">
                                        <Badge className={getStatusColor(document.status)}>
                                            <span className="mr-1">{getStatusIcon(document.status)}</span>
                                            {document.status}
                                        </Badge>

                                        {document.status === 'ready' && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={(e) => { e.stopPropagation(); onDocumentSelect?.(document); }}
                                                className="text-blue-600 hover:text-blue-700"
                                            >
                                                <Eye className="w-4 h-4" />
                                            </Button>
                                        )}

                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={(e) => { e.stopPropagation(); handleDelete(document.id); }}
                                            className="text-red-600 hover:text-red-700"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    )
}
