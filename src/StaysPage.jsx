import { useState, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import Stays from './Stays'
import SyncReview from './SyncReview'
import ICalSync from './ICalSync'

export default function StaysPage() {
  const [reviewRefresh, setReviewRefresh] = useState(0)
  const location = useLocation()

  useEffect(() => {
    document.title = 'Stays — Whitetail Spur'
    return () => { document.title = 'Whitetail Spur Management Portal' }
  }, [])

  useEffect(() => {
    if (location.hash) {
      const id = location.hash.replace('#', '')
      setTimeout(() => {
        const el = document.getElementById(id)
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 300)
    }
  }, [location])

  return (
    <div className="page-container">
      <SyncReview
        onReviewed={() => setReviewRefresh(prev => prev + 1)}
        refreshTrigger={reviewRefresh}
      />
      <Stays refreshTrigger={reviewRefresh} />
      <ICalSync onSync={() => setReviewRefresh(prev => prev + 1)} />
    </div>
  )
}