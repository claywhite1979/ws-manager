import { useState } from 'react'
import { supabase } from './supabaseClient'

const PROPERTY_ID = '5a23806a-a9d4-482b-b97f-f37453e2f196'

const ICAL_SOURCES = [
    { key: 'airbnb', label: 'Airbnb', url: import.meta.env.VITE_AIRBNB_ICAL_URL },
    { key: 'vrbo', label: 'VRBO', url: import.meta.env.VITE_VRBO_ICAL_URL },
]

export default function ICalSync({ onSync }) {
    const [syncing, setSyncing] = useState(false)
    const [results, setResults] = useState(null)

    async function syncAll() {
        setSyncing(true)
        setResults(null)
        const summary = []

        for (const source of ICAL_SOURCES) {
            if (!source.url) {
                summary.push({ source: source.label, skipped: true, reason: 'No URL configured' })
                continue
            }

            try {
                const response = await fetch(
                    `/.netlify/functions/fetch-ical?url=${encodeURIComponent(source.url)}`
                )

                if (!response.ok) throw new Error(`HTTP ${response.status}`)

                const text = await response.text()
                const events = parseICal(text)
                let added = 0
                let skipped = 0

                for (const event of events) {
                    if (!event.start || !event.end) continue
                    if (event.summary?.toLowerCase().includes('blocked')) continue
                    const today = new Date()
                    const cutoff = new Date()
                    cutoff.setDate(today.getDate() - 30)
                    const checkOut = new Date(event.end)
                    if (checkOut < cutoff) continue

                    const { data: existing } = await supabase
                        .from('stay')
                        .select('id')
                        .eq('property_id', PROPERTY_ID)
                        .eq('check_in', event.start)
                        .eq('check_out', event.end)
                        .eq('source', source.key)
                        .single()

                    if (existing) {
                        skipped++
                        continue
                    }

                    await supabase
                        .from('stay')
                        .insert([{
                            property_id: PROPERTY_ID,
                            check_in: event.start,
                            check_out: event.end,
                            guest_name: event.summary || 'Guest',
                            source: source.key,
                        }])

                    added++
                }

                summary.push({ source: source.label, added, skipped })
            } catch (err) {
                summary.push({ source: source.label, error: err.message })
            }
        }

        setResults(summary)
        if (onSync) onSync()
        setSyncing(false)
    }

    function parseICal(text) {
        const events = []
        const lines = text.replace(/\r\n /g, '').split(/\r\n|\n/)
        let current = null

        for (const line of lines) {
            if (line === 'BEGIN:VEVENT') {
                current = {}
            } else if (line === 'END:VEVENT') {
                if (current) events.push(current)
                current = null
            } else if (current) {
                if (line.startsWith('DTSTART')) {
                    current.start = parseDate(line.split(':')[1])
                } else if (line.startsWith('DTEND')) {
                    current.end = parseDate(line.split(':')[1])
                } else if (line.startsWith('SUMMARY')) {
                    current.summary = line.split(':').slice(1).join(':').trim()
                }
            }
        }

        return events
    }

    function parseDate(raw) {
        if (!raw) return null
        const clean = raw.replace(/T.*$/, '').trim()
        if (clean.length !== 8) return null
        return `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}`
    }

    return (
        <section style={{ marginTop: '2rem' }}>
            <h2>Calendar Sync</h2>
            <p style={{ color: '#666', fontSize: '0.9rem' }}>
                Imports bookings from Airbnb and VRBO into your stays list.
            </p>
            <button
                onClick={syncAll}
                disabled={syncing}
                style={{ padding: '0.5rem 1rem', cursor: 'pointer' }}
            >
                {syncing ? '⏳ Syncing...' : '🔄 Sync Now'}
            </button>

            {results && (
                <div style={{ marginTop: '1rem' }}>
                    {results.map((r, i) => (
                        <div key={i} style={{
                            padding: '0.75rem',
                            marginTop: '0.5rem',
                            borderRadius: '4px',
                            background: r.error ? '#f8d7da' : '#d4edda',
                            color: r.error ? '#721c24' : '#155724',
                        }}>
                            <strong>{r.source}</strong>
                            {r.error && <span> — Error: {r.error}</span>}
                            {r.skipped && r.reason && <span> — {r.reason}</span>}
                            {!r.error && r.added !== undefined && (
                                <span> — {r.added} added, {r.skipped} already existed</span>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </section>
    )
}