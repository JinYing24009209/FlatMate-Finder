import { useEffect, useMemo, useRef, useState } from 'react';
import PageHeader from '../components/PageHeader';
import ListingCard from '../components/ListingCard';
import MoveInDateSelect from '../components/MoveInDateSelect';
import { CategoryMultiSelect, CategorySelect } from '../components/CategorySelect';
import useCategories from '../hooks/useCategories';
import LocationFilters from '../components/LocationFilters';
import SearchSections from '../components/SearchSections';
import { api } from '../services/api';

// Keep standard and smart-search filters in the same serialisable shape.
const emptyFilters = {
  q: '',
  city: '',
  suburb: '',
  minRent: '',
  maxRent: '',
  roomType: '',
  availableFrom: '',
  transport: [],
  utilities: [],
  lifestyle: [],
};

const recentSearchKey = 'flatmate-finder-recent-listing-searches';
const readRecentSearches = () => {
  try {
    const value = JSON.parse(localStorage.getItem(recentSearchKey) || '[]');
    return Array.isArray(value) ? value.slice(0, 5).map(String) : [];
  } catch {
    return [];
  }
};
const rememberSearch = (mode, values) => {
  const summary =
    mode === 'smart'
      ? String(values.q || '').trim()
      : Object.entries(values)
          .filter(([, value]) => (Array.isArray(value) ? value.length : value !== ''))
          .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`)
          .join('; ');
  if (!summary) return;
  const recent = [summary, ...readRecentSearches().filter((item) => item !== summary)].slice(0, 5);
  localStorage.setItem(recentSearchKey, JSON.stringify(recent));
};

export default function BrowsePage({ user, setPage, setSelected, initialState, onStateChange }) {
  const [filters, setFilters] = useState(() => initialState?.filters || emptyFilters);
  const [smartText, setSmartText] = useState(() => initialState?.smartText || '');
  const [listings, setListings] = useState(() => initialState?.listings || []);
  const [listingsLoading, setListingsLoading] = useState(() => !initialState);
  const [listingsError, setListingsError] = useState(() => initialState?.listingsError || '');
  const [recommendations, setRecommendations] = useState(() => initialState?.recommendations || []);
  const [savedIds, setSavedIds] = useState(new Set());
  const [notice, setNotice] = useState(() => initialState?.notice || '');
  const [searchFeedback, setSearchFeedback] = useState(() => initialState?.searchFeedback || '');
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(() => initialState?.hasSearched || false);
  const [searchMode, setSearchMode] = useState(() => initialState?.searchMode || 'standard');
  const [aiStatus, setAiStatus] = useState(() => initialState?.aiStatus || null);
  const resultsRef = useRef(null);
  const searchSessionRef = useRef(initialState?.searchSession || null);
  const listingsRequestRef = useRef(0);
  const interactiveSearchRef = useRef(false);
  const { options } = useCategories();

  useEffect(() => {
    onStateChange?.({
      filters,
      smartText,
      listings,
      listingsError,
      recommendations,
      notice,
      searchFeedback,
      hasSearched,
      searchMode,
      aiStatus,
      searchSession: searchSessionRef.current,
    });
  }, [
    filters,
    smartText,
    listings,
    listingsError,
    recommendations,
    notice,
    searchFeedback,
    hasSearched,
    searchMode,
    aiStatus,
    onStateChange,
  ]);

  const loadRecommendations = async () => {
    if (user.role !== 'student') return;
    try {
      const params = new URLSearchParams({ recentSearches: JSON.stringify(readRecentSearches()) });
      const data = await api(`/ai/recommendations?${params}`);
      setRecommendations(data.recommendations);
    } catch (error) {
      setNotice(`Recommendations unavailable: ${error.message}`);
    }
  };

  const loadAll = async (activeFilters = emptyFilters) => {
    const request = ++listingsRequestRef.current;
    setListingsError('');
    try {
      const data = await api(`/listings?${new URLSearchParams(activeFilters)}`);
      if (request !== listingsRequestRef.current) return;
      setListings(data.listings || []);
    } catch (error) {
      if (request === listingsRequestRef.current) setListingsError(error.message);
    } finally {
      if (request === listingsRequestRef.current) setListingsLoading(false);
    }
  };

  // Run either search mode while preserving enough state to refresh its results.
  const runSearch = async (
    mode,
    activeFilters = filters,
    { interactive = true, scroll = true } = {}
  ) => {
    const request = ++listingsRequestRef.current;
    if (interactive) {
      interactiveSearchRef.current = true;
      setIsSearching(true);
      setNotice('');
      setSearchFeedback('Searching available rooms…');
    }

    try {
      const params = new URLSearchParams(activeFilters);
      const path = mode === 'smart' ? `/ai/smart-search?${params}` : `/listings?${params}`;
      const data = await api(path);
      if (request !== listingsRequestRef.current) return;
      const nextListings = data.listings || [];

      setListings(nextListings);
      setHasSearched(true);
      setSearchMode(mode);
      searchSessionRef.current = { mode, filters: activeFilters };
      rememberSearch(mode, activeFilters);

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
      if (request === listingsRequestRef.current)
        setSearchFeedback(
          mode === 'smart'
            ? `Smart search unavailable: ${error.message}`
            : `Search unavailable: ${error.message}`
        );
    } finally {
      if (interactive && request === listingsRequestRef.current) {
        interactiveSearchRef.current = false;
        setIsSearching(false);
      }
    }
  };

  const loadSaved = () =>
    api('/saved')
      .then((data) => setSavedIds(new Set(data.listings.map((listing) => listing.listing_id))))
      .catch(() => {});

  useEffect(() => {
    const requestSequence = listingsRequestRef;
    const refresh = () => {
      // Preserve explicit search results until the user searches again or clears them.
      if (!interactiveSearchRef.current && !searchSessionRef.current) loadAll();
    };
    const storage = (event) => {
      if (event.key === 'listings-updated-at') refresh();
    };

    if (!initialState) {
      loadAll();
      loadRecommendations();
    } else {
      setListingsLoading(false);
    }
    if (user.role === 'student') loadSaved();
    api('/ai/status')
      .then(setAiStatus)
      .catch(() => {});
    window.addEventListener('listings-changed', refresh);
    window.addEventListener('storage', storage);

    return () => {
      requestSequence.current++;
      window.removeEventListener('listings-changed', refresh);
      window.removeEventListener('storage', storage);
    };
    // This lifecycle owns one set of listing-change listeners for the mounted account.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    setSmartText('');
    setHasSearched(false);
    setSearchFeedback('');
    setNotice('');
    searchSessionRef.current = null;
    loadAll();
    loadRecommendations();
  };

  const renderCard = (listing, showRecommendation = false) => (
    <ListingCard
      key={listing.listing_id}
      listing={listing}
      recommendation={
        showRecommendation
          ? listing.ai_match || recommendationById.get(listing.listing_id)
          : undefined
      }
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

      <SearchSections
        smartText={smartText}
        onSmartText={setSmartText}
        busy={isSearching}
        onSmartSearch={() => runSearch('smart', { ...emptyFilters, q: smartText })}
        placeholder="e.g. quiet furnished room in Auckland under $250 near a bus"
      >
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
            <LocationFilters
              city={filters.city}
              suburb={filters.suburb}
              onChange={(location) => setFilters({ ...filters, ...location })}
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
            <CategorySelect
              aria-label="Room type"
              options={options('room_type')}
              value={filters.roomType}
              placeholder="Any room type"
              onChange={(event) => setFilters({ ...filters, roomType: event.target.value })}
            />
            <label className="date-filter">
              Available by
              <MoveInDateSelect
                label="Available by"
                allowFlexible={false}
                allowUnspecified
                value={filters.availableFrom}
                onChange={(value) => setFilters({ ...filters, availableFrom: value })}
              />
            </label>
          </div>
          <div className="form-grid additional-filters">
            <label>
              Transport
              <CategoryMultiSelect
                label="Transport"
                options={options('transport')}
                value={filters.transport}
                onChange={(transport) => setFilters({ ...filters, transport })}
              />
            </label>
            <label>
              Facilities & utilities
              <CategoryMultiSelect
                label="Facilities and utilities"
                options={options('utility')}
                value={filters.utilities}
                onChange={(utilities) => setFilters({ ...filters, utilities })}
              />
            </label>
            <label>
              Life in the flat
              <CategoryMultiSelect
                label="Life in the flat"
                options={options('listing_lifestyle')}
                value={filters.lifestyle}
                onChange={(lifestyle) => setFilters({ ...filters, lifestyle })}
              />
            </label>
          </div>
          <p className="muted">
            Every comma-separated phrase must match its field, ignoring case. Lifestyle phrases
            search the description and house rules. Available by includes that date.
          </p>
          <div className="search-actions">
            <button className="primary" type="submit" disabled={isSearching}>
              {isSearching ? 'Searching…' : 'Search listings'}
            </button>
            <button
              className="text-button"
              type="button"
              onClick={clearSearch}
              disabled={isSearching}
            >
              Clear
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
              ? 'Gemini smart search is ready. Local keyword fallback remains available.'
              : 'Local keyword smart search is ready.'}
          </p>
        )}
        {searchFeedback && (
          <p className={`search-feedback ${isSearching ? 'loading' : ''}`} aria-live="polite">
            {isSearching && <span className="search-spinner" aria-hidden="true" />}
            {searchFeedback}
          </p>
        )}
      </SearchSections>

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
                  Ranked by your profile, recent searches, saved listings and listing meaning.
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
            {listingsLoading ? (
              <div className="empty" role="status">
                Loading available rooms…
              </div>
            ) : listingsError ? (
              <div className="empty" role="alert">
                {listingsError}{' '}
                <button className="outline" onClick={() => loadAll()}>
                  Try again
                </button>
              </div>
            ) : (
              !listings.length && <div className="empty">No listings are available yet.</div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
