// Minimal Node HTTP API for ICS token + events
// Dependencies: jsonwebtoken, ical. No logging of tokens, URLs, or event contents.

import http from 'http'
import { parse as parseUrl } from 'url'
import jwt from 'jsonwebtoken'
import ical from 'ical'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env' })
dotenv.config({ path: '.env.local' })

const PORT = process.env.API_PORT ? Number(process.env.API_PORT) : 8787
const ICS_JWT_SECRET = process.env.ICS_JWT_SECRET || ''
const CACHE_TTL_MS = 15 * 60 * 1000 // 15 minutes

// Optional: load .env and .env.local manually if present (no dotenv dependency)
try {
    if (!ICS_JWT_SECRET) {
        const fs = await import('fs')
        const path = await import('path')
        const loadEnv = (baseDir, filename) => {
            const p = path.resolve(baseDir, filename)
            if (!fs.existsSync(p)) return
            const content = fs.readFileSync(p, 'utf-8')
            for (const line of content.split('\n')) {
                const trimmed = line.trim()
                if (!trimmed || trimmed.startsWith('#')) continue
                const eq = trimmed.indexOf('=')
                if (eq > -1) {
                    const key = trimmed.slice(0, eq).trim()
                    const value = trimmed.slice(eq + 1).trim()
                    if (!process.env[key]) process.env[key] = value
                }
            }
        }
        const cwd = process.cwd()
        const parent = path.dirname(cwd)
        for (const dir of [cwd, parent]) {
            loadEnv(dir, '.env')
            loadEnv(dir, '.env.local')
        }
    }
} catch { }

const SECRET = process.env.ICS_JWT_SECRET || ICS_JWT_SECRET

if (!SECRET) {
    // Do not log the secret value, only a helpful message
    console.error('[api] ICS_JWT_SECRET is not set. Add it to frontend/.env or frontend/.env.local')
}

const cache = new Map()

function json(res, status, body) {
    const payload = JSON.stringify(body)
    res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(payload)
    })
    res.end(payload)
}

function parseBody(req) {
    return new Promise((resolve, reject) => {
        let data = ''
        req.on('data', (chunk) => {
            data += chunk
            if (data.length > 1_000_000) {
                req.destroy()
                reject(new Error('payload_too_large'))
            }
        })
        req.on('end', () => {
            try {
                const parsed = data ? JSON.parse(data) : {}
                resolve(parsed)
            } catch (e) {
                reject(new Error('invalid_json'))
            }
        })
    })
}

function validateIcsUrl(url) {
    try {
        const u = new URL(url)
        if (u.protocol !== 'https:') return false
        if (!u.pathname.toLowerCase().endsWith('.ics')) return false
        return true
    } catch {
        return false
    }
}

function toIsoOrNull(d) {
    try { return d ? new Date(d).toISOString() : null } catch { return null }
}

function isAllDay(start, end) {
    if (!start || !end) return false
    try {
        const s = new Date(start)
        const e = new Date(end)
        const duration = e.getTime() - s.getTime()
        const isMidnight = s.getUTCHours() === 0 && s.getUTCMinutes() === 0 && s.getUTCSeconds() === 0
        const isDayMultiple = duration % (24 * 60 * 60 * 1000) === 0
        return isMidnight && isDayMultiple
    } catch { return false }
}

function normalizeEvents(icsText) {
    const parsed = ical.parseICS(icsText)
    const events = []
    for (const key in parsed) {
        const item = parsed[key]
        if (!item || item.type !== 'VEVENT') continue
        const start = item.start ? new Date(item.start) : null
        const end = item.end ? new Date(item.end) : null
        const evt = {
            id: String(item.uid || key || (start ? start.getTime() : Math.random())),
            title: String(item.summary || 'Untitled'),
            description: String(item.description || ''),
            location: String(item.location || ''),
            start: toIsoOrNull(start),
            end: toIsoOrNull(end),
            url: item.url ? String(item.url) : null,
            allDay: isAllDay(start, end),
        }
        events.push(evt)
    }
    events.sort((a, b) => {
        if (!a.start && !b.start) return 0
        if (!a.start) return 1
        if (!b.start) return -1
        return new Date(a.start).getTime() - new Date(b.start).getTime()
    })
    return events
}

async function fetchIcsWithTimeout(url, timeoutMs = 10_000) {
    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), timeoutMs)
    try {
        const res = await fetch(url, {
            method: 'GET',
            redirect: 'error',
            signal: controller.signal,
            headers: { 'Accept': 'text/calendar, text/plain, */*' }
        })
        if (!res.ok) throw new Error('bad_status')
        const text = await res.text()
        return text
    } finally {
        clearTimeout(t)
    }
}

const server = http.createServer(async (req, res) => {
    const { pathname, query } = parseUrl(req.url || '', true)

    // CORS for local dev only
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173')
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }

    if (pathname === '/api/health' && req.method === 'GET') {
        return json(res, 200, { status: 'ok', secret: Boolean(SECRET) })
    }

    // Tasks CRUD (requires Supabase auth via Authorization: Bearer <access_token>)
    if (pathname && pathname.startsWith('/api/calendar/tasks')) {
        const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
        const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
        if (!supabaseUrl || !supabaseAnonKey) {
            return json(res, 500, { error: 'server_not_configured' })
        }

        // Extract JWT from Authorization header or cookies
        const getJwt = () => {
            const authHeader = Array.isArray(req.headers['authorization']) ? req.headers['authorization'][0] : req.headers['authorization']
            if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
                return authHeader.slice(7)
            }
            const cookie = Array.isArray(req.headers['cookie']) ? req.headers['cookie'].join(';') : (req.headers['cookie'] || '')
            if (cookie) {
                const parts = Object.fromEntries(cookie.split(';').map(c => {
                    const i = c.indexOf('=');
                    const k = c.slice(0, i).trim();
                    const v = decodeURIComponent(c.slice(i + 1));
                    return [k, v]
                }))
                if (parts['sb-access-token']) return parts['sb-access-token']
                if (parts['supabase-auth-token']) {
                    try {
                        const parsed = JSON.parse(parts['supabase-auth-token'])
                        if (parsed?.currentSession?.access_token) return parsed.currentSession.access_token
                        if (parsed?.access_token) return parsed.access_token
                    } catch { }
                }
            }
            return ''
        }

        const accessToken = getJwt()
        if (!accessToken) return json(res, 401, { error: 'unauthorized' })

        const supabase = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: `Bearer ${accessToken}` } },
        })
        const { data: userRes } = await supabase.auth.getUser()
        const user = userRes?.user
        if (!user) return json(res, 401, { error: 'unauthorized' })

        // Parse id if present
        const parts = pathname.split('/').filter(Boolean) // [api, calendar, tasks, id?]
        const id = parts[3]

        // Helpers for from/to with defaults (next 30 days)
        const parseIsoOrNull = (s) => { try { return s ? new Date(s).toISOString() : null } catch { return null } }
        const fromParam = typeof query?.from === 'string' ? parseIsoOrNull(query.from) : null
        const toParam = typeof query?.to === 'string' ? parseIsoOrNull(query.to) : null
        const now = new Date()
        const defaultFrom = new Date(now.getTime())
        const defaultTo = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
        const fromIso = fromParam || defaultFrom.toISOString()
        const toIso = toParam || defaultTo.toISOString()

        if (req.method === 'GET' && (!id || id === '')) {
            try {
                let q = supabase
                    .from('tasks')
                    .select('*')
                    .order('due_at', { ascending: true })
                if (fromIso) q = q.gte('due_at', fromIso)
                if (toIso) q = q.lte('due_at', toIso)
                const { data, error } = await q
                if (error) return json(res, 500, { error: 'db_error' })
                return json(res, 200, { tasks: data || [] })
            } catch {
                return json(res, 500, { error: 'unknown' })
            }
        }

        if (req.method === 'POST' && (!id || id === '')) {
            try {
                const body = await parseBody(req)
                const title = typeof body?.title === 'string' ? body.title.trim() : ''
                const due_at = typeof body?.due_at === 'string' ? body.due_at : null
                const document_id = typeof body?.document_id === 'string' ? body.document_id : null
                if (!title) return json(res, 400, { error: 'invalid_title' })
                const payload = { title, due_at, document_id }
                const { data, error } = await supabase.from('tasks').insert(payload).select('*').single()
                if (error) return json(res, 500, { error: 'db_error' })
                return json(res, 200, { task: data })
            } catch {
                return json(res, 400, { error: 'bad_request' })
            }
        }

        if (req.method === 'PATCH' && id) {
            try {
                const body = await parseBody(req)
                const update = {}
                if (typeof body?.title === 'string') update.title = body.title.trim()
                if (typeof body?.due_at === 'string' || body?.due_at === null) update.due_at = body.due_at
                if (typeof body?.status === 'string') update.status = body.status
                if (typeof body?.document_id === 'string' || body?.document_id === null) update.document_id = body.document_id
                const { data, error } = await supabase.from('tasks').update(update).eq('id', id).select('*').single()
                if (error) return json(res, 500, { error: 'db_error' })
                return json(res, 200, { task: data })
            } catch {
                return json(res, 400, { error: 'bad_request' })
            }
        }

        if (req.method === 'DELETE' && id) {
            const { error } = await supabase.from('tasks').delete().eq('id', id)
            if (error) return json(res, 500, { error: 'db_error' })
            return json(res, 200, { ok: true })
        }

        // Method not allowed or route not found
        res.writeHead(404, { 'Content-Type': 'application/json' })
        return res.end('{"error":"not_found"}')
    }

    if (pathname === '/api/feeds/token' && req.method === 'POST') {
        if (!SECRET) return json(res, 500, { error: 'server_not_configured' })
        try {
            const body = await parseBody(req)
            const url = typeof body?.url === 'string' ? body.url.trim() : ''
            if (!validateIcsUrl(url)) return json(res, 400, { error: 'invalid_url' })
            const token = jwt.sign({ url }, SECRET, { expiresIn: '24h' })
            return json(res, 200, { token })
        } catch (e) {
            return json(res, 400, { error: 'bad_request' })
        }
    }

    if (pathname === '/api/feeds/events' && req.method === 'GET') {
        const token = typeof query?.token === 'string' ? query.token : ''
        if (!token) return json(res, 401, { error: 'unauthorized' })
        try {
            const decoded = jwt.verify(token, SECRET)
            const url = typeof decoded === 'object' && decoded && 'url' in decoded ? decoded.url : ''
            if (typeof url !== 'string' || !validateIcsUrl(url)) return json(res, 401, { error: 'unauthorized' })

            const now = Date.now()
            const hit = cache.get(token)
            if (hit && now - hit.ts < CACHE_TTL_MS) {
                return json(res, 200, { events: hit.events })
            }

            let icsText = ''
            try {
                icsText = await fetchIcsWithTimeout(url)
            } catch {
                return json(res, 502, { error: 'upstream_unavailable' })
            }

            let events = []
            try {
                events = normalizeEvents(icsText)
            } catch {
                return json(res, 500, { error: 'parse_failed' })
            }

            cache.set(token, { ts: now, events })
            return json(res, 200, { events })
        } catch {
            return json(res, 401, { error: 'unauthorized' })
        }
    }

    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end('{"error":"not_found"}')
})

server.listen(PORT)


