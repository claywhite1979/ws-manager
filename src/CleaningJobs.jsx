import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

const PROPERTY_ID = '5a23806a-a9d4-482b-b97f-f37453e2f196'

export default function CleaningJobs() {
  const [jobs, setJobs] = useState([])
  const [stays, setStays] = useState([])
  const [cleaners, setCleaners] = useState([])
  const [loading, setLoading] = useState(true)
  const [composedText, setComposedText] = useState(null)

  useEffect(() => {
    fetchAll()
  }, [])

  async function fetchAll() {
    setLoading(true)

    const { data: jobData } = await supabase
      .from('cleaning_job')
      .select('*, stay(*), cleaner(*)')
      .eq('standalone', true)
      .order('scheduled_date', { ascending: false })

    const { data: stayData } = await supabase
      .from('stay')
      .select('*')
      .order('check_out', { ascending: false })

    const { data: cleanerData } = await supabase
      .from('cleaner')
      .select('*')
      .eq('active', true)

    setJobs(jobData || [])
    setStays(stayData || [])
    setCleaners(cleanerData || [])
    setLoading(false)
  }

  async function addJob() {
    if (stays.length === 0) {
      alert('Add a stay first before scheduling a cleaning job.')
      return
    }
    if (cleaners.length === 0) {
      alert('Add a cleaner first before scheduling a cleaning job.')
      return
    }

    const stayOptions = stays.map((s, i) => `${i + 1}. ${s.guest_name || 'Guest'} (out: ${s.check_out})`).join('\n')
    const stayIndex = prompt(`Choose a stay:\n${stayOptions}\nEnter number:`)
    const stay = stays[parseInt(stayIndex) - 1]
    if (!stay) return

    const cleanerOptions = cleaners.map((c, i) => `${i + 1}. ${c.name}`).join('\n')
    const cleanerIndex = prompt(`Assign a cleaner:\n${cleanerOptions}\nEnter number:`)
    const cleaner = cleaners[parseInt(cleanerIndex) - 1]
    if (!cleaner) return

    const scheduled_date = prompt(`Scheduled date (YYYY-MM-DD):\n(Checkout is ${stay.check_out})`)
    if (!scheduled_date) return

    const agreed_rate = prompt(`Agreed rate for this job (default: $${cleaner.default_rate}):`) || cleaner.default_rate

    const { data, error } = await supabase
      .from('cleaning_job')
      .insert([{
        property_id: PROPERTY_ID,
        stay_id: stay.id,
        cleaner_id: cleaner.id,
        scheduled_date,
        agreed_rate,
        status: 'offered',
        standalone: true,
      }])
      .select('*, stay(*), cleaner(*)')
      .single()

    if (!error && data) {
      composeText(data)
    }

    fetchAll()
  }

  function composeText(job) {
    const checkoutDate = job.stay?.check_out || 'TBD'
    const scheduledDate = job.scheduled_date
    const cleanerName = job.cleaner?.name || 'there'
    const jobToken = job.job_token

    const appUrl = `https://whitetailspur.com/job/${jobToken}`

    const message =
      `Hi ${cleanerName}! We'd like to offer you a cleaning job at the property.

Checkout date: ${checkoutDate}
Cleaning date: ${scheduledDate}
Rate: $${job.agreed_rate}

Please review and accept or decline here:
${appUrl}

Reply if you have any questions. Thanks!`

    setComposedText(message)
  }

  async function deleteJob(id) {
    if (!confirm('Remove this cleaning job?')) return
    await supabase.from('cleaning_job').delete().eq('id', id)
    fetchAll()
  }

  if (loading) return <p>Loading jobs...</p>

  return (
    <section className="section">
      <div className="section-header">
        <h2>Standalone Jobs</h2>
        <div className="row">
          <button className="btn btn-ghost btn-sm" onClick={fetchAll}>↻ Refresh</button>
          <button className="btn btn-primary btn-sm" onClick={addJob}>+ Schedule Job</button>
        </div>
      </div>

      {composedText && (
        <div className="alert alert-info" style={{ marginTop: 'var(--spacing-md)' }}>
          <h3 style={{ marginTop: 0, marginBottom: 'var(--spacing-sm)' }}>📱 Ready to Send</h3>
          <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'var(--font-family)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--spacing-sm)' }}>{composedText}</pre>
          <div className="row">
            <button className="btn btn-primary btn-sm" onClick={() => {
              navigator.clipboard.writeText(composedText)
              alert('Copied to clipboard!')
            }}>
              Copy to Clipboard
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setComposedText(null)}>
              Dismiss
            </button>
          </div>
        </div>
      )}

      {jobs.length === 0
        ? <p className="empty-state">No standalone jobs scheduled yet.</p>
        : jobs.map(j => (
          <div key={j.id} className="card" style={{ marginTop: 'var(--spacing-sm)' }}>
            <div className="row-between">
              <div>
                <strong>{j.cleaner?.name || 'Unassigned'}</strong>
                <p style={{ margin: 'var(--spacing-xs) 0 0', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
                  📅 {j.scheduled_date}
                </p>
                <p style={{ margin: 'var(--spacing-xs) 0 0', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
                  🏠 Checkout: {j.stay?.check_out}
                </p>
                <p style={{ margin: 'var(--spacing-xs) 0 0', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
                  💵 ${j.agreed_rate} · {j.payment_status}
                </p>
              </div>
              <div className="col" style={{ alignItems: 'flex-end' }}>
                <span className={`badge ${j.status === 'confirmed' ? 'badge-success' :
                    j.status === 'declined' ? 'badge-danger' :
                      j.status === 'complete' ? 'badge-primary' :
                        j.status === 'in_progress' ? 'badge-warning' :
                          'badge-neutral'
                  }`}>
                  {j.status}
                </span>
                <button className="btn btn-ghost btn-sm" onClick={() => composeText(j)}>
                  Resend Text
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => deleteJob(j.id)}
                  style={{ color: 'var(--color-danger)' }}
                >
                  Remove
                </button>
              </div>
            </div>
            {j.status === 'declined' && (
              <p style={{ marginTop: 'var(--spacing-sm)', fontSize: 'var(--font-size-sm)', color: 'var(--color-danger)', fontWeight: '500' }}>
                ⚠️ Declined — needs reassignment
              </p>
            )}
          </div>
        ))
      }
    </section>
  )
}