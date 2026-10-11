export default function Modal({ title, onClose, children }) {
  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.4)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: 'var(--spacing-md)',
    }}>
      <div className="card" style={{
        width: '100%',
        maxWidth: '480px',
        maxHeight: '90vh',
        overflowY: 'auto',
        padding: 'var(--spacing-lg)',
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 'var(--spacing-lg)',
        }}>
          <h2 style={{ margin: 0 }}>{title}</h2>
          <button
            onClick={onClose}
            className="btn btn-ghost"
            style={{ fontSize: '1.25rem', lineHeight: 1, padding: '0.25rem 0.5rem' }}
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}