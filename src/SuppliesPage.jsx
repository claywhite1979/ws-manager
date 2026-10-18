import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Modal from './Modal'
import SupplyForm from './SupplyForm'
import SupplyEditForm from './SupplyEditForm'

const PROPERTY_ID = '5a23806a-a9d4-482b-b97f-f37453e2f196'

export default function SuppliesPage() {
  const navigate = useNavigate()
  const [supplies, setSupplies] = useState([])
  const [loading, setLoading] = useState(true)
  const [showSupplyForm, setShowSupplyForm] = useState(false)
  const [editingSupply, setEditingSupply] = useState(null)
  const [activeRoom, setActiveRoom] = useState('All')

  useEffect(() => {
    fetchSupplies()
  }, [])

  async function fetchSupplies() {
    setLoading(true)
    const { data } = await supabase
      .from('supply_item')
      .select('*')
      .eq('property_id', PROPERTY_ID)
      .order('category', { ascending: true })
    setSupplies(data || [])
    setLoading(false)
  }

  async function addSupply(data) {
    await supabase
      .from('supply_item')
      .insert([{ property_id: PROPERTY_ID, ...data }])
    setShowSupplyForm(false)
    fetchSupplies()
  }

  async function updateSupply(data) {
    await supabase
      .from('supply_item')
      .update(data)
      .eq('id', editingSupply.id)
    setEditingSupply(null)
    fetchSupplies()
  }

  async function deleteSupply(id) {
    if (!confirm('Remove this supply item?')) return
    await supabase.from('supply_item').delete().eq('id', id)
    fetchSupplies()
  }

  const rooms = ['All', ...new Set(supplies.map(s => s.category || 'Uncategorized').sort())]

  const filteredSupplies = activeRoom === 'All'
    ? supplies
    : supplies.filter(s => (s.category || 'Uncategorized') === activeRoom)

  const statusColor = (status) =>
    status === 'ok' ? 'badge-success' :
    status === 'low' ? 'badge-warning' :
    'badge-danger'

  if (loading) return (
    <div className="page-container">
      <p style={{ color: 'var(--color-text-muted)' }}>Loading supplies...</p>
    </div>
  )

  return (
    <div className="page-container">
      <div className="section-header" style={{ marginBottom: 'var(--spacing-lg)' }}>
        <div>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => navigate('/')}
            style={{ marginBottom: 'var(--spacing-xs)', paddingLeft: 0 }}
          >
            ← Back to Dashboard
          </button>
          <h1 style={{ margin: 0 }}>Supply Management</h1>
        </div>
        <button className="btn btn-primary" onClick={() => setShowSupplyForm(true)}>
          + Add Supply Item
        </button>
      </div>

      {/* Room tabs */}
      <div style={{
        display: 'flex',
        gap: 'var(--spacing-xs)',
        flexWrap: 'wrap',
        marginBottom: 'var(--spacing-lg)',
        borderBottom: '1px solid var(--color-border)',
        paddingBottom: 'var(--spacing-sm)',
      }}>
        {rooms.map(room => (
          <button
            key={room}
            onClick={() => setActiveRoom(room)}
            className="btn btn-sm"
            style={{
              background: activeRoom === room ? 'var(--color-primary)' : 'transparent',
              color: activeRoom === room ? 'white' : 'var(--color-text-muted)',
              border: activeRoom === room ? 'none' : '1px solid transparent',
              borderRadius: 'var(--radius-full)',
            }}
          >
            {room}
          </button>
        ))}
      </div>

      {filteredSupplies.length === 0 ? (
        <p className="empty-state">No supply items {activeRoom !== 'All' ? `in ${activeRoom}` : 'yet'}.</p>
      ) : (
        filteredSupplies.map(s => (
          <div key={s.id} className="card" style={{ marginTop: 'var(--spacing-sm)' }}>
            <div className="row-between">
              <div>
                <strong>{s.name}</strong>
                {s.category && (
                  <p style={{ margin: 'var(--spacing-xs) 0 0', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                    {s.category}
                  </p>
                )}
                {s.par_level_note && (
                  <p style={{ margin: 'var(--spacing-xs) 0 0', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
                    {s.par_level_note}
                  </p>
                )}
                {s.order_url && (
                  <a
                    href={s.order_url}
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontSize: 'var(--font-size-sm)', display: 'block', marginTop: 'var(--spacing-xs)' }}
                  >
                    Order link
                  </a>
                )}
              </div>
              <div className="col" style={{ alignItems: 'flex-end', gap: 'var(--spacing-xs)' }}>
                <span className={`badge ${statusColor(s.current_status)}`}>
                  {s.current_status}
                </span>
                <button className="btn btn-secondary btn-sm" onClick={() => setEditingSupply(s)}>
                  Edit
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => deleteSupply(s.id)}
                  style={{ color: 'var(--color-danger)' }}
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        ))
      )}

      {showSupplyForm && (
        <Modal title="Add Supply Item" onClose={() => setShowSupplyForm(false)}>
          <SupplyForm
            onSave={addSupply}
            onCancel={() => setShowSupplyForm(false)}
          />
        </Modal>
      )}

      {editingSupply && (
        <Modal title="Edit Supply Item" onClose={() => setEditingSupply(null)}>
          <SupplyEditForm
            initial={editingSupply}
            onSave={updateSupply}
            onCancel={() => setEditingSupply(null)}
          />
        </Modal>
      )}
    </div>
  )
}