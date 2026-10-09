import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import Modal from './Modal'
import SupplyForm from './SupplyForm'
import SupplyEditForm from './SupplyEditForm'

const PROPERTY_ID = '5a23806a-a9d4-482b-b97f-f37453e2f196'

export default function Supplies() {
    const [supplies, setSupplies] = useState([])
    const [flags, setFlags] = useState([])
    const [loading, setLoading] = useState(true)
    const [showSupplyForm, setShowSupplyForm] = useState(false)
    const [editingSupply, setEditingSupply] = useState(null)

    useEffect(() => {
        fetchAll()
    }, [])

    async function fetchAll() {
        setLoading(true)

        const { data: supplyData } = await supabase
            .from('supply_item')
            .select('*')
            .order('category', { ascending: true })

        const { data: flagData } = await supabase
            .from('supply_flag')
            .select('*, supply_item(*), cleaning_job(scheduled_date, cleaner(name))')
            .eq('resolved', false)
            .order('created_at', { ascending: false })

        setSupplies(supplyData || [])
        setFlags(flagData || [])
        setLoading(false)
    }

    async function addSupply(data) {
        await supabase
            .from('supply_item')
            .insert([{ property_id: PROPERTY_ID, ...data }])
        setShowSupplyForm(false)
        fetchAll()
    }

    async function deleteSupply(id) {
        if (!confirm('Remove this supply item?')) return
        await supabase.from('supply_item').delete().eq('id', id)
        fetchAll()
    }

    async function updateSupply(data) {
        await supabase
            .from('supply_item')
            .update(data)
            .eq('id', editingSupply.id)
        setEditingSupply(null)
        fetchAll()
    }

    async function resolveFlag(id, supplyItemId) {
        await supabase
            .from('supply_flag')
            .update({ resolved: true })
            .eq('id', id)

        await supabase
            .from('supply_item')
            .update({ current_status: 'ok' })
            .eq('id', supplyItemId)

        fetchAll()
    }

    const statusColor = (status) => ({
        ok: '#d4edda',
        low: '#fff3cd',
        out: '#f8d7da',
    }[status] || '#e2e3e5')

    const statusTextColor = (status) => ({
        ok: '#155724',
        low: '#856404',
        out: '#721c24',
    }[status] || '#383d41')

    if (loading) return <p>Loading supplies...</p>

    return (
        <section style={{ marginTop: '2rem' }}>
            <h2>Supplies</h2>
            <button onClick={() => setShowSupplyForm(true)}>+ Add Supply Item</button>
            <button onClick={fetchAll} style={{ marginLeft: '1rem' }}>↻ Refresh</button>

            {flags.length > 0 && (
                <div style={{ marginTop: '1rem', padding: '1rem', background: '#fff3cd', border: '1px solid #ffc107', borderRadius: '4px' }}>
                    <h3 style={{ marginTop: 0 }}>⚠️ Supply Flags Needing Attention</h3>
                    {flags.map(f => (
                        <div key={f.id} style={{ marginBottom: '0.75rem', paddingBottom: '0.75rem', borderBottom: '1px solid #ffc107' }}>
                            <strong>{f.supply_item?.name}</strong>
                            <span style={{
                                marginLeft: '0.5rem',
                                padding: '0.1rem 0.5rem',
                                borderRadius: '999px',
                                fontSize: '0.75rem',
                                background: f.status === 'out' ? '#f8d7da' : '#fff3cd',
                                color: f.status === 'out' ? '#721c24' : '#856404',
                            }}>
                                {f.status}
                            </span>
                            {f.cleaner_note && <p style={{ margin: '0.25rem 0', fontSize: '0.9rem' }}>Note: {f.cleaner_note}</p>}
                            <p style={{ margin: '0.25rem 0', fontSize: '0.8rem', color: '#666' }}>
                                Flagged during job on {f.cleaning_job?.scheduled_date} by {f.cleaning_job?.cleaner?.name}
                            </p>
                            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                                {f.supply_item?.order_url && (
                                    <a href={f.supply_item.order_url} target="_blank" rel="noreferrer">
                                        <button>🛒 Order Now</button>
                                    </a>
                                )}
                                <button onClick={() => resolveFlag(f.id, f.supply_item?.id)}>✅ Mark Resolved</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {supplies.length === 0
                ? <p>No supply items yet.</p>
                : supplies.map(s => (
                    <div key={s.id} style={{ border: '1px solid #ccc', padding: '1rem', marginTop: '0.5rem', borderRadius: '4px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <strong>{s.name}</strong>
                            <span style={{
                                padding: '0.25rem 0.75rem',
                                borderRadius: '999px',
                                fontSize: '0.8rem',
                                fontWeight: 'bold',
                                background: statusColor(s.current_status),
                                color: statusTextColor(s.current_status),
                            }}>
                                {s.current_status}
                            </span>
                        </div>
                        {s.category && <p style={{ margin: '0.25rem 0', color: '#666', fontSize: '0.9rem' }}>📦 {s.category}</p>}
                        {s.par_level_note && <p style={{ margin: '0.25rem 0', fontSize: '0.9rem' }}>📋 {s.par_level_note}</p>}
                        {s.order_url && (
                            <a href={s.order_url} target="_blank" rel="noreferrer" style={{ fontSize: '0.9rem' }}>
                                🛒 Order link
                            </a>
                        )}
                        <button
                            onClick={() => setEditingSupply(s)}
                            style={{ cursor: 'pointer', marginTop: '0.5rem', display: 'block' }}
                        >
                            ✏️ Edit
                        </button>
                        <button
                            onClick={() => deleteSupply(s.id)}
                            style={{ color: 'red', cursor: 'pointer', marginTop: '0.5rem', display: 'block' }}
                        >
                            Remove
                        </button>
                    </div>
                ))
            }
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
        </section>
    )
}