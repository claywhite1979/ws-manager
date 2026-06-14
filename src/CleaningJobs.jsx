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

    const appUrl = `http://localhost:5173/job/${jobToken}`

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
    <section style={{ marginTop: '2rem' }}>
      <h2>Cleaning Jobs</h2>
      <button onClick={fetchAll} style={{ marginLeft: '1rem' }}>↻ Refresh</button>
      <button onClick={addJob}>+ Schedule Job</button>

      {composedText && (
        <div style={{ marginTop: '1rem', padding: '1rem', background: '#f0f7ff', border: '1px solid #b3d4ff', borderRadius: '4px' }}>
          <h3 style={{ marginTop: 0 }}>📱 Ready to Send</h3>
          <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'sans-serif' }}>{composedText}</pre>
          <button onClick={() => {
            navigator.clipboard.writeText(composedText)
            alert('Copied to clipboard!')
          }}>
            Copy to Clipboard
          </button>
          <button onClick={() => setComposedText(null)} style={{ marginLeft: '1rem' }}>
            Dismiss
          </button>
        </div>
      )}

      {jobs.length === 0
        ? <p>No jobs scheduled yet.</p>
        : jobs.map(j => (
          <div key={j.id} style={{ border: '1px solid #ccc', padding: '1rem', marginTop: '0.5rem', borderRadius: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <strong>🧹 {j.cleaner?.name || 'Unassigned'}</strong>
              <span style={{
                padding: '0.25rem 0.75rem',
                borderRadius: '999px',
                fontSize: '0.8rem',
                fontWeight: 'bold',
                background:
                  j.status === 'confirmed' ? '#d4edda' :
                    j.status === 'declined' ? '#f8d7da' :
                      j.status === 'complete' ? '#cce5ff' :
                        j.status === 'in_progress' ? '#fff3cd' :
                          '#e2e3e5',
                color:
                  j.status === 'confirmed' ? '#155724' :
                    j.status === 'declined' ? '#721c24' :
                      j.status === 'complete' ? '#004085' :
                        j.status === 'in_progress' ? '#856404' :
                          '#383d41'
              }}>
                {j.status}
              </span>
            </div>
            <p>📅 Scheduled: {j.scheduled_date}</p>
            <p>🏠 Stay checkout: {j.stay?.check_out}</p>
            <p>💵 Rate: ${j.agreed_rate}</p>
            <p>Payment: {j.payment_status}</p>
            {j.status === 'declined' && (
              <p style={{ color: '#721c24', fontWeight: 'bold' }}>⚠️ Declined — needs reassignment</p>
            )}
            <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem' }}>
              <button onClick={() => composeText(j)}>
                📱 Compose Text
              </button>
              <button
                onClick={() => deleteJob(j.id)}
                style={{ color: 'red', cursor: 'pointer' }}
              >
                Remove
              </button>
            </div>
          </div>
        ))
      }
    </section>
  )
}