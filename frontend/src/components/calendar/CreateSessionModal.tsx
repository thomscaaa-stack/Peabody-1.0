import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface Props {
    open: boolean
    onClose: () => void
    defaultTitle?: string
    defaultStart?: string
    defaultEnd?: string
}

export default function CreateSessionModal({ open, onClose, defaultTitle = '', defaultStart = '', defaultEnd = '' }: Props) {
    const [title, setTitle] = useState(defaultTitle)
    const [start, setStart] = useState(defaultStart)
    const [end, setEnd] = useState(defaultEnd)

    if (!open) return null

    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
            <div className="bg-white rounded-xl p-4 w-full max-w-md space-y-3">
                <h3 className="text-lg font-semibold">Create Study Session</h3>
                <div className="space-y-2">
                    <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
                    <Input placeholder="Start ISO" value={start} onChange={(e) => setStart(e.target.value)} />
                    <Input placeholder="End ISO" value={end} onChange={(e) => setEnd(e.target.value)} />
                </div>
                <div className="flex justify-end gap-2">
                    <Button variant="ghost" onClick={onClose}>Cancel</Button>
                    <Button onClick={onClose}>Save</Button>
                </div>
            </div>
        </div>
    )
}


