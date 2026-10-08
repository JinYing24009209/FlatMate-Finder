import { useCallback, useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader';
import FlatmateCard from '../components/FlatmateCard';
import { api } from '../services/api';
const empty = { q: '', location: '', maxBudget: '' };
export default function MatchesPage({ savedOnly = false, setPage, setSelected }) {
  const [matches, setMatches] = useState([]);
  const [filters, setFilters] = useState(empty);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [complete, setComplete] = useState(true);
  const [saving, setSaving] = useState(null);
  const load = useCallback(
    async (values = empty) => {
      setLoading(true);
      setError('');
      try {
        const data = await api(
          savedOnly ? '/saved-flatmates' : `/matches?${new URLSearchParams(values)}`
        );
        setMatches(data.matches);
        setComplete(data.profile_complete);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    },
    [savedOnly]
  );
  useEffect(() => {
    load();
  }, [load]);
  const save = async (person) => {
    setSaving(person.user_id);
    setNotice('');
    try {
      await api(`/flatmates/${person.user_id}/save`, {
        method: person.is_saved ? 'DELETE' : 'POST',
      });
      setMatches((old) =>
        savedOnly
          ? old.filter((x) => x.user_id !== person.user_id)
          : old.map((x) => (x.user_id === person.user_id ? { ...x, is_saved: !x.is_saved } : x))
      );
      setNotice(person.is_saved ? 'Removed from saved flatmates.' : 'Added to saved flatmates.');
    } catch (e) {
      setNotice(e.message);
    } finally {
      setSaving(null);
    }
  };
  const open = (person) => {
    setSelected(person);
    setPage('Flatmate detail');
  };
  return (
    <main className="content people-page">
      <PageHeader
        title={savedOnly ? 'Saved flatmates' : 'Find your kind of flatmate'}
        subtitle={
          savedOnly
            ? 'Your shortlist of people you would like to share a home with.'
            : 'Explore people, compare your preferences and start a conversation.'
        }
      />
      {!savedOnly && (
        <section className="search-panel">
          <form
            className="flatmate-search"
            onSubmit={(e) => {
              e.preventDefault();
              load(filters);
            }}
          >
            <input
              aria-label="Name or lifestyle"
              placeholder="Name or lifestyle, e.g. tidy"
              value={filters.q}
              onChange={(e) => setFilters({ ...filters, q: e.target.value })}
            />
            <input
              aria-label="Preferred location"
              placeholder="City or suburb"
              value={filters.location}
              onChange={(e) => setFilters({ ...filters, location: e.target.value })}
            />
            <input
              aria-label="Maximum weekly budget"
              type="number"
              min="0"
              placeholder="Max weekly budget"
              value={filters.maxBudget}
              onChange={(e) => setFilters({ ...filters, maxBudget: e.target.value })}
            />
            <button className="primary" disabled={loading}>
              {loading ? 'Searching…' : 'Search flatmates'}
            </button>
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setFilters(empty);
                load(empty);
              }}
            >
              Clear
            </button>
          </form>
          <p className="search-hint">
            ✦ Compatibility scores compare shared preferences. Complete your profile for more
            meaningful results.
          </p>
        </section>
      )}
      {!complete && !savedOnly && (
        <p className="notice">
          Add your budget, location and lifestyle in{' '}
          <button className="text-button" onClick={() => setPage('My profile')}>
            My profile
          </button>{' '}
          to see compatibility scores.
        </p>
      )}
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      <div className="browse-section-header">
        <div>
          <h2>{savedOnly ? 'Your saved people' : 'Compatible flatmates'}</h2>
          <p className="muted">
            {loading ? 'Loading profiles…' : `${matches.length} profiles to explore`}
          </p>
        </div>
        <span className="ai-label">AI enhanced · preference matching</span>
      </div>
      {error ? (
        <div className="empty" role="alert">
          {error}{' '}
          <button className="outline" onClick={() => load(filters)}>
            Try again
          </button>
        </div>
      ) : loading ? (
        <div className="empty" role="status">
          Loading flatmates…
        </div>
      ) : matches.length ? (
        <div className="people-grid">
          {matches.map((person) => (
            <FlatmateCard
              key={person.user_id}
              flatmate={person}
              onOpen={open}
              onSave={save}
              busy={saving === person.user_id}
            />
          ))}
        </div>
      ) : (
        <div className="empty">
          {savedOnly
            ? 'No saved flatmates yet. Explore profiles and save the people you would like to meet.'
            : 'No visible profiles match these filters. Try another location or check back soon.'}
        </div>
      )}
    </main>
  );
}
