import React, { useEffect, useMemo, useState } from 'react'
import SearchInput from '@/components/SearchInput'
import DocumentList from '@/components/DocumentList'
import type { Document as PdfDocument, DocItem } from '@/lib/types'
import PDFReader from '@/components/PDFReader'
import PDFUpload from '@/components/PDFUpload'
import SplitPane from '@/components/SplitPane'
import NoteCard, { NoteItem } from '@/components/NoteCard'
import NotesEditor from '@/components/NotesEditor'
import { Link, useParams } from 'react-router-dom'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { supabase } from '@/lib/supabase'
import { htmlToPlain } from '@/lib/text'

const isUUID = (s?: string | null) => !!s && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)

export default function FolderPage() {
    const { id } = useParams()
    const folderId = id ?? null
    const [query, setQuery] = useState('')
    const [selectedDocument, setSelectedDocument] = useState<PdfDocument | null>(null)
    const [selectedNote, setSelectedNote] = useState<{ id: string | null; title: string; content: string } | null>(null)
    const [title, setTitle] = useState('')
    const [documents, setDocuments] = useState<DocItem[]>([])
    const [notes, setNotes] = useState<NoteItem[]>([])
    const [meta, setMeta] = useState<{ docs: number; notes: number }>({ docs: 0, notes: 0 })
    const [showUpload, setShowUpload] = useState(false)
    const [refreshTrigger, setRefreshTrigger] = useState<number>(0)
    const [isDesktop, setIsDesktop] = useState<boolean>(typeof window !== 'undefined' ? window.innerWidth >= 1024 : true)

    useEffect(() => {
        const load = async () => {
            if (!folderId) return
            const { data: userRes } = await supabase.auth.getUser()
            const user = userRes?.user

            const { data: f } = await supabase.from('folders').select('title').eq('id', folderId).maybeSingle()
            setTitle(f?.title ?? 'Folder')

            const { data: docs } = await supabase
                .from('documents')
                .select('id, file_name, file_size, updated_at')
                .eq('user_id', user?.id)
                .order('updated_at', { ascending: false })
            setDocuments((docs ?? []).map((d: any) => ({ id: d.id, name: d.file_name, size: d.file_size ? `${(d.file_size / (1024 * 1024)).toFixed(1)} MB` : '—', updated: new Date(d.updated_at).toLocaleDateString() })))

            let q = supabase
                .from('notes')
                .select('id, title, content_html, updated_at')
                .eq('user_id', user?.id)
                .order('updated_at', { ascending: false })
            if (isUUID(folderId)) q = q.eq('folder_id', folderId)
            const { data: ns } = await q

            setNotes((ns ?? []).map((n: any) => ({ id: n.id, title: n.title ?? 'Untitled', preview: htmlToPlain(n.content_html ?? '').slice(0, 160), tags: [], updated: new Date(n.updated_at).toLocaleDateString() })))
            setMeta({ docs: (docs ?? []).length, notes: (ns ?? []).length })
        }
        load()
    }, [folderId])

    // Track breakpoint to avoid mounting duplicate viewers
    useEffect(() => {
        const onResize = () => setIsDesktop(window.innerWidth >= 1024)
        window.addEventListener('resize', onResize)
        return () => window.removeEventListener('resize', onResize)
    }, [])

    // Load a single note when selected
    useEffect(() => {
        const fetchSelected = async () => {
            if (!isUUID(selectedNote?.id ?? null)) return
            const { data, error } = await supabase
                .from('notes')
                .select('id, title, content_html, updated_at')
                .eq('id', selectedNote!.id)
                .maybeSingle()
            if (!error && data) setSelectedNote({ id: data.id, title: data.title ?? 'Untitled', content: data.content_html ?? '<p></p>' })
        }
        fetchSelected()
    }, [selectedNote?.id])

    const filteredDocs = useMemo(() => documents.filter(d => d.name.toLowerCase().includes(query.toLowerCase())), [documents, query])
    const filteredNotes = useMemo(() => notes.filter(n => n.title.toLowerCase().includes(query.toLowerCase())), [notes, query])

    const onSaved = (id: string, title: string, html: string) => {
        // Update notes list with the new/updated note
        setNotes((prev) => {
            const existingIndex = prev.findIndex(n => n.id === id)
            const updatedNote = {
                id,
                title: title || 'Untitled',
                preview: htmlToPlain(html || '<p></p>').slice(0, 160),
                tags: [],
                updated: new Date().toLocaleDateString()
            }

            if (existingIndex >= 0) {
                // Update existing note
                const newNotes = [...prev]
                newNotes[existingIndex] = updatedNote
                return newNotes
            } else {
                // Add new note to the beginning
                return [updatedNote, ...prev]
            }
        })

        // Update selected note state
        setSelectedNote((p) => ({ ...(p || { title: '', content: '' }), id, title, content: html }))

        // Update meta count for new notes only
        if (!notes.find(n => n.id === id)) {
            setMeta((m) => ({ ...m, notes: m.notes + 1 }))
        }
    }

    const deleteNote = async () => {
        if (!selectedNote?.id || !isUUID(selectedNote.id)) return
        await supabase.from('notes').delete().eq('id', selectedNote.id)
        setNotes((prev) => prev.filter((n) => n.id !== selectedNote.id))
        setSelectedNote(null)
        setMeta((m) => ({ ...m, notes: Math.max(0, m.notes - 1) }))
    }

    return (
        <div className="max-w-[1400px] mx-auto p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Link to="/workspace" className="rounded-lg border px-3 py-1.5 text-sm hover:shadow-sm">← Back</Link>
                    <div>
                        <div className="text-2xl font-bold text-gray-900">{title}</div>
                        <div className="text-sm text-gray-500">{meta.docs} documents • {meta.notes} notes</div>
                    </div>
                </div>

            </div>

            {/* Primary content region: PDF dominant; notes join as split on desktop */}
            {selectedDocument ? (
                <>
                    {isDesktop ? (
                        <div className="h-[calc(100vh-220px)]">
                            {selectedNote ? (
                                <SplitPane
                                    left={<PDFReader document={selectedDocument} onClose={() => setSelectedDocument(null)} />}
                                    right={<NotesEditor key={selectedNote.id ?? 'new'} noteId={selectedNote.id} initialTitle={selectedNote.title || 'Untitled'} initialHTML={selectedNote.content || '<p></p>'} folderId={folderId} onSaved={onSaved} onDelete={deleteNote} />}
                                    storageKey="folder_split_width"
                                />
                            ) : (
                                <div className="h-full border rounded-xl overflow-hidden">
                                    <PDFReader document={selectedDocument} onClose={() => setSelectedDocument(null)} />
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="h-[calc(100vh-220px)]">
                            {selectedNote ? (
                                <Tabs defaultValue="pdf" className="h-full">
                                    <TabsList className="grid grid-cols-2 w-full">
                                        <TabsTrigger value="pdf">PDF</TabsTrigger>
                                        <TabsTrigger value="notes">Notes</TabsTrigger>
                                    </TabsList>
                                    <TabsContent value="pdf" className="h-[calc(100%-40px)] border rounded-xl overflow-hidden">
                                        <PDFReader document={selectedDocument} onClose={() => setSelectedDocument(null)} />
                                    </TabsContent>
                                    <TabsContent value="notes" className="h-[calc(100%-40px)]">
                                        <NotesEditor
                                            key={selectedNote.id ?? 'new'}
                                            noteId={selectedNote.id}
                                            initialTitle={selectedNote.title || 'Untitled'}
                                            initialHTML={selectedNote.content || '<p></p>'}
                                            folderId={folderId}
                                            onSaved={onSaved}
                                            onDelete={deleteNote}
                                        />
                                    </TabsContent>
                                </Tabs>
                            ) : (
                                <div className="h-full border rounded-xl overflow-hidden">
                                    <PDFReader document={selectedDocument} onClose={() => setSelectedDocument(null)} />
                                </div>
                            )}
                        </div>
                    )}

                    {/* Study Materials moved below when a PDF is open */}
                    <div className="space-y-4 mt-8">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-gray-900">Study Materials</h2>
                            <div className="flex items-center gap-2">
                                <button className="rounded-lg border px-3 py-1.5 text-sm hover:shadow-sm" onClick={() => setShowUpload((v) => !v)}>Upload PDF</button>
                                <button className="rounded-lg bg-blue-600 text-white px-3 py-1.5 text-sm hover:bg-blue-700" onClick={() => setSelectedNote({ id: null, title: '', content: '<p></p>' })}>New Note</button>
                            </div>
                        </div>
                        {showUpload && (
                            <div className="border rounded-xl p-4">
                                <PDFUpload
                                    onUploadComplete={(doc) => {
                                        setShowUpload(false)
                                        setRefreshTrigger(Date.now())
                                        setSelectedDocument(doc as any)
                                    }}
                                />
                            </div>
                        )}
                        <SearchInput value={query} onChange={setQuery} />
                        <DocumentList onDocumentSelect={(doc) => setSelectedDocument(doc as any)} refreshTrigger={refreshTrigger} />
                        <div className="text-xs font-medium text-gray-500 tracking-wide mt-6">RECENT NOTES</div>
                        <div className="space-y-2">
                            {filteredNotes.map(n => (
                                <NoteCard key={n.id} note={n} selected={selectedNote?.id === n.id} onSelect={(id) => setSelectedNote({ id, title: '', content: '' })} />)
                            )}
                        </div>
                    </div>
                </>
            ) : (
                // Default layout when no PDF is open
                <div className="grid gap-8 xl:grid-cols-[420px_1fr]">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-gray-900">Study Materials</h2>
                            <div className="flex items-center gap-2">
                                <button className="rounded-lg border px-3 py-1.5 text-sm hover:shadow-sm" onClick={() => setShowUpload((v) => !v)}>Upload PDF</button>
                                <button className="rounded-lg bg-blue-600 text-white px-3 py-1.5 text-sm hover:bg-blue-700" onClick={() => setSelectedNote({ id: null, title: '', content: '<p></p>' })}>New Note</button>
                            </div>
                        </div>
                        {showUpload && (
                            <div className="border rounded-xl p-4">
                                <PDFUpload
                                    onUploadComplete={(doc) => {
                                        setShowUpload(false)
                                        setRefreshTrigger(Date.now())
                                        setSelectedDocument(doc as any)
                                    }}
                                />
                            </div>
                        )}
                        <SearchInput value={query} onChange={setQuery} />
                        <DocumentList onDocumentSelect={(doc) => setSelectedDocument(doc as any)} refreshTrigger={refreshTrigger} />
                        <div className="text-xs font-medium text-gray-500 tracking-wide mt-6">RECENT NOTES</div>
                        <div className="space-y-2">
                            {filteredNotes.map(n => (
                                <NoteCard key={n.id} note={n} selected={selectedNote?.id === n.id} onSelect={(id) => setSelectedNote({ id, title: '', content: '' })} />
                            ))}
                        </div>
                    </div>
                    <div>
                        {!selectedNote ? (
                            <div className="h-[calc(100vh-220px)] border rounded-xl grid place-items-center text-center text-gray-500">
                                <div className="space-y-3">
                                    <div className="mx-auto w-16 h-16 rounded-full bg-gray-100 grid place-items-center">📄</div>
                                    <div className="text-lg font-semibold text-gray-900">Start taking notes</div>
                                    <div className="text-sm">Open a document to start reading, or create a note</div>
                                    <button className="rounded-lg bg-blue-600 text-white px-3 py-1.5 text-sm hover:bg-blue-700" onClick={() => setSelectedNote({ id: null, title: '', content: '<p></p>' })}>Create New Note</button>
                                </div>
                            </div>
                        ) : (
                            <NotesEditor
                                key={selectedNote.id ?? 'new'}
                                noteId={selectedNote.id}
                                initialTitle={selectedNote.title || 'Untitled'}
                                initialHTML={selectedNote.content || '<p></p>'}
                                folderId={folderId}
                                onSaved={onSaved}
                                onDelete={deleteNote}
                            />
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
