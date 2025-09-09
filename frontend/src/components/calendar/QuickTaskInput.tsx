import React, { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'

interface Props {
    onCreated?: () => void
}

export default function QuickTaskInput({ onCreated }: Props) {
    const [title, setTitle] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const create = async () => {
        if (!title.trim()) return
        try {
            setLoading(true)
            setError(null)
            const { data: sessionRes } = await supabase.auth.getSession()
            const accessToken = sessionRes?.session?.access_token
            if (!accessToken) { setError('Not signed in'); return }
            const res = await fetch('/api/calendar/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
                body: JSON.stringify({ title })
            })
            if (!res.ok) throw new Error('Failed to create task')
            setTitle('')
            onCreated?.()
        } catch (e: any) {
            setError(e?.message || 'Failed to create task')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="flex items-center gap-2">
            <Input placeholder="Quick add task" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') create() }} />
            <Button onClick={create} disabled={loading}>Add</Button>
            {error && <div className="text-xs text-red-600 ml-2">{error}</div>}
        </div>
    )
}


