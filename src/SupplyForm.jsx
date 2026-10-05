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

export default function SupplyForm({ onSave, onCancel, initial = {} }) {
  const [name, setName] = useState(initial.name || '')
  const [category, setCategory] = useState(initial.category || '')
  const [parLevelNote, setParLevelNote] = useState(initial.par_level_note || '')
  const [orderUrl, setOrderUrl] = useState(initial.order_url || '')
  const [saving, setSaving] = useState(false)

  async function handleSubmit() {
    if (!name.trim()) {
      alert('Supply name is required.')
      return
    }
    setSaving(true)
    await onSave({
      name: name.trim(),
      category: category.trim() || null,
      par_level_note: parLevelNote.trim() || null,
      order_url: orderUrl.trim() || null,
    })
    setSaving(false)
  }

  return (
    <div>
      <label style={labelStyle}>
        Supply Name *
        <input
          style={inputStyle}
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. Paper towels"
          autoFocus
        />
      </label>

      <label style={labelStyle}>
        Category
        <input
          style={inputStyle}
          type="text"
          value={category}
          onChange={e => setCategory(e.target.value)}
          placeholder="e.g. Kitchen, Bathroom, Bedroom"
        />
      </label>

      <label style={labelStyle}>
        Par Level Note
        <input
          style={inputStyle}
          type="text"
          value={parLevelNote}
          onChange={e => setParLevelNote(e.target.value)}
          placeholder="e.g. Should see 2+ backup rolls"
        />
      </label>

      <label style={labelStyle}>
        Order URL
        <input
          style={inputStyle}
          type="url"
          value={orderUrl}
          onChange={e => setOrderUrl(e.target.value)}
          placeholder="Paste Amazon or other link"
        />
      </label>

      <div style={buttonRowStyle}>
        <button style={secondaryButton} onClick={onCancel}>
          Cancel
        </button>
        <button style={primaryButton} onClick={handleSubmit} disabled={saving}>
          {saving ? 'Saving...' : 'Save Supply Item'}
        </button>
      </div>
    </div>
  )
}