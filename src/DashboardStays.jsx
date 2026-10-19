import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import { FLAG_DEFINITIONS } from './StayFlags'

const PROPERTY_ID = '5a23806a-a9d4-482b-b97f-f37453e2f196'

const AIRBNB_REVIEW_URL = 'https://www.airbnb.com/hosting'
const VRBO_REVIEW_URL = 'https://www.vrbo.com/supply/home?propertyId=36359715'

export default function DashboardStays() {
    const navigate = useNavigate()
    const [nextStays, setNextStays] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchNextStays()
    }, [])

    async function fetchNextStays() {
        setLoading(true)
        const today = new Date().toISOString().split('T')[0]

        const { data } = await supabase
            .from('stay')
            .select('*, cleaning_job(*)')
            .eq('property_id', PROPERTY_ID)
            .eq('archived', false)
            .gte('check_out', today)
            .order('check_in', { ascending: true })
            .limit(3)

        setNextStays(data || [])
        setLoading(false)
    }

    function getCleaningStatus(stay) {
        const jobs = stay.cleaning_job || []
        const active = jobs.find(j => j.status === 'confirmed' || j.status === 'complete')
        if (!active) return { label: 'No cleaning scheduled', color: 'badge-danger' }
        if (active.status === 'complete') return { label: `Cleaned ${active.scheduled_date}`, color: 'badge-success' }
        return { label: `Cleaning ${active.scheduled_date}`, color: 'badge-warning' }
    }

    function getDaysUntil(dateStr) {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const [year, month, day] = dateStr.split('-').map(Number)
        const date = new Date(year, month - 1, day)
        const days = Math.floor((date - today) / (1000 * 60 * 60 * 24))
        if (days === 0) return 'Today'
        if (days === 1) return 'Tomorrow'
        if (days < 0) return 'Checked in'
        return `In ${days} days`
    }

    function getActiveFlags(stay) {
        const flags = stay.flags || []
        return FLAG_DEFINITIONS.filter(f => flags.includes(f.key))
    }

    if (loading) return null
    if (nextStays.length === 0) return (
        <section className="section">
            <div className="section-header">
                <h2>Upcoming Stays</h2>
                <button className="btn btn-ghost btn-sm" onClick={() => navigate('/stays')}>
                    All stays →
                </button>
            </div>
            <p className="empty-state">No upcoming stays.</p>
        </section>
    )

    return (
        <section className="section">
            <div className="section-header">
                <h2>Upcoming Stays</h2>
                <button className="btn btn-ghost btn-sm" onClick={() => navigate('/stays')}>
                    All stays →
                </button>
            </div>

            {nextStays.map(stay => {
                const cleaning = getCleaningStatus(stay)
                const activeFlags = getActiveFlags(stay)
                const daysUntil = getDaysUntil(stay.check_in)

                return (
                    <div
                        key={stay.id}
                        className="card"
                        style={{ marginTop: 'var(--spacing-sm)', cursor: 'pointer' }}
                        onClick={() => navigate(`/stays#${stay.id}`)}
                    >
                        <div className="row-between">
                            <div style={{ flex: 1 }}>
                                <div className="row" style={{ flexWrap: 'wrap', gap: 'var(--spacing-xs)', marginBottom: 'var(--spacing-xs)' }}>
                                    <strong>{stay.guest_name || 'Guest'}</strong>
                                    <span className="badge badge-neutral">{stay.source}</span>
                                    <span className={`badge ${daysUntil === 'Today' || daysUntil === 'Tomorrow' ? 'badge-danger' :
                                            daysUntil === 'Checked in' ? 'badge-success' :
                                                'badge-neutral'
                                        }`}>
                                        {daysUntil}
                                    </span>
                                </div>
                                <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
                                    {stay.check_in} → {stay.check_out}
                                </p>
                                <div className="row" style={{ flexWrap: 'wrap', gap: 'var(--spacing-xs)', marginTop: 'var(--spacing-xs)' }}>
                                    <span className={`badge ${cleaning.color}`}>
                                        {cleaning.label}
                                    </span>
                                    {activeFlags.map(flag => (
                                        <span key={flag.key} className={`badge ${flag.color}`}>
                                            {flag.label}
                                        </span>
                                    ))}
                                </div>
                            </div>
                            <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-lg)' }}>›</span>
                        </div>
                    </div>
                )
            })}
        </section>
    )
}