import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import Modal from './Modal'
import StandaloneJobForm from './StandaloneJobForm'
import StandaloneJobEditForm from './StandaloneJobEditForm'
import ListToolbar from './ListToolbar'
import { sortList, matchesSearch } from './listUtils'

const PROPERTY_ID = '5a23806a-a9d4-482b-b97f-f37453e2f196'
const ARCHIVABLE = ['complete', 'declined', 'cancelled']

const JOB_SORT_OPTIONS = [
  { key: 'date', label: 'Job date' },
  { key: 'title', label: 'Job title' },
  { key: 'worker', label: 'Worker' },
  { key: 'rate', label: 'Pay rate' },
  { key: 'status', label: 'Status' },
]

function workerName(j) {
  return j.cleaner?.name || j.worker_name || 'Unassigned'
}

function getJobSortValue(j, key) {
  if (key === 'date') return j.scheduled_date
  if (key === 'title') return (j.title || 'Cleaning').toLowerCase()
  if (key === 'worker') return workerName(j).toLowerCase()
  if (key === 'rate') return j.agreed_rate != null ? parseFloat(j.agreed_rate) : null
  if (key === 'status') return j.status
  return null
}

export default function CleaningJobs() {
  const [jobs, setJobs] = useState([])
  const [stays, setStays] = useState([])
  const [cleaners, setCleaners] = useState([])
  const [loading, setLoading] = useState(true)
  const [showArchived, setShowArchived] = useState(false)
  const [showJobForm, setShowJobForm] = useState(false)
  const [editingStandaloneJob, setEditingStandaloneJob] = useState(null)
  const [notesJobId, setNotesJobId] = useState(null)
  const [noteDraft, setNoteDraft] = useState('')

  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState('date')
  const [sortDir, setSortDir] = useState('asc')
  const [workerFilter, setWorkerFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [payFilter, setPayFilter] = useState('all')
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState([])

  useEffect(() => {
    fetchAll()
  }, [showArchived])

  useEffect(() => {
    setSelectedIds([])
    setSelectMode(false)
  }, [showArchived])

  async function fetchAll() {
    setLoading(true)

    const { data: jobData } = await supabase
      .from('cleaning_job')
      .select('*, cleaner(*)')
      .eq('property_id', PROPERTY_ID)
      .eq('standalone', true)
      .eq('archived', showArchived)

    const { data: stayData } = await supabase
      .from('stay')
      .select('guest_name, check_in, check_out')
      .eq('property_id', PROPERTY_ID)
      .eq('archived', false)

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
    await supabase.from('cleaning_job').insert([data])
    setShowJobForm(false)
    fetchAll()
  }

  async function updateJob(data) {
    await supabase.from('cleaning_job').update(data).eq('id', editingStandaloneJob.id)
    setEditingStandaloneJob(null)
    fetchAll()
  }

  async function updateJobStatus(id, status) {
    await supabase.from('cleaning_job').update({ status }).eq('id', id)
    fetchAll()
  }

  async function saveJobNote(id) {
    await supabase.from('cleaning_job').update({ cleaner_notes: noteDraft }).eq('id', id)
    setNotesJobId(null)
    setNoteDraft('')
    fetchAll()
  }

  async function deleteJob(id) {
    if (!confirm('Permanently remove this job? This cannot be undone. Archive is safer.')) return
    await supabase.from('cleaning_job').delete().eq('id', id)
    fetchAll()
  }

  async function archiveJob(job) {
    const msg = job.payment_status === 'unpaid' && job.status === 'complete'
      ? 'This job is complete but unpaid. It will still appear in Payments until it is paid. Archive it anyway?'
      : 'Archive this job? You can restore it from the archived view.'
    if (!confirm(msg)) return
    await supabase.from('cleaning_job').update({ archived: true }).eq('id', job.id)
    fetchAll()
  }

  async function unarchiveJob(job) {
    await supabase.from('cleaning_job').update({ archived: false }).eq('id', job.id)
    fetchAll()
  }

  function getStayConflicts(job) {
    return stays.filter(s =>
      job.scheduled_date >= s.check_in && job.scheduled_date <= s.check_out
    )
  }

  // ---- filtering, sorting, selection ----
  const workerNames = [...new Set(jobs.map(workerName))].sort()

  const visibleJobs = sortList(
    jobs.filter(j => {
      if (!matchesSearch(`${j.title || 'Cleaning'} ${workerName(j)} ${j.cleaner_notes || ''}`, search)) return false
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
      fetchAll()
      return
    }

    const archivable = selectedJobs.filter(j => ARCHIVABLE.includes(j.status))
    const skipped = selectedJobs.length - archivable.length
    if (archivable.length === 0) {
      alert('None of the selected jobs can be archived yet. Only complete, declined, or cancelled jobs can be archived. Mark a finished job complete first.')
      return
    }

    const unpaid = archivable.filter(j => j.status === 'complete' && j.payment_status === 'unpaid').length
    let msg = `Archive ${archivable.length} job${archivable.length === 1 ? '' : 's'}?`
    if (skipped > 0) msg += `\n\n${skipped} selected job${skipped === 1 ? ' is' : 's are'} still active and will be left alone.`
    if (unpaid > 0) msg += `\n\n${unpaid} complete but unpaid job${unpaid === 1 ? '' : 's'} will still appear in Payments until paid.`
    if (!confirm(msg)) return

    await supabase.from('cleaning_job').update({ archived: true }).in('id', archivable.map(j => j.id))
    exitSelectMode()
    fetchAll()
  }

  async function bulkRemove() {
    if (selectedJobs.length === 0) return
    const n = selectedJobs.length
    const completed = selectedJobs.filter(j => j.status === 'complete').length

    let msg = `Permanently remove ${n} job${n === 1 ? '' : 's'}? This cannot be undone. Archive is safer if you only want them out of the way.`
    if (completed > 0) msg += `\n\n${completed} completed job${completed === 1 ? '' : 's'}, including payment records, will be deleted.`
    if (!confirm(msg)) return

    await supabase.from('cleaning_job').delete().in('id', selectedJobs.map(j => j.id))
    exitSelectMode()
    fetchAll()
  }

  const statusBadge = (status) =>
    status === 'confirmed' ? 'badge-success' :
    status === 'complete' ? 'badge-primary' :
    status === 'declined' || status === 'cancelled' ? 'badge-danger' :
    'badge-neutral'

  if (loading && jobs.length === 0 && !showJobForm) {
    return <p className="empty-state">Loading standalone jobs...</p>
  }

  return (
    <section className="section">
      <div className="section-header">
        <h2>
          Standalone Jobs
          {showArchived && (
            <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'normal', color: 'var(--color-text-muted)', marginLeft: 'var(--spacing-xs)' }}>
              — viewing archived
            </span>
          )}
        </h2>
        <div className="row">
          <button className="btn btn-ghost btn-sm" onClick={fetchAll}>↻ Refresh</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowArchived(prev => !prev)}>
            {showArchived ? 'Hide archived' : 'Show archived'}
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowJobForm(true)}>
            + Schedule Job
          </button>
        </div>
      </div>

      <ListToolbar
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Search title, worker or notes..."
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
          {showArchived ? 'No archived standalone jobs.' : 'No standalone jobs scheduled yet.'}
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
                <strong>{j.title || 'Cleaning'}</strong>
                <p style={{ margin: 'var(--spacing-xs) 0 0', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
                  {workerName(j)}
                </p>
                <p style={{ margin: 'var(--spacing-xs) 0 0', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
                  📅 {j.scheduled_date}
                </p>
                {j.agreed_rate != null && (
                  <p style={{ margin: 'var(--spacing-xs) 0 0', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
                    💵 ${j.agreed_rate} · {j.payment_status}
                  </p>
                )}
              </div>
              <div className="col" style={{ alignItems: 'flex-end' }}>
                <span className={`badge ${statusBadge(j.status)}`}>{j.status}</span>
                {!showArchived && (
                  <button className="btn btn-secondary btn-sm" onClick={() => setEditingStandaloneJob(j)}>
                    Edit
                  </button>
                )}
                {!showArchived && j.status === 'confirmed' && (
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => updateJobStatus(j.id, 'complete')}
                    style={{ color: 'var(--color-success)' }}
                  >
                    Mark Complete
                  </button>
                )}
                {!showArchived && j.status === 'complete' && (
                  <button className="btn btn-ghost btn-sm" onClick={() => updateJobStatus(j.id, 'confirmed')}>
                    Undo
                  </button>
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
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => deleteJob(j.id)}
                  style={{ color: 'var(--color-danger)' }}
                >
                  Remove
                </button>
              </div>
            </div>

            {j.cleaner_notes && notesJobId !== j.id && (
              <div className="note-block" style={{ marginTop: 'var(--spacing-sm)' }}>
                {j.cleaner_notes}
              </div>
            )}

            <div style={{ marginTop: 'var(--spacing-sm)' }}>
              {notesJobId === j.id ? (
                <div>
                  <textarea
                    className="form-input"
                    rows={3}
                    value={noteDraft}
                    onChange={e => setNoteDraft(e.target.value)}
                    placeholder="Add notes about this job..."
                    style={{ resize: 'vertical', marginBottom: 'var(--spacing-sm)' }}
                    autoFocus
                  />
                  <div className="row">
                    <button className="btn btn-primary btn-sm" onClick={() => saveJobNote(j.id)} style={{ flex: 1 }}>
                      Save Notes
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => { setNotesJobId(null); setNoteDraft('') }}
                      style={{ flex: 1 }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => { setNotesJobId(j.id); setNoteDraft(j.cleaner_notes || '') }}
                >
                  {j.cleaner_notes ? '✏️ Edit notes' : '+ Add notes'}
                </button>
              )}
            </div>

            {getStayConflicts(j).map((s, i) => (
              <div key={i} className="alert alert-warning" style={{ marginTop: 'var(--spacing-sm)', fontSize: 'var(--font-size-xs)' }}>
                ⚠️ Overlaps with stay: {s.guest_name || 'Guest'} ({s.check_in} → {s.check_out})
              </div>
            ))}
          </div>
        ))
      )}

      {showJobForm && (
        <Modal title="Schedule Standalone Job" onClose={() => setShowJobForm(false)}>
          <StandaloneJobForm
            cleaners={cleaners}
            onSave={addJob}
            onCancel={() => setShowJobForm(false)}
          />
        </Modal>
      )}

      {editingStandaloneJob && (
        <Modal title="Edit Job" onClose={() => setEditingStandaloneJob(null)}>
          <StandaloneJobEditForm
            job={editingStandaloneJob}
            cleaners={cleaners}
            onSave={updateJob}
            onCancel={() => setEditingStandaloneJob(null)}
          />
        </Modal>
      )}
    </section>
  )
}