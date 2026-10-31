export default function ListToolbar({
  search, onSearch, searchPlaceholder = 'Search...',
  sortOptions = [], sortKey, onSortKey, sortDir, onSortDir,
  filters = [], activeCount = 0, onReset,
  selectMode, onToggleSelect, selectedCount = 0, shownCount = 0,
  onSelectAll, onClearSelection, bulkActions = [],
}) {
  const compact = { width: 'auto', marginTop: 0 }

  return (
    <div className="card-surface" style={{ marginTop: 'var(--spacing-md)' }}>
      <div className="row" style={{ flexWrap: 'wrap', gap: 'var(--spacing-sm)' }}>
        {onSearch && (
          <input
            className="form-input"
            type="text"
            value={search}
            onChange={e => onSearch(e.target.value)}
            placeholder={searchPlaceholder}
            style={{ ...compact, flex: '1 1 160px' }}
          />
        )}

        {sortOptions.length > 0 && (
          <>
            <select
              className="form-input"
              value={sortKey}
              onChange={e => onSortKey(e.target.value)}
              style={compact}
              aria-label="Sort by"
            >
              {sortOptions.map(o => (
                <option key={o.key} value={o.key}>Sort: {o.label}</option>
              ))}
            </select>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => onSortDir(sortDir === 'asc' ? 'desc' : 'asc')}
            >
              {sortDir === 'asc' ? '↑ Ascending' : '↓ Descending'}
            </button>
          </>
        )}

        {filters.map(f => (
          <select
            key={f.key}
            className="form-input"
            value={f.value}
            onChange={e => f.onChange(e.target.value)}
            style={compact}
            aria-label={f.label}
          >
            {f.options.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        ))}

        {activeCount > 0 && (
          <>
            <span className="badge badge-warning">Filters active ({activeCount})</span>
            <button className="btn btn-ghost btn-sm" onClick={onReset}>Reset</button>
          </>
        )}

        {onToggleSelect && (
          <button className="btn btn-secondary btn-sm" onClick={onToggleSelect}>
            {selectMode ? 'Exit select' : 'Select'}
          </button>
        )}
      </div>

      {selectMode && (
        <div className="row" style={{
          flexWrap: 'wrap',
          marginTop: 'var(--spacing-sm)',
          paddingTop: 'var(--spacing-sm)',
          borderTop: '1px solid var(--color-border)',
        }}>
          <strong style={{ fontSize: 'var(--font-size-sm)' }}>{selectedCount} selected</strong>
          <button className="btn btn-ghost btn-sm" onClick={onSelectAll}>
            Select all shown ({shownCount})
          </button>
          <button className="btn btn-ghost btn-sm" onClick={onClearSelection} disabled={selectedCount === 0}>
            Clear
          </button>
          {bulkActions.map(a => (
            <button
              key={a.label}
              className={`btn btn-sm ${a.danger ? 'btn-danger' : 'btn-secondary'}`}
              disabled={selectedCount === 0}
              onClick={a.onClick}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}