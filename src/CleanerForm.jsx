import { useState } from 'react'

import { inputStyle, labelStyle, buttonRowStyle, primaryButton, secondaryButton } from './formStyles'

export default function CleanerForm({ onSave, onCancel, initial = {} }) {
  const [name, setName] = useState(initial.name || '')
  const [phone, setPhone] = useState(initial.phone || '')
  const [email, setEmail] = useState(initial.email || '')
  const [rate, setRate] = useState(initial.default_rate || '')
  const [saving, setSaving] = useState(false)

  async function handleSubmit() {
    if (!name.trim()) {
      alert('Name is required.')
      return
    }
    setSaving(true)
    await onSave({
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim(),
      default_rate: rate ? parseFloat(rate) : null,
    })
    setSaving(false)
  }

  return (
    <div>
      <label style={labelStyle}>
        Name *
        <input
          style={inputStyle}
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. Robin Smith"
          autoFocus
        />
      </label>

      <label style={labelStyle}>
        Phone
        <input
          style={inputStyle}
          type="tel"
          value={phone}
          onChange={e => setPhone(e.target.value)}
          placeholder="e.g. 555-867-5309"
        />
      </label>

      <label style={labelStyle}>
        Email
        <input
          style={inputStyle}
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="e.g. robin@email.com"
        />
      </label>

      <label style={labelStyle}>
        Default Rate ($)
        <input
          style={inputStyle}
          type="number"
          value={rate}
          onChange={e => setRate(e.target.value)}
          placeholder="e.g. 150"
          min="0"
          step="5"
        />
      </label>

      <div style={buttonRowStyle}>
        <button style={secondaryButton} onClick={onCancel}>
          Cancel
        </button>
        <button style={primaryButton} onClick={handleSubmit} disabled={saving}>
          {saving ? 'Saving...' : 'Save Cleaner'}
        </button>
      </div>
    </div>
  )
}