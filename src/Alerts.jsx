import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

const PROPERTY_ID = '5a23806a-a9d4-482b-b97f-f37453e2f196'

export default function Alerts() {
    const [reviewReminders, setReviewReminders] = useState([])
    const [coverageWarnings, setCoverageWarnings] = useState([])
    const [loading, setLoading] = useState(true)
    const [gapWarnings, setGapWarnings] = useState([])

    useEffect(() => {
        fetchAlerts()
    }, [])

    async function fetchAlerts() {
        setLoading(true)

        const today = new Date()
        const todayStr = today.toISOString().split('T')[0]

        const fourteenDaysAgo = new Date()
        fourteenDaysAgo.setDate(today.getDate() - 14)
        const fourteenDaysAgoStr = fourteenDaysAgo.toISOString().split('T')[0]

        const fourteenDaysAhead = new Date()
        fourteenDaysAhead.setDate(today.getDate() + 14)
        const fourteenDaysAheadStr = fourteenDaysAhead.toISOString().split('T')[0]

        // Fetch recent checkouts for review reminders
        const { data: recentStays } = await supabase
            .from('stay')
            .select('*')
            .eq('property_id', PROPERTY_ID)
            .eq('archived', false)
            .gte('check_out', fourteenDaysAgoStr)
            .lte('check_out', todayStr)
            .is('reviewed_at', null)
            .in('source', ['airbnb', 'vrbo'])
            .order('check_out', { ascending: false })

        // Fetch upcoming stays with their cleaning jobs
        const { data: upcomingStays } = await supabase
            .from('stay')
            .select('*, cleaning_job(*)')
            .eq('property_id', PROPERTY_ID)
            .eq('archived', false)
            .gt('check_in', todayStr)
            .lte('check_in', fourteenDaysAheadStr)
            .order('check_in', { ascending: true })

        // Fetch all future stays for gap analysis
        const { data: allFutureStays } = await supabase
            .from('stay')
            .select('*, cleaning_job(*)')
            .eq('property_id', PROPERTY_ID)
            .eq('archived', false)
            .gte('check_out', todayStr)
            .order('check_in', { ascending: true })

        // Find consecutive stay pairs with no cleaning coverage
        const gapWarnings = []
        const futureStays = allFutureStays || []

        for (let i = 0; i < futureStays.length - 1; i++) {
            const current = futureStays[i]
            const next = futureStays[i + 1]

            const hasCleaningBetween = (current.cleaning_job || []).some(j =>
                (j.status === 'confirmed' || j.status === 'complete') &&
                j.scheduled_date >= current.check_out &&
                j.scheduled_date <= next.check_in
            )

            if (!hasCleaningBetween) {
                const nextCheckin = new Date(next.check_in)
                const daysUntil = Math.floor((nextCheckin - today) / (1000 * 60 * 60 * 24))
                gapWarnings.push({ current, next, daysUntil })
            }
        }

        // Build review reminders
        const reminders = (recentStays || []).map(stay => {
            const checkoutDate = new Date(stay.check_out)
            const daysAgo = Math.floor((today - checkoutDate) / (1000 * 60 * 60 * 24))
            const daysRemaining = 14 - daysAgo
            return { stay, daysAgo, daysRemaining }
        })

        // Build coverage warnings
        const warnings = (upcomingStays || []).filter(stay => {
            const jobs = stay.cleaning_job || []
            const hasActiveCleaning = jobs.some(j =>
                j.status === 'confirmed' || j.status === 'complete'
            )
            return !hasActiveCleaning
        }).map(stay => {
            const checkinDate = new Date(stay.check_in)
            const daysUntil = Math.floor((checkinDate - today) / (1000 * 60 * 60 * 24))
            return { stay, daysUntil }
        })

        setReviewReminders(reminders)
        setCoverageWarnings(warnings)
        setLoading(false)
        setGapWarnings(gapWarnings)
    }

    async function markReviewed(stayId) {
        await supabase
            .from('stay')
            .update({ reviewed_at: new Date().toISOString() })
            .eq('id', stayId)
        fetchAlerts()
    }

    if (loading) return null
    if (reviewReminders.length === 0 && coverageWarnings.length === 0) return null
    if (reviewReminders.length === 0 && coverageWarnings.length === 0 && gapWarnings.length === 0) return null

    return (
        <section className="section">
            <h2>Alerts</h2>

            {gapWarnings.length > 0 && (
                <div style={{ marginBottom: 'var(--spacing-md)' }}>
                    {gapWarnings.map(({ current, next, daysUntil }) => (
                        <div key={`${current.id}-${next.id}`} className="card" style={{
                            marginTop: 'var(--spacing-sm)',
                            borderLeft: `3px solid ${daysUntil <= 7 ? 'var(--color-danger)' : 'var(--color-warning)'}`,
                        }}>
                            <div className="row-between">
                                <div>
                                    <strong>🧹 No cleaning between stays</strong>
                                    <p style={{ margin: 'var(--spacing-xs) 0 0', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
                                        {current.guest_name || 'Guest'} out {current.check_out} → {next.guest_name || 'Guest'} in {next.check_in}
                                    </p>
                                </div>
                                <span className={`badge ${daysUntil <= 7 ? 'badge-danger' : 'badge-warning'}`}>
                                    {daysUntil === 0 ? 'Today' : daysUntil === 1 ? 'Tomorrow' : `${daysUntil} days`}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {coverageWarnings.length > 0 && (
                <div style={{ marginBottom: 'var(--spacing-md)' }}>
                    {coverageWarnings.map(({ stay, daysUntil }) => (
                        <div key={stay.id} className="card" style={{
                            marginTop: 'var(--spacing-sm)',
                            borderLeft: `3px solid ${daysUntil <= 7 ? 'var(--color-danger)' : 'var(--color-warning)'}`,
                        }}>
                            <div className="row-between">
                                <div>
                                    <strong>⚠️ No cleaning scheduled</strong>
                                    <p style={{ margin: 'var(--spacing-xs) 0 0', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
                                        {stay.guest_name || 'Guest'} checks in {stay.check_in}
                                    </p>
                                </div>
                                <span className={`badge ${daysUntil <= 7 ? 'badge-danger' : 'badge-warning'}`}>
                                    {daysUntil === 0 ? 'Today' : daysUntil === 1 ? 'Tomorrow' : `${daysUntil} days`}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {reviewReminders.length > 0 && (
                <div>
                    {reviewReminders.map(({ stay, daysRemaining }) => (
                        <div key={stay.id} className="card" style={{
                            marginTop: 'var(--spacing-sm)',
                            borderLeft: '3px solid var(--color-primary)',
                        }}>
                            <div className="row-between">
                                <div>
                                    <strong>📝 Review window open</strong>
                                    <p style={{ margin: 'var(--spacing-xs) 0 0', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
                                        {stay.guest_name || 'Guest'} checked out {stay.check_out}
                                    </p>
                                </div>
                                <span className="badge badge-primary">
                                    {daysRemaining === 1 ? 'Last day' : `${daysRemaining} days left`}
                                </span>
                            </div>
                            <div className="row" style={{ marginTop: 'var(--spacing-sm)', flexWrap: 'wrap' }}>
                                {stay.source === 'airbnb' && (
                                    <a href="https://www.airbnb.com/hosting" target="_blank" rel="noreferrer">
                                        <button className="btn btn-secondary btn-sm">Review on Airbnb →</button>
                                    </a>
                                )}
                                {stay.source === 'vrbo' && (
                                    <a href="https://www.vrbo.com/supply/home?propertyId=36359715" target="_blank" rel="noreferrer">
                                        <button className="btn btn-secondary btn-sm">Review on VRBO →</button>
                                    </a>
                                )}
                                <button
                                    className="btn btn-ghost btn-sm"
                                    onClick={() => markReviewed(stay.id)}
                                    style={{ color: 'var(--color-primary)' }}
                                >
                                    ✓ I've Reviewed This Guest
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </section>
    )
}