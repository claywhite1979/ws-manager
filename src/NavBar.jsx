import { useNavigate, useLocation } from 'react-router-dom'
import { UserButton } from '@clerk/clerk-react'

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard' },
  { path: '/stays', label: 'Stays' },
  { path: '/jobs', label: 'Jobs' },
  { path: '/supplies', label: 'Supplies' },
  { path: '/payments', label: 'Payments' },
  { path: '/settings', label: 'Settings' },
]

export default function NavBar() {
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <nav style={{
      background: 'var(--color-background)',
      borderBottom: '1px solid var(--color-border)',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      boxShadow: 'var(--shadow-sm)',
    }}>
      <div style={{
        maxWidth: '960px',
        margin: '0 auto',
        padding: '0 var(--spacing-lg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: '56px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
          {NAV_ITEMS.map(item => {
            const isActive = location.pathname === item.path
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '0.4rem 0.75rem',
                  cursor: 'pointer',
                  fontSize: 'var(--font-size-sm)',
                  fontWeight: isActive ? '600' : '400',
                  color: isActive ? 'var(--color-primary)' : 'var(--color-text-muted)',
                  borderBottom: isActive ? '2px solid var(--color-primary)' : '2px solid transparent',
                  borderRadius: 0,
                  fontFamily: 'var(--font-family)',
                  transition: 'color 0.15s',
                  whiteSpace: 'nowrap',
                }}
              >
                {item.label}
              </button>
            )
          })}
        </div>
        <UserButton />
      </div>
    </nav>
  )
}