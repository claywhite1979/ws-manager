import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

const PROPERTY_ID = '5a23806a-a9d4-482b-b97f-f37453e2f196'

export default function SyncReview({ onReviewed }) {
  const [pending, setPending] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchPending()
  }, [])

  async function fetchPending() {
    setLoading(true)
    const { data } = await supabase
      .from('ical_event')
      .select('*')
      .eq('property_id', PROPERTY_ID)
      .eq('status', 'pending')
      .order('check_in', { ascending: true })
    setPending(data || [])
    setLoading(false)
  }

  async function classify(event, classification) {
    if (classification === 'guest' || classification === 'family') {
      const { data: stay } = await supabase
        .from('stay')
        .insert([{
          property_id: PROPERTY_ID,
          check_in: event.check_in,
          check_out: event.check_out,
          guest_name: classification === 'family' ? 'Family Block' : event.title,
          source: classification === 'family' ? 'direct' : event.source,
        }])
        .select()
        .single()

      await supabase
        .from('ical_event')
        .update({ status: classification, stay_id: stay?.id || null })
        .eq('id', event.id)
    } else {
      await supabase
        .from('ical_event')
        .update({ status: 'ignored' })
        .eq('id', event.id)
    }

    setPending(prev => prev.filter(e => e.id !== event.id))
    if (onReviewed) onReviewed()
  }

  if (loading) return null
  if (pending.length === 0) return null

  return (
    <section className="section">
      <div className="section-header">
        <h2>Sync Review</h2>
      </div>
      <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--spacing-md)' }}>
        These events were imported but need your review before appearing on the dashboard.
      </p>

      {pending.map(event => (
        <div key={event.id} className="card" style={{ marginTop: 'var(--spacing-sm)', borderLeft: '3px solid var(--color-warning)' }}>
          <div className="row-between" style={{ marginBottom: 'var(--spacing-xs)' }}>
            <div>
              <strong>{event.title || 'No title'}</strong>
              <span className="badge badge-neutral" style={{ marginLeft: 'var(--spacing-sm)' }}>
                {event.source}
              </span>
            </div>
          </div>
          <p style={{ margin: 'var(--spacing-xs) 0', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
            {event.check_in} → {event.check_out}
          </p>
          <div className="row" style={{ marginTop: 'var(--spacing-sm)', flexWrap: 'wrap' }}>
            <button
              className="btn btn-success btn-sm"
              onClick={() => classify(event, 'guest')}
            >
              Guest Stay
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => classify(event, 'family')}
            >
              Family Block
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => classify(event, 'ignored')}
            >
              Ignore
            </button>
          </div>
        </div>
      ))}
    </section>
  )
}