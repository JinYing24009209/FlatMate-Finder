export default function SearchSections({
  smartText,
  onSmartText,
  onSmartSearch,
  busy = false,
  placeholder,
  children,
}) {
  return (
    <div className="search-sections">
      <section className="search-panel smart-search-panel" aria-label="AI smart search">
        <h2>AI smart search</h2>
        <p className="muted">
          Describe what you need. This search is separate from the filters below.
        </p>

        <form
          className="smart-search-row"
          onSubmit={(e) => {
            e.preventDefault();
            if (smartText.trim() && !busy) onSmartSearch();
          }}
        >
          <input
            aria-label="Smart search description"
            maxLength={1000}
            value={smartText}
            onChange={(e) => onSmartText(e.target.value)}
            placeholder={placeholder}
          />
          <button className="primary" disabled={busy || !smartText.trim()}>
            {busy ? 'Searching…' : '✦ Smart search'}
          </button>
        </form>
      </section>

      <section className="search-panel standard-search" aria-label="Standard search">
        <h2>Standard search</h2>
        {children}
      </section>
    </div>
  );
}
