import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ClerkProvider } from '@clerk/clerk-react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import App from './App.jsx'
import JobPage from './JobPage'
import './index.css'

const isTeamHost = window.location.hostname.startsWith('team.')

function TeamSite() {
  return (
    <Routes>
      <Route path="/job/:token" element={<JobPage />} />
      <Route path="*" element={
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          textAlign: 'center',
          padding: 'var(--spacing-xl)',
        }}>
          <h2>Whitetail Spur Team</h2>
          <p style={{ color: 'var(--color-text-muted)' }}>
            Please use the job link you were sent.
          </p>
        </div>
      } />
    </Routes>
  )
}

if (isTeamHost) {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <BrowserRouter>
        <TeamSite />
      </BrowserRouter>
    </StrictMode>,
  )
} else {
  const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

  if (!publishableKey) {
    throw new Error('Missing Clerk publishable key')
  }

  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <BrowserRouter>
        <ClerkProvider publishableKey={publishableKey}>
          <App />
        </ClerkProvider>
      </BrowserRouter>
    </StrictMode>,
  )
}