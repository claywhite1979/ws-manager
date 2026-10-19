import { useEffect } from 'react'
import CleaningJobs from './CleaningJobs'
import { useState } from 'react'

export default function JobsPage() {
    const [reviewRefresh, setReviewRefresh] = useState(0)

    useEffect(() => {
        document.title = 'Jobs — Whitetail Spur'
        return () => { document.title = 'Whitetail Spur Management Portal' }
    }, [])

    return (
        <div className="page-container">
            <CleaningJobs />
        </div>
    )
}