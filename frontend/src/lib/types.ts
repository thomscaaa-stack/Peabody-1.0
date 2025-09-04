export interface Folder {
    id: string
    user_id: string
    title: string
    created_at: string
    updated_at: string
}

export interface DocumentRow {
    id: string
    user_id: string
    title?: string | null
    file_name: string
    file_size?: number | null
    created_at: string
    updated_at: string
}

export interface NoteRow {
    id: string
    user_id?: string
    folder_id?: string | null
    title: string | null
    content_html: string | null
    created_at: string
    updated_at: string
}
