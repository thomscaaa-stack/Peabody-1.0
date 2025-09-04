import React, { useState } from 'react'
import { Send, Loader2, MessageSquare, FileText, Volume2, Square } from 'lucide-react'
import { askQuestion, askQuestionStream } from '@/lib/ai'
import type { AIAnswer } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface AIQAProps {
    userId: string
}

export default function AIQA({ userId }: AIQAProps) {
    const [question, setQuestion] = useState('')
    const [answer, setAnswer] = useState<AIAnswer | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [speaking, setSpeaking] = useState(false) // Mentor: speech state
    const [streaming, setStreaming] = useState(false)
    const [partial, setPartial] = useState('')
    const streamRef = React.useRef<{ abort: () => void; done: Promise<AIAnswer> } | null>(null)

    const handleAskQuestion = async () => {
        if (!question.trim()) return

        setLoading(true)
        setError(null)
        setAnswer(null)
        setPartial('')
        setStreaming(false)

        try {
            const result = await askQuestion(question, userId)
            setAnswer(result)
        } catch (err) {
            console.error('Error asking question:', err)
            setError(err instanceof Error ? err.message : 'Failed to get answer')
        } finally {
            setLoading(false)
        }
    }

    const handleAskQuestionStream = async () => {
        if (!question.trim()) return
        setLoading(false)
        setError(null)
        setAnswer(null)
        setPartial('')
        setStreaming(true)

        try {
            const stream = askQuestionStream(
                question,
                userId,
                (token) => setPartial(prev => prev + token)
            )
            streamRef.current = stream
            const result = await stream.done
            setAnswer(result)
        } catch (err) {
            console.error('Error streaming question:', err)
            setError(err instanceof Error ? err.message : 'Failed to stream answer')
        } finally {
            setStreaming(false)
            streamRef.current = null
        }
    }

    const handleStopStream = () => {
        try {
            streamRef.current?.abort()
        } finally {
            setStreaming(false)
        }
    }

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleAskQuestion()
        }
    }

    // Mentor: Text-to-speech controls
    const handleSpeak = () => {
        if (!answer?.answer) return
        try {
            window.speechSynthesis.cancel()
            const utterance = new SpeechSynthesisUtterance(answer.answer)
            utterance.onend = () => setSpeaking(false)
            utterance.onerror = () => setSpeaking(false)
            setSpeaking(true)
            window.speechSynthesis.speak(utterance)
        } catch (_) {
            setSpeaking(false)
        }
    }

    const handleStopSpeak = () => {
        try {
            window.speechSynthesis.cancel()
        } finally {
            setSpeaking(false)
        }
    }

    const formatAnswer = (text: string) => {
        // Simple formatting for better readability
        return text.split('\n').map((line, index) => (
            <p key={index} className="mb-2">
                {line}
            </p>
        ))
    }

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                        <MessageSquare className="w-5 h-5" />
                        <span>Mentor</span>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <div className="flex space-x-2">
                            <Input
                                // Mentor: broaden placeholder
                                placeholder="Ask Mentor anything (documents, study, code, etc.)..."
                                value={question}
                                onChange={(e) => setQuestion(e.target.value)}
                                onKeyPress={handleKeyPress}
                                disabled={loading}
                                className="flex-1"
                            />
                            {!streaming ? (
                                <Button
                                    onClick={handleAskQuestionStream}
                                    disabled={!question.trim()}
                                >
                                    <Send className="w-4 h-4" />
                                </Button>
                            ) : (
                                <Button variant="destructive" onClick={handleStopStream}>
                                    <Square className="w-4 h-4" />
                                </Button>
                            )}
                        </div>

                        {error && (
                            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                                <p className="text-red-800 text-sm">{error}</p>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {(answer || partial) && (
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-lg">Answer</CardTitle>
                            <div className="flex items-center space-x-2">
                                {!speaking ? (
                                    <Button variant="outline" size="sm" onClick={handleSpeak}>
                                        <Volume2 className="w-4 h-4 mr-1" />
                                        Speak
                                    </Button>
                                ) : (
                                    <Button variant="outline" size="sm" onClick={handleStopSpeak}>
                                        <Square className="w-4 h-4 mr-1" />
                                        Stop
                                    </Button>
                                )}
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="prose prose-sm max-w-none">
                            {partial && !answer ? formatAnswer(partial) : answer ? formatAnswer(answer.answer) : null}
                        </div>

                        {answer && answer.citations.length > 0 && (
                            <div className="border-t pt-4">
                                <h4 className="font-semibold mb-2 flex items-center space-x-2">
                                    <FileText className="w-4 h-4" />
                                    <span>Sources</span>
                                    <Badge variant="secondary">{answer.citations.length}</Badge>
                                </h4>

                                <div className="space-y-2">
                                    {answer.citations.map((citation, index) => (
                                        <div key={index} className="p-3 bg-gray-50 rounded-lg">
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1">
                                                    <p className="text-sm font-medium">
                                                        Page {citation.page_number}
                                                    </p>
                                                    <p className="text-sm text-gray-600 mt-1">
                                                        {citation.content.length > 200
                                                            ? citation.content.substring(0, 200) + '...'
                                                            : citation.content
                                                        }
                                                    </p>
                                                </div>
                                                <Badge variant="outline" className="ml-2">
                                                    {(citation.similarity * 100).toFixed(1)}%
                                                </Badge>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {!answer && !loading && (
                <Card>
                    <CardContent className="p-8 text-center">
                        <MessageSquare className="mx-auto w-12 h-12 text-gray-400 mb-4" />
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">Ask Mentor Anything</h3>
                        <p className="text-gray-600">General questions, study plans, coding help, or document Q&A with citations.</p>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
