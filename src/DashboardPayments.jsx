import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'

const PROPERTY_ID = '5a23806a-a9d4-482b-b97f-f37453e2f196'

export default function DashboardPayments() {
  const navigate = useNavigate()
  const [unpaid, setUnpaid] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchUnpaid()
  }, [])

  async function fetchUnpaid() {
    setLoading(true)
    const { data } = await supabase
      .from('cleaning_job')
      .select('*, cleaner(*)')
      .eq('payment_status', 'unpaid')
      .eq('status', 'complete')
      .order('scheduled_date', { ascending: true })
    setUnpaid(data || [])
    setLoading(false)
  }

  if (loading) return null
  if (unpaid.length === 0) return null

  // Group by cleaner
  const byCleaner = unpaid.reduce((acc, job) => {
    const name = job.cleaner?.name || job.worker_name || 'Unknown'
    if (!acc[name]) acc[name] = { jobs: [], total: 0 }
    acc[name].jobs.push(job)
    acc[name].total += parseFloat(job.agreed_rate || 0)
    return acc
  }, {})

  return (
    <section className="section">
      <div className="section-header">
        <h2>Pending Payments</h2>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/payments')}>
          All payments →
        </button>
      </div>

      {Object.entries(byCleaner).map(([name, { jobs, total }]) => (
        <div key={name} className="card" style={{ marginTop: 'var(--spacing-sm)' }}>
          <div className="row-between">
            <div>
              <strong>{name}</strong>
              <p style={{ margin: 'var(--spacing-xs) 0 0', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
                {jobs.length} job{jobs.length > 1 ? 's' : ''} · {jobs.map(j => j.scheduled_date).join(', ')}
              </p>
            </div>
            <strong style={{ color: 'var(--color-warning)' }}>${total.toFixed(2)}</strong>
          </div>
        </div>
      ))}
    </section>
  )
}