import React from 'react'

interface SearchInputProps {
    value: string
    onChange: (v: string) => void
    placeholder?: string
}

export default function SearchInput({ value, onChange, placeholder = 'Search notes and documents…' }: SearchInputProps) {
    return (
        <div className="relative">
            <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.3-4.3"></path></svg>
            <input
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className="w-full rounded-xl border border-gray-200 p-3 pl-9 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
        </div>
    )
}
