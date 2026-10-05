import { useState } from 'react'

const inputStyle = {
  width: '100%',
  padding: '0.6rem 0.75rem',
  fontSize: '1rem',
  border: '1px solid #ccc',
  borderRadius: '6px',
  boxSizing: 'border-box',
  marginTop: '0.25rem',
}

const labelStyle = {
  display: 'block',
  fontSize: '0.9rem',
  fontWeight: '600',
  color: '#333',
  marginTop: '1rem',
}

const buttonRowStyle = {
  display: 'flex',
  gap: '0.75rem',
  marginTop: '1.5rem',
}

const primaryButton = {
  flex: 1,
  padding: '0.75rem',
  fontSize: '1rem',
  background: '#2563eb',
  color: 'white',
  border: 'none',
  borderRadius: '6px',
  cursor: 'pointer',
  fontWeight: '600',
}

const secondaryButton = {
  flex: 1,
  padding: '0.75rem',
  fontSize: '1rem',
  background: 'white',
  color: '#333',
  border: '1px solid #ccc',
  borderRadius: '6px',
  cursor: 'pointer',
  fontWeight: '600',
}

export default function JobOfferForm({ stay, window, cleaners, onSave, onCancel }) {
  const [cleanerId, setCleanerId] = useState('')
  const [rate, setRate] = useState('')
  const [saving, setSaving] = useState(false)

  const selectedCleaner = cleaners.find(c => c.id === cleanerId)

  function handleCleanerChange(id) {
    setCleanerId(id)
    const cleaner = cleaners.find(c => c.id === id)
    if (cleaner?.default_rate) {
      setRate(cleaner.default_rate.toString())
    }
  }

  async function handleSubmit() {
    if (!cleanerId) {
      alert('Please select a cleaner.')
      return
    }
    if (!rate) {
      alert('Please enter a rate.')
      return
    }
    setSaving(true)
    await onSave({
      cleaner_id: cleanerId,
      agreed_rate: parseFloat(rate),
    })
    setSaving(false)
  }

  return (
    <div>
      <div style={{
        background: '#f8f9fa',
        borderRadius: '6px',
        padding: '0.75rem 1rem',
        marginBottom: '0.5rem',
        fontSize: '0.9rem',
      }}>
        <p style={{ margin: '0.25rem 0' }}>
          🏠 <strong>Guest checkout:</strong> {stay.check_out}
        </p>
        <p style={{ margin: '0.25rem 0' }}>
          📅 <strong>Cleaning window:</strong> {window.start} → {window.end}
        </p>
      </div>

      <label style={labelStyle}>
        Assign Cleaner *
        <select
          style={inputStyle}
          value={cleanerId}
          onChange={e => handleCleanerChange(e.target.value)}
        >
          <option value="">Select a cleaner...</option>
          {cleaners.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </label>

      <label style={labelStyle}>
        Agreed Rate ($) *
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
          <span style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.25rem', display: 'block' }}>
            Default rate for {selectedCleaner.name}: ${selectedCleaner.default_rate}
          </span>
        )}
      </label>

      <div style={buttonRowStyle}>
        <button style={secondaryButton} onClick={onCancel}>
          Cancel
        </button>
        <button style={primaryButton} onClick={handleSubmit} disabled={saving}>
          {saving ? 'Sending...' : 'Send Offer'}
        </button>
      </div>
    </div>
  )
}