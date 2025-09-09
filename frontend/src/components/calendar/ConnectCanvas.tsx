import React, { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface ConnectCanvasProps {
    onConnected: (token: string) => void
}

export default function ConnectCanvas({ onConnected }: ConnectCanvasProps) {
    const [url, setUrl] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => { inputRef.current?.focus() }, [])

    const submit = async () => {
        setError(null)
        const trimmed = url.trim()
        if (!trimmed) { setError('Please paste your Canvas .ics URL'); return }
        try {
            setLoading(true)
            const res = await fetch('/api/feeds/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: trimmed })
            })
            if (!res.ok) {
                const j = await res.json().catch(() => ({}))
                throw new Error(j?.error || 'Failed to connect')
            }
            const { token } = await res.json()
            if (typeof token !== 'string') throw new Error('Invalid server response')
            localStorage.setItem('canvasIcsToken', token)
            onConnected(token)
        } catch (e: any) {
            setError(e?.message || 'Failed to connect')
        } finally {
            setLoading(false)
        }
    }

    const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') submit()
    }

    return (
        <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
                We never store your calendar URL. It stays private on your device; our server only holds a short-lived token.
            </p>
            <Input
                ref={inputRef}
                placeholder="https://<your-canvas-domain>/feeds/calendars/user_xxx.ics"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={onKey}
            />
            {error && <div className="text-sm text-red-600">{error}</div>}
            <div className="flex gap-2">
                <Button onClick={submit} disabled={loading}>
                    {loading ? 'Connecting…' : 'Connect'}
                </Button>
            </div>
        </div>
    )
}


