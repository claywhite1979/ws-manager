import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

const PROPERTY_ID = '5a23806a-a9d4-482b-b97f-f37453e2f196'

const ICAL_SOURCES = [
    { key: 'airbnb', label: 'Airbnb', url: import.meta.env.VITE_AIRBNB_ICAL_URL },
    { key: 'vrbo', label: 'VRBO', url: import.meta.env.VITE_VRBO_ICAL_URL },
]

const REAL_BOOKING_PATTERNS = [
    /^reserved/i,
]

function isRealBooking(title) {
    if (!title) return false
    return REAL_BOOKING_PATTERNS.some(pattern => pattern.test(title.trim()))
}

export default function ICalSync({ onSync, autoSync = false }) {
    const [syncing, setSyncing] = useState(false)
    const [results, setResults] = useState(null)

    useEffect(() => {
        if (!autoSync) return
        const lastSync = localStorage.getItem('lastSync')
        if (!lastSync) {
            syncAll()
            return
        }
        const hoursSinceSync = (new Date() - new Date(lastSync)) / (1000 * 60 * 60)
        if (hoursSinceSync >= 24) {
            syncAll()
        }
    }, [])

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
                const seenUids = new Set(events.map(e => e.uid).filter(Boolean))
                let added = 0
                let pending = 0
                let skipped = 0

                const today = new Date()
                const cutoff = new Date()
                const horizon = new Date()
                cutoff.setDate(today.getDate() - 30)
                horizon.setDate(today.getDate() + 364)

                for (const event of events) {
                    if (!event.start || !event.end || !event.uid) continue
                    if (event.summary?.toLowerCase().includes('not available')) continue

                    const checkOut = new Date(event.end)
                    const checkIn = new Date(event.start)
                    if (checkOut < cutoff) continue
                    if (checkIn > horizon) continue

                    // Check if we've already processed this UID
                    const { data: existing } = await supabase
                        .from('ical_event')
                        .select('id, status')
                        .eq('uid', event.uid)
                        .eq('source', source.key)
                        .single()

                    if (existing) {
                        skipped++
                        continue
                    }

                    if (isRealBooking(event.summary)) {
                        const { data: stay } = await supabase
                            .from('stay')
                            .insert([{
                                property_id: PROPERTY_ID,
                                check_in: event.start,
                                check_out: event.end,
                                guest_name: event.summary,
                                source: source.key,
                                ical_uid: event.uid,
                            }])
                            .select()
                            .single()

                        await supabase
                            .from('ical_event')
                            .insert([{
                                property_id: PROPERTY_ID,
                                uid: event.uid,
                                source: source.key,
                                title: event.summary,
                                check_in: event.start,
                                check_out: event.end,
                                status: 'guest',
                                stay_id: stay?.id || null,
                            }])

                        added++
                    } else {
                        // Hold for review
                        await supabase
                            .from('ical_event')
                            .insert([{
                                property_id: PROPERTY_ID,
                                uid: event.uid,
                                source: source.key,
                                title: event.summary,
                                check_in: event.start,
                                check_out: event.end,
                                status: 'pending',
                            }])

                        pending++
                    }
                }

                let missing = 0
                const todayStr = new Date().toLocaleDateString('en-CA')
                const horizonStr = horizon.toLocaleDateString('en-CA')

                // Only compare against the feed if it actually returned events
                if (events.length > 0) {
                    const { data: tracked } = await supabase
                        .from('ical_event')
                        .select('uid, stay_id')
                        .eq('property_id', PROPERTY_ID)
                        .eq('source', source.key)
                        .in('status', ['guest', 'family'])
                        .not('stay_id', 'is', null)
                        .gte('check_out', todayStr)
                        .lte('check_in', horizonStr)

                    for (const t of tracked || []) {
                        if (seenUids.has(t.uid)) {
                            // Back in the feed, so clear any earlier flag
                            await supabase
                                .from('stay')
                                .update({ feed_missing_at: null })
                                .eq('id', t.stay_id)
                                .not('feed_missing_at', 'is', null)
                        } else {
                            // Not in the feed, so flag it (only stamps if not already flagged)
                            await supabase
                                .from('stay')
                                .update({ feed_missing_at: new Date().toISOString() })
                                .eq('id', t.stay_id)
                                .is('feed_missing_at', null)
                            missing++
                        }
                    }
                }

                summary.push({ source: source.label, added, pending, skipped, missing })
            } catch (err) {
                summary.push({ source: source.label, error: err.message })
            }
        }

        setResults(summary)
        if (onSync) onSync()
        localStorage.setItem('lastSync', new Date().toISOString())
        setSyncing(false)
    }

    function parseICal(text) {
        const events = []
        const lines = unfoldLines(text)
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
                } else if (line.startsWith('UID')) {
                    current.uid = line.split(':').slice(1).join(':').trim()
                }
            }
        }

        return events
    }

    function unfoldLines(text) {
        return text
            .replace(/\r\n /g, '')
            .replace(/\r\n\t/g, '')
            .split(/\r\n|\n/)
    }

    function parseDate(raw) {
        if (!raw) return null
        const clean = raw.replace(/T.*$/, '').trim()
        if (clean.length !== 8) return null
        return `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}`
    }

    return (
        <section className="section">
            <div className="section-header">
                <h2>Calendar Sync</h2>
                <button
                    className="btn btn-primary btn-sm"
                    onClick={syncAll}
                    disabled={syncing}
                >
                    {syncing ? '⏳ Syncing...' : '🔄 Sync Now'}
                </button>
            </div>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--spacing-md)' }}>
                Imports bookings from Airbnb and VRBO. Real bookings are added automatically; ambiguous events are held for your review.
            </p>

            {results && (
                <div style={{ marginTop: 'var(--spacing-md)' }}>
                    {results.map((r, i) => (
                        <div key={i} className={`alert ${r.error ? 'alert-danger' : 'alert-success'}`} style={{ marginTop: 'var(--spacing-xs)' }}>
                            <strong>{r.source}</strong>
                            {r.error && <span> — Error: {r.error}</span>}
                            {r.reason && <span> — {r.reason}</span>}
                            {!r.error && !r.reason && (
                                <span> — {r.added} added, {r.pending} pending review, {r.skipped} already processed{r.missing > 0 && `, ${r.missing} missing from feed`}</span>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </section>
    )
}