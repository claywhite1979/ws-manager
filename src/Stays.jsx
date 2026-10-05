import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import Modal from './Modal'
import StayForm from './StayForm'
import JobOfferForm from './JobOfferForm'

const PROPERTY_ID = '5a23806a-a9d4-482b-b97f-f37453e2f196'

export default function Stays(props) {
  const [stays, setStays] = useState([])
  const [cleaners, setCleaners] = useState([])
  const [loading, setLoading] = useState(true)
  const [composedText, setComposedText] = useState(null)
  const [showStayForm, setShowStayForm] = useState(false)
  const [offerStay, setOfferStay] = useState(null)

  useEffect(() => {
    fetchAll()
  }, [props.refreshTrigger])

  async function fetchAll() {
    setLoading(true)

    const { data: stayData } = await supabase
      .from('stay')
      .select('*, cleaning_job(*, cleaner(*))')
      .eq('property_id', PROPERTY_ID)
      .order('check_in', { ascending: true })

    const { data: cleanerData } = await supabase
      .from('cleaner')
      .select('*')
      .eq('active', true)

    setStays(stayData || [])
    setCleaners(cleanerData || [])
    setLoading(false)
  }

  async function addStay(data) {
    await supabase
      .from('stay')
      .insert([{ property_id: PROPERTY_ID, ...data }])
    setShowStayForm(false)
    fetchAll()
  }

  async function deleteStay(id) {
    if (!confirm('Remove this stay?')) return
    await supabase.from('stay').delete().eq('id', id)
    fetchAll()
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
    const active = stay.cleaning_job.filter(j => j.status !== 'declined')
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
            onClick={() => setOfferStay(stay)}
            style={{ marginTop: '0.5rem', cursor: 'pointer' }}
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
            onClick={() => {
              const window = calculateWindow(stay, stays)
              composeText(job, window)
            }}
            style={{ marginTop: '0.25rem', cursor: 'pointer', fontSize: '0.85rem' }}
          >
            📱 Resend Text
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
          <p style={{ fontSize: '0.85rem', margin: '0.25rem 0' }}>
            {job.cleaner?.name} — {job.scheduled_date}
          </p>
        </div>
      )
    }

    return null
  }

  if (loading) return <p>Loading stays...</p>

  return (
    <section style={{ marginTop: '2rem' }}>
      <h2>Stays</h2>
      <button onClick={() => setShowStayForm(true)}>+ Add Stay</button>
      <button onClick={fetchAll} style={{ marginLeft: '1rem' }}>↻ Refresh</button>

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

      {stays.length === 0
        ? <p>No stays yet.</p>
        : stays.map(s => (
          <div key={s.id} style={{ border: '1px solid #ccc', padding: '1rem', marginTop: '0.5rem', borderRadius: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <strong>{s.guest_name || 'Guest'}</strong>
                <p style={{ margin: '0.25rem 0', fontSize: '0.9rem' }}>
                  📅 {s.check_in} → {s.check_out}
                </p>
                <p style={{ margin: '0.25rem 0', fontSize: '0.85rem', color: '#666' }}>
                  📌 {s.source}
                </p>
              </div>
              <button
                onClick={() => deleteStay(s.id)}
                style={{ color: 'red', cursor: 'pointer', fontSize: '0.85rem' }}
              >
                Remove
              </button>
            </div>
            {getStatusDisplay(s)}
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
    </section>
  )
}