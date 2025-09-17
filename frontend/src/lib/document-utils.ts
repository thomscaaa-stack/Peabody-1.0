import { supabase } from './supabase'
import type { Document } from './types'

// Development helper to log insert shape
function logInsertShape(table: string, payload: Record<string, any>) {
    const knownColumns = [
        'id', 'user_id', 'title', 'file_name', 'file_type',
        'file_size', 'file_path', 'status', 'page_count',
        'metadata', 'created_at', 'updated_at'
    ]

    const payloadKeys = Object.keys(payload)
    const unknownKeys = payloadKeys.filter(key => !knownColumns.includes(key))
    const missingRequired = ['file_path', 'file_name', 'file_type'].filter(key => !payloadKeys.includes(key))

    if (unknownKeys.length > 0) {
        console.warn(`⚠️ Unknown keys in ${table} insert:`, unknownKeys)
    }

    if (missingRequired.length > 0) {
        console.error(`❌ Missing required keys in ${table} insert:`, missingRequired)
    }

    console.log(`✅ ${table} insert shape:`, payloadKeys)
}

// Type for the minimal document insert payload based on actual DB schema
export interface DocumentInsertPayload {
    id: string
    user_id: string
    title: string
    file_name: string
    file_type: string
    file_size: number
    file_path: string
    status: 'uploaded' | 'processing' | 'ready' | 'error'
}

/**
 * Validates file before processing
 */
function validateFile(file: File): void {
    const maxSize = 100 * 1024 * 1024 // 100MB
    if (file.size > maxSize) {
        throw new Error('File size exceeds 100MB limit')
    }
    if (!file.name || !file.size) {
        throw new Error('Invalid file: missing required properties')
    }
}

/**
 * Sanitizes filename for storage path
 */
function sanitizeFileName(fileName: string): string {
    return fileName
        .replace(/[<>:"/\\|?*]/g, '_') // Replace invalid characters
        .replace(/\/+/g, '/') // Normalize multiple slashes
        .trim()
}

/**
 * Creates a document record with correct schema fields
 */
export async function createDocumentRecord(
    file: File,
    userId: string
): Promise<{ doc: Document; filePath: string; docId: string }> {
    // Validate file before processing
    validateFile(file)

    // Generate client UUID for the document
    const docId = crypto.randomUUID()
    const fileName = file.name
    const fileType = file.type || 'application/pdf'
    const fileSize = file.size
    const sanitizedFileName = sanitizeFileName(fileName)
    // Dedicated workspace/project folder structure
    // workspaceId is resolved from localStorage or env, with a safe default
    let workspaceId = 'default'
    if (typeof window !== 'undefined') {
        workspaceId = window.localStorage.getItem('workspace:id')
            || (window.localStorage.getItem('workspaceId') as string)
            || workspaceId
    }
    // Vite env override
    // @ts-ignore
    const envWorkspace = (typeof import.meta !== 'undefined' && (import.meta as any)?.env?.VITE_WORKSPACE_ID) || undefined
    if (envWorkspace) workspaceId = envWorkspace as string
    // Final, clean path: workspace/<workspaceId>/uploads/<docId>/<file>
    const filePath = `workspace/${workspaceId}/uploads/${docId}/${sanitizedFileName}`
    const title = fileName.replace(/\.pdf$/i, '')

    // Build payload with only fields that exist in the documents table
    const payload: DocumentInsertPayload = {
        id: docId,
        user_id: userId,
        title,
        file_name: fileName,
        file_type: fileType,
        file_size: fileSize,
        file_path: filePath,
        status: 'uploaded'
    }

    console.debug('Creating document with payload:', payload)

    // Development helper to log insert shape
    if (process.env.NODE_ENV === 'development') {
        logInsertShape('documents', payload)
    }

    // Insert document record
    const { data: document, error } = await supabase
        .from('documents')
        .insert([payload])
        .select()
        .single()

    if (error) {
        console.error('Document creation failed:', error)
        console.error('Failed payload keys:', Object.keys(payload))
        throw new Error(`Failed to create document record: ${error.message}`)
    }

    if (!document) {
        throw new Error('Document creation succeeded but no data returned')
    }

    console.log('Document created successfully:', document.id)
    return { doc: document, filePath, docId }
}

/**
 * Updates document status
 */
export async function updateDocumentStatus(
    documentId: string,
    status: 'uploaded' | 'processing' | 'ready' | 'error'
): Promise<void> {
    const { error } = await supabase
        .from('documents')
        .update({ status })
        .eq('id', documentId)

    if (error) {
        console.error('Document status update failed:', error)
        throw new Error(`Failed to update document status: ${error.message}`)
    }
}

/**
 * Uploads file to Supabase Storage
 */
export async function uploadFileToStorage(
    file: File,
    filePath: string,
    fileType: string
): Promise<void> {
    const { error } = await supabase.storage
        .from('documents')
        .upload(filePath, file, {
            upsert: true,
            contentType: fileType
        })

    if (error) {
        console.error('File upload failed:', error)
        throw new Error(`Failed to upload file to storage: ${error.message}`)
    }
}

/**
 * Finalizes document with processing results
 */
export async function finalizeDocument(
    documentId: string,
    pageCount: number,
    metadata: Record<string, any>
): Promise<Document> {
    const { data: document, error } = await supabase
        .from('documents')
        .update({
            status: 'ready',
            page_count: pageCount,
            metadata: metadata
        })
        .eq('id', documentId)
        .select()
        .single()

    if (error) {
        console.error('Document finalization failed:', error)
        throw new Error(`Failed to finalize document: ${error.message}`)
    }

    if (!document) {
        throw new Error('Document finalization succeeded but no data returned')
    }

    return document
}
