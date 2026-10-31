import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { PUBLIC_URL } from './config'
import ListToolbar from './ListToolbar'
import { sortList, matchesSearch } from './listUtils'

const PROPERTY_ID = '5a23806a-a9d4-482b-b97f-f37453e2f196'
const INACTIVE = ['declined', 'cancelled']
const ARCHIVABLE = ['complete', 'declined', 'cancelled']

const JOB_SORT_OPTIONS = [
  { key: 'date', label: 'Cleaning date' },
  { key: 'checkout', label: 'Stay checkout' },
  { key: 'worker', label: 'Worker' },
  { key: 'rate', label: 'Pay rate' },
  { key: 'status', label: 'Status' },
]

function workerName(j) {
  return j.cleaner?.name || j.worker_name || 'Unassigned'
}

function getJobSortValue(j, key) {
  if (key === 'date') return j.scheduled_date
  if (key === 'checkout') return j.stay?.check_out
  if (key === 'worker') return workerName(j).toLowerCase()
  if (key === 'rate') return j.agreed_rate != null ? parseFloat(j.agreed_rate) : null
  if (key === 'status') return j.status
  return null
}

export default function StayJobs({ refreshTrigger }) {
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [showArchived, setShowArchived] = useState(false)
  const [copiedId, setCopiedId] = useState(null)

  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState('date')
  const [sortDir, setSortDir] = useState('asc')
  const [workerFilter, setWorkerFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [payFilter, setPayFilter] = useState('all')
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState([])

  useEffect(() => {
    fetchJobs()
  }, [refreshTrigger, showArchived])

  useEffect(() => {
    setSelectedIds([])
    setSelectMode(false)
  }, [showArchived])

  async function fetchJobs() {
    setLoading(true)
    const { data } = await supabase
      .from('cleaning_job')
      .select('*, stay(*), cleaner(*)')
      .eq('property_id', PROPERTY_ID)
      .eq('standalone', false)
      .eq('archived', showArchived)
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

  // ---- filtering, sorting, selection ----
  const workerNames = [...new Set(jobs.map(workerName))].sort()

  const visibleJobs = sortList(
    jobs.filter(j => {
      if (!matchesSearch(`${workerName(j)} ${j.stay?.guest_name || ''}`, search)) return false
      if (workerFilter !== 'all' && workerName(j) !== workerFilter) return false
      if (statusFilter !== 'all' && j.status !== statusFilter) return false
      if (payFilter !== 'all' && j.payment_status !== payFilter) return false
      return true
    }),
    j => getJobSortValue(j, sortKey),
    sortDir
  )

  // Only jobs currently shown can be acted on
  const selectedJobs = visibleJobs.filter(j => selectedIds.includes(j.id))

  const activeFilterCount =
    (search.trim() ? 1 : 0) +
    (workerFilter !== 'all' ? 1 : 0) +
    (statusFilter !== 'all' ? 1 : 0) +
    (payFilter !== 'all' ? 1 : 0)

  function resetFilters() {
    setSearch('')
    setWorkerFilter('all')
    setStatusFilter('all')
    setPayFilter('all')
  }

  function toggleSelected(id) {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  function exitSelectMode() {
    setSelectMode(false)
    setSelectedIds([])
  }

  async function bulkArchive(archive) {
    if (selectedJobs.length === 0) return

    if (!archive) {
      if (!confirm(`Unarchive ${selectedJobs.length} job${selectedJobs.length === 1 ? '' : 's'}?`)) return
      await supabase.from('cleaning_job').update({ archived: false }).in('id', selectedJobs.map(j => j.id))
      exitSelectMode()
      fetchJobs()
      return
    }

    const archivable = selectedJobs.filter(j => ARCHIVABLE.includes(j.status))
    const skipped = selectedJobs.length - archivable.length
    if (archivable.length === 0) {
      alert('None of the selected jobs can be archived yet. Only complete, declined, or cancelled jobs can be archived.')
      return
    }

    const unpaid = archivable.filter(j => j.status === 'complete' && j.payment_status === 'unpaid').length
    let msg = `Archive ${archivable.length} job${archivable.length === 1 ? '' : 's'}?`
    if (skipped > 0) msg += `\n\n${skipped} selected job${skipped === 1 ? ' is' : 's are'} still active and will be left alone.`
    if (unpaid > 0) msg += `\n\n${unpaid} complete but unpaid job${unpaid === 1 ? '' : 's'} will still appear in Payments until paid.`
    if (!confirm(msg)) return

    await supabase.from('cleaning_job').update({ archived: true }).in('id', archivable.map(j => j.id))
    exitSelectMode()
    fetchJobs()
  }

  async function bulkRemove() {
    if (selectedJobs.length === 0) return
    const n = selectedJobs.length
    const open = selectedJobs
      .filter(j => ['offered', 'confirmed'].includes(j.status))
      .map(j => `${workerName(j)} (${j.scheduled_date})`)
    const completed = selectedJobs.filter(j => j.status === 'complete').length

    let msg = `Permanently remove ${n} job${n === 1 ? '' : 's'}? Their supply reports are deleted too, and this cannot be undone. Archive is safer if you only want them out of the way.`
    if (open.length > 0) msg += `\n\nOpen jobs that will be deleted: ${open.join(', ')}. Remember to tell those workers.`
    if (completed > 0) msg += `\n\n${completed} completed job${completed === 1 ? '' : 's'}, including payment records, will be deleted.`
    if (!confirm(msg)) return

    await supabase.from('cleaning_job').delete().in('id', selectedJobs.map(j => j.id))
    exitSelectMode()
    fetchJobs()
  }

  const hasLink = (job) => !INACTIVE.includes(job.status)

  const statusBadge = (status) =>
    status === 'confirmed' ? 'badge-success' :
    status === 'complete' ? 'badge-primary' :
    status === 'offered' ? 'badge-warning' :
    status === 'declined' || status === 'cancelled' ? 'badge-danger' :
    'badge-neutral'

  if (loading && jobs.length === 0) return null

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

      <ListToolbar
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Search worker or guest..."
        sortOptions={JOB_SORT_OPTIONS}
        sortKey={sortKey}
        onSortKey={setSortKey}
        sortDir={sortDir}
        onSortDir={setSortDir}
        filters={[
          {
            key: 'worker', label: 'Worker', value: workerFilter, onChange: setWorkerFilter,
            options: [{ value: 'all', label: 'All workers' }, ...workerNames.map(n => ({ value: n, label: n }))],
          },
          {
            key: 'status', label: 'Status', value: statusFilter, onChange: setStatusFilter,
            options: [
              { value: 'all', label: 'Any status' },
              { value: 'offered', label: 'Offered' },
              { value: 'confirmed', label: 'Confirmed' },
              { value: 'complete', label: 'Complete' },
              { value: 'declined', label: 'Declined' },
              { value: 'cancelled', label: 'Cancelled' },
            ],
          },
          {
            key: 'pay', label: 'Payment', value: payFilter, onChange: setPayFilter,
            options: [
              { value: 'all', label: 'Paid or unpaid' },
              { value: 'unpaid', label: 'Unpaid' },
              { value: 'paid', label: 'Paid' },
            ],
          },
        ]}
        activeCount={activeFilterCount}
        onReset={resetFilters}
        selectMode={selectMode}
        onToggleSelect={() => (selectMode ? exitSelectMode() : setSelectMode(true))}
        selectedCount={selectedJobs.length}
        shownCount={visibleJobs.length}
        onSelectAll={() => setSelectedIds(visibleJobs.map(j => j.id))}
        onClearSelection={() => setSelectedIds([])}
        bulkActions={[
          showArchived
            ? { label: 'Unarchive', onClick: () => bulkArchive(false) }
            : { label: 'Archive', onClick: () => bulkArchive(true) },
          { label: 'Remove', danger: true, onClick: bulkRemove },
        ]}
      />

      {jobs.length === 0 ? (
        <p className="empty-state">
          {showArchived ? 'No archived jobs.' : 'No cleaning jobs linked to stays.'}
        </p>
      ) : visibleJobs.length === 0 ? (
        <p className="empty-state">No jobs match your filters.</p>
      ) : (
        visibleJobs.map(j => (
          <div
            key={j.id}
            className="card"
            style={{
              marginTop: 'var(--spacing-sm)',
              borderColor: selectMode && selectedIds.includes(j.id) ? 'var(--color-primary)' : undefined,
            }}
          >
            {selectMode && (
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--spacing-sm)',
                marginBottom: 'var(--spacing-sm)',
                cursor: 'pointer',
                fontSize: 'var(--font-size-sm)',
                color: 'var(--color-text-muted)',
              }}>
                <input
                  type="checkbox"
                  checked={selectedIds.includes(j.id)}
                  onChange={() => toggleSelected(j.id)}
                />
                Select
              </label>
            )}
            <div className="row-between">
              <div>
                <strong>{workerName(j)}</strong>
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