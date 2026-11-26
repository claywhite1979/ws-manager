import { useState, useEffect } from 'react'
import { useUser } from '@clerk/clerk-react'
import { supabase } from './supabaseClient'
import Modal from './Modal'

const ROLES = ['admin', 'manager']

export default function UsersAdmin() {
  const { user } = useUser()
  const [people, setPeople] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [editing, setEditing] = useState(null) // a person to edit, or {} for a new one

  useEffect(() => {
    fetchPeople()
  }, [])

  async function fetchPeople() {
    setLoading(true)
    const { data, error: err } = await supabase
      .from('app_user')
      .select('*')
      .order('created_at', { ascending: true })
    if (err) {
      setError(err.message)
    } else {
      setError(null)
      setPeople(data || [])
    }
    setLoading(false)
  }

  // Is this row the person who is signed in right now?
  const isSelf = p => !!p.clerk_id && p.clerk_id === user?.id

  async function savePerson(values) {
    const row = {
      email: values.email.trim().toLowerCase(),
      display_name: values.display_name.trim() || null,
      role: values.role,
      clerk_id: values.clerk_id.trim() || null,
      note: values.note.trim() || null,
    }

    if (!row.email) {
      setError('An email address is required.')
      return
    }
    if (row.clerk_id && !row.clerk_id.startsWith('user_')) {
      setError('A Clerk user ID starts with "user_". Copy it from the Clerk dashboard.')
      return
    }

    const { error: err } = editing.id
      ? await supabase.from('app_user').update(row).eq('id', editing.id)
      : await supabase.from('app_user').insert([{ ...row, active: true }])

    if (err) {
      setError(err.message)
      return
    }
    setError(null)
    setEditing(null)
    fetchPeople()
  }

  async function toggleActive(p) {
    const msg = p.active
      ? `Deactivate ${p.display_name || p.email}? They will be locked out of the app right away. You can reactivate them any time.`
      : `Reactivate ${p.display_name || p.email}?`
    if (!confirm(msg)) return
    const { error: err } = await supabase
      .from('app_user')
      .update({ active: !p.active })
      .eq('id', p.id)
    if (err) setError(err.message)
    else setError(null)
    fetchPeople()
  }

  return (
    <section className="section">
      <div className="section-header">
        <h2>Users</h2>
        <button className="btn btn-primary btn-sm" onClick={() => setEditing({})}>
          + Add User
        </button>
      </div>

      <p style={{ margin: '0 0 var(--spacing-sm)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
        People who can sign in to this app. A person also needs their Clerk user ID here before the database will let them in.
      </p>

      {error && (
        <div className="alert alert-warning" style={{ marginBottom: 'var(--spacing-sm)' }}>
          {error}
        </div>
      )}

      {loading ? (
        <p style={{ color: 'var(--color-text-muted)' }}>Loading...</p>
      ) : people.length === 0 ? (
        <p className="empty-state">No users found.</p>
      ) : (
        people.map(p => (
          <div key={p.id} className="card" style={{ marginTop: 'var(--spacing-sm)', opacity: p.active ? 1 : 0.65 }}>
            <div className="row-between">
              <div>
                <div className="row" style={{ alignItems: 'center', gap: 'var(--spacing-sm)', flexWrap: 'wrap' }}>
                  <strong>{p.display_name || p.email}</strong>
                  <span className="badge badge-primary">{p.role}</span>
                  {!p.active && <span className="badge badge-neutral">Inactive</span>}
                  {!p.clerk_id && <span className="badge badge-warning">No Clerk ID yet</span>}
                  {isSelf(p) && <span className="badge badge-success">You</span>}
                </div>
                {p.display_name && (
                  <p style={{ margin: 'var(--spacing-xs) 0 0', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
                    {p.email}
                  </p>
                )}
                {p.note && (
                  <p style={{ margin: 'var(--spacing-xs) 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                    {p.note}
                  </p>
                )}
              </div>
              <div className="col" style={{ alignItems: 'flex-end', gap: 'var(--spacing-xs)' }}>
                <button className="btn btn-secondary btn-sm" onClick={() => setEditing(p)}>
                  Edit
                </button>
                {!isSelf(p) && (
                  <button className="btn btn-ghost btn-sm" onClick={() => toggleActive(p)}>
                    {p.active ? 'Deactivate' : 'Reactivate'}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))
      )}

      {editing && (
        <Modal title={editing.id ? 'Edit User' : 'Add User'} onClose={() => { setEditing(null); setError(null) }}>
          <UserForm
            initial={editing}
            self={editing.id ? isSelf(editing) : false}
            onSave={savePerson}
            onCancel={() => { setEditing(null); setError(null) }}
          />
        </Modal>
      )}
    </section>
  )
}

function UserForm({ initial, self, onSave, onCancel }) {
  const [values, setValues] = useState({
    email: initial.email || '',
    display_name: initial.display_name || '',
    role: initial.role || 'manager',
    clerk_id: initial.clerk_id || '',
    note: initial.note || '',
  })

  const set = (key, value) => setValues(prev => ({ ...prev, [key]: value }))
  const labelStyle = { display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: '600', marginBottom: 'var(--spacing-xs)' }
  const fieldStyle = { marginBottom: 'var(--spacing-md)' }

  return (
    <div>
      <div style={fieldStyle}>
        <label style={labelStyle}>Email</label>
        <input
          type="email"
          className="form-input"
          value={values.email}
          onChange={e => set('email', e.target.value)}
        />
      </div>

      <div style={fieldStyle}>
        <label style={labelStyle}>Name (optional)</label>
        <input
          type="text"
          className="form-input"
          value={values.display_name}
          onChange={e => set('display_name', e.target.value)}
        />
      </div>

      <div style={fieldStyle}>
        <label style={labelStyle}>Role</label>
        <select
          className="form-input"
          value={values.role}
          onChange={e => set('role', e.target.value)}
          disabled={self}
        >
          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        {self && (
          <p style={{ margin: 'var(--spacing-xs) 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
            You can't change your own role.
          </p>
        )}
      </div>

      <div style={fieldStyle}>
        <label style={labelStyle}>Clerk user ID</label>
        <input
          type="text"
          className="form-input"
          placeholder="user_..."
          value={values.clerk_id}
          onChange={e => set('clerk_id', e.target.value)}
        />
        <p style={{ margin: 'var(--spacing-xs) 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
          Clerk dashboard (Production instance) → Users → pick the person → User ID. Leave blank until they have signed in once.
        </p>
      </div>

      <div style={fieldStyle}>
        <label style={labelStyle}>Note (optional)</label>
        <input
          type="text"
          className="form-input"
          value={values.note}
          onChange={e => set('note', e.target.value)}
        />
      </div>

      <div className="row">
        <button
          className="btn btn-primary btn-sm"
          onClick={() => onSave(values)}
          style={{ flex: 1 }}
        >
          Save
        </button>
        <button className="btn btn-ghost btn-sm" onClick={onCancel} style={{ flex: 1 }}>
          Cancel
        </button>
      </div>
    </div>
  )
}
