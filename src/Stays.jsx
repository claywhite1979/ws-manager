import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import Modal from './Modal'
import StayForm from './StayForm'
import StayEditForm from './StayEditForm'
import JobOfferForm from './JobOfferForm'
import StayFlags from './StayFlags'
import { PUBLIC_URL } from './config'
import ListToolbar from './ListToolbar'
import { sortList, matchesSearch, nightsBetween } from './listUtils'

const STAY_SORT_OPTIONS = [
  { key: 'check_in', label: 'Check-in date' },
  { key: 'check_out', label: 'Check-out date' },
  { key: 'length', label: 'Length of stay' },
  { key: 'source', label: 'Source' },
  { key: 'name', label: 'Guest name' },
]

function getStaySortValue(s, key) {
  if (key === 'length') return nightsBetween(s.check_in, s.check_out)
  if (key === 'name') return s.guest_name ? s.guest_name.toLowerCase() : null
  return s[key]
}

const PROPERTY_ID = '5a23806a-a9d4-482b-b97f-f37453e2f196'

export default function Stays(props) {
  const [stays, setStays] = useState([])
  const [cleaners, setCleaners] = useState([])
  const [loading, setLoading] = useState(true)
  const [composedText, setComposedText] = useState(null)
  const [showStayForm, setShowStayForm] = useState(false)
  const [offerStay, setOfferStay] = useState(null)
  const [editingStay, setEditingStay] = useState(null)
  const [showArchived, setShowArchived] = useState(false)
  const [standaloneJobs, setStandaloneJobs] = useState([])
  const [copiedJobId, setCopiedJobId] = useState(null)
  const [composedStayId, setComposedStayId] = useState(null)
  const [textCopied, setTextCopied] = useState(false)
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState('check_in')
  const [sortDir, setSortDir] = useState('asc')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [cleaningFilter, setCleaningFilter] = useState('all')
  const [flagFilter, setFlagFilter] = useState('all')
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState([])

  useEffect(() => {
    fetchAll()
  }, [props.refreshTrigger, showArchived])

  useEffect(() => {
    setSelectedIds([])
    setSelectMode(false)
  }, [showArchived])

  async function fetchAll() {
    setLoading(true)

    const { data: stayData } = await supabase
      .from('stay')
      .select('*, cleaning_job(*, cleaner(*))')
      .eq('property_id', PROPERTY_ID)
      .eq('archived', showArchived)
      .order('check_in', { ascending: true })

    const { data: cleanerData } = await supabase
      .from('cleaner')
      .select('*')
      .eq('active', true)

    const { data: jobData } = await supabase
      .from('cleaning_job')
      .select('*, cleaner(*)')
      .eq('property_id', PROPERTY_ID)
      .eq('standalone', true)
      .eq('archived', false)
      .neq('status', 'declined')

    setStandaloneJobs(jobData || [])
    setStays(stayData || [])
    setCleaners(cleanerData || [])
    setLoading(false)
  }

  async function addStay(data) {
    const conflicts = await checkStandaloneConflicts(data.check_in, data.check_out)

    if (conflicts.length > 0) {
      const names = conflicts.map(j => {
        const worker = j.worker_name || j.cleaner?.name || 'Unknown'
        return `${j.title} on ${j.scheduled_date} (${worker})`
      }).join(', ')

      if (!window.confirm(`⚠️ This stay overlaps with: ${names}. Add anyway?`)) return
    }

    await supabase
      .from('stay')
      .insert([{ property_id: PROPERTY_ID, ...data }])
    setShowStayForm(false)
    fetchAll()
  }

  async function deleteStay(id) {
    const stay = stays.find(s => s.id === id)
    const job = (stay?.cleaning_job || []).find(j => j.status === 'offered' || j.status === 'confirmed')
    const msg = job
      ? `Remove this stay? This also deletes the ${job.status} cleaning job for ${job.cleaner?.name || 'the cleaner'} (${job.scheduled_date}), and their job link will stop working. Remember to tell them.`
      : 'Remove this stay?'
    if (!confirm(msg)) return
    await supabase.from('stay').delete().eq('id', id)
    fetchAll()
  }

  async function archiveStay(id) {
    if (!confirm('Archive this stay? It will be hidden from the dashboard but kept in your records.')) return
    await supabase
      .from('stay')
      .update({ archived: true })
      .eq('id', id)
    fetchAll()
  }

  async function markJobComplete(jobId) {
    await supabase
      .from('cleaning_job')
      .update({ status: 'complete' })
      .eq('id', jobId)
    fetchAll()
  }

  async function undoJobComplete(jobId) {
    if (!confirm('Mark this job as not complete?')) return
    await supabase
      .from('cleaning_job')
      .update({ status: 'confirmed' })
      .eq('id', jobId)
    fetchAll()
  }

  async function unarchiveStay(id) {
    await supabase
      .from('stay')
      .update({ archived: false, cancelled_at: null })
      .eq('id', id)
    fetchAll()
  }

  async function cancelStay(id) {
    const stay = stays.find(s => s.id === id)
    const jobs = (stay?.cleaning_job || []).filter(j =>
      ['offered', 'confirmed', 'in_progress'].includes(j.status)
    )

    const msg = jobs.length > 0
      ? `Cancel this stay? The ${jobs[0].status} cleaning job for ${jobs[0].cleaner?.name || 'the cleaner'} will be cancelled too, and the stay moves to your archived view.`
      : 'Cancel this stay? It will move to your archived view.'
    if (!confirm(msg)) return

    // Mark the stay cancelled and archive it, and clear any feed flag
    await supabase
      .from('stay')
      .update({ archived: true, cancelled_at: new Date().toISOString(), feed_missing_at: null })
      .eq('id', id)

    // Stop tracking it against the feed so sync doesn't flag it again
    await supabase
      .from('ical_event')
      .update({ stay_id: null })
      .eq('stay_id', id)

    // Cancel open cleaning jobs (completed jobs are left alone)
    if (jobs.length > 0) {
      await supabase
        .from('cleaning_job')
        .update({ status: 'cancelled' })
        .in('id', jobs.map(j => j.id))

      const job = jobs[0]
      const name = job.cleaner?.name || 'there'
      setComposedText(
        `Hi ${name}, unfortunately the booking that ended ${stay.check_out} was cancelled, so we no longer need the cleaning on ${job.scheduled_date}. Sorry for the change! If you added it to your calendar, please remove it. Thank you!`
      )
      setComposedStayId(id)
    }

    fetchAll()
  }

  async function keepMissingStay(stayId) {
    // Clear the flag and stop tracking this stay against the feed,
    // so the next sync doesn't flag it again
    await supabase
      .from('stay')
      .update({ feed_missing_at: null })
      .eq('id', stayId)
    await supabase
      .from('ical_event')
      .update({ stay_id: null })
      .eq('stay_id', stayId)
    fetchAll()
  }

  async function copyJobLink(job) {
    await navigator.clipboard.writeText(`${PUBLIC_URL}/job/${job.job_token}`)
    setCopiedJobId(job.id)
    setTimeout(() => setCopiedJobId(null), 2000)
  }

  function renderComposedCard() {
    return (
      <div id="composed-card" className="alert alert-info" style={{ marginTop: 'var(--spacing-md)' }}>
        <h3 style={{ marginTop: 0, marginBottom: 'var(--spacing-sm)' }}>Ready to Send</h3>
        <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'var(--font-family)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--spacing-sm)' }}>
          {composedText}
        </pre>
        <div className="row">
          <button
            className="btn btn-primary btn-sm"
            onClick={async () => {
              await navigator.clipboard.writeText(composedText)
              setTextCopied(true)
              setTimeout(() => setTextCopied(false), 2000)
            }}
          >
            {textCopied ? 'Copied!' : 'Copy to Clipboard'}
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => { setComposedText(null); setComposedStayId(null) }}
          >
            Dismiss
          </button>
        </div>
      </div>
    )
  }

  useEffect(() => {
    if (!composedText || loading) return
    setTimeout(() => {
      document.getElementById('composed-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 100)
  }, [composedText, loading])

  async function updateStay(data) {
    const conflicts = await checkStandaloneConflicts(data.check_in, data.check_out)

    if (conflicts.length > 0) {
      const names = conflicts.map(j => {
        const worker = j.worker_name || j.cleaner?.name || 'Unknown'
        return `${j.title} on ${j.scheduled_date} (${worker})`
      }).join(', ')

      if (!window.confirm(`⚠️ This stay overlaps with: ${names}. Update anyway?`)) return
    }

    await supabase
      .from('stay')
      .update(data)
      .eq('id', editingStay.id)
    setEditingStay(null)
    fetchAll()
  }

  async function checkStandaloneConflicts(checkIn, checkOut) {
    const { data: jobs } = await supabase
      .from('cleaning_job')
      .select('title, scheduled_date, cleaner(*), worker_name')
      .eq('property_id', PROPERTY_ID)
      .eq('standalone', true)
      .eq('archived', false)
      .neq('status', 'declined')
      .gte('scheduled_date', checkIn)
      .lte('scheduled_date', checkOut)

    return jobs || []
  }

  function getStandaloneConflicts(stay, jobs) {
    if (!jobs || jobs.length === 0) return []
    return jobs.filter(j =>
      j.scheduled_date >= stay.check_in &&
      j.scheduled_date <= stay.check_out &&
      j.status !== 'declined'
    )
  }

  function calculateWindow(stay, allStays) {
    const checkout = new Date(stay.check_out)
    const windowEnd = new Date(checkout)
    windowEnd.setDate(windowEnd.getDate() + 7)

    const nextStay = allStays
      .filter(s => new Date(s.check_in) > checkout)
      .sort((a, b) => new Date(a.check_in) - new Date(b.check_in))[0]

    if (nextStay) {
      const dayBeforeNext = new Date(nextStay.check_in)
      dayBeforeNext.setDate(dayBeforeNext.getDate() - 1)
      if (dayBeforeNext < windowEnd) {
        return { start: stay.check_out, end: dayBeforeNext.toISOString().split('T')[0] }
      }
    }

    return { start: stay.check_out, end: windowEnd.toISOString().split('T')[0] }
  }

  function getAvailableDates(window) {
    const dates = []
    const current = new Date(window.start)
    const end = new Date(window.end)
    while (current <= end) {
      dates.push(current.toISOString().split('T')[0])
      current.setDate(current.getDate() + 1)
    }
    return dates
  }

  function getActiveJob(stay) {
    if (!stay.cleaning_job || stay.cleaning_job.length === 0) return null
    const active = stay.cleaning_job.filter(j => j.status !== 'declined' && j.status !== 'cancelled')
    if (active.length === 0) return null
    return active.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0]
  }

  function getDeclinedCleaners(stay) {
    if (!stay.cleaning_job) return []
    return stay.cleaning_job
      .filter(j => j.status === 'declined' && j.cleaner)
      .map(j => j.cleaner.name)
  }

  async function createOffer({ cleaner_id, agreed_rate }) {
    const stay = offerStay
    const window = calculateWindow(stay, stays)
    const cleaner = cleaners.find(c => c.id === cleaner_id)

    const { data, error } = await supabase
      .from('cleaning_job')
      .insert([{
        property_id: PROPERTY_ID,
        stay_id: stay.id,
        cleaner_id,
        scheduled_date: window.start,
        agreed_rate,
        status: 'offered',
        standalone: false,
        window_start: window.start,
        window_end: window.end,
      }])
      .select('*, stay(*), cleaner(*)')
      .single()

    if (!error && data) {
      composeText(data, window)
    }

    setOfferStay(null)
    fetchAll()
  }

  function composeText(job, window) {
    const cleanerName = job.cleaner?.name || 'there'
    const jobToken = job.job_token
    const appUrl = `https://whitetailspur.com/job/${jobToken}`

    const message =
      `Hi ${cleanerName}! We'd like to offer you a cleaning job at the property.

Guest checkout: ${job.stay?.check_out}
Available cleaning dates: ${window.start} through ${window.end}
Rate: $${job.agreed_rate}

Please review and select your date here:
${appUrl}

Reply if you have any questions. Thanks!`

    setComposedText(message)
    setComposedStayId(job.stay_id || job.stay?.id || null)
  }

  function getStatusDisplay(stay) {
    const job = getActiveJob(stay)
    const declinedNames = getDeclinedCleaners(stay)

    if (!job) {
      return (
        <div style={{ marginTop: '0.5rem' }}>
          <span style={{
            padding: '0.25rem 0.75rem',
            borderRadius: '999px',
            fontSize: '0.8rem',
            fontWeight: 'bold',
            background: '#f8d7da',
            color: '#721c24',
          }}>
            🔴 Unassigned
          </span>
          {declinedNames.length > 0 && (
            <p style={{ fontSize: '0.8rem', color: '#856404', marginTop: '0.25rem' }}>
              Previously declined by: {declinedNames.join(', ')}
            </p>
          )}
          <button
            className="btn btn-primary btn-sm"
            onClick={() => setOfferStay(stay)}
            style={{ marginTop: 'var(--spacing-sm)' }}
          >
            + Create Offer
          </button>
        </div>
      )
    }

    if (job.status === 'offered') {
      return (
        <div style={{ marginTop: '0.5rem' }}>
          <span style={{
            padding: '0.25rem 0.75rem',
            borderRadius: '999px',
            fontSize: '0.8rem',
            fontWeight: 'bold',
            background: '#fff3cd',
            color: '#856404',
          }}>
            🟡 Offer Pending
          </span>
          <p style={{ fontSize: '0.85rem', margin: '0.25rem 0' }}>
            Offered to: {job.cleaner?.name}
          </p>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              const window = calculateWindow(stay, stays)
              composeText(job, window)
            }}
          >
            Resend Text
          </button>
          <a href={`/job/${job.job_token}`} target="_blank" rel="noreferrer">
            <button className="btn btn-ghost btn-sm">Open job page</button>
          </a>
          <button className="btn btn-ghost btn-sm" onClick={() => copyJobLink(job)}>
            {copiedJobId === job.id ? 'Copied!' : 'Copy link'}
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              if (window.confirm('This job hasn\'t been accepted yet. Mark it complete anyway? Make sure the right cleaner is assigned before paying.')) {
                markJobComplete(job.id)
              }
            }}
            style={{ color: 'var(--color-success)', display: 'block', marginTop: 'var(--spacing-xs)' }}
          >
            ✅ Mark Complete
          </button>
        </div>
      )
    }

    if (job.status === 'confirmed') {
      return (
        <div style={{ marginTop: '0.5rem' }}>
          <span style={{
            padding: '0.25rem 0.75rem',
            borderRadius: '999px',
            fontSize: '0.8rem',
            fontWeight: 'bold',
            background: '#d4edda',
            color: '#155724',
          }}>
            🟢 Confirmed
          </span>
          <p style={{ fontSize: '0.85rem', margin: '0.25rem 0' }}>
            {job.cleaner?.name} — {job.scheduled_date}
          </p>
          {job.cleaner_notes && (
            <div style={{
              marginTop: '0.5rem',
              padding: '0.5rem 0.75rem',
              background: '#f8f9fa',
              borderRadius: '4px',
              borderLeft: '3px solid #2563eb',
              fontSize: '0.85rem',
            }}>
              <strong>Cleaner notes:</strong>
              <p style={{ margin: '0.25rem 0 0', whiteSpace: 'pre-wrap' }}>{job.cleaner_notes}</p>
            </div>
          )}
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              const window = calculateWindow(stay, stays)
              composeText(job, window)
            }}
          >
            Resend Text
          </button>
          <a href={`/job/${job.job_token}`} target="_blank" rel="noreferrer">
            <button className="btn btn-ghost btn-sm">Open job page</button>
          </a>
          <button className="btn btn-ghost btn-sm" onClick={() => copyJobLink(job)}>
            {copiedJobId === job.id ? 'Copied!' : 'Copy link'}
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => markJobComplete(job.id)}
            style={{ color: 'var(--color-success)', display: 'block', marginTop: 'var(--spacing-xs)' }}
          >
            ✅ Mark Complete
          </button>
        </div>
      )
    }

    if (job.status === 'complete') {
      return (
        <div style={{ marginTop: '0.5rem' }}>
          <span style={{
            padding: '0.25rem 0.75rem',
            borderRadius: '999px',
            fontSize: '0.8rem',
            fontWeight: 'bold',
            background: '#cce5ff',
            color: '#004085',
          }}>
            ✅ Complete
          </span>
          <button
            onClick={() => undoJobComplete(job.id)}
            style={{
              marginTop: '0.25rem',
              cursor: 'pointer',
              fontSize: '0.85rem',
              display: 'block',
              marginLeft: 'auto',
              marginRight: 'auto',
              color: '#666',
              background: 'none',
              border: 'none',
              textDecoration: 'underline',
              padding: 0,
            }}
          >
            Undo complete
          </button>
          <p style={{ fontSize: '0.85rem', margin: '0.25rem 0' }}>
            {job.cleaner?.name} — {job.scheduled_date}
          </p>
          {job.cleaner_notes && (
            <div style={{
              marginTop: '0.5rem',
              padding: '0.5rem 0.75rem',
              background: '#f8f9fa',
              borderRadius: '4px',
              borderLeft: '3px solid #2563eb',
              fontSize: '0.85rem',
            }}>
              <strong>Cleaner notes:</strong>
              <p style={{ margin: '0.25rem 0 0', whiteSpace: 'pre-wrap' }}>{job.cleaner_notes}</p>
            </div>
          )}
        </div>
      )
    }

    return null
  }

  const visibleStays = sortList(
    stays.filter(s => {
      if (!matchesSearch(`${s.guest_name || ''} ${s.notes || ''}`, search)) return false
      if (sourceFilter !== 'all' && s.source !== sourceFilter) return false
      if (cleaningFilter !== 'all') {
        const job = getActiveJob(s)
        const state = !job ? 'unassigned' : job.status === 'offered' ? 'pending' : 'covered'
        if (state !== cleaningFilter) return false
      }
      if (flagFilter === 'flagged' && !((s.flags || []).length > 0 || s.feed_missing_at)) return false
      return true
    }),
    s => getStaySortValue(s, sortKey),
    sortDir
  )

  // Only stays currently shown can be acted on, so a filter can never
  // leave a hidden selection that a bulk action would still affect.
  const selectedStays = visibleStays.filter(s => selectedIds.includes(s.id))

  const activeFilterCount =
    (search.trim() ? 1 : 0) +
    (sourceFilter !== 'all' ? 1 : 0) +
    (cleaningFilter !== 'all' ? 1 : 0) +
    (flagFilter !== 'all' ? 1 : 0)

  function resetFilters() {
    setSearch('')
    setSourceFilter('all')
    setCleaningFilter('all')
    setFlagFilter('all')
  }

  function toggleSelected(id) {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  function exitSelectMode() {
    setSelectMode(false)
    setSelectedIds([])
  }

  async function bulkArchive(archive) {
    if (selectedStays.length === 0) return
    const n = selectedStays.length
    const verb = archive ? 'Archive' : 'Unarchive'
    if (!confirm(`${verb} ${n} stay${n === 1 ? '' : 's'}?`)) return
    const changes = archive ? { archived: true } : { archived: false, cancelled_at: null }
    await supabase.from('stay').update(changes).in('id', selectedStays.map(s => s.id))
    exitSelectMode()
    fetchAll()
  }

  async function bulkRemove() {
    if (selectedStays.length === 0) return
    const n = selectedStays.length
    const openJobs = selectedStays.flatMap(s =>
      (s.cleaning_job || [])
        .filter(j => ['offered', 'confirmed'].includes(j.status))
        .map(j => `${j.cleaner?.name || 'a cleaner'} (${j.scheduled_date})`)
    )
    const completedJobs = selectedStays.flatMap(s =>
      (s.cleaning_job || []).filter(j => j.status === 'complete')
    ).length

    let msg = `Permanently remove ${n} stay${n === 1 ? '' : 's'}? This also deletes their cleaning jobs and supply reports, and cannot be undone. Archive is safer if you only want them out of the way.`
    if (openJobs.length > 0) {
      msg += `\n\nOpen jobs that will be deleted: ${openJobs.join(', ')}. Remember to tell those cleaners.`
    }
    if (completedJobs > 0) {
      msg += `\n\n${completedJobs} completed job${completedJobs === 1 ? '' : 's'}, including payment records, will also be deleted.`
    }
    if (!confirm(msg)) return

    await supabase.from('stay').delete().in('id', selectedStays.map(s => s.id))
    exitSelectMode()
    fetchAll()
  }

  if (loading && stays.length === 0) return <p>Loading stays...</p>

  return (
    <section className="section">
      <div className="section-header">
        <h2>
          Stays {showArchived && <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'normal', color: 'var(--color-text-muted)', marginLeft: 'var(--spacing-xs)' }}>— viewing archived</span>}
        </h2>
        <div className="row">
          <button className="btn btn-ghost btn-sm" onClick={fetchAll}>↻ Refresh</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowArchived(prev => !prev)}>
            {showArchived ? 'Hide archived' : 'Show archived'}
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowStayForm(true)}>+ Add Stay</button>
        </div>
      </div>
      <ListToolbar
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Search name or notes..."
        sortOptions={STAY_SORT_OPTIONS}
        sortKey={sortKey}
        onSortKey={setSortKey}
        sortDir={sortDir}
        onSortDir={setSortDir}
        filters={[
          {
            key: 'source', label: 'Source', value: sourceFilter, onChange: setSourceFilter,
            options: [
              { value: 'all', label: 'All sources' },
              { value: 'airbnb', label: 'Airbnb' },
              { value: 'vrbo', label: 'VRBO' },
              { value: 'direct', label: 'Direct' },
              { value: 'manual', label: 'Manual' },
            ],
          },
          {
            key: 'cleaning', label: 'Cleaning', value: cleaningFilter, onChange: setCleaningFilter,
            options: [
              { value: 'all', label: 'Any cleaning status' },
              { value: 'unassigned', label: 'Unassigned' },
              { value: 'pending', label: 'Offer pending' },
              { value: 'covered', label: 'Confirmed/complete' },
            ],
          },
          {
            key: 'flags', label: 'Flags', value: flagFilter, onChange: setFlagFilter,
            options: [
              { value: 'all', label: 'All stays' },
              { value: 'flagged', label: 'Has flags or warnings' },
            ],
          },
        ]}
        activeCount={activeFilterCount}
        onReset={resetFilters}
        selectMode={selectMode}
        onToggleSelect={() => (selectMode ? exitSelectMode() : setSelectMode(true))}
        selectedCount={selectedStays.length}
        shownCount={visibleStays.length}
        onSelectAll={() => setSelectedIds(visibleStays.map(s => s.id))}
        onClearSelection={() => setSelectedIds([])}
        bulkActions={[
          showArchived
            ? { label: 'Unarchive', onClick: () => bulkArchive(false) }
            : { label: 'Archive', onClick: () => bulkArchive(true) },
          { label: 'Remove', danger: true, onClick: bulkRemove },
        ]}
      />

      {stays.length > 0 && visibleStays.length === 0 && (
        <p className="empty-state">No stays match your filters.</p>
      )}
      {composedText && !stays.some(s => s.id === composedStayId) && renderComposedCard()}

      {stays.length === 0
        ? <p>No stays yet.</p>
        : visibleStays.map(s => (
          <div
            key={s.id}
            id={s.id}
            className="card"
            style={{
              marginTop: 'var(--spacing-sm)',
              borderColor: selectMode && selectedIds.includes(s.id) ? 'var(--color-primary)' : undefined,
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
                  checked={selectedIds.includes(s.id)}
                  onChange={() => toggleSelected(s.id)}
                />
                Select
              </label>
            )}
            <div className="row-between">
              <div>
                <strong style={{ fontSize: 'var(--font-size-base)' }}>{s.guest_name || 'Guest'}</strong>
                <p style={{ margin: 'var(--spacing-xs) 0', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
                  📅 {s.check_in} → {s.check_out}
                </p>
                <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                  {s.source}
                </p>
                {s.cancelled_at && <span className="badge badge-danger">Cancelled</span>}
              </div>
              <div className="col" style={{ alignItems: 'flex-end' }}>
                <button className="btn btn-secondary btn-sm" onClick={() => setEditingStay(s)}>
                  Edit
                </button>
                {!showArchived && (
                  <button className="btn btn-ghost btn-sm" onClick={() => archiveStay(s.id)}>
                    Archive
                  </button>
                )}
                {showArchived && (
                  <button className="btn btn-ghost btn-sm" onClick={() => unarchiveStay(s.id)}>
                    Unarchive
                  </button>
                )}
                {!showArchived && (
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => cancelStay(s.id)}
                    style={{ color: 'var(--color-warning)' }}
                  >
                    Cancel stay
                  </button>
                )}
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => deleteStay(s.id)}
                  style={{ color: 'var(--color-danger)' }}
                >
                  Remove
                </button>
              </div>
            </div>

            {s.notes && (
              <div className="note-block" style={{ marginTop: 'var(--spacing-sm)' }}>
                {s.notes}
              </div>
            )}

            {s.feed_missing_at && (
              <div className="alert alert-warning" style={{ marginTop: 'var(--spacing-sm)' }}>
                <p style={{ margin: '0 0 var(--spacing-sm)', fontWeight: '600' }}>
                  ⚠️ No longer in the {s.source} calendar feed
                </p>
                <p style={{ margin: '0 0 var(--spacing-sm)', fontSize: 'var(--font-size-sm)' }}>
                  This booking may have been cancelled. Check the platform, then choose below.
                </p>
                {(() => {
                  const job = (s.cleaning_job || []).find(j => j.status === 'offered' || j.status === 'confirmed')
                  return job?.cleaner ? (
                    <p style={{ margin: '0 0 var(--spacing-sm)', fontSize: 'var(--font-size-sm)', fontWeight: '600' }}>
                      📞 If cancelled, let {job.cleaner.name} know{job.cleaner.phone ? ` (${job.cleaner.phone})` : ''}. There wasa {job.status} job on {job.scheduled_date}.
                    </p>
                  ) : null
                })()}
                <div className="row">
                  <button className="btn btn-secondary btn-sm" onClick={() => keepMissingStay(s.id)}>
                    Keep it (still valid)
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={() => cancelStay(s.id)}>
                    Cancel stay
                  </button>
                </div>
              </div>
            )}

            <StayFlags stay={s} onUpdate={fetchAll} />

            {getStandaloneConflicts(s, standaloneJobs).map(j => (
              <div key={j.id} className="alert alert-warning" style={{ marginTop: 'var(--spacing-sm)', fontSize: 'var(--font-size-xs)' }}>
                ⚠️ {j.title || 'Standalone job'} scheduled on {j.scheduled_date}
                {(j.cleaner?.name || j.worker_name) && ` (${j.cleaner?.name || j.worker_name})`}
              </div>
            ))}

            {getStatusDisplay(s)}
            {composedText && composedStayId === s.id && renderComposedCard()}
          </div>
        ))
      }
      {showStayForm && (
        <Modal title="Add Stay" onClose={() => setShowStayForm(false)}>
          <StayForm
            onSave={addStay}
            onCancel={() => setShowStayForm(false)}
          />
        </Modal>
      )}
      {offerStay && (
        <Modal title="Create Job Offer" onClose={() => setOfferStay(null)}>
          <JobOfferForm
            stay={offerStay}
            window={calculateWindow(offerStay, stays)}
            cleaners={cleaners.filter(c => !getDeclinedCleaners(offerStay).includes(c.name))}
            onSave={createOffer}
            onCancel={() => setOfferStay(null)}
          />
        </Modal>
      )}
      {editingStay && (
        <Modal title="Edit Stay" onClose={() => setEditingStay(null)}>
          <StayEditForm
            initial={editingStay}
            onSave={updateStay}
            onCancel={() => setEditingStay(null)}
          />
        </Modal>
      )}
    </section>
  )
}