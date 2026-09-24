import { useCallback, useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader';
import { api } from '../services/api';

const emptyFilters = { q: '', location: '', maxBudget: '' };

export default function MatchesPage({ savedOnly = false }) {
  const [matches, setMatches] = useState([]);
  const [profileComplete, setProfileComplete] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [filters, setFilters] = useState(emptyFilters);
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (activeFilters) => {
    setLoading(true);
    setNotice('');
    try {
      const query = new URLSearchParams(activeFilters);
      const path = savedOnly ? '/saved-flatmates' : `/matches?${query}`;
      const data = await api(path);
      setMatches(data.matches);
      setProfileComplete(data.profile_complete !== false);
    } catch (error) {
      setNotice(error.message);
    } finally {
      setLoading(false);
    }
  }, [savedOnly]);

  useEffect(() => {
    load(emptyFilters);
  }, [load]);

  const toggleSave = async (match) => {
    const shouldSave = !match.is_saved;
    try {
      await api(`/flatmates/${match.user_id}/save`, {
        method: shouldSave ? 'POST' : 'DELETE',
      });
      if (savedOnly && !shouldSave) {
        setMatches((current) => current.filter((item) => item.user_id !== match.user_id));
      } else {
        setMatches((current) =>
          current.map((item) =>
            item.user_id === match.user_id ? { ...item, is_saved: shouldSave } : item
          )
        );
      }
      setNotice(shouldSave ? 'Flatmate saved to your shortlist.' : 'Flatmate removed.');
    } catch (error) {
      setNotice(error.message);
    }
  };

  return (
    <main className="content">
      <PageHeader
        title={savedOnly ? 'Saved flatmates' : 'Compatible flatmates'}
        subtitle={
          savedOnly
            ? 'Return to the people you may want to share a home with.'
            : 'Search profiles and compare transparent compatibility recommendations.'
        }
      />

      {!savedOnly && (
        <form
          className="flatmate-search"
          onSubmit={(event) => {
            event.preventDefault();
            load(filters);
          }}
        >
          <input
            aria-label="Name or lifestyle"
            placeholder="Name or lifestyle, e.g. tidy"
            value={filters.q}
            onChange={(event) => setFilters({ ...filters, q: event.target.value })}
          />
          <input
            aria-label="Preferred location"
            placeholder="Preferred location"
            value={filters.location}
            onChange={(event) => setFilters({ ...filters, location: event.target.value })}
          />
          <input
            aria-label="Maximum weekly budget"
            type="number"
            min="0"
            placeholder="Max weekly budget"
            value={filters.maxBudget}
            onChange={(event) => setFilters({ ...filters, maxBudget: event.target.value })}
          />
          <button className="primary" disabled={loading}>
            {loading ? 'Searching…' : 'Search people'}
          </button>
        </form>
      )}

      {!savedOnly && (
        <p className={profileComplete ? 'notice' : 'match-warning'}>
          {profileComplete
            ? 'Scores adapt to the profile fields both students provide; they are not fixed percentages.'
            : 'Complete your matching preferences to unlock meaningful compatibility percentages.'}
        </p>
      )}

      {notice && <p className={notice.includes('saved') ? 'notice' : 'muted'}>{notice}</p>}

      <div className="match-grid">
        {matches.map((match) => {
          const open = expanded === match.user_id;
          return (
            <article className={`match-card ${open ? 'expanded' : ''}`} key={match.user_id}>
              <div className="match-card-top">
                <span className="match-avatar" aria-hidden="true">
                  {match.full_name?.slice(0, 1).toUpperCase()}
                </span>
                <div className="match-heading">
                  <h3>{match.full_name}</h3>
                  <p>{match.preferred_location || 'Location not set'}</p>
                </div>
                <b className={`score ${match.compatibility_score == null ? 'incomplete' : ''}`}>
                  {match.compatibility_score == null ? '—' : `${match.compatibility_score}%`}
                </b>
              </div>

              <div className="match-preview">
                <span>
                  Budget{' '}
                  <b>
                    {match.budget_min || match.budget_max
                      ? `$${match.budget_min || 0}–$${match.budget_max || '+'}/wk`
                      : 'not provided'}
                  </b>
                </span>
                <span>
                  Routine <b>{match.study_habits || 'not provided'}</b>
                </span>
              </div>

              <div className="match-tags compact">
                {(match.lifestyle_tags || []).slice(0, 4).map((tag) => (
                  <em key={tag}>{tag.replaceAll('_', ' ')}</em>
                ))}
              </div>

              <p className="muted">{match.explanation}</p>

              <div className="match-actions">
                <button
                  className="outline"
                  aria-expanded={open}
                  onClick={() => setExpanded(open ? null : match.user_id)}
                >
                  {open ? 'Hide details' : 'View details'}
                </button>
                <button
                  type="button"
                  className={`save-button ${match.is_saved ? 'saved' : ''}`}
                  aria-pressed={match.is_saved}
                  onClick={() => toggleSave(match)}
                >
                  <span>{match.is_saved ? '♥' : '♡'}</span>
                  {match.is_saved ? ' Saved' : ' Save'}
                </button>
              </div>

              {open && (
                <div className="match-details">
                  <div>
                    <span>Preferred location</span>
                    <b>{match.preferred_location || 'Not provided'}</b>
                  </div>
                  <div>
                    <span>Contact preference</span>
                    <b>{match.contact_preference || 'In-app message'}</b>
                  </div>
                  <div className="score-breakdown">
                    <span>Why this score</span>
                    <p>
                      {match.score_breakdown?.length
                        ? match.score_breakdown.join(' · ')
                        : 'Complete both profiles to compare more preferences.'}
                    </p>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>

      {!matches.length && !loading && !notice && (
        <div className="empty">
          {savedOnly
            ? 'You have not saved any flatmate profiles yet.'
            : 'No visible profiles match these filters. Try a broader location or budget.'}
        </div>
      )}
    </main>
  );
}
