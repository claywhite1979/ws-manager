import { supabase } from './supabaseClient'

const FLAG_DEFINITIONS = [
  { key: 'early_checkin_requested', label: 'Early Check-In Requested', color: 'badge-warning' },
  { key: 'early_checkin_approved', label: 'Early Check-In Approved', color: 'badge-success' },
  { key: 'guest_needs_followup', label: 'Guest Needs Follow-Up', color: 'badge-danger' },
  { key: 'special_request_pending', label: 'Special Request Pending', color: 'badge-warning' },
]

export { FLAG_DEFINITIONS }

export default function StayFlags({ stay, onUpdate }) {
  const currentFlags = stay.flags || []

  async function toggleFlag(key) {
    const hasFlag = currentFlags.includes(key)
    const newFlags = hasFlag
      ? currentFlags.filter(f => f !== key)
      : [...currentFlags, key]

    await supabase
      .from('stay')
      .update({ flags: newFlags })
      .eq('id', stay.id)

    if (onUpdate) onUpdate()
  }

  return (
    <div style={{ marginTop: 'var(--spacing-sm)' }}>
      <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--spacing-xs)' }}>
        Flags
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-xs)' }}>
        {FLAG_DEFINITIONS.map(flag => {
          const isActive = currentFlags.includes(flag.key)
          return (
            <button
              key={flag.key}
              onClick={() => toggleFlag(flag.key)}
              className={`badge ${isActive ? flag.color : 'badge-neutral'}`}
              style={{
                cursor: 'pointer',
                border: isActive ? 'none' : '1px dashed var(--color-border)',
                opacity: isActive ? 1 : 0.6,
                fontWeight: isActive ? '600' : '400',
                padding: '0.25rem 0.625rem',
              }}
            >
              {flag.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}