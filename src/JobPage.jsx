import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from './supabaseClient'

export default function JobPage() {
  const { token } = useParams()
  const [job, setJob] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [supplies, setSupplies] = useState([])
  const [flags, setFlags] = useState({})
  const [notes, setNotes] = useState({})
  const [flagsSubmitted, setFlagsSubmitted] = useState(false)
  const [selectedDate, setSelectedDate] = useState(null)
  const [dateConfirmed, setDateConfirmed] = useState(false)
  const [showResignForm, setShowResignForm] = useState(false)
  const [resignNote, setResignNote] = useState('')
  const [changingDate, setChangingDate] = useState(false)
  const [cleanerNotes, setCleanerNotes] = useState('')
  const [notesSaved, setNotesSaved] = useState(false)
  const [showAddSupply, setShowAddSupply] = useState(false)
  const [newSupply, setNewSupply] = useState({ name: '', category: '', status: 'low' })
  const [showCompleteForm, setShowCompleteForm] = useState(false)

  useEffect(() => {
    fetchJob()
  }, [token])

  async function fetchJob() {
    setLoading(true)

    const { data: jobData, error: jobError } = await supabase
      .from('cleaning_job')
      .select('*, stay(*), cleaner(*)')
      .eq('job_token', token)
      .single()

    if (jobError || !jobData) {
      setError('This link is invalid or has expired.')
      setLoading(false)
      return
    }

    setJob(jobData)

    if (jobData.cleaner_notes) {
      setCleanerNotes(jobData.cleaner_notes)
      setNotesSaved(true)
    }

    if (jobData.status === 'confirmed' || jobData.status === 'in_progress') {
      setDateConfirmed(true)
    }

    const { data: supplyData } = await supabase
      .from('supply_item')
      .select('*')
      .eq('property_id', jobData.property_id)
      .order('category', { ascending: true })

    setSupplies(supplyData || [])

    const { data: existingFlags } = await supabase
      .from('supply_flag')
      .select('*')
      .eq('job_id', jobData.id)
      .eq('resolved', false)

    if (existingFlags && existingFlags.length > 0) {
      setFlagsSubmitted(true)
      const restoredFlags = {}
      const restoredNotes = {}
      existingFlags.forEach(f => {
        restoredFlags[f.supply_item_id] = f.status
        if (f.cleaner_note) restoredNotes[f.supply_item_id] = f.cleaner_note
      })
      setFlags(restoredFlags)
      setNotes(restoredNotes)
    }

    setLoading(false)
  }

  function getAvailableDates(job) {
    if (!job.window_start || !job.window_end) return []
    const dates = []
    const current = new Date(job.window_start)
    const end = new Date(job.window_end)
    while (current <= end) {
      dates.push(current.toISOString().split('T')[0])
      current.setDate(current.getDate() + 1)
    }
    return dates
  }

  async function confirmDate() {
    if (!selectedDate) return
    setSubmitting(true)

    await supabase
      .from('cleaning_job')
      .update({ status: 'confirmed', scheduled_date: selectedDate })
      .eq('job_token', token)

    setJob(prev => ({ ...prev, status: 'confirmed', scheduled_date: selectedDate }))
    setDateConfirmed(true)
    setSubmitting(false)
  }

  async function changeDate() {
    if (!selectedDate) return
    setSubmitting(true)

    await supabase
      .from('cleaning_job')
      .update({ scheduled_date: selectedDate })
      .eq('job_token', token)

    setJob(prev => ({ ...prev, scheduled_date: selectedDate }))
    setChangingDate(false)
    setSubmitting(false)
  }

  async function saveNotes() {
    setSubmitting(true)

    await supabase
      .from('cleaning_job')
      .update({ cleaner_notes: cleanerNotes })
      .eq('job_token', token)

    setNotesSaved(true)
    setSubmitting(false)
  }

  async function addSupplyItem() {
    if (!newSupply.name.trim()) return
    setSubmitting(true)

    const { data: item } = await supabase
      .from('supply_item')
      .insert([{
        property_id: job.property_id,
        name: newSupply.name.trim(),
        category: newSupply.category.trim() || null,
        current_status: newSupply.status,
      }])
      .select()
      .single()

    if (item && newSupply.status !== 'ok') {
      await supabase
        .from('supply_flag')
        .insert([{
          job_id: job.id,
          supply_item_id: item.id,
          status: newSupply.status,
        }])
    }

    setNewSupply({ name: '', category: '', status: 'low' })
    setShowAddSupply(false)
    await fetchJob()
    setSubmitting(false)
  }

  async function decline() {
    setSubmitting(true)

    await supabase
      .from('cleaning_job')
      .update({ status: 'declined' })
      .eq('job_token', token)

    setJob(prev => ({ ...prev, status: 'declined' }))
    setSubmitting(false)
  }

  async function resign() {
    setSubmitting(true)

    await supabase
      .from('cleaning_job')
      .update({
        status: 'declined',
        payment_note: resignNote ? `Resigned: ${resignNote}` : 'Resigned by cleaner'
      })
      .eq('job_token', token)

    setJob(prev => ({ ...prev, status: 'declined' }))
    setSubmitting(false)
  }

  async function markComplete() {
    setSubmitting(true)
    await supabase
      .from('cleaning_job')
      .update({ status: 'complete' })
      .eq('job_token', token)
    setJob(prev => ({ ...prev, status: 'complete' }))
    setShowCompleteForm(false)
    setSubmitting(false)
  }

  async function undoComplete() {
    setSubmitting(true)
    await supabase
      .from('cleaning_job')
      .update({ status: 'confirmed' })
      .eq('job_token', token)
    setJob(prev => ({ ...prev, status: 'confirmed' }))
    setSubmitting(false)
  }

  async function submitFlags() {
    setSubmitting(true)

    for (const [supplyId, status] of Object.entries(flags)) {
      const { data: existing } = await supabase
        .from('supply_flag')
        .select('id')
        .eq('job_id', job.id)
        .eq('supply_item_id', supplyId)
        .single()

      if (status === 'ok') {
        if (existing) {
          await supabase
            .from('supply_flag')
            .update({ resolved: true, cleaner_note: null })
            .eq('id', existing.id)
        }
        await supabase
          .from('supply_item')
          .update({ current_status: 'ok' })
          .eq('id', supplyId)
      } else {
        if (existing) {
          await supabase
            .from('supply_flag')
            .update({
              status,
              cleaner_note: notes[supplyId] || null,
              resolved: false,
            })
            .eq('id', existing.id)
        } else {
          await supabase
            .from('supply_flag')
            .insert([{
              job_id: job.id,
              supply_item_id: supplyId,
              status,
              cleaner_note: notes[supplyId] || null,
            }])
        }
        await supabase
          .from('supply_item')
          .update({ current_status: status })
          .eq('id', supplyId)
      }
    }

    setFlagsSubmitted(true)
    setSubmitting(false)
  }

  function setFlag(supplyId, status) {
    setFlags(prev => ({ ...prev, [supplyId]: status }))
  }

  function setNote(supplyId, note) {
    setNotes(prev => ({ ...prev, [supplyId]: note }))
  }

  if (loading) return (
    <div style={styles.centered}>
      <p style={{ color: 'var(--color-text-muted)' }}>Loading job details...</p>
    </div>
  )

  if (error) return (
    <div style={styles.centered}>
      <h2>Link Not Found</h2>
      <p style={{ color: 'var(--color-text-muted)' }}>{error}</p>
    </div>
  )

  if (job.status === 'declined') return (
    <div style={styles.centered}>
      <h2>Job Declined</h2>
      <p style={{ color: 'var(--color-text-muted)' }}>No problem — we will follow up shortly.</p>
    </div>
  )

  const availableDates = getAvailableDates(job)

  function downloadCalendarEvent() {
    const cleaningDate = job.scheduled_date?.replace(/-/g, '')
    const nextDay = new Date(job.scheduled_date)
    nextDay.setDate(nextDay.getDate() + 1)
    const nextDayStr = nextDay.toISOString().split('T')[0].replace(/-/g, '')

    const jobUrl = `https://whitetailspur.com/job/${job.job_token}`

    const description = [
      `Guest stay: ${job.stay?.check_in} to ${job.stay?.check_out}`,
      `Cleaning date: ${job.scheduled_date}`,
      `Job details & supply checklist: ${jobUrl}`,
    ].join('\\n')

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Whitetail Spur//WS Manager//EN',
      'BEGIN:VEVENT',
      `DTSTART;VALUE=DATE:${cleaningDate}`,
      `DTEND;VALUE=DATE:${nextDayStr}`,
      `SUMMARY:Cleaning Job — Whitetail Spur`,
      `DESCRIPTION:${description}`,
      `URL:${jobUrl}`,
      `END:VEVENT`,
      'END:VCALENDAR',
    ].join('\r\n')

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `cleaning-job-${job.scheduled_date}.ics`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <div style={styles.page}>
      <h1 style={{ marginBottom: 'var(--spacing-xs)' }}>Cleaning Job</h1>
      <p style={{ color: 'var(--color-text-muted)', marginTop: 0, marginBottom: 'var(--spacing-lg)' }}>
        {job.cleaner?.name} · checkout {job.stay?.check_out}
      </p>

      <div className="card" style={{ marginBottom: 'var(--spacing-md)' }}>
        <h2 style={{ marginTop: 0, marginBottom: 'var(--spacing-md)' }}>Job Details</h2>
        <p style={{ fontSize: 'var(--font-size-sm)', marginBottom: 'var(--spacing-xs)' }}>
          <strong>Guest checkout:</strong> {job.stay?.check_out}
        </p>
        <p style={{ fontSize: 'var(--font-size-sm)', marginBottom: 'var(--spacing-xs)' }}>
          <strong>Rate:</strong> ${job.agreed_rate}
        </p>
        <p style={{ fontSize: 'var(--font-size-sm)', marginBottom: 'var(--spacing-xs)' }}>
          <strong>Assigned to:</strong> {job.cleaner?.name}
        </p>
        {job.window_start && (
          <p style={{ fontSize: 'var(--font-size-sm)', marginBottom: 'var(--spacing-xs)' }}>
            <strong>Available dates:</strong> {job.window_start} through {job.window_end}
          </p>
        )}
        {dateConfirmed && (
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-success)', fontWeight: '600', marginBottom: 0 }}>
            ✓ Confirmed for {job.scheduled_date}
          </p>
        )}
      </div>

      {job.status === 'offered' && (
        <div className="card" style={{ marginBottom: 'var(--spacing-md)' }}>
          <h2 style={{ marginTop: 0, marginBottom: 'var(--spacing-sm)' }}>Select Your Cleaning Date</h2>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--spacing-md)' }}>
            Choose the date you can do this job, then confirm or decline below.
          </p>

          {availableDates.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)', marginBottom: 'var(--spacing-md)' }}>
              {availableDates.map(date => (
                <button
                  key={date}
                  onClick={() => setSelectedDate(date)}
                  className={`btn ${selectedDate === date ? 'btn-success' : 'btn-secondary'}`}
                  style={{ textAlign: 'left', justifyContent: 'flex-start' }}
                >
                  {date}
                </button>
              ))}
            </div>
          ) : (
            <p style={{ color: 'var(--color-warning)' }}>No date window set — please contact the property owner.</p>
          )}

          <div className="row">
            <button
              className="btn btn-primary btn-lg"
              onClick={confirmDate}
              disabled={!selectedDate || submitting}
              style={{ flex: 1 }}
            >
              Confirm Date & Accept
            </button>
            <button
              className="btn btn-danger btn-lg"
              onClick={decline}
              disabled={submitting}
              style={{ flex: 1 }}
            >
              Decline
            </button>
          </div>
          {!selectedDate && (
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: 'var(--spacing-sm)' }}>
              Please select a date above before confirming.
            </p>
          )}
        </div>
      )}

      {dateConfirmed && (
        <div style={{ marginTop: 'var(--spacing-md)' }}>
          <div className="alert alert-success" style={{ marginBottom: 'var(--spacing-md)' }}>
            <p style={{ margin: '0 0 var(--spacing-sm)', fontWeight: '600' }}>
              ✓ Job confirmed for {job.scheduled_date}
            </p>
            <button
              className="btn btn-secondary btn-sm"
              onClick={downloadCalendarEvent}
            >
              Add to Calendar
            </button>

            {!showResignForm && !changingDate && (
              <div className="row" style={{ marginTop: 'var(--spacing-sm)' }}>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setChangingDate(true)
                    setSelectedDate(job.scheduled_date)
                  }}
                >
                  Change my date
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setShowResignForm(true)}
                  style={{ color: 'var(--color-danger)' }}
                >
                  I can no longer do this job
                </button>
              </div>
            )}

            {changingDate && (
              <div style={{ marginTop: 'var(--spacing-md)', paddingTop: 'var(--spacing-md)', borderTop: '1px solid var(--color-border)' }}>
                <p style={{ margin: '0 0 var(--spacing-sm)', fontSize: 'var(--font-size-sm)', fontWeight: '600' }}>
                  Select a new date:
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)', marginBottom: 'var(--spacing-md)' }}>
                  {availableDates.map(date => (
                    <button
                      key={date}
                      onClick={() => setSelectedDate(date)}
                      className={`btn btn-sm ${selectedDate === date ? 'btn-success' : 'btn-secondary'}`}
                      style={{ textAlign: 'left', justifyContent: 'flex-start' }}
                    >
                      {date}
                    </button>
                  ))}
                </div>
                <div className="row">
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={changeDate}
                    disabled={!selectedDate || submitting}
                    style={{ flex: 1 }}
                  >
                    Confirm New Date
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      setChangingDate(false)
                      setSelectedDate(job.scheduled_date)
                    }}
                    style={{ flex: 1 }}
                  >
                    Never mind
                  </button>
                </div>
              </div>
            )}

            {!changingDate && showResignForm && (
              <div style={{ marginTop: 'var(--spacing-md)', paddingTop: 'var(--spacing-md)', borderTop: '1px solid var(--color-border)' }}>
                <p style={{ margin: '0 0 var(--spacing-sm)', fontSize: 'var(--font-size-sm)', fontWeight: '600' }}>
                  Please let us know why if you can:
                </p>
                <input
                  type="text"
                  placeholder="Optional reason..."
                  value={resignNote}
                  onChange={e => setResignNote(e.target.value)}
                  className="form-input"
                  style={{ marginBottom: 'var(--spacing-sm)' }}
                />
                <div className="row">
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={resign}
                    disabled={submitting}
                    style={{ flex: 1 }}
                  >
                    Confirm — I can't do this job
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      setShowResignForm(false)
                      setResignNote('')
                    }}
                    style={{ flex: 1 }}
                  >
                    Never mind
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="card" style={{ marginBottom: 'var(--spacing-md)' }}>
            <h2 style={{ marginTop: 0, marginBottom: 'var(--spacing-sm)' }}>Cleaning Notes</h2>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--spacing-md)' }}>
              Any observations, issues, or things the owner should know about this job.
            </p>
            {notesSaved ? (
              <div>
                <p style={{ whiteSpace: 'pre-wrap', fontSize: 'var(--font-size-sm)' }}>{cleanerNotes}</p>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setNotesSaved(false)}
                  style={{ marginTop: 'var(--spacing-xs)' }}
                >
                  Edit notes
                </button>
              </div>
            ) : (
              <div>
                <textarea
                  value={cleanerNotes}
                  onChange={e => setCleanerNotes(e.target.value)}
                  placeholder="e.g. Back door was left unlocked, master bath needs new shower curtain liner..."
                  rows={4}
                  className="form-input"
                  style={{ resize: 'vertical', marginBottom: 'var(--spacing-sm)' }}
                />
                <div className="row">
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={saveNotes}
                    disabled={submitting || !cleanerNotes.trim()}
                    style={{ flex: 1 }}
                  >
                    Save Notes
                  </button>
                  {cleanerNotes.trim() === '' && (
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => setNotesSaved(true)}
                      style={{ flex: 1 }}
                    >
                      Skip
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {!showCompleteForm ? (
            <button
              className="btn btn-primary btn-block"
              style={{ marginBottom: 'var(--spacing-md)' }}
              onClick={() => setShowCompleteForm(true)}
            >
              ✅ Mark Job Complete
            </button>
          ) : (
            <div className="card" style={{ marginBottom: 'var(--spacing-md)' }}>
              <p style={{ margin: '0 0 var(--spacing-sm)', fontWeight: '600' }}>Mark this job as complete?</p>
              <p style={{ margin: '0 0 var(--spacing-md)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
                Make sure you have submitted your supply report before marking complete.
              </p>
              <div className="row">
                <button className="btn btn-primary btn-sm" onClick={markComplete} disabled={submitting} style={{ flex: 1 }}>
                  Yes, job is complete
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowCompleteForm(false)} style={{ flex: 1 }}>
                  Not yet
                </button>
              </div>
            </div>
          )}

          {supplies.length > 0 && (
            <div className="card" style={{ marginBottom: 'var(--spacing-md)' }}>
              <h2 style={{ marginTop: 0, marginBottom: 'var(--spacing-sm)' }}>🧴 Supply Check</h2>
              <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--spacing-md)' }}>
                Please mark anything that is running low or out.
              </p>

              {flagsSubmitted ? (
                <div>
                  <p style={{ color: 'var(--color-success)', fontWeight: '600' }}>✅ Supply flags submitted. Thank you!</p>
                  <button className="btn btn-ghost btn-sm" onClick={() => setFlagsSubmitted(false)} style={{ marginTop: 'var(--spacing-xs)' }}>
                    ✏️ Edit supply report
                  </button>
                </div>
              ) : (
                <>
                  {supplies.map(s => (
                    <div key={s.id} style={{ marginBottom: 'var(--spacing-md)', paddingBottom: 'var(--spacing-md)', borderBottom: '1px solid var(--color-border)' }}>
                      <strong>{s.name}</strong>
                      {s.category && <span style={{ marginLeft: 'var(--spacing-sm)', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)' }}>({s.category})</span>}
                      {s.par_level_note && <p style={{ margin: 'var(--spacing-xs) 0', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>{s.par_level_note}</p>}
                      <div className="row" style={{ marginTop: 'var(--spacing-sm)' }}>
                        {['ok', 'low', 'out'].map(status => (
                          <button
                            key={status}
                            onClick={() => setFlag(s.id, status)}
                            className={`btn btn-sm ${flags[s.id] === status
                                ? status === 'ok' ? 'btn-success'
                                  : status === 'low' ? 'btn-warning'
                                    : 'btn-danger'
                                : 'btn-secondary'
                              }`}
                          >
                            {status === 'ok' ? '✓ OK' : status === 'low' ? '⚠️ Low' : '❌ Out'}
                          </button>
                        ))}
                      </div>
                      {notes[s.id] !== undefined && notes[s.id] !== '' ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginTop: 'var(--spacing-sm)' }}>
                          <input
                            type="text"
                            placeholder="Optional note..."
                            value={notes[s.id].trim()}
                            onChange={e => setNote(s.id, e.target.value)}
                            className="form-input"
                            style={{ flex: 1 }}
                          />
                          <button className="btn btn-ghost btn-sm" onClick={() => setNote(s.id, '')}>×</button>
                        </div>
                      ) : (
                        <button className="btn btn-ghost btn-sm" onClick={() => setNote(s.id, ' ')} style={{ marginTop: 'var(--spacing-sm)' }}>
                          + Add note
                        </button>
                      )}
                    </div>
                  ))}

                  <div className="row" style={{ marginTop: 'var(--spacing-sm)' }}>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={submitFlags}
                      disabled={submitting || Object.keys(flags).length === 0}
                      style={{ flex: 1 }}
                    >
                      Submit Supply Report
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => setFlagsSubmitted(true)}
                      style={{ flex: 1 }}
                    >
                      Cancel
                    </button>
                  </div>
                  {Object.keys(flags).length === 0 && (
                    <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: 'var(--spacing-sm)' }}>
                      Mark at least one item above to submit.
                    </p>
                  )}

                  <div style={{ marginTop: 'var(--spacing-md)', paddingTop: 'var(--spacing-md)', borderTop: '1px solid var(--color-border)' }}>
                    {!showAddSupply ? (
                      <button className="btn btn-ghost btn-sm" onClick={() => setShowAddSupply(true)}>
                        + Something missing from this list?
                      </button>
                    ) : (
                      <div>
                        <p style={{ margin: '0 0 var(--spacing-sm)', fontSize: 'var(--font-size-sm)', fontWeight: '600' }}>Add a supply item:</p>
                        <input
                          type="text"
                          placeholder="Item name (required)"
                          value={newSupply.name}
                          onChange={e => setNewSupply(prev => ({ ...prev, name: e.target.value }))}
                          className="form-input"
                          style={{ marginBottom: 'var(--spacing-sm)' }}
                        />
                        <input
                          type="text"
                          placeholder="Category (e.g. Kitchen, Bathroom)"
                          value={newSupply.category}
                          onChange={e => setNewSupply(prev => ({ ...prev, category: e.target.value }))}
                          className="form-input"
                          style={{ marginBottom: 'var(--spacing-sm)' }}
                        />
                        <div className="row" style={{ marginBottom: 'var(--spacing-sm)' }}>
                          {['ok', 'low', 'out'].map(status => (
                            <button
                              key={status}
                              onClick={() => setNewSupply(prev => ({ ...prev, status }))}
                              className={`btn btn-sm ${newSupply.status === status
                                  ? status === 'ok' ? 'btn-success'
                                    : status === 'low' ? 'btn-warning'
                                      : 'btn-danger'
                                  : 'btn-secondary'
                                }`}
                              style={{ flex: 1 }}
                            >
                              {status === 'ok' ? '✓ OK' : status === 'low' ? '⚠️ Low' : '❌ Out'}
                            </button>
                          ))}
                        </div>
                        <div className="row">
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={addSupplyItem}
                            disabled={submitting || !newSupply.name.trim()}
                            style={{ flex: 1 }}
                          >
                            Add Item
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => { setShowAddSupply(false); setNewSupply({ name: '', category: '', status: 'low' }) }}
                            style={{ flex: 1 }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {job.status === 'complete' && (
        <div className="alert alert-info" style={{ marginTop: 'var(--spacing-lg)' }}>
          <p style={{ margin: '0 0 var(--spacing-sm)', fontWeight: '600' }}>✅ This job is marked complete. Thank you for your work!</p>
          <button
            className="btn btn-ghost btn-sm"
            onClick={undoComplete}
            disabled={submitting}
          >
            Undo — job is not complete yet
          </button>
        </div>
      )}
    </div>
  )
}

const styles = {
  page: {
    maxWidth: '600px',
    margin: '0 auto',
    padding: 'var(--spacing-xl) var(--spacing-md)',
    fontFamily: 'var(--font-family)',
  },
  centered: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    fontFamily: 'var(--font-family)',
    textAlign: 'center',
    padding: 'var(--spacing-xl)',
  },
}