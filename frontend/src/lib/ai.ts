import OpenAI from 'openai'
import { supabase } from './supabase'
import type { AIAnswer, SearchResult } from './types'
// Mentor: imports
import { buildMentorMessages, deSycophantize, StudyPlanSchema, mentorTools } from './mentor'

// Initialize OpenAI client (kept for chat/QA; embeddings moved server-side)
const openai = new OpenAI({
    apiKey: import.meta.env.VITE_OPENAI_API_KEY,
    dangerouslyAllowBrowser: true
})

// Generate embeddings for text chunks
// Embeddings are now server-side only
export async function generateEmbeddings(_texts: string[]): Promise<number[][]> {
    throw new Error('Embeddings must be generated server-side')
}

// Search for relevant document chunks
export async function searchDocuments(query: string, userId: string): Promise<SearchResult[]> {
    try {
        // Generate embedding for the query
        const queryEmbedding = await generateEmbeddings([query])

        // Search in Supabase using the similarity function
        const { data, error } = await supabase.rpc('search_document_chunks', {
            query_embedding: queryEmbedding[0],
            match_threshold: 0.7,
            match_count: 5
        })

        if (error) {
            console.error('Error searching documents:', error)
            throw new Error('Failed to search documents')
        }

        return data || []
    } catch (error) {
        console.error('Error in searchDocuments:', error)
        throw new Error('Failed to search documents')
    }
}

// Generate AI answer based on search results
export async function generateAnswer(query: string, searchResults: SearchResult[]): Promise<AIAnswer> {
    try {
        // Mentor: Prepare context from search results
        const context = searchResults
            .map(result => `Page ${result.page_number}: ${result.content}`)
            .join('\n\n')

        // Mentor: Build system+user messages
        const userPrompt = `Context from documents:\n${context}\n\nQuestion: ${query}\n\nPlease provide a comprehensive answer based on the context above. Include specific page citations.`

        // Mentor: default message build (no memory/mode unless provided via options in askQuestion)
        const messages = buildMentorMessages({ userInput: userPrompt })

        // Mentor: call with optional tools/schema if needed in a later overload
        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages,
            temperature: 0.8,
            presence_penalty: 0.2,
            max_tokens: 1200,
            top_p: 1.0
        })

        const raw = response.choices[0]?.message
        const content = raw?.content || 'No answer generated'
        const answer = deSycophantize(content) // Mentor: anti-sycophancy guard

        return {
            answer,
            citations: searchResults.map(result => ({
                document_id: result.document_id,
                page_number: result.page_number,
                chunk_index: result.chunk_index,
                content: result.content,
                similarity: result.similarity
            }))
        }
    } catch (error) {
        console.error('Error generating answer:', error)
        throw new Error('Failed to generate answer')
    }
}

// Combined function to search and answer
// Mentor: extended options (non-breaking)
type MentorOptions = {
    userSummary?: string
    mode?: 'direct' | 'coach' | 'reflective' | 'cheerful'
    style?: string
    prefs?: string
    response_format?: 'studyPlan' | string
}

export async function askQuestion(query: string, userId: string, options?: MentorOptions): Promise<AIAnswer> {
    try {
        const searchResults = await searchDocuments(query, userId)

        // Mentor: if no document context, answer generally (no citations)
        if (searchResults.length === 0) {
            if (options) {
                return await generateAnswerWithMentor(query, searchResults, { ...options, userId })
            }
            return await generateGeneralAnswer(query)
        }

        // Mentor: route to enhanced generator if options provided
        if (options) {
            return await generateAnswerWithMentor(query, searchResults, { ...options, userId })
        }

        return await generateAnswer(query, searchResults)
    } catch (error) {
        console.error('Error in askQuestion:', error)
        throw new Error('Failed to process question')
    }
}

// Mentor: enhanced generator with modes, memory, structured outputs, and minimal tool-calling
async function generateAnswerWithMentor(
    query: string,
    searchResults: SearchResult[],
    { userSummary = '', mode = 'direct', style = '', prefs = '', response_format, userId }: MentorOptions & { userId?: string }
): Promise<AIAnswer> {
    // Build context-aware or general prompt
    const hasContext = searchResults.length > 0
    const context = hasContext
        ? searchResults.map(result => `Page ${result.page_number}: ${result.content}`).join('\n\n')
        : ''

    const userPrompt = hasContext
        ? `Context from documents:\n${context}\n\nQuestion: ${query}\n\nPlease provide a comprehensive answer based on the context above. Include specific page citations.`
        : `Question: ${query}\n\nPlease provide a helpful, accurate answer. If the user references uploaded documents and you have context, cite specific pages; otherwise answer generally.`

    const messages: Array<{ role: 'system' | 'user' | 'assistant' | 'tool'; content: string; tool_call_id?: string; name?: string }> = buildMentorMessages({
        userInput: userPrompt,
        userSummary,
        mode,
        style,
        prefs
    }) as any

    const commonParams: any = {
        model: 'gpt-4o-mini',
        temperature: 0.8,
        presence_penalty: 0.2,
        max_tokens: 1200 as number,
        top_p: 1.0
    }

    // Structured outputs when requested
    if (response_format === 'studyPlan') {
        commonParams.response_format = StudyPlanSchema // strict schema
    }

    // Minimal function calling support (single round)
    let response = await openai.chat.completions.create({
        ...commonParams,
        messages: messages as any,
        // Enable tools only when needed (opt-in)
        // tools: mentorTools as any,
        // tool_choice: 'auto'
    })

    const first = response.choices[0]
    const toolCalls = (first as any)?.message?.tool_calls as Array<{ id: string; type: string; function: { name: string; arguments: string } }> | undefined

    if (toolCalls && toolCalls.length > 0) {
        for (const call of toolCalls) {
            try {
                const args = JSON.parse(call.function.arguments || '{}')
                if (call.function.name === 'search_notes') {
                    const q = String(args.query || query)
                    const k = typeof args.topK === 'number' ? args.topK : 5
                    const uid = userId
                    let results: SearchResult[] = []
                    if (uid) {
                        results = await searchDocuments(q, uid)
                    }
                    const payload = {
                        items: results.slice(0, k).map(r => ({
                            document_id: r.document_id,
                            page_number: r.page_number,
                            chunk_index: r.chunk_index,
                            content: r.content,
                            similarity: r.similarity
                        }))
                    }
                    messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(payload) })
                } else if (call.function.name === 'create_task') {
                    const payload = { id: 'task_' + Math.random().toString(36).slice(2), title: String(args.title || ''), due: args.due ? String(args.due) : undefined }
                    messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(payload) })
                } else if (call.function.name === 'summarize_pdf') {
                    const payload = { summary: 'Summary not available in this client. Please open the PDF to view details.', fileId: String(args.fileId || '') }
                    messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(payload) })
                }
            } catch (e) {
                messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify({ error: 'Tool execution failed' }) })
            }
        }

        // Follow-up completion after tools
        response = await openai.chat.completions.create({
            ...commonParams,
            messages: messages as any
        })
    }

    const finalMsg = response.choices[0]?.message
    const rawContent = finalMsg?.content || ''
    const isJson = Boolean(commonParams.response_format)
    const content = isJson ? rawContent : deSycophantize(rawContent)

    return {
        answer: content || 'No answer generated',
        citations: searchResults.map(result => ({
            document_id: result.document_id,
            page_number: result.page_number,
            chunk_index: result.chunk_index,
            content: result.content,
            similarity: result.similarity
        }))
    }
}

// Mentor: general answer path (no citations)
async function generateGeneralAnswer(query: string): Promise<AIAnswer> {
    const messages = buildMentorMessages({
        userInput: `Question: ${query}\n\nPlease provide a helpful, accurate answer. If relevant, offer next steps.`
    }) as any

    const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages,
        temperature: 0.8,
        presence_penalty: 0.2,
        top_p: 1.0,
        max_tokens: 1200
    })

    const raw = response.choices[0]?.message?.content || ''
    const answer = deSycophantize(raw)

    return { answer: answer || 'No answer generated', citations: [] }
}

// Batch process embeddings for multiple chunks
export async function batchProcessEmbeddings(_chunks: Array<{ content: string; id: string }>) {
    throw new Error('Embeddings must be generated server-side')
}

// Streamed answer generation (token-by-token)
export function askQuestionStream(
    query: string,
    userId: string,
    onToken: (token: string) => void,
    options?: MentorOptions
): { abort: () => void; done: Promise<AIAnswer> } {
    const controller = new AbortController()

    const done = (async (): Promise<AIAnswer> => {
        // Prepare optional context
        let searchResults: SearchResult[] = []
        try {
            searchResults = await searchDocuments(query, userId)
        } catch (_) {
            // Non-fatal for streaming; proceed without context
            searchResults = []
        }

        const hasContext = searchResults.length > 0
        const context = hasContext
            ? searchResults.map(result => `Page ${result.page_number}: ${result.content}`).join('\n\n')
            : ''

        const userPrompt = hasContext
            ? `Context from documents:\n${context}\n\nQuestion: ${query}\n\nPlease provide a helpful, accurate answer based on the context above. Include specific page citations.`
            : `Question: ${query}\n\nPlease provide a helpful, accurate answer. If the user references uploaded documents and you have context, cite specific pages; otherwise answer generally.`

        const messages = buildMentorMessages({
            userInput: userPrompt,
            userSummary: options?.userSummary || '',
            mode: options?.mode || 'direct',
            style: options?.style || '',
            prefs: options?.prefs || ''
        }) as any

        const body = JSON.stringify({
            model: 'gpt-4o-mini',
            messages,
            temperature: 0.8,
            presence_penalty: 0.2,
            top_p: 1.0,
            max_tokens: 1200,
            stream: true
        })

        const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body,
            signal: controller.signal
        })

        if (!res.ok || !res.body) {
            const msg = await res.text().catch(() => 'Failed to stream response')
            throw new Error(msg || 'Failed to stream response')
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder('utf-8')
        let answerText = ''

        while (true) {
            const { value, done } = await reader.read()
            if (done) break
            const chunk = decoder.decode(value, { stream: true })

            // SSE lines: parse data: {json}
            const lines = chunk.split('\n')
            for (const line of lines) {
                const trimmed = line.trim()
                if (!trimmed.startsWith('data:')) continue
                const data = trimmed.replace(/^data:\s*/, '')
                if (data === '[DONE]') {
                    break
                }
                try {
                    const payload = JSON.parse(data)
                    const delta = payload.choices?.[0]?.delta?.content
                    if (typeof delta === 'string' && delta.length > 0) {
                        onToken(delta)
                        answerText += delta
                    }
                } catch (_) {
                    // ignore malformed lines
                }
            }
        }

        return {
            answer: deSycophantize(answerText || ''),
            citations: searchResults.map(result => ({
                document_id: result.document_id,
                page_number: result.page_number,
                chunk_index: result.chunk_index,
                content: result.content,
                similarity: result.similarity
            }))
        }
    })()

    return {
        abort: () => controller.abort(),
        done
    }
}
