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
    <section style={{ marginTop: '2rem' }}>
      <h2>📋 Sync Review</h2>
      <p style={{ color: '#666', fontSize: '0.9rem' }}>
        These events were imported but need your review before appearing on the dashboard.
      </p>

      {pending.map(event => (
        <div key={event.id} style={{
          border: '1px solid #ffc107',
          background: '#fffdf0',
          borderRadius: '4px',
          padding: '1rem',
          marginTop: '0.5rem',
        }}>
          <div style={{ marginBottom: '0.5rem' }}>
            <strong>{event.title || 'No title'}</strong>
            <span style={{
              marginLeft: '0.5rem',
              fontSize: '0.8rem',
              color: '#666',
              textTransform: 'uppercase',
            }}>
              {event.source}
            </span>
          </div>
          <p style={{ margin: '0.25rem 0', fontSize: '0.9rem' }}>
            📅 {event.check_in} → {event.check_out}
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
            <button
              onClick={() => classify(event, 'guest')}
              style={{
                padding: '0.4rem 0.75rem',
                background: '#d4edda',
                color: '#155724',
                border: '1px solid #28a745',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '0.85rem',
              }}
            >
              👤 Guest Stay
            </button>
            <button
              onClick={() => classify(event, 'family')}
              style={{
                padding: '0.4rem 0.75rem',
                background: '#cce5ff',
                color: '#004085',
                border: '1px solid #004085',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '0.85rem',
              }}
            >
              🏠 Family Block
            </button>
            <button
              onClick={() => classify(event, 'ignored')}
              style={{
                padding: '0.4rem 0.75rem',
                background: '#f8f9fa',
                color: '#666',
                border: '1px solid #ccc',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.85rem',
              }}
            >
              🗑 Ignore
            </button>
          </div>
        </div>
      ))}
    </section>
  )
}