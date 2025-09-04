// Simple test file to verify document utilities
// This can be run manually to test the utilities

import { createDocumentRecord } from './document-utils'

// Mock file for testing
const mockFile = {
    name: 'test-document.pdf',
    size: 1024 * 1024, // 1MB
    type: 'application/pdf'
} as File

// Test the createDocumentRecord function
export async function testCreateDocumentRecord() {
    const userId = 'test-user-id'

    try {
        const result = await createDocumentRecord(mockFile, userId)

        console.log('Test createDocumentRecord result:', result)

        // Verify the returned structure
        if (!result.doc || !result.filePath || !result.docId) {
            console.error('Missing required return fields')
            return false
        }

        // Verify document has required fields
        const requiredFields = ['id', 'user_id', 'title', 'file_name', 'file_type', 'file_size', 'file_path', 'status']
        const missingFields = requiredFields.filter(field => !(field in result.doc))

        if (missingFields.length > 0) {
            console.error('Missing required fields in document:', missingFields)
            return false
        }

        console.log('✅ createDocumentRecord test passed')
        return true
    } catch (error) {
        console.error('Test failed:', error)
        return false
    }
}

// Run test if this file is executed directly
if (typeof window !== 'undefined') {
    // Browser environment
    (window as any).testDocumentUtils = testCreateDocumentRecord
}
