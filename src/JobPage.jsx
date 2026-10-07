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
      <p>Loading job details...</p>
    </div>
  )

  if (error) return (
    <div style={styles.centered}>
      <h2>Link Not Found</h2>
      <p>{error}</p>
    </div>
  )

  if (job.status === 'declined') return (
    <div style={styles.centered}>
      <h2>❌ Job Declined</h2>
      <p>No problem — we will follow up shortly.</p>
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
      <h1 style={{ marginBottom: '0.25rem' }}>Cleaning Job</h1>
      <p style={{ color: '#666', marginTop: 0 }}>
        {job.cleaner?.name} · {job.stay?.check_out}
      </p>

      <div style={styles.card}>
        <h2 style={{ marginTop: 0 }}>Job Details</h2>
        <p>🏠 <strong>Guest checkout:</strong> {job.stay?.check_out}</p>
        <p>💵 <strong>Rate:</strong> ${job.agreed_rate}</p>
        <p>👤 <strong>Assigned to:</strong> {job.cleaner?.name}</p>
        {job.window_start && (
          <p>📅 <strong>Available dates:</strong> {job.window_start} through {job.window_end}</p>
        )}
        {dateConfirmed && (
          <p>✅ <strong>Your confirmed date:</strong> {job.scheduled_date}</p>
        )}
      </div>

      {job.status === 'offered' && (
        <div style={styles.card}>
          <h2 style={{ marginTop: 0 }}>Select Your Cleaning Date</h2>
          <p style={{ color: '#666', fontSize: '0.9rem' }}>
            Choose the date you can do this job, then confirm or decline below.
          </p>

          {availableDates.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
              {availableDates.map(date => (
                <button
                  key={date}
                  onClick={() => setSelectedDate(date)}
                  style={{
                    padding: '0.6rem 1rem',
                    borderRadius: '4px',
                    border: '2px solid',
                    cursor: 'pointer',
                    textAlign: 'left',
                    background: selectedDate === date ? '#d4edda' : 'white',
                    borderColor: selectedDate === date ? '#28a745' : '#ccc',
                    color: selectedDate === date ? '#155724' : '#333',
                    fontWeight: selectedDate === date ? 'bold' : 'normal',
                  }}
                >
                  {date}
                </button>
              ))}
            </div>
          ) : (
            <p style={{ color: '#856404' }}>No date window set — please contact the property owner.</p>
          )}

          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
            <button
              onClick={confirmDate}
              disabled={!selectedDate || submitting}
              style={{
                ...styles.acceptButton,
                opacity: !selectedDate ? 0.5 : 1,
              }}
            >
              ✅ Confirm Date & Accept
            </button>
            <button
              onClick={decline}
              disabled={submitting}
              style={styles.declineButton}
            >
              ❌ Decline
            </button>
          </div>
          {!selectedDate && (
            <p style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.5rem' }}>
              Please select a date above before confirming.
            </p>
          )}
        </div>
      )}

      {dateConfirmed && (
        <div style={{ marginTop: '1.5rem' }}>
          <div style={{ padding: '1rem', background: '#d4edda', borderRadius: '4px', marginBottom: '1.5rem' }}>
            <p style={{ margin: 0, color: '#155724' }}>
              ✅ Job confirmed for {job.scheduled_date}. Thank you!
            </p>
            <button
              onClick={downloadCalendarEvent}
              style={{
                marginTop: '0.75rem',
                padding: '0.5rem 1rem',
                fontSize: '0.9rem',
                background: 'white',
                color: '#155724',
                border: '1px solid #155724',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '600',
              }}
            >
              📅 Add to Calendar
            </button>

            {!showResignForm && !changingDate && (
              <div style={{ marginTop: '0.5rem', display: 'flex', gap: '1rem' }}>
                <button
                  onClick={() => {
                    setChangingDate(true)
                    setSelectedDate(job.scheduled_date)
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#888',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    padding: 0,
                    textDecoration: 'underline',
                  }}
                >
                  Change my date
                </button>
                <button
                  onClick={() => setShowResignForm(true)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#888',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    padding: 0,
                    textDecoration: 'underline',
                  }}
                >
                  I can no longer do this job
                </button>
              </div>
            )}

            {changingDate && (
              <div style={{ marginTop: '0.75rem', borderTop: '1px solid #b8dbb8', paddingTop: '0.75rem' }}>
                <p style={{ margin: '0 0 0.5rem', fontSize: '0.9rem', color: '#155724' }}>
                  Select a new date:
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
                  {availableDates.map(date => (
                    <button
                      key={date}
                      onClick={() => setSelectedDate(date)}
                      style={{
                        padding: '0.6rem 1rem',
                        borderRadius: '4px',
                        border: '2px solid',
                        cursor: 'pointer',
                        textAlign: 'left',
                        background: selectedDate === date ? '#d4edda' : 'white',
                        borderColor: selectedDate === date ? '#28a745' : '#ccc',
                        color: selectedDate === date ? '#155724' : '#333',
                        fontWeight: selectedDate === date ? 'bold' : 'normal',
                      }}
                    >
                      {date}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={changeDate}
                    disabled={!selectedDate || submitting}
                    style={{
                      flex: 1,
                      padding: '0.6rem',
                      background: '#28a745',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      fontWeight: '600',
                      opacity: !selectedDate ? 0.5 : 1,
                    }}
                  >
                    Confirm New Date
                  </button>
                  <button
                    onClick={() => {
                      setChangingDate(false)
                      setSelectedDate(job.scheduled_date)
                    }}
                    style={{
                      flex: 1,
                      padding: '0.6rem',
                      background: 'white',
                      color: '#333',
                      border: '1px solid #ccc',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                    }}
                  >
                    Never mind
                  </button>
                </div>
              </div>
            )}

            {!changingDate && (
              <>
                {!showResignForm ? (
                  <div style={{ marginTop: '0.5rem' }} />
                ) : (
                  <div style={{ marginTop: '0.75rem', borderTop: '1px solid #b8dbb8', paddingTop: '0.75rem' }}>
                    <p style={{ margin: '0 0 0.5rem', fontSize: '0.9rem', color: '#155724' }}>
                      Please let us know why if you can:
                    </p>
                    <input
                      type="text"
                      placeholder="Optional reason..."
                      value={resignNote}
                      onChange={e => setResignNote(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        borderRadius: '4px',
                        border: '1px solid #b8dbb8',
                        boxSizing: 'border-box',
                        fontSize: '0.9rem',
                        marginBottom: '0.5rem',
                      }}
                    />
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        onClick={resign}
                        disabled={submitting}
                        style={{
                          flex: 1,
                          padding: '0.6rem',
                          background: '#dc3545',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '0.9rem',
                          fontWeight: '600',
                        }}
                      >
                        Confirm — I can't do this job
                      </button>
                      <button
                        onClick={() => {
                          setShowResignForm(false)
                          setResignNote('')
                        }}
                        style={{
                          flex: 1,
                          padding: '0.6rem',
                          background: 'white',
                          color: '#333',
                          border: '1px solid #ccc',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '0.9rem',
                        }}
                      >
                        Never mind
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <div style={styles.card}>
            <h2 style={{ marginTop: 0 }}>📝 Cleaning Notes</h2>
            <p style={{ color: '#666', fontSize: '0.9rem' }}>
              Any observations, issues, or things the owner should know about this job.
            </p>
            {notesSaved ? (
              <div>
                <p style={{ whiteSpace: 'pre-wrap', fontSize: '0.95rem' }}>{cleanerNotes}</p>
                <button
                  onClick={() => setNotesSaved(false)}
                  style={{ fontSize: '0.85rem', cursor: 'pointer', marginTop: '0.25rem' }}
                >
                  ✏️ Edit notes
                </button>
              </div>
            ) : (
              <div>
                <textarea
                  value={cleanerNotes}
                  onChange={e => setCleanerNotes(e.target.value)}
                  placeholder="e.g. Back door was left unlocked, master bath needs new shower curtain liner..."
                  rows={4}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    borderRadius: '4px',
                    border: '1px solid #ccc',
                    boxSizing: 'border-box',
                    fontSize: '0.95rem',
                    resize: 'vertical',
                  }}
                />
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <button
                    onClick={saveNotes}
                    disabled={submitting || !cleanerNotes.trim()}
                    style={{
                      flex: 1,
                      padding: '0.6rem',
                      background: '#2563eb',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      fontWeight: '600',
                      opacity: !cleanerNotes.trim() ? 0.5 : 1,
                    }}
                  >
                    Save Notes
                  </button>
                  {cleanerNotes.trim() === '' && (
                    <button
                      onClick={() => setNotesSaved(true)}
                      style={{
                        flex: 1,
                        padding: '0.6rem',
                        background: 'white',
                        color: '#333',
                        border: '1px solid #ccc',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.9rem',
                      }}
                    >
                      Skip
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>


          {supplies.length > 0 && (
            <div style={styles.card}>
              <h2 style={{ marginTop: 0 }}>🧴 Supply Check</h2>
              <p style={{ color: '#666', fontSize: '0.9rem' }}>
                Please mark anything that is running low or out.
              </p>

              {flagsSubmitted ? (
                <div>
                  <p style={{ color: '#155724', fontWeight: 'bold' }}>✅ Supply flags submitted. Thank you!</p>
                  <button
                    onClick={() => setFlagsSubmitted(false)}
                    style={{ fontSize: '0.85rem', cursor: 'pointer', marginTop: '0.25rem' }}
                  >
                    ✏️ Edit supply report
                  </button>
                </div>
              ) : (
                <>
                  {supplies.map(s => (
                    <div key={s.id} style={{ marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid #eee' }}>
                      <strong>{s.name}</strong>
                      {s.category && <span style={{ marginLeft: '0.5rem', color: '#666', fontSize: '0.85rem' }}>({s.category})</span>}
                      {s.par_level_note && <p style={{ margin: '0.25rem 0', fontSize: '0.85rem', color: '#666' }}>{s.par_level_note}</p>}
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                        {['ok', 'low', 'out'].map(status => (
                          <button
                            key={status}
                            onClick={() => setFlag(s.id, status)}
                            style={{
                              padding: '0.35rem 0.75rem',
                              borderRadius: '4px',
                              border: '2px solid',
                              cursor: 'pointer',
                              fontWeight: flags[s.id] === status ? 'bold' : 'normal',
                              background:
                                flags[s.id] === status
                                  ? status === 'ok' ? '#d4edda'
                                    : status === 'low' ? '#fff3cd'
                                      : '#f8d7da'
                                  : 'white',
                              borderColor:
                                flags[s.id] === status
                                  ? status === 'ok' ? '#28a745'
                                    : status === 'low' ? '#ffc107'
                                      : '#dc3545'
                                  : '#ccc',
                              color:
                                flags[s.id] === status
                                  ? status === 'ok' ? '#155724'
                                    : status === 'low' ? '#856404'
                                      : '#721c24'
                                  : '#333',
                            }}
                          >
                            {status === 'ok' ? '✓ OK' : status === 'low' ? '⚠️ Low' : '❌ Out'}
                          </button>
                        ))}
                      </div>

                      {notes[s.id] !== undefined && notes[s.id] !== '' ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                          <input
                            type="text"
                            placeholder="Optional note..."
                            value={notes[s.id].trim()}
                            onChange={e => setNote(s.id, e.target.value)}
                            style={{ flex: 1, padding: '0.4rem', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box' }}
                          />
                          <button
                            onClick={() => setNote(s.id, '')}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#888',
                              fontSize: '1.1rem',
                              cursor: 'pointer',
                              padding: '0 0.25rem',
                              lineHeight: 1,
                            }}
                          >
                            ×
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setNote(s.id, ' ')}
                          style={{
                            marginTop: '0.5rem',
                            background: 'none',
                            border: 'none',
                            color: '#888',
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                            padding: 0,
                            textDecoration: 'underline',
                          }}
                        >
                          + Add note
                        </button>
                      )}

                    </div>
                  ))}

                  <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                    <button
                      onClick={submitFlags}
                      disabled={submitting || Object.keys(flags).length === 0}
                      style={{ ...styles.acceptButton, flex: 1 }}
                    >
                      Submit Supply Report
                    </button>
                    <button
                      onClick={() => setFlagsSubmitted(true)}
                      style={{
                        flex: 1,
                        padding: '0.75rem',
                        fontSize: '1rem',
                        background: 'white',
                        color: '#333',
                        border: '1px solid #ccc',
                        borderRadius: '4px',
                        cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                  {Object.keys(flags).length === 0 && (
                    <p style={{ fontSize: '0.85rem', color: '#666' }}>Mark at least one item above to submit.</p>
                  )}

                  <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #eee' }}>
                    {!showAddSupply ? (
                      <button
                        onClick={() => setShowAddSupply(true)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#888',
                          fontSize: '0.85rem',
                          cursor: 'pointer',
                          padding: 0,
                          textDecoration: 'underline',
                        }}
                      >
                        + Something missing from this list?
                      </button>
                    ) : (
                      <div>
                        <p style={{ margin: '0 0 0.5rem', fontSize: '0.9rem', fontWeight: '600' }}>
                          Add a supply item:
                        </p>
                        <input
                          type="text"
                          placeholder="Item name (required)"
                          value={newSupply.name}
                          onChange={e => setNewSupply(prev => ({ ...prev, name: e.target.value }))}
                          style={{ width: '100%', padding: '0.4rem', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box', marginBottom: '0.5rem' }}
                        />
                        <input
                          type="text"
                          placeholder="Category (e.g. Kitchen, Bathroom)"
                          value={newSupply.category}
                          onChange={e => setNewSupply(prev => ({ ...prev, category: e.target.value }))}
                          style={{ width: '100%', padding: '0.4rem', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box', marginBottom: '0.5rem' }}
                        />
                        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                          {['ok', 'low', 'out'].map(status => (
                            <button
                              key={status}
                              onClick={() => setNewSupply(prev => ({ ...prev, status }))}
                              style={{
                                flex: 1,
                                padding: '0.35rem',
                                borderRadius: '4px',
                                border: '2px solid',
                                cursor: 'pointer',
                                fontWeight: newSupply.status === status ? 'bold' : 'normal',
                                background:
                                  newSupply.status === status
                                    ? status === 'ok' ? '#d4edda'
                                      : status === 'low' ? '#fff3cd'
                                        : '#f8d7da'
                                    : 'white',
                                borderColor:
                                  newSupply.status === status
                                    ? status === 'ok' ? '#28a745'
                                      : status === 'low' ? '#ffc107'
                                        : '#dc3545'
                                    : '#ccc',
                                color:
                                  newSupply.status === status
                                    ? status === 'ok' ? '#155724'
                                      : status === 'low' ? '#856404'
                                        : '#721c24'
                                    : '#333',
                                fontSize: '0.85rem',
                              }}
                            >
                              {status === 'ok' ? '✓ OK' : status === 'low' ? '⚠️ Low' : '❌ Out'}
                            </button>
                          ))}
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            onClick={addSupplyItem}
                            disabled={submitting || !newSupply.name.trim()}
                            style={{
                              flex: 1,
                              padding: '0.6rem',
                              background: '#2563eb',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '0.9rem',
                              fontWeight: '600',
                              opacity: !newSupply.name.trim() ? 0.5 : 1,
                            }}
                          >
                            Add Item
                          </button>
                          <button
                            onClick={() => {
                              setShowAddSupply(false)
                              setNewSupply({ name: '', category: '', status: 'low' })
                            }}
                            style={{
                              flex: 1,
                              padding: '0.6rem',
                              background: 'white',
                              color: '#333',
                              border: '1px solid #ccc',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '0.9rem',
                            }}
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
        <div style={{ marginTop: '1.5rem', padding: '1rem', background: '#cce5ff', borderRadius: '4px' }}>
          <p style={{ margin: 0, color: '#004085' }}>✅ This job is marked complete. Thank you for your work!</p>
        </div>
      )}
    </div>
  )
}

const styles = {
  page: {
    padding: '2rem',
    fontFamily: 'sans-serif',
    maxWidth: '600px',
    margin: '0 auto',
  },
  card: {
    border: '1px solid #ccc',
    borderRadius: '4px',
    padding: '1rem',
    background: '#fafafa',
    marginBottom: '1rem',
  },
  centered: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    fontFamily: 'sans-serif',
    textAlign: 'center',
    padding: '2rem',
  },
  acceptButton: {
    padding: '0.75rem 1.5rem',
    fontSize: '1rem',
    background: '#28a745',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  declineButton: {
    padding: '0.75rem 1.5rem',
    fontSize: '1rem',
    background: '#dc3545',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
  },
}