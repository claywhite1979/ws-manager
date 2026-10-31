import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

const PROPERTY_ID = '5a23806a-a9d4-482b-b97f-f37453e2f196'
const PUBLIC_URL = 'https://whitetailspur.com'
const INACTIVE = ['declined', 'cancelled']
const ARCHIVABLE = ['complete', 'declined', 'cancelled']

export default function StayJobs({ refreshTrigger }) {
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [showArchived, setShowArchived] = useState(false)
  const [copiedId, setCopiedId] = useState(null)

  useEffect(() => {
    fetchJobs()
  }, [refreshTrigger, showArchived])

  async function fetchJobs() {
    setLoading(true)
    const { data } = await supabase
      .from('cleaning_job')
      .select('*, stay(*), cleaner(*)')
      .eq('property_id', PROPERTY_ID)
      .eq('standalone', false)
      .eq('archived', showArchived)
      .order('scheduled_date', { ascending: false })
    setJobs(data || [])
    setLoading(false)
  }

  async function copyLink(job) {
    await navigator.clipboard.writeText(`${PUBLIC_URL}/job/${job.job_token}`)
    setCopiedId(job.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  async function archiveJob(job) {
    const msg = job.payment_status === 'unpaid' && job.status === 'complete'
      ? 'This job is complete but unpaid. It will still appear in Payments until it is paid. Archive it anyway?'
      : 'Archive this job? You can restore it from the archived view.'
    if (!confirm(msg)) return
    await supabase.from('cleaning_job').update({ archived: true }).eq('id', job.id)
    fetchJobs()
  }

  async function unarchiveJob(job) {
    await supabase.from('cleaning_job').update({ archived: false }).eq('id', job.id)
    fetchJobs()
  }

  const hasLink = (job) => !INACTIVE.includes(job.status)

  const statusBadge = (status) =>
    status === 'confirmed' ? 'badge-success' :
    status === 'complete' ? 'badge-primary' :
    status === 'offered' ? 'badge-warning' :
    status === 'declined' || status === 'cancelled' ? 'badge-danger' :
    'badge-neutral'

  if (loading) return null

  return (
    <section className="section">
      <div className="section-header">
        <h2>
          Cleaning Jobs (linked to stays)
          {showArchived && (
            <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'normal', color: 'var(--color-text-muted)', marginLeft: 'var(--spacing-xs)' }}>
              — viewing archived
            </span>
          )}
        </h2>
        <div className="row">
          <button className="btn btn-ghost btn-sm" onClick={fetchJobs}>↻ Refresh</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowArchived(prev => !prev)}>
            {showArchived ? 'Hide archived' : 'Show archived'}
          </button>
        </div>
      </div>

      {jobs.length === 0 ? (
        <p className="empty-state">
          {showArchived ? 'No archived jobs.' : 'No cleaning jobs linked to stays.'}
        </p>
      ) : (
        jobs.map(j => (
          <div key={j.id} className="card" style={{ marginTop: 'var(--spacing-sm)' }}>
            <div className="row-between">
              <div>
                <strong>{j.cleaner?.name || 'Unassigned'}</strong>
                <p style={{ margin: 'var(--spacing-xs) 0 0', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
                  {j.stay?.guest_name || 'Guest'} · out {j.stay?.check_out}
                </p>
                <p style={{ margin: 'var(--spacing-xs) 0 0', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
                  {j.status === 'offered' && j.window_start
                    ? `Window: ${j.window_start} → ${j.window_end}`
                    : `Cleaning: ${j.scheduled_date}`}
                </p>
                <p style={{ margin: 'var(--spacing-xs) 0 0', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
                  ${j.agreed_rate} · {j.payment_status}
                </p>
              </div>
              <div className="col" style={{ alignItems: 'flex-end' }}>
                <span className={`badge ${statusBadge(j.status)}`}>{j.status}</span>
                {hasLink(j) && (
                  <>
                    <a href={`/job/${j.job_token}`} target="_blank" rel="noreferrer">
                      <button className="btn btn-secondary btn-sm">Open job page</button>
                    </a>
                    <button className="btn btn-ghost btn-sm" onClick={() => copyLink(j)}>
                      {copiedId === j.id ? 'Copied!' : 'Copy link'}
                    </button>
                  </>
                )}
                {!showArchived && ARCHIVABLE.includes(j.status) && (
                  <button className="btn btn-ghost btn-sm" onClick={() => archiveJob(j)}>
                    Archive
                  </button>
                )}
                {showArchived && (
                  <button className="btn btn-ghost btn-sm" onClick={() => unarchiveJob(j)}>
                    Unarchive
                  </button>
                )}
              </div>
            </div>
          </div>
        ))
      )}
    </section>
  )
}