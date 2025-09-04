export interface Folder {
    id: string
    title: string
    created_at: string
    updated_at: string
}

export interface NoteItem {
    id: string
    title: string
    preview: string
    tags: string[]
    updated: string
}

export interface DocItem {
    id: string
    name: string
    size: string
    updated: string
}

// PDF Document Types
export type DocumentStatus = 'uploaded' | 'processing' | 'ready' | 'error'

export interface Document {
    id: string
    user_id: string
    title: string
    file_name: string
    file_type: string
    file_size: number
    file_path: string
    page_count?: number
    status: DocumentStatus
    metadata: Record<string, any>
    created_at: string
    updated_at: string
}

export interface DocumentPage {
    id: string
    document_id: string
    page_number: number
    text: string
    token_count?: number
    created_at: string
}

export interface DocumentChunk {
    id: string
    document_id: string
    page_number: number
    chunk_index: number
    content: string
    token_count?: number
    embedding?: number[]
    created_at: string
}

export interface SearchResult {
    id: string
    document_id: string
    page_number: number
    chunk_index: number
    content: string
    similarity: number
}

export interface UploadProgress {
    stage: 'upload' | 'processing' | 'embedding'
    progress: number
    message: string
}

export interface AIAnswer {
    answer: string
    citations: Array<{
        document_id: string
        page_number: number
        chunk_index: number
        content: string
        similarity: number
    }>
}
