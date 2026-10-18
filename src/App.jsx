import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { SignedIn, SignedOut, SignInButton, UserButton, useUser, SignOutButton } from '@clerk/clerk-react'
import Stays from './Stays'
import CleaningJobs from './CleaningJobs'
import { Routes, Route } from 'react-router-dom'
import JobPage from './JobPage'
import Supplies from './Supplies'
import ICalSync from './ICalSync'
import Modal from './Modal'
import CleanerForm from './CleanerForm'
import SyncReview from './SyncReview'
import Payments from './Payments'
import SuppliesPage from './SuppliesPage'
import Alerts from './Alerts'
import CleanerEditForm from './CleanerEditForm'

function Dashboard() {
  const { user } = useUser()
  const ALLOWED_EMAILS = ['claywhite1979@gmail.com', 'hpkcllc@gmail.com', 'imkkristenwhite@gmail.com', 'alba.villa@cox.net', 'r_p_crawford@yahoo.com']
  const [stayRefresh, setStayRefresh] = useState(0)
  const [showCleanerForm, setShowCleanerForm] = useState(false)
  const [reviewRefresh, setReviewRefresh] = useState(0)
  const [editingCleaner, setEditingCleaner] = useState(null)

  function triggerStayRefresh() {
    setStayRefresh(prev => prev + 1)
  }

  function triggerReviewRefresh() {
    setReviewRefresh(prev => prev + 1)
  }

  const userEmail = user?.emailAddresses[0]?.emailAddress
  if (userEmail && !ALLOWED_EMAILS.includes(userEmail)) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', fontFamily: 'sans-serif' }}>
        <h2>Access Denied</h2>
        <p>You don't have permission to access this app.</p>
        <SignOutButton>
          <button>Sign Out</button>
        </SignOutButton>
      </div>
    )
  }
  const [properties, setProperties] = useState([])
  const [cleaners, setCleaners] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)

    const { data: propertyData } = await supabase
      .from('property')
      .select('*')

    const { data: cleanerData } = await supabase
      .from('cleaner')
      .select('*')

    setProperties(propertyData || [])
    setCleaners(cleanerData || [])
    setLoading(false)
  }

  async function addProperty() {
    const name = prompt('Property name?')
    const address = prompt('Address?')
    if (!name) return

    await supabase
      .from('property')
      .insert([{ name, address }])

    fetchData()
  }

  async function addCleaner(data) {
    await supabase
      .from('cleaner')
      .insert([data])
    setShowCleanerForm(false)
    fetchData()
  }

  async function updateCleaner(data) {
    await supabase
      .from('cleaner')
      .update(data)
      .eq('id', editingCleaner.id)
    setEditingCleaner(null)
    fetchData()
  }

  async function deleteCleaner(id) {
    if (!confirm('Are you sure you want to remove this cleaner?')) return

    await supabase
      .from('cleaner')
      .delete()
      .eq('id', id)

    fetchData()
  }

  if (loading) return <p>Loading...</p>

  return (
    <div className="page-container">
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        flexWrap: 'wrap',
        gap: '0.5rem',
        marginBottom: '1rem',
      }}>
        <h1 style={{
          margin: 0,
          fontSize: 'clamp(1.2rem, 4vw, 1.8rem)',
          lineHeight: '1.3',
          flex: '1 1 200px',
        }}>
          Whitetail Spur Management Portal
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexShrink: 0 }}>
          <span style={{ fontSize: '0.9rem' }}>👋 {user?.firstName || user?.emailAddresses[0]?.emailAddress}</span>
          <UserButton />
        </div>
      </div>

      <Alerts />

      <section className="section">
        <div className="section-header">
          <h2>Properties</h2>
          <button className="btn btn-primary btn-sm" onClick={addProperty}>+ Add Property</button>
        </div>
        {properties.length === 0
          ? <p className="empty-state">No properties yet.</p>
          : properties.map(p => (
            <div key={p.id} className="card" style={{ marginTop: 'var(--spacing-sm)' }}>
              <strong>{p.name}</strong>
              <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', marginTop: 'var(--spacing-xs)' }}>{p.address}</p>
            </div>
          ))
        }
      </section>

      <Stays refreshTrigger={stayRefresh} />

      <section className="section">
        <div className="section-header">
          <h2>Cleaners</h2>
          <button className="btn btn-primary btn-sm" onClick={() => setShowCleanerForm(true)}>+ Add Cleaner</button>
        </div>
        {cleaners.length === 0
          ? <p className="empty-state">No cleaners yet.</p>
          : cleaners.map(c => (
            <div key={c.id} className="card" style={{ marginTop: 'var(--spacing-sm)' }}>
              <div className="row-between">
                <div>
                  <strong>{c.name}</strong>
                  <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', marginTop: 'var(--spacing-xs)' }}>📞 {c.phone}</p>
                  <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>💵 Default rate: ${c.default_rate}</p>
                </div>
                <div className="col" style={{ alignItems: 'flex-end', gap: 'var(--spacing-xs)' }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => setEditingCleaner(c)}>
                    Edit
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => deleteCleaner(c.id)}
                    style={{ color: 'var(--color-danger)' }}
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))
        }
      </section>

      <CleaningJobs />
      <Payments />
      <Supplies />
      <SyncReview onReviewed={triggerStayRefresh} refreshTrigger={reviewRefresh} />
      <ICalSync onSync={() => { triggerStayRefresh(); triggerReviewRefresh() }} />
      {showCleanerForm && (
        <Modal title="Add Cleaner" onClose={() => setShowCleanerForm(false)}>
          <CleanerForm
            onSave={addCleaner}
            onCancel={() => setShowCleanerForm(false)}
          />
        </Modal>
      )}
      {editingCleaner && (
        <Modal title="Edit Cleaner" onClose={() => setEditingCleaner(null)}>
          <CleanerEditForm
            initial={editingCleaner}
            onSave={updateCleaner}
            onCancel={() => setEditingCleaner(null)}
          />
        </Modal>
      )}
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
            <Dashboard />
          </SignedIn>
        </>
      } />
      <Route path="/supplies" element={<SuppliesPage />} />
    </Routes>
  )
}

export default App