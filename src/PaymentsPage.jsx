import { useEffect, useState } from 'react'
import Payments from './Payments'
import { supabase } from './supabaseClient'

export default function PaymentsPage() {
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    document.title = 'Payments — Whitetail Spur'
    return () => { document.title = 'Whitetail Spur Management Portal' }
  }, [])

  async function exportCSV() {
    setExporting(true)

    const { data } = await supabase
      .from('cleaning_job')
      .select('*, cleaner(*), stay(*)')
      .eq('payment_status', 'paid')
      .in('status', ['confirmed', 'complete'])
      .order('scheduled_date', { ascending: true })

    if (!data || data.length === 0) {
      alert('No paid jobs to export.')
      setExporting(false)
      return
    }

    const rows = [
      ['Date', 'Cleaner', 'Job Title', 'Stay Guest', 'Checkout Date', 'Rate', 'Payment Note'],
      ...data.map(j => [
        j.scheduled_date,
        j.cleaner?.name || j.worker_name || 'Unknown',
        j.title || 'Cleaning',
        j.stay?.guest_name || '',
        j.stay?.check_out || '',
        j.agreed_rate || '',
        j.payment_note || '',
      ])
    ]

    const csv = rows.map(row =>
      row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(',')
    ).join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `whitetailspur-payments-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    setExporting(false)
  }

  return (
    <div className="page-container">
      <div className="section-header" style={{ marginBottom: 'var(--spacing-lg)' }}>
        <h1 style={{ margin: 0 }}>Payments</h1>
        <button
          className="btn btn-secondary"
          onClick={exportCSV}
          disabled={exporting}
        >
          {exporting ? 'Exporting...' : '⬇ Export CSV'}
        </button>
      </div>
      <Payments />
    </div>
  )
}