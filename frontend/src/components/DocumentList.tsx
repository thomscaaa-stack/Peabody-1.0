import React from 'react'

export interface DocItem {
    id: string
    name: string
    size: string
    updated: string
}

interface DocumentListProps {
    documents: DocItem[]
    selectedId?: string | null
    onSelect: (id: string) => void
}

export default function DocumentList({ documents, selectedId, onSelect }: DocumentListProps) {
    return (
        <div className="space-y-2">
            <div className="text-xs font-medium text-gray-500 tracking-wide">DOCUMENTS</div>
            <ul className="space-y-2">
                {documents.map((d) => (
                    <li key={d.id}>
                        <button
                            type="button"
                            onClick={() => onSelect(d.id)}
                            className={`w-full text-left flex items-center gap-3 p-3 border rounded-xl hover:shadow-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-600 ${selectedId === d.id ? 'ring-2 ring-blue-600' : ''}`}
                        >
                            <div className="h-8 w-8 grid place-items-center rounded-lg bg-gray-100 text-gray-600">
                                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 3v4a1 1 0 0 0 1 1h4" /><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2Z" /></svg>
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-medium text-gray-900">{d.name}</div>
                                <div className="text-xs text-gray-500">{d.size} • {d.updated}</div>
                            </div>
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    )
}
