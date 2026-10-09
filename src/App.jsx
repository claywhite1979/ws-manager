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

function Dashboard() {
  const { user } = useUser()
  const ALLOWED_EMAILS = ['claywhite1979@gmail.com', 'hpkcllc@gmail.com', 'imkkristenwhite@gmail.com', 'alba.villa@cox.net']
  const [stayRefresh, setStayRefresh] = useState(0)
  const [showCleanerForm, setShowCleanerForm] = useState(false)

  function triggerStayRefresh() {
    setStayRefresh(prev => prev + 1)
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
    <div style={{ padding: '1.5rem', fontFamily: 'sans-serif', maxWidth: '960px', margin: '0 auto', boxSizing: 'border-box' }}>
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

      <section>
        <h2>Properties</h2>
        <button onClick={addProperty}>+ Add Property</button>
        {properties.length === 0
          ? <p>No properties yet.</p>
          : properties.map(p => (
            <div key={p.id} style={{ border: '1px solid #ccc', padding: '1rem', marginTop: '0.5rem', borderRadius: '4px' }}>
              <strong>{p.name}</strong>
              <p>{p.address}</p>
            </div>
          ))
        }
      </section>

      <section style={{ marginTop: '2rem' }}>
        <h2>Cleaners</h2>
        <button onClick={() => setShowCleanerForm(true)}>+ Add Cleaner</button>
        {cleaners.length === 0
          ? <p>No cleaners yet.</p>
          : cleaners.map(c => (
            <div key={c.id} style={{ border: '1px solid #ccc', padding: '1rem', marginTop: '0.5rem', borderRadius: '4px' }}>
              <strong>{c.name}</strong>
              <p>📞 {c.phone}</p>
              <p>💵 Default rate: ${c.default_rate}</p>
              <button
                onClick={() => deleteCleaner(c.id)}
                style={{ color: 'red', cursor: 'pointer', marginTop: '0.5rem' }}
              >
                Remove
              </button>
            </div>
          ))
        }
      </section>

      <Stays refreshTrigger={stayRefresh} />
      <CleaningJobs />
      <Supplies />
      <SyncReview onReviewed={triggerStayRefresh} />
      <ICalSync onSync={triggerStayRefresh} />
      {showCleanerForm && (
        <Modal title="Add Cleaner" onClose={() => setShowCleanerForm(false)}>
          <CleanerForm
            onSave={addCleaner}
            onCancel={() => setShowCleanerForm(false)}
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
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'sans-serif' }}>
              <div style={{ textAlign: 'center' }}>
                <h1>WS Manager</h1>
                <p>Please sign in to continue.</p>
                <SignInButton mode="modal">
                  <button style={{ padding: '0.75rem 1.5rem', fontSize: '1rem', cursor: 'pointer' }}>
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
    </Routes>
  )
}

export default App