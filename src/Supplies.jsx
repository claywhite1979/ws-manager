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
            <div className="section-header">
                <h2>Supplies</h2>
                <div className="row">
                    <button className="btn btn-ghost btn-sm" onClick={fetchAll}>↻ Refresh</button>
                    <button className="btn btn-primary btn-sm" onClick={() => setShowSupplyForm(true)}>+ Add Supply Item</button>
                </div>
            </div>
            {flags.length > 0 && (
                <div className="alert alert-warning" style={{ marginTop: 'var(--spacing-md)' }}>
                    <h3 style={{ marginTop: 0, marginBottom: 'var(--spacing-sm)' }}>Supply Flags Needing Attention</h3>
                    {flags.map(f => (
                        <div key={f.id} style={{ marginBottom: 'var(--spacing-md)', paddingBottom: 'var(--spacing-md)', borderBottom: `1px solid var(--color-border)` }}>
                            <div className="row" style={{ marginBottom: 'var(--spacing-xs)' }}>
                                <strong>{f.supply_item?.name}</strong>
                                <span className={`badge ${f.status === 'out' ? 'badge-danger' : 'badge-warning'}`}>
                                    {f.status}
                                </span>
                            </div>
                            {f.cleaner_note && (
                                <p style={{ margin: 'var(--spacing-xs) 0', fontSize: 'var(--font-size-sm)' }}>
                                    {f.cleaner_note}
                                </p>
                            )}
                            <p style={{ margin: 'var(--spacing-xs) 0', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                                Flagged during job on {f.cleaning_job?.scheduled_date} by {f.cleaning_job?.cleaner?.name}
                            </p>
                            <div className="row" style={{ marginTop: 'var(--spacing-sm)' }}>
                                {f.supply_item?.order_url && (
                                    <a href={f.supply_item.order_url} target="_blank" rel="noreferrer">
                                        <button className="btn btn-secondary btn-sm">Order Now</button>
                                    </a>
                                )}
                                <button className="btn btn-success btn-sm" onClick={() => resolveFlag(f.id, f.supply_item?.id)}>
                                    Mark Resolved
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {supplies.length === 0
                ? <p>No supply items yet.</p>
                : supplies.map(s => (
                    <div key={s.id} className="card" style={{ marginTop: 'var(--spacing-sm)' }}>
                        <div className="row-between">
                            <div>
                                <strong>{s.name}</strong>
                                {s.category && (
                                    <p style={{ margin: 'var(--spacing-xs) 0 0', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
                                        {s.category}
                                    </p>
                                )}
                                {s.par_level_note && (
                                    <p style={{ margin: 'var(--spacing-xs) 0 0', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
                                        {s.par_level_note}
                                    </p>
                                )}
                                {s.order_url && (
                                    <a href={s.order_url} target="_blank" rel="noreferrer" style={{ fontSize: 'var(--font-size-sm)', display: 'block', marginTop: 'var(--spacing-xs)' }}>
                                        Order link
                                    </a>
                                )}
                            </div>
                            <div className="col" style={{ alignItems: 'flex-end', gap: 'var(--spacing-xs)' }}>
                                <span className={`badge ${s.current_status === 'ok' ? 'badge-success' :
                                    s.current_status === 'low' ? 'badge-warning' :
                                        'badge-danger'
                                    }`}>
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