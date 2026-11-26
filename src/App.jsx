import { useState } from 'react'
import { SignedIn, SignedOut, SignInButton, SignOutButton, useUser } from '@clerk/clerk-react'
import { Routes, Route } from 'react-router-dom'
import JobPage from './JobPage'
import SuppliesPage from './SuppliesPage'
import Alerts from './Alerts'
import NavBar from './NavBar'
import StaysPage from './StaysPage'
import JobsPage from './JobsPage'
import PaymentsPage from './PaymentsPage'
import SettingsPage from './SettingsPage'
import DashboardStays from './DashboardStays'
import DashboardPayments from './DashboardPayments'
import Supplies from './Supplies'
import { useRole } from './useRole'

// Access is decided by the database (the app_user table). This gate asks the
// database who you are and shows a plain message if you have no access yet.
function AccessGate({ children }) {
  const role = useRole()

  if (role === null) {
    return (
      <div className="page-container">
        <p style={{ color: 'var(--color-text-muted)' }}>Loading...</p>
      </div>
    )
  }

  if (role === 'none') {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h2>Your account isn't set up yet</h2>
        <p style={{ color: 'var(--color-text-muted)' }}>
          You're signed in, but you don't have access to this app yet. Please ask the property owner to finish setting up your access.
        </p>
        <SignOutButton>
          <button className="btn btn-secondary">Sign Out</button>
        </SignOutButton>
      </div>
    )
  }

  return children
}

function Dashboard() {
  const { user } = useUser()

  return (
    <div className="page-container">
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        flexWrap: 'wrap',
        gap: '0.5rem',
        marginBottom: 'var(--spacing-lg)',
      }}>
        <h1 style={{
          margin: 0,
          fontSize: 'clamp(1.2rem, 4vw, 1.8rem)',
          lineHeight: '1.3',
          flex: '1 1 200px',
        }}>
          Whitetail Spur
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexShrink: 0 }}>
          <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
            {user?.firstName || user?.emailAddresses[0]?.emailAddress}
          </span>
        </div>
      </div>

      <Alerts />
      <DashboardStays />
      <Supplies />
      <DashboardPayments />
    </div>
  )
}

function App() {
  return (
    <Routes>
      <Route path="/job/:token" element={<JobPage />} />
      <Route path="/*" element={
        <>
          <SignedOut>
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              height: '100vh',
              background: 'var(--color-surface)',
            }}>
              <div className="card" style={{ textAlign: 'center', maxWidth: '400px', width: '100%' }}>
                <h1 style={{ marginBottom: 'var(--spacing-sm)' }}>Whitetail Spur</h1>
                <p style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--spacing-lg)' }}>Management Portal</p>
                <SignInButton mode="modal">
                  <button className="btn btn-primary btn-lg btn-block">
                    Sign In
                  </button>
                </SignInButton>
              </div>
            </div>
          </SignedOut>
          <SignedIn>
            <AccessGate>
              <NavBar />
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/stays" element={<StaysPage />} />
                <Route path="/jobs" element={<JobsPage />} />
                <Route path="/supplies" element={<SuppliesPage />} />
                <Route path="/payments" element={<PaymentsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Routes>
            </AccessGate>
          </SignedIn>
        </>
      } />
    </Routes>
  )
}

export default App