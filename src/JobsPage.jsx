import { useEffect } from 'react'
import StayJobs from './StayJobs'
import CleaningJobs from './CleaningJobs'

export default function JobsPage() {
  useEffect(() => {
    document.title = 'Jobs — Whitetail Spur'
    return () => { document.title = 'Whitetail Spur Management Portal' }
  }, [])

  return (
    <div className="page-container">
      <StayJobs />
      <CleaningJobs />
    </div>
  )
}