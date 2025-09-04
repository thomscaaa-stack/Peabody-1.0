import React, { useCallback, useEffect, useRef, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { createLowlight, common } from 'lowlight'
import { supabase } from '@/lib/supabase'
import 'prosemirror-view/style/prosemirror.css'

export interface NotesEditorProps {
    noteId?: string | null
    folderId?: string | null
    initialTitle?: string
    initialHTML?: string
    onSaved?: (id: string, title: string, html: string) => void
    onDelete?: () => void
}

export default function NotesEditor({ noteId, folderId, initialTitle = '', initialHTML = '', onSaved, onDelete }: NotesEditorProps) {
    const [title, setTitle] = useState(initialTitle)
    const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
    const saveTimer = useRef<number | undefined>(undefined)

    // track current note id to prevent cross-note overwrites
    const noteIdRef = useRef<string | null>(noteId ?? null)
    useEffect(() => { noteIdRef.current = noteId ?? null }, [noteId])

    // track which note's content is loaded in the editor
    const loadedNoteIdRef = useRef<string | null>(null)

    const lowlight = createLowlight(common)

    const editor = useEditor({
        extensions: [
            StarterKit.configure({ codeBlock: false, link: false }),
            Link.configure({ openOnClick: false }),
            CodeBlockLowlight.configure({ lowlight }),
            Placeholder.configure({ placeholder: 'Write your notes…' }),
        ],
        content: initialHTML,
    })

    // Rehydrate when switching notes, without stomping while typing
    useEffect(() => {
        if (!editor) return
        const current = noteId ?? null
        const changedId = loadedNoteIdRef.current !== current
        const editorEmpty = editor.getText().trim() === ''

        if (changedId) {
            editor.commands.setContent(initialHTML || '<p></p>')
            setTitle(initialTitle || 'Untitled')
            loadedNoteIdRef.current = current
        } else if (editorEmpty && (initialHTML && initialHTML !== '<p></p>')) {
            // Same note, content just arrived from fetch → hydrate once
            editor.commands.setContent(initialHTML)
            setTitle(initialTitle || 'Untitled')
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [noteId, initialHTML, initialTitle, editor])

    const persist = useCallback(async (t: string, html: string) => {
        const currentId = noteIdRef.current
        if (!currentId) {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return
            const { data, error } = await supabase
                .from('notes')
                .insert({ user_id: user.id, folder_id: folderId ?? null, title: t || 'Untitled', content_html: html })
                .select('id')
                .single()
            if (!error && data) {
                noteIdRef.current = data.id
                loadedNoteIdRef.current = data.id
                onSaved?.(data.id, t, html)
            }
            return
        }
        const { error } = await supabase
            .from('notes')
            .update({ title: t || 'Untitled', content_html: html, updated_at: new Date().toISOString() })
            .eq('id', currentId)
        if (!error) {
            onSaved?.(currentId, t, html)
        }
    }, [folderId, onSaved])

    const debouncedSave = useCallback(() => {
        if (!editor) return
        setStatus('saving')
        const html = editor.getHTML()
        const t = title
        window.clearTimeout(saveTimer.current)
        saveTimer.current = window.setTimeout(async () => {
            await persist(t, html)
            setStatus('saved')
        }, 800)
    }, [editor, title, persist])

    // Save immediately when title changes
    const handleTitleChange = useCallback((newTitle: string) => {
        setTitle(newTitle)
        if (!editor) return
        setStatus('saving')
        const html = editor.getHTML()
        window.clearTimeout(saveTimer.current)
        saveTimer.current = window.setTimeout(async () => {
            await persist(newTitle, html)
            setStatus('saved')
        }, 500) // Faster save for title changes
    }, [editor, persist])

    // Save on blur for immediate feedback
    const handleTitleBlur = useCallback(() => {
        if (!editor) return
        const html = editor.getHTML()
        persist(title, html)
        setStatus('saved')
    }, [editor, title, persist])

    useEffect(() => {
        if (!editor) return
        const handler = () => debouncedSave()
        editor.on('update', handler)
        return () => {
            editor?.off('update', handler)
            window.clearTimeout(saveTimer.current)
        }
    }, [editor, debouncedSave])

    return (
        <div className="flex flex-col h-[calc(100vh-220px)] border rounded-xl bg-white">
            <div className="p-4 border-b">
                <div className="flex items-center justify-between">
                    <input
                        value={title}
                        onChange={(e) => handleTitleChange(e.target.value)}
                        onBlur={handleTitleBlur}
                        placeholder="Untitled"
                        className="flex-1 text-lg font-semibold text-gray-900 placeholder:text-gray-400 focus:outline-none"
                        aria-label="Note title"
                    />
                    {noteId && onDelete && (
                        <button
                            onClick={onDelete}
                            className="ml-2 px-3 py-1 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                        >
                            Delete
                        </button>
                    )}
                </div>
                <div className="mt-1 text-xs text-gray-500" aria-live="polite">
                    {status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved' : ''}
                </div>
            </div>

            <div className="sticky top-0 z-10 bg-white border-b p-2 flex gap-2 flex-wrap">
                {/* Minimal toolbar using document.execCommand fallbacks for brevity */}
                <button className="px-2 py-1 text-sm rounded-lg border" onClick={() => editor?.chain().focus().toggleBold().run()} aria-pressed={editor?.isActive('bold')}>B</button>
                <button className="px-2 py-1 text-sm rounded-lg border" onClick={() => editor?.chain().focus().toggleItalic().run()} aria-pressed={editor?.isActive('italic')}>I</button>
                <button className="px-2 py-1 text-sm rounded-lg border" onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()} aria-pressed={editor?.isActive('heading', { level: 1 })}>H1</button>
                <button className="px-2 py-1 text-sm rounded-lg border" onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} aria-pressed={editor?.isActive('heading', { level: 2 })}>H2</button>
                <button className="px-2 py-1 text-sm rounded-lg border" onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()} aria-pressed={editor?.isActive('heading', { level: 3 })}>H3</button>
                <button className="px-2 py-1 text-sm rounded-lg border" onClick={() => editor?.chain().focus().toggleBulletList().run()} aria-pressed={editor?.isActive('bulletList')}>• List</button>
                <button className="px-2 py-1 text-sm rounded-lg border" onClick={() => editor?.chain().focus().toggleOrderedList().run()} aria-pressed={editor?.isActive('orderedList')}>1. List</button>
                <button className="px-2 py-1 text-sm rounded-lg border" onClick={() => editor?.chain().focus().toggleCodeBlock().run()} aria-pressed={editor?.isActive('codeBlock')}>Code</button>
                <button className="px-2 py-1 text-sm rounded-lg border" onClick={() => editor?.chain().focus().setLink({ href: prompt('Link URL') || '' }).run()}>Link</button>
            </div>

            <div className="flex-1 overflow-auto p-4">
                <EditorContent editor={editor} className="prose max-w-none" />
            </div>
        </div>
    )
}
