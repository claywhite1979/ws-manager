import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

const PROPERTY_ID = '5a23806a-a9d4-482b-b97f-f37453e2f196'

const PAYMENT_METHODS = ['Venmo', 'Cash', 'Check', 'Other']

export default function Payments() {
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [showPaid, setShowPaid] = useState(false)
  const [payingJob, setPayingJob] = useState(null)
  const [payingAll, setPayingAll] = useState(null)
  const [paymentMethod, setPaymentMethod] = useState('Venmo')
  const [paymentNote, setPaymentNote] = useState('')
  const [paymentDate, setPaymentDate] = useState(today())

  useEffect(() => {
    fetchJobs()
  }, [showPaid])

  function today() {
    return new Date().toISOString().split('T')[0]
  }

  async function fetchJobs() {
    setLoading(true)

    const { data } = await supabase
      .from('cleaning_job')
      .select('*, cleaner(*), stay(*)')
      .eq('payment_status', showPaid ? 'paid' : 'unpaid')
      .in('status', ['confirmed', 'complete'])
      .order('scheduled_date', { ascending: true })

    setJobs(data || [])
    setLoading(false)
  }

  async function markPaid(jobId) {
    const note = `${paymentMethod}${paymentNote ? ' — ' + paymentNote : ''} on ${paymentDate}`
    await supabase
      .from('cleaning_job')
      .update({ payment_status: 'paid', payment_note: note })
      .eq('id', jobId)
    setPayingJob(null)
    setPayingAll(null)
    resetPaymentForm()
    fetchJobs()
  }

  async function markAllPaid(cleanerId) {
    const completeJobs = jobsByClean[cleanerId].filter(j => j.status === 'complete')
    const note = `${paymentMethod}${paymentNote ? ' — ' + paymentNote : ''} on ${paymentDate}`
    for (const job of completeJobs) {
      await supabase
        .from('cleaning_job')
        .update({ payment_status: 'paid', payment_note: note })
        .eq('id', job.id)
    }
    setPayingAll(null)
    resetPaymentForm()
    fetchJobs()
  }

  async function undoPayment(jobId) {
    if (!confirm('Mark this job as unpaid?')) return
    await supabase
      .from('cleaning_job')
      .update({ payment_status: 'unpaid', payment_note: null })
      .eq('id', jobId)
    fetchJobs()
  }

  function resetPaymentForm() {
    setPaymentMethod('Venmo')
    setPaymentNote('')
    setPaymentDate(today())
  }

  // Group jobs by cleaner
  const jobsByClean = jobs.reduce((acc, job) => {
    const id = job.cleaner?.id || 'unknown'
    if (!acc[id]) acc[id] = []
    acc[id].push(job)
    return acc
  }, {})

  function owedToClean(cleanerId) {
    return jobsByClean[cleanerId]
      .filter(j => j.status === 'complete')
      .reduce((sum, j) => sum + parseFloat(j.agreed_rate || 0), 0)
  }

  function paymentForm(onConfirm) {
    return (
      <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: '#f8f9fa', borderRadius: '4px', border: '1px solid #dee2e6' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
          {PAYMENT_METHODS.map(m => (
            <button
              key={m}
              onClick={() => setPaymentMethod(m)}
              style={{
                padding: '0.3rem 0.6rem',
                borderRadius: '4px',
                border: '2px solid',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: paymentMethod === m ? 'bold' : 'normal',
                background: paymentMethod === m ? '#cce5ff' : 'white',
                borderColor: paymentMethod === m ? '#004085' : '#ccc',
                color: paymentMethod === m ? '#004085' : '#333',
              }}
            >
              {m}
            </button>
          ))}
        </div>
        <input
          type="date"
          value={paymentDate}
          onChange={e => setPaymentDate(e.target.value)}
          style={{ width: '100%', padding: '0.4rem', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box', marginBottom: '0.5rem' }}
        />
        <input
          type="text"
          placeholder="Optional note..."
          value={paymentNote}
          onChange={e => setPaymentNote(e.target.value)}
          style={{ width: '100%', padding: '0.4rem', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box', marginBottom: '0.5rem' }}
        />
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={onConfirm}
            style={{ flex: 1, padding: '0.5rem', background: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '600' }}
          >
            Confirm Payment
          </button>
          <button
            onClick={() => { setPayingJob(null); setPayingAll(null); resetPaymentForm() }}
            style={{ flex: 1, padding: '0.5rem', background: 'white', color: '#333', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer' }}
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  if (loading) return <p>Loading payments...</p>

  return (
    <section style={{ marginTop: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>💰 Payments</h2>
        <button
          onClick={() => setShowPaid(prev => !prev)}
          style={{ background: 'none', border: 'none', color: '#666', fontSize: '0.85rem', cursor: 'pointer', textDecoration: 'underline' }}
        >
          {showPaid ? 'Show unpaid' : 'Show payment history'}
        </button>
      </div>

      {Object.keys(jobsByClean).length === 0 && (
        <p style={{ color: '#666', fontSize: '0.9rem' }}>
          {showPaid ? 'No payment history yet.' : 'No unpaid jobs.'}
        </p>
      )}

      {Object.keys(jobsByClean).map(cleanerId => {
        const cleanerJobs = jobsByClean[cleanerId]
        const cleaner = cleanerJobs[0]?.cleaner
        const owed = owedToClean(cleanerId)
        const hasCompletedJobs = cleanerJobs.some(j => j.status === 'complete')

        return (
          <div key={cleanerId} style={{ border: '1px solid #ccc', borderRadius: '4px', padding: '1rem', marginTop: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
              <div>
                <strong style={{ fontSize: '1.05rem' }}>{cleaner?.name || 'Unknown'}</strong>
                {!showPaid && owed > 0 && (
                  <span style={{ marginLeft: '0.75rem', color: '#856404', fontWeight: '600' }}>
                    ${owed.toFixed(2)} owed
                  </span>
                )}
              </div>
              {!showPaid && hasCompletedJobs && payingAll !== cleanerId && (
                <button
                  onClick={() => { setPayingAll(cleanerId); setPayingJob(null) }}
                  style={{ fontSize: '0.85rem', padding: '0.3rem 0.75rem', background: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                  Mark All Complete Paid
                </button>
              )}
            </div>

            {payingAll === cleanerId && paymentForm(() => markAllPaid(cleanerId))}

            {cleanerJobs.map(job => (
              <div key={job.id} style={{
                padding: '0.5rem 0.75rem',
                marginTop: '0.5rem',
                borderRadius: '4px',
                background: job.status === 'complete' ? '#f8f9fa' : '#fff',
                border: '1px solid #eee',
                opacity: job.status === 'confirmed' ? 0.7 : 1,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: '0.9rem' }}>
                      🧹 {job.scheduled_date}
                      {job.stay && <span style={{ color: '#666', fontSize: '0.8rem' }}> · checkout {job.stay.check_out}</span>}
                    </span>
                    <span style={{
                      marginLeft: '0.5rem',
                      fontSize: '0.8rem',
                      padding: '0.1rem 0.4rem',
                      borderRadius: '999px',
                      background: job.status === 'complete' ? '#cce5ff' : '#fff3cd',
                      color: job.status === 'complete' ? '#004085' : '#856404',
                    }}>
                      {job.status}
                    </span>
                  </div>
                  <strong>${parseFloat(job.agreed_rate || 0).toFixed(2)}</strong>
                </div>

                {job.payment_note && (
                  <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: '#666' }}>
                    {job.payment_note}
                  </p>
                )}

                {!showPaid && job.status === 'complete' && payingJob !== job.id && (
                  <button
                    onClick={() => { setPayingJob(job.id); setPayingAll(null) }}
                    style={{ marginTop: '0.4rem', fontSize: '0.8rem', padding: '0.2rem 0.5rem', background: 'none', border: '1px solid #28a745', borderRadius: '4px', cursor: 'pointer', color: '#155724' }}
                  >
                    Mark Paid
                  </button>
                )}

                {payingJob === job.id && paymentForm(() => markPaid(job.id))}

                {showPaid && (
                  <button
                    onClick={() => undoPayment(job.id)}
                    style={{ marginTop: '0.4rem', fontSize: '0.8rem', padding: '0.2rem 0.5rem', background: 'none', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer', color: '#666' }}
                  >
                    Undo
                  </button>
                )}
              </div>
            ))}
          </div>
        )
      })}
    </section>
  )
}