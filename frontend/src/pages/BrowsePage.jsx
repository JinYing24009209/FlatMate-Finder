import { useEffect, useMemo, useRef, useState } from 'react';
import PageHeader from '../components/PageHeader';
import ListingCard from '../components/ListingCard';
import { api } from '../services/api';

const emptyFilters = {
  q: '',
  city: '',
  minRent: '',
  maxRent: '',
  roomType: '',
  availableFrom: '',
};

export default function BrowsePage({ user, setPage, setSelected }) {
  const [filters, setFilters] = useState(emptyFilters);
  const [listings, setListings] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [savedIds, setSavedIds] = useState(new Set());
  const [notice, setNotice] = useState('');
  const [searchFeedback, setSearchFeedback] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchMode, setSearchMode] = useState('standard');
  const [aiStatus, setAiStatus] = useState(null);
  const resultsRef = useRef(null);
  const searchSessionRef = useRef(null);

  const loadRecommendations = async () => {
    if (user.role !== 'student') return;
    try {
      const data = await api('/ai/recommendations');
      setRecommendations(data.recommendations);
    } catch (error) {
      setNotice(`Recommendations unavailable: ${error.message}`);
    }
  };

  const loadAll = async (activeFilters = emptyFilters) => {
    try {
      const data = await api(`/listings?${new URLSearchParams(activeFilters)}`);
      setListings(data.listings);
    } catch (error) {
      setNotice(error.message);
    }
  };

  const runSearch = async (
    mode,
    activeFilters = filters,
    { interactive = true, scroll = true } = {}
  ) => {
    if (interactive) {
      setIsSearching(true);
      setNotice('');
      setSearchFeedback('Searching available rooms…');
    }

    try {
      const params = new URLSearchParams(activeFilters);
      const path = mode === 'smart' ? `/ai/smart-search?${params}` : `/listings?${params}`;
      const data = await api(path);
      const nextListings = data.listings || [];

      setListings(nextListings);
      setHasSearched(true);
      setSearchMode(mode);
      searchSessionRef.current = { mode, filters: activeFilters };

      if (interactive) {
        const resultLabel = `${nextListings.length} matching room${
          nextListings.length === 1 ? '' : 's'
        } found.`;
        setSearchFeedback(data.notice ? `${resultLabel} ${data.notice}` : resultLabel);
      }

      if (scroll) {
        window.setTimeout(
          () => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
          0
        );
      }
    } catch (error) {
      setSearchFeedback(
        `${mode === 'smart' ? 'Smart search' : 'Search'} unavailable: ${error.message}`
      );
    } finally {
      if (interactive) setIsSearching(false);
    }
  };

  const loadSaved = () =>
    api('/saved')
      .then((data) => setSavedIds(new Set(data.listings.map((listing) => listing.listing_id))))
      .catch(() => {});

  useEffect(() => {
    const refresh = () => {
      const session = searchSessionRef.current;
      if (session) runSearch(session.mode, session.filters, { interactive: false, scroll: false });
      else loadAll();
      loadRecommendations();
    };
    const storage = (event) => {
      if (event.key === 'listings-updated-at') refresh();
    };

    refresh();
    if (user.role === 'student') loadSaved();
    api('/ai/status').then(setAiStatus).catch(() => {});
    window.addEventListener('listings-changed', refresh);
    window.addEventListener('storage', storage);
    window.addEventListener('focus', refresh);
    const timer = window.setInterval(refresh, 30000);

    return () => {
      window.removeEventListener('listings-changed', refresh);
      window.removeEventListener('storage', storage);
      window.removeEventListener('focus', refresh);
      window.clearInterval(timer);
    };
  }, []);

  const recommendationById = useMemo(
    () => new Map(recommendations.map((listing) => [listing.listing_id, listing.ai_match])),
    [recommendations]
  );

  const searchResults = useMemo(() => {
    if (searchMode === 'smart') return listings;
    return [...listings].sort(
      (a, b) =>
        (recommendationById.get(b.listing_id)?.score || 0) -
        (recommendationById.get(a.listing_id)?.score || 0)
    );
  }, [listings, recommendationById, searchMode]);

  const toggleSave = async (listing, shouldSave) => {
    try {
      await api(`/listings/${listing.listing_id}/save`, {
        method: shouldSave ? 'POST' : 'DELETE',
      });
      setSavedIds((old) => {
        const next = new Set(old);
        shouldSave ? next.add(listing.listing_id) : next.delete(listing.listing_id);
        return next;
      });
      setNotice(shouldSave ? 'Saved to your shortlist.' : 'Removed from saved listings.');
    } catch (error) {
      setNotice(error.message);
    }
  };

  const open = (listing) => {
    setSelected(listing);
    setPage('Listing detail');
  };

  const clearSearch = () => {
    setFilters(emptyFilters);
    setHasSearched(false);
    setSearchFeedback('');
    setNotice('');
    searchSessionRef.current = null;
    loadAll();
  };

  const renderCard = (listing, showRecommendation = false) => (
    <ListingCard
      key={listing.listing_id}
      listing={listing}
      recommendation={showRecommendation ? recommendationById.get(listing.listing_id) : undefined}
      onOpen={open}
      onSave={toggleSave}
      saved={savedIds.has(listing.listing_id)}
    />
  );

  return (
    <main className="content browse-page">
      <PageHeader
        title="Browse accommodation"
        subtitle="Search available rooms and discover recommendations tailored to you."
      />

      <section className="search-panel" aria-label="Search listings">
        <form
          className="search-bar"
          aria-busy={isSearching}
          onSubmit={(event) => {
            event.preventDefault();
            runSearch('standard');
          }}
        >
          <div className="search-fields">
            <input
              aria-label="Search terms"
              placeholder="e.g. quiet room near a bus route"
              value={filters.q}
              onChange={(event) => setFilters({ ...filters, q: event.target.value })}
            />
            <input
              aria-label="City or suburb"
              placeholder="City or suburb"
              value={filters.city}
              onChange={(event) => setFilters({ ...filters, city: event.target.value })}
            />
            <input
              aria-label="Minimum weekly rent"
              type="number"
              min="0"
              placeholder="Min rent"
              value={filters.minRent}
              onChange={(event) => setFilters({ ...filters, minRent: event.target.value })}
            />
            <input
              aria-label="Maximum weekly rent"
              type="number"
              min="0"
              placeholder="Max rent"
              value={filters.maxRent}
              onChange={(event) => setFilters({ ...filters, maxRent: event.target.value })}
            />
            <select
              aria-label="Room type"
              value={filters.roomType}
              onChange={(event) => setFilters({ ...filters, roomType: event.target.value })}
            >
              <option value="">Any room type</option>
              <option>Single room</option>
              <option>Double room</option>
              <option>Shared room</option>
              <option>Studio</option>
            </select>
            <label className="date-filter">
              Available by
              <input
                aria-label="Available by"
                type="date"
                value={filters.availableFrom}
                onChange={(event) => setFilters({ ...filters, availableFrom: event.target.value })}
              />
            </label>
          </div>
          <div className="search-actions">
            <button className="primary" type="submit" disabled={isSearching}>
              {isSearching ? 'Searching…' : 'Search listings'}
            </button>
            <button
              className="outline"
              type="button"
              disabled={isSearching}
              onClick={() => runSearch('smart')}
            >
              {isSearching ? 'Please wait…' : '✦ Smart search'}
            </button>
          </div>
        </form>
        <p className="search-hint">
          Try a natural-language search such as “quiet furnished room near a bus route under $250”.
        </p>
        {aiStatus && (
          <p className="ai-readiness" aria-live="polite">
            <span aria-hidden="true">✦</span>
            {aiStatus.provider === 'gemini'
              ? 'Gemini semantic search is ready. Local explainable fallback stays available.'
              : 'Explainable local smart search is ready.'}
          </p>
        )}
        {searchFeedback && (
          <p className={`search-feedback ${isSearching ? 'loading' : ''}`} aria-live="polite">
            {isSearching && <span className="search-spinner" aria-hidden="true" />}
            {searchFeedback}
          </p>
        )}
      </section>

      {notice && <p className="notice browse-notice">{notice}</p>}

      {hasSearched ? (
        <section className="browse-section search-results-section" ref={resultsRef}>
          <div className="browse-section-header">
            <div>
              <div className="title-with-label">
                <h2>Search results</h2>
                <span className="ai-label">
                  {searchMode === 'smart' ? 'AI smart search' : 'AI ranked'}
                </span>
              </div>
              <p className="muted">Only rooms matching your current filters are shown here.</p>
            </div>
            <button className="text-button clear-search" onClick={clearSearch}>
              Clear search
            </button>
          </div>
          <div className="listing-grid">
            {searchResults.map((listing) => renderCard(listing, true))}
          </div>
          {!searchResults.length && (
            <div className="empty">
              No rooms match these filters. Try a nearby suburb or a higher maximum rent.
            </div>
          )}
        </section>
      ) : (
        <>
          <section className="browse-section recommendation-section">
            <div className="browse-section-header">
              <div>
                <div className="title-with-label">
                  <h2>Recommended for you</h2>
                  <span className="ai-label">AI enhanced</span>
                </div>
                <p className="muted">
                  Ranked by your budget, preferred location and lifestyle profile.
                </p>
              </div>
            </div>
            {recommendations.length ? (
              <div className="listing-grid">
                {recommendations.slice(0, 4).map((listing) => renderCard(listing, true))}
              </div>
            ) : (
              <div className="recommendation-empty">
                <span>✦</span>
                <div>
                  <strong>Complete your profile for personalised matches</strong>
                  <p>Recommendations will appear here when suitable rooms are available.</p>
                </div>
              </div>
            )}
          </section>

          <section className="browse-section">
            <div className="browse-section-header">
              <div>
                <h2>All listings</h2>
                <p className="muted">Explore every room currently available.</p>
              </div>
            </div>
            <div className="listing-grid">{listings.map((listing) => renderCard(listing))}</div>
            {!listings.length && <div className="empty">No listings are available yet.</div>}
          </section>
        </>
      )}
    </main>
  );
}
