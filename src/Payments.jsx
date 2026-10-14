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
            <div className="card-surface" style={{ marginTop: 'var(--spacing-sm)', marginBottom: 'var(--spacing-sm)' }}>
                <div className="row" style={{ flexWrap: 'wrap', marginBottom: 'var(--spacing-sm)' }}>
                    {PAYMENT_METHODS.map(m => (
                        <button
                            key={m}
                            onClick={() => setPaymentMethod(m)}
                            className={`btn btn-sm ${paymentMethod === m ? 'btn-primary' : 'btn-secondary'}`}
                        >
                            {m}
                        </button>
                    ))}
                </div>
                <input
                    type="date"
                    value={paymentDate}
                    onChange={e => setPaymentDate(e.target.value)}
                    className="form-input"
                    style={{ marginBottom: 'var(--spacing-sm)' }}
                />
                <input
                    type="text"
                    placeholder="Optional note..."
                    value={paymentNote}
                    onChange={e => setPaymentNote(e.target.value)}
                    className="form-input"
                    style={{ marginBottom: 'var(--spacing-sm)' }}
                />
                <div className="row">
                    <button className="btn btn-success btn-sm" onClick={onConfirm}>
                        Confirm Payment
                    </button>
                    <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => { setPayingJob(null); setPayingAll(null); resetPaymentForm() }}
                    >
                        Cancel
                    </button>
                </div>
            </div>
        )
    }

    if (loading) return <p>Loading payments...</p>

    return (
        <section className="section">
            <div className="section-header">
                <h2>Payments</h2>
                <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setShowPaid(prev => !prev)}
                >
                    {showPaid ? 'Show unpaid' : 'Payment history'}
                </button>
            </div>

            {Object.keys(jobsByClean).length === 0 && (
                <p className="empty-state">
                    {showPaid ? 'No payment history yet.' : 'No unpaid jobs.'}
                </p>
            )}

            {Object.keys(jobsByClean).map(cleanerId => {
                const cleanerJobs = jobsByClean[cleanerId]
                const cleaner = cleanerJobs[0]?.cleaner
                const owed = owedToClean(cleanerId)
                const hasCompletedJobs = cleanerJobs.some(j => j.status === 'complete')

                return (
                    <div key={cleanerId} className="card" style={{ marginTop: 'var(--spacing-md)' }}>
                        <div className="row-between" style={{ marginBottom: 'var(--spacing-md)' }}>
                            <div>
                                <strong style={{ fontSize: 'var(--font-size-lg)' }}>{cleaner?.name || 'Unknown'}</strong>
                                {!showPaid && owed > 0 && (
                                    <span style={{ marginLeft: 'var(--spacing-sm)', color: 'var(--color-warning)', fontWeight: '600', fontSize: 'var(--font-size-sm)' }}>
                                        ${owed.toFixed(2)} owed
                                    </span>
                                )}
                            </div>
                            {!showPaid && hasCompletedJobs && payingAll !== cleanerId && (
                                <button
                                    className="btn btn-success btn-sm"
                                    onClick={() => { setPayingAll(cleanerId); setPayingJob(null) }}
                                >
                                    Mark All Paid
                                </button>
                            )}
                        </div>

                        {payingAll === cleanerId && paymentForm(() => markAllPaid(cleanerId))}

                        {cleanerJobs.map(job => (
                            <div key={job.id} className="card-surface" style={{
                                marginTop: 'var(--spacing-sm)',
                                opacity: job.status === 'confirmed' ? 0.7 : 1,
                            }}>
                                <div className="row-between">
                                    <div>
                                        <span style={{ fontSize: 'var(--font-size-sm)' }}>
                                            {job.scheduled_date}
                                            {job.stay && (
                                                <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)', marginLeft: 'var(--spacing-xs)' }}>
                                                    · checkout {job.stay.check_out}
                                                </span>
                                            )}
                                        </span>
                                        <span className={`badge ${job.status === 'complete' ? 'badge-primary' : 'badge-warning'}`} style={{ marginLeft: 'var(--spacing-sm)' }}>
                                            {job.status}
                                        </span>
                                    </div>
                                    <strong style={{ fontSize: 'var(--font-size-sm)' }}>${parseFloat(job.agreed_rate || 0).toFixed(2)}</strong>
                                </div>

                                {job.payment_note && (
                                    <p style={{ margin: 'var(--spacing-xs) 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                                        {job.payment_note}
                                    </p>
                                )}

                                {!showPaid && job.status === 'complete' && payingJob !== job.id && (
                                    <button
                                        className="btn btn-ghost btn-sm"
                                        style={{ marginTop: 'var(--spacing-xs)', color: 'var(--color-success)' }}
                                        onClick={() => { setPayingJob(job.id); setPayingAll(null) }}
                                    >
                                        Mark Paid
                                    </button>
                                )}

                                {payingJob === job.id && paymentForm(() => markPaid(job.id))}

                                {showPaid && (
                                    <button
                                        className="btn btn-ghost btn-sm"
                                        style={{ marginTop: 'var(--spacing-xs)' }}
                                        onClick={() => undoPayment(job.id)}
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