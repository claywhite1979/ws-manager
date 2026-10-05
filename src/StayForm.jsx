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

export default function StayForm({ onSave, onCancel, initial = {} }) {
  const [guestName, setGuestName] = useState(initial.guest_name || '')
  const [checkIn, setCheckIn] = useState(initial.check_in || '')
  const [checkOut, setCheckOut] = useState(initial.check_out || '')
  const [source, setSource] = useState(initial.source || 'manual')
  const [saving, setSaving] = useState(false)

  async function handleSubmit() {
    if (!checkIn || !checkOut) {
      alert('Check-in and check-out dates are required.')
      return
    }
    if (checkOut <= checkIn) {
      alert('Check-out must be after check-in.')
      return
    }
    setSaving(true)
    await onSave({
      guest_name: guestName.trim() || null,
      check_in: checkIn,
      check_out: checkOut,
      source,
    })
    setSaving(false)
  }

  return (
    <div>
      <label style={labelStyle}>
        Guest Name
        <input
          style={inputStyle}
          type="text"
          value={guestName}
          onChange={e => setGuestName(e.target.value)}
          placeholder="e.g. Smith family"
          autoFocus
        />
      </label>

      <label style={labelStyle}>
        Check-in Date *
        <input
          style={inputStyle}
          type="date"
          value={checkIn}
          onChange={e => setCheckIn(e.target.value)}
        />
      </label>

      <label style={labelStyle}>
        Check-out Date *
        <input
          style={inputStyle}
          type="date"
          value={checkOut}
          onChange={e => setCheckOut(e.target.value)}
        />
      </label>

      <label style={labelStyle}>
        Source
        <select
          style={inputStyle}
          value={source}
          onChange={e => setSource(e.target.value)}
        >
          <option value="manual">Manual</option>
          <option value="airbnb">Airbnb</option>
          <option value="vrbo">VRBO</option>
          <option value="direct">Direct</option>
        </select>
      </label>

      <div style={buttonRowStyle}>
        <button style={secondaryButton} onClick={onCancel}>
          Cancel
        </button>
        <button style={primaryButton} onClick={handleSubmit} disabled={saving}>
          {saving ? 'Saving...' : 'Save Stay'}
        </button>
      </div>
    </div>
  )
}