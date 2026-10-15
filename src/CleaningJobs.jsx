import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import Modal from './Modal'
import StandaloneJobForm from './StandaloneJobForm'

const PROPERTY_ID = '5a23806a-a9d4-482b-b97f-f37453e2f196'

export default function CleaningJobs() {
  const [jobs, setJobs] = useState([])
  const [stays, setStays] = useState([])
  const [cleaners, setCleaners] = useState([])
  const [loading, setLoading] = useState(true)
  const [composedText, setComposedText] = useState(null)
  const [showJobForm, setShowJobForm] = useState(false)
  const [editingJob, setEditingJob] = useState(null)
  const [jobNotes, setJobNotes] = useState({})
  const [savingNotes, setSavingNotes] = useState(false)

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

  async function addJob(data) {
    const { data: newJob, error } = await supabase
      .from('cleaning_job')
      .insert([data])
      .select('*, stay(*), cleaner(*)')
      .single()

    if (!error && newJob) {
      composeText(newJob)
    }

    setShowJobForm(false)
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

  async function updateJobStatus(id, status) {
    await supabase
      .from('cleaning_job')
      .update({ status })
      .eq('id', id)
    fetchAll()
  }

  async function saveJobNote(id, note) {
    setSavingNotes(true)
    await supabase
      .from('cleaning_job')
      .update({ cleaner_notes: note })
      .eq('id', id)
    setSavingNotes(false)
    fetchAll()
  }

  if (loading) return <p>Loading jobs...</p>

  return (
    <section className="section">
      <div className="section-header">
        <h2>Standalone Jobs</h2>
        <div className="row">
          <button className="btn btn-ghost btn-sm" onClick={fetchAll}>↻ Refresh</button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowJobForm(true)}>+ Schedule Job</button>
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
                <strong>{j.title || 'Cleaning'}</strong>
                {j.cleaner?.name && (
                  <p style={{ margin: 'var(--spacing-xs) 0 0', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
                    {j.cleaner.name}
                  </p>
                )}
                {j.worker_name && (
                  <p style={{ margin: 'var(--spacing-xs) 0 0', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
                    {j.worker_name}
                  </p>
                )}
                <p style={{ margin: 'var(--spacing-xs) 0 0', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
                  📅 {j.scheduled_date}
                </p>
                {j.agreed_rate && (
                  <p style={{ margin: 'var(--spacing-xs) 0 0', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
                    💵 ${j.agreed_rate}
                  </p>
                )}
              </div>
              <div className="col" style={{ alignItems: 'flex-end' }}>
                <span className={`badge ${j.status === 'confirmed' ? 'badge-success' :
                    j.status === 'complete' ? 'badge-primary' :
                      j.status === 'declined' ? 'badge-danger' :
                        'badge-neutral'
                  }`}>
                  {j.status}
                </span>
                {j.status === 'confirmed' && (
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => updateJobStatus(j.id, 'complete')}
                    style={{ color: 'var(--color-success)' }}
                  >
                    Mark Complete
                  </button>
                )}
                {j.status === 'complete' && (
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => updateJobStatus(j.id, 'confirmed')}
                  >
                    Undo
                  </button>
                )}
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => deleteJob(j.id)}
                  style={{ color: 'var(--color-danger)' }}
                >
                  Remove
                </button>
              </div>
            </div>

            {j.cleaner_notes && (
              <div className="note-block" style={{ marginTop: 'var(--spacing-sm)' }}>
                {j.cleaner_notes}
              </div>
            )}

            <div style={{ marginTop: 'var(--spacing-sm)' }}>
              {editingJob === j.id ? (
                <div>
                  <textarea
                    className="form-input"
                    rows={3}
                    defaultValue={j.cleaner_notes || ''}
                    id={`notes-${j.id}`}
                    placeholder="Add notes about this job..."
                    style={{ resize: 'vertical', marginBottom: 'var(--spacing-sm)' }}
                  />
                  <div className="row">
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => {
                        const note = document.getElementById(`notes-${j.id}`).value
                        saveJobNote(j.id, note)
                        setEditingJob(null)
                      }}
                      disabled={savingNotes}
                      style={{ flex: 1 }}
                    >
                      Save Notes
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => setEditingJob(null)}
                      style={{ flex: 1 }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setEditingJob(j.id)}
                >
                  {j.cleaner_notes ? '✏️ Edit notes' : '+ Add notes'}
                </button>
              )}
            </div>
          </div>
        ))
      }
      {showJobForm && (
        <Modal title="Schedule Standalone Job" onClose={() => setShowJobForm(false)}>
          <StandaloneJobForm
            cleaners={cleaners}
            onSave={addJob}
            onCancel={() => setShowJobForm(false)}
          />
        </Modal>
      )}
    </section>
  )
}