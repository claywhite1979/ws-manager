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

  async function decline() {
    setSubmitting(true)

    await supabase
      .from('cleaning_job')
      .update({ status: 'declined' })
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
                      {flags[s.id] && flags[s.id] !== 'ok' && (
                        <input
                          type="text"
                          placeholder="Optional note..."
                          value={notes[s.id] || ''}
                          onChange={e => setNote(s.id, e.target.value)}
                          style={{ marginTop: '0.5rem', width: '100%', padding: '0.4rem', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box' }}
                        />
                      )}
                    </div>
                  ))}

                  <button
                    onClick={submitFlags}
                    disabled={submitting || Object.keys(flags).length === 0}
                    style={{ ...styles.acceptButton, marginTop: '0.5rem' }}
                  >
                    Submit Supply Report
                  </button>
                  {Object.keys(flags).length === 0 && (
                    <p style={{ fontSize: '0.85rem', color: '#666' }}>Mark at least one item above to submit.</p>
                  )}
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