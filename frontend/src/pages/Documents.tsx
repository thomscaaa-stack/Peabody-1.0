import React, { useState, useEffect } from 'react'
import { FileText, Upload, MessageSquare, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Document } from '@/lib/types'
import PDFUpload from '@/components/PDFUpload'
import DocumentList from '@/components/DocumentList'
import PDFReader from '@/components/PDFReader'
import AIQA from '@/components/AIQA'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export default function DocumentsPage() {
  const [user, setUser] = useState<any>(null)
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null)
  const [showUpload, setShowUpload] = useState(false)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
    }
    getUser()
  }, [])

  const handleUploadComplete = (document: Document) => {
    setShowUpload(false)
    setRefreshTrigger(prev => prev + 1)
  }

  const handleDocumentSelect = (document: Document) => {
    setSelectedDocument(document)
  }

  const handleDocumentDelete = (documentId: string) => {
    if (selectedDocument?.id === documentId) {
      setSelectedDocument(null)
    }
    setRefreshTrigger(prev => prev + 1)
  }

  const handleCloseViewer = () => {
    setSelectedDocument(null)
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Documents</h1>
          <p className="text-gray-600 mt-1">
            Upload, view, and analyze your PDF documents with AI
          </p>
        </div>

        <Button onClick={() => setShowUpload(true)} className="flex items-center space-x-2">
          <Upload className="w-4 h-4" />
          <span>Upload PDF</span>
        </Button>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Document Management */}
        <div className="lg:col-span-2 space-y-6">
          <Tabs defaultValue="documents" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="documents" className="flex items-center space-x-2">
                <FileText className="w-4 h-4" />
                <span>Documents</span>
              </TabsTrigger>
              <TabsTrigger value="ai" className="flex items-center space-x-2">
                <MessageSquare className="w-4 h-4" />
                <span>Mentor</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="documents" className="space-y-4">
              <DocumentList
                onDocumentSelect={handleDocumentSelect}
                onDocumentDelete={handleDocumentDelete}
                refreshTrigger={refreshTrigger}
              />
            </TabsContent>

            <TabsContent value="ai" className="space-y-4">
              <AIQA userId={user.id} />
            </TabsContent>
          </Tabs>
        </div>

        {/* Right Column - PDF Viewer */}
        <div className="lg:col-span-1">
          {selectedDocument ? (
            <Card className="h-[calc(100vh-200px)]">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg truncate">
                    {selectedDocument.title}
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCloseViewer}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0 h-full">
                <PDFReader document={selectedDocument} onClose={handleCloseViewer} />
              </CardContent>
            </Card>
          ) : (
            <Card className="h-[calc(100vh-200px)]">
              <CardContent className="flex items-center justify-center h-full">
                <div className="text-center">
                  <FileText className="mx-auto w-12 h-12 text-gray-400 mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Select a Document
                  </h3>
                  <p className="text-gray-600">
                    Choose a document from the list to view it here.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Upload Modal */}
      {showUpload && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Upload PDF Document</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowUpload(false)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <PDFUpload
                onUploadComplete={handleUploadComplete}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
