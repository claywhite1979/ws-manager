import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { inputStyle, labelStyle, buttonRowStyle, primaryButton, secondaryButton } from './formStyles'

const PROPERTY_ID = '5a23806a-a9d4-482b-b97f-f37453e2f196'

export default function StandaloneJobForm({ onSave, onCancel, cleaners }) {
    const [title, setTitle] = useState('Cleaning')
    const [scheduledDate, setScheduledDate] = useState('')
    const [cleanerId, setCleanerId] = useState('')
    const [rate, setRate] = useState('')
    const [saving, setSaving] = useState(false)
    const [dateWarning, setDateWarning] = useState(null)
    const [otherWorker, setOtherWorker] = useState('')

    const selectedCleaner = cleaners.find(c => c.id === cleanerId)

    useEffect(() => {
        if (cleanerId && selectedCleaner?.default_rate) {
            setRate(selectedCleaner.default_rate.toString())
        }
    }, [cleanerId])

    async function checkDateConflict(date) {
        if (!date) return
        const { data: stays } = await supabase
            .from('stay')
            .select('guest_name, check_in, check_out')
            .eq('property_id', PROPERTY_ID)
            .eq('archived', false)
            .lte('check_in', date)
            .gte('check_out', date)

        if (stays && stays.length > 0) {
            const stay = stays[0]
            setDateWarning(`⚠️ This date falls during a stay: ${stay.guest_name || 'Guest'} (${stay.check_in} → ${stay.check_out})`)
        } else {
            setDateWarning(null)
        }
    }

    async function handleSubmit() {
        if (!scheduledDate) {
            alert('Please select a date.')
            return
        }
        if (!cleanerId) {
            alert('Please select a cleaner or worker.')
            return
        }
        if (cleanerId === 'other' && !otherWorker.trim()) {
            alert('Please enter the worker name.')
            return
        }
        setSaving(true)
        await onSave({
            title: title.trim() || 'Cleaning',
            scheduled_date: scheduledDate,
            cleaner_id: cleanerId === 'other' ? null : cleanerId,
            worker_name: cleanerId === 'other' ? otherWorker.trim() : null,
            agreed_rate: rate ? parseFloat(rate) : null,
            status: 'confirmed',
            standalone: true,
            property_id: PROPERTY_ID,
        })
        setSaving(false)
    }

    return (
        <div>
            <label style={labelStyle}>
                Job Title
                <input
                    style={inputStyle}
                    type="text"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="e.g. Cleaning, HVAC Service, Plumber"
                    autoFocus
                />
            </label>

            <label style={labelStyle}>
                Date *
                <input
                    style={inputStyle}
                    type="date"
                    value={scheduledDate}
                    onChange={e => {
                        setScheduledDate(e.target.value)
                        checkDateConflict(e.target.value)
                    }}
                />
            </label>

            {dateWarning && (
                <div className="alert alert-warning" style={{ marginTop: 'var(--spacing-sm)' }}>
                    {dateWarning}
                </div>
            )}

            <label style={labelStyle}>
                Assign To *
                <select
                    style={inputStyle}
                    value={cleanerId}
                    onChange={e => setCleanerId(e.target.value)}
                >
                    <option value="">Select a person...</option>
                    {cleaners.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                    <option value="other">Other...</option>
                </select>
            </label>

            {cleanerId === 'other' && (
                <label style={labelStyle}>
                    Worker Name *
                    <input
                        style={inputStyle}
                        type="text"
                        value={otherWorker}
                        onChange={e => setOtherWorker(e.target.value)}
                        placeholder="e.g. Bob's Plumbing"
                        autoFocus
                    />
                </label>
            )}

            <label style={labelStyle}>
                Rate ($)
                <input
                    style={inputStyle}
                    type="number"
                    value={rate}
                    onChange={e => setRate(e.target.value)}
                    placeholder="e.g. 150"
                    min="0"
                    step="5"
                />
                {selectedCleaner?.default_rate && (
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: 'var(--spacing-xs)', display: 'block' }}>
                        Default rate for {selectedCleaner.name}: ${selectedCleaner.default_rate}
                    </span>
                )}
            </label>

            <div style={buttonRowStyle}>
                <button style={secondaryButton} onClick={onCancel}>Cancel</button>
                <button style={primaryButton} onClick={handleSubmit} disabled={saving}>
                    {saving ? 'Saving...' : 'Send Offer'}
                </button>
            </div>
        </div>
    )
}