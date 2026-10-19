import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { useUser, SignOutButton } from '@clerk/clerk-react'
import Modal from './Modal'
import CleanerForm from './CleanerForm'
import CleanerEditForm from './CleanerEditForm'

export default function SettingsPage() {
  const { user } = useUser()
  const [properties, setProperties] = useState([])
  const [cleaners, setCleaners] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCleanerForm, setShowCleanerForm] = useState(false)
  const [editingCleaner, setEditingCleaner] = useState(null)

  useEffect(() => {
    document.title = 'Settings — Whitetail Spur'
    fetchData()
    return () => { document.title = 'Whitetail Spur Management Portal' }
  }, [])

  async function fetchData() {
    setLoading(true)
    const { data: propertyData } = await supabase.from('property').select('*')
    const { data: cleanerData } = await supabase.from('cleaner').select('*')
    setProperties(propertyData || [])
    setCleaners(cleanerData || [])
    setLoading(false)
  }

  async function addCleaner(data) {
    await supabase.from('cleaner').insert([data])
    setShowCleanerForm(false)
    fetchData()
  }

  async function updateCleaner(data) {
    await supabase.from('cleaner').update(data).eq('id', editingCleaner.id)
    setEditingCleaner(null)
    fetchData()
  }

  async function deleteCleaner(id) {
    if (!confirm('Remove this cleaner? This will also delete their job history.')) return
    await supabase.from('cleaner').delete().eq('id', id)
    fetchData()
  }

  if (loading) return <div className="page-container"><p style={{ color: 'var(--color-text-muted)' }}>Loading...</p></div>

  return (
    <div className="page-container">
      <h1 style={{ marginBottom: 'var(--spacing-xl)' }}>Settings</h1>

      {/* Properties */}
      <section className="section">
        <div className="section-header">
          <h2>Properties</h2>
        </div>
        {properties.map(p => (
          <div key={p.id} className="card" style={{ marginTop: 'var(--spacing-sm)' }}>
            <strong>{p.name}</strong>
            {p.address && <p style={{ margin: 'var(--spacing-xs) 0 0', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>{p.address}</p>}
          </div>
        ))}
      </section>

      {/* Cleaners */}
      <section className="section">
        <div className="section-header">
          <h2>Cleaners</h2>
          <button className="btn btn-primary btn-sm" onClick={() => setShowCleanerForm(true)}>
            + Add Cleaner
          </button>
        </div>
        {cleaners.length === 0
          ? <p className="empty-state">No cleaners yet.</p>
          : cleaners.map(c => (
            <div key={c.id} className="card" style={{ marginTop: 'var(--spacing-sm)' }}>
              <div className="row-between">
                <div>
                  <div className="row" style={{ alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                    <strong>{c.name}</strong>
                    {!c.active && <span className="badge badge-neutral">Inactive</span>}
                  </div>
                  {c.phone && <p style={{ margin: 'var(--spacing-xs) 0 0', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>{c.phone}</p>}
                  {c.email && <p style={{ margin: 'var(--spacing-xs) 0 0', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>{c.email}</p>}
                  {c.default_rate && <p style={{ margin: 'var(--spacing-xs) 0 0', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>Default rate: ${c.default_rate}</p>}
                </div>
                <div className="col" style={{ alignItems: 'flex-end', gap: 'var(--spacing-xs)' }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => setEditingCleaner(c)}>
                    Edit
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => deleteCleaner(c.id)}
                    style={{ color: 'var(--color-danger)' }}
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))
        }
      </section>

      {/* Account */}
      <section className="section">
        <h2>Account</h2>
        <div className="card" style={{ marginTop: 'var(--spacing-sm)' }}>
          <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
            Signed in as {user?.emailAddresses[0]?.emailAddress}
          </p>
          <div style={{ marginTop: 'var(--spacing-md)' }}>
            <SignOutButton>
              <button className="btn btn-secondary btn-sm">Sign Out</button>
            </SignOutButton>
          </div>
        </div>
      </section>

      {showCleanerForm && (
        <Modal title="Add Cleaner" onClose={() => setShowCleanerForm(false)}>
          <CleanerForm onSave={addCleaner} onCancel={() => setShowCleanerForm(false)} />
        </Modal>
      )}

      {editingCleaner && (
        <Modal title="Edit Cleaner" onClose={() => setEditingCleaner(null)}>
          <CleanerEditForm
            initial={editingCleaner}
            onSave={updateCleaner}
            onCancel={() => setEditingCleaner(null)}
          />
        </Modal>
      )}
    </div>
  )
}