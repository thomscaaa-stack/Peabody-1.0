import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist'
import workerSrc from 'pdfjs-dist/build/pdf.worker.mjs?url'

// Configure PDF.js worker (Vite bundler-safe)
GlobalWorkerOptions.workerSrc = workerSrc as unknown as string

export interface ParsedPage {
    pageNumber: number
    text: string
    tokenCount: number
}

export interface ParsedDocument {
    title: string
    pageCount: number
    pages: ParsedPage[]
    metadata: {
        title?: string
        author?: string
        subject?: string
        keywords?: string
    }
}

export interface TextChunk {
    content: string
    tokenCount: number
    pageNumber: number
    chunkIndex: number
}

// Parse PDF file and extract text from all pages
export async function parsePDF(file: File): Promise<ParsedDocument> {
    const arrayBuffer = await file.arrayBuffer()
    const pdf = await getDocument({ data: arrayBuffer }).promise

    const pages: ParsedPage[] = []
    const pageCount = pdf.numPages

    // Extract text from each page
    for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
        const page = await pdf.getPage(pageNum)
        const textContent = await page.getTextContent()

        // Combine text items into a single string
        const text = textContent.items
            .map((item: any) => item.str)
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim()

        const tokenCount = estimateTokenCount(text)

        pages.push({
            pageNumber: pageNum,
            text,
            tokenCount
        })
    }

    // Extract metadata
    const metadata = await pdf.getMetadata()

    return {
        title: file.name.replace(/\.pdf$/i, ''),
        pageCount,
        pages,
        metadata: {
            title: metadata?.info?.Title,
            author: metadata?.info?.Author,
            subject: metadata?.info?.Subject,
            keywords: metadata?.info?.Keywords
        }
    }
}

// Chunk text into smaller pieces for embedding
export function chunkText(text: string, targetTokens: number = 500, overlapTokens: number = 50): TextChunk[] {
    const chunks: TextChunk[] = []
    const words = text.split(/\s+/)
    const tokensPerWord = 1.3 // Rough estimate

    let currentChunk: string[] = []
    let currentTokenCount = 0
    let chunkIndex = 0

    for (const word of words) {
        const wordTokens = Math.ceil(word.length / 4) // Rough token estimation

        if (currentTokenCount + wordTokens > targetTokens && currentChunk.length > 0) {
            // Save current chunk
            chunks.push({
                content: currentChunk.join(' '),
                tokenCount: currentTokenCount,
                pageNumber: 1, // Will be set by caller
                chunkIndex: chunkIndex++
            })

            // Start new chunk with overlap
            const overlapWords = Math.floor(overlapTokens / tokensPerWord)
            currentChunk = currentChunk.slice(-overlapWords)
            currentTokenCount = currentChunk.reduce((sum, w) => sum + Math.ceil(w.length / 4), 0)
        }

        currentChunk.push(word)
        currentTokenCount += wordTokens
    }

    // Add final chunk
    if (currentChunk.length > 0) {
        chunks.push({
            content: currentChunk.join(' '),
            tokenCount: currentTokenCount,
            pageNumber: 1, // Will be set by caller
            chunkIndex: chunkIndex
        })
    }

    return chunks
}

// Estimate token count for text (rough approximation)
export function estimateTokenCount(text: string): number {
    // Rough approximation: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4)
}

// Format file size for display
export function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes'

    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// Validate PDF file
export function validatePDFFile(file: File): { valid: boolean; error?: string } {
    const maxSize = 100 * 1024 * 1024 // 100MB
    const allowedTypes = ['application/pdf']

    if (file.size > maxSize) {
        return { valid: false, error: 'File size exceeds 100MB limit' }
    }

    if (!allowedTypes.includes(file.type)) {
        return { valid: false, error: 'Only PDF files are allowed' }
    }

    if (!file.name.toLowerCase().endsWith('.pdf')) {
        return { valid: false, error: 'File must have .pdf extension' }
    }

    return { valid: true }
}

// Highlight search terms in text
export function highlightSearchTerms(text: string, searchTerm: string): string {
    if (!searchTerm.trim()) return text

    const regex = new RegExp(`(${searchTerm})`, 'gi')
    return text.replace(regex, '<mark>$1</mark>')
}

// Extract text from PDF page for display
export function extractPageText(text: string, maxLength: number = 500): string {
    if (text.length <= maxLength) return text

    const truncated = text.substring(0, maxLength)
    const lastSpace = truncated.lastIndexOf(' ')

    return lastSpace > 0
        ? truncated.substring(0, lastSpace) + '...'
        : truncated + '...'
}
