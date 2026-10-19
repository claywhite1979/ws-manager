import { useEffect } from 'react'
import Payments from './Payments'

export default function PaymentsPage() {
  useEffect(() => {
    document.title = 'Payments — Whitetail Spur'
    return () => { document.title = 'Whitetail Spur Management Portal' }
  }, [])

  return (
    <div className="page-container">
      <Payments />
    </div>
  )
}