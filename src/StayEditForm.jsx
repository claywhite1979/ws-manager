import { useState } from 'react'

import { inputStyle, labelStyle, buttonRowStyle, primaryButton, secondaryButton } from './formStyles'

export default function StayEditForm({ onSave, onCancel, initial = {} }) {
  const [guestName, setGuestName] = useState(initial.guest_name || '')
  const [checkIn, setCheckIn] = useState(initial.check_in || '')
  const [checkOut, setCheckOut] = useState(initial.check_out || '')
  const [source, setSource] = useState(initial.source || 'manual')
  const [notes, setNotes] = useState(initial.notes || '')
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
      notes: notes.trim() || null,
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

      <label style={labelStyle}>
        Notes
        <textarea
          style={{ ...inputStyle, resize: 'vertical' }}
          rows={3}
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Any notes about this stay..."
        />
      </label>

      <div style={buttonRowStyle}>
        <button style={secondaryButton} onClick={onCancel}>
          Cancel
        </button>
        <button style={primaryButton} onClick={handleSubmit} disabled={saving}>
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  )
}