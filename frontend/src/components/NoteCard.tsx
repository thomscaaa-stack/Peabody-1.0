import React from 'react'
import { htmlToPlain, preview as previewFn } from '@/lib/text'

export interface NoteItem {
    id: string
    title: string
    preview: string
    tags?: string[]
    updated: string
}

interface NoteCardProps {
    note: NoteItem
    selected?: boolean
    onSelect: (id: string) => void
}

export default function NoteCard({ note, selected, onSelect }: NoteCardProps) {
    const snippet = previewFn(htmlToPlain(note.preview ?? ''), 120)
    return (
        <button
            type="button"
            onClick={() => onSelect(note.id)}
            className={`w-full text-left p-3 border rounded-xl hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-600 ${selected ? 'ring-2 ring-blue-600' : ''}`}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="truncate font-medium text-gray-900">{note.title}</div>
                    <div className="text-sm text-gray-500 line-clamp-2">{snippet}</div>
                    {note.tags && note.tags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                            {note.tags.map((t) => (
                                <span key={t} className="bg-gray-100 text-gray-600 text-xs rounded-full px-2 py-0.5">{t}</span>
                            ))}
                        </div>
                    )}
                </div>
                <div className="text-xs text-gray-500 whitespace-nowrap">{note.updated}</div>
            </div>
        </button>
    )
}
