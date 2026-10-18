import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'

const PROPERTY_ID = '5a23806a-a9d4-482b-b97f-f37453e2f196'

export default function Supplies() {
  const navigate = useNavigate()
  const [flagged, setFlagged] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchFlagged()
  }, [])

  async function fetchFlagged() {
    setLoading(true)
    const { data } = await supabase
      .from('supply_item')
      .select('*')
      .eq('property_id', PROPERTY_ID)
      .in('current_status', ['low', 'out'])
      .order('current_status', { ascending: true })
    setFlagged(data || [])
    setLoading(false)
  }

  async function resolveItem(id) {
    await supabase
      .from('supply_item')
      .update({ current_status: 'ok' })
      .eq('id', id)
    fetchFlagged()
  }

  if (loading) return null

  return (
    <section className="section">
      <div className="section-header">
        <h2>Supplies</h2>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/supplies')}>
          Manage supplies →
        </button>
      </div>

      {flagged.length === 0 ? (
        <p className="empty-state">No supply issues. All good!</p>
      ) : (
        flagged.map(s => (
          <div key={s.id} className="card" style={{
            marginTop: 'var(--spacing-sm)',
            borderLeft: `3px solid ${s.current_status === 'out' ? 'var(--color-danger)' : 'var(--color-warning)'}`,
          }}>
            <div className="row-between">
              <div>
                <strong>{s.name}</strong>
                <span className={`badge ${s.current_status === 'out' ? 'badge-danger' : 'badge-warning'}`} style={{ marginLeft: 'var(--spacing-sm)' }}>
                  {s.current_status}
                </span>
                {s.category && (
                  <p style={{ margin: 'var(--spacing-xs) 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                    {s.category}
                  </p>
                )}
                {s.par_level_note && (
                  <p style={{ margin: 'var(--spacing-xs) 0 0', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
                    {s.par_level_note}
                  </p>
                )}
              </div>
            </div>
            <div className="row" style={{ marginTop: 'var(--spacing-sm)' }}>
              <button
                className="btn btn-success btn-sm"
                onClick={() => resolveItem(s.id)}
              >
                ✅ Mark Resolved
              </button>
              {s.order_url && (
                <a href={s.order_url} target="_blank" rel="noreferrer">
                  <button className="btn btn-secondary btn-sm">🛒 Order Now</button>
                </a>
              )}
            </div>
          </div>
        ))
      )}
    </section>
  )
}