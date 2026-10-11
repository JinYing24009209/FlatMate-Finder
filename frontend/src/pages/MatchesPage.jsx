import { useCallback, useEffect, useRef, useState } from 'react';
import PageHeader from '../components/PageHeader';
import FlatmateCard from '../components/FlatmateCard';
import MoveInDateSelect from '../components/MoveInDateSelect';
import SearchSections from '../components/SearchSections';
import LocationFilters from '../components/LocationFilters';
import { api } from '../services/api';
const empty = { q: '', city: '', suburb: '', maxBudget: '',studyHabits:'',lifestyle:'',moveInFrom:'',moveInTo:'' };
export default function MatchesPage({ savedOnly = false, setPage, setSelected }) {
  const [matches, setMatches] = useState([]);
  const [filters, setFilters] = useState(empty);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [complete, setComplete] = useState(true);
  const [saving, setSaving] = useState(null);
  const [smartText,setSmartText]=useState(''),[searchInfo,setSearchInfo]=useState('');
  const latest=useRef(0),lastSearch=useRef({values:empty,smart:false});
  const load = useCallback(
    async (values = empty, smart=false) => {
      const request=++latest.current;lastSearch.current={values,smart};
      setLoading(true);
      setError('');
      try {
        const data = await api(
          savedOnly ? '/saved-flatmates' : `${smart?'/matches/smart-search':'/matches'}?${new URLSearchParams(values)}`
        );
        if(request!==latest.current)return;
        setMatches(data.matches);
        setComplete(data.profile_complete);
        setSearchInfo(smart?`${data.search_mode==='gemini'?'Gemini interpretation':'Local keyword interpretation'} · Applied filters: ${Object.entries(data.interpretation||{}).filter(([k,v])=>k!=='mode'&&v!==null&&v!==''&&(!Array.isArray(v)||v.length)).map(([k,v])=>`${k}: ${Array.isArray(v)?v.join(', '):v}`).join(' · ') || 'none recognised; showing eligible profiles'}`:'Standard filters applied.');
      } catch (e) {
        if(request===latest.current)setError(e.message);
      } finally {
        if(request===latest.current)setLoading(false);
      }
    },
    [savedOnly]
  );
  useEffect(() => {
    load();
    return()=>{latest.current++;};
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
        <SearchSections smartText={smartText} onSmartText={setSmartText} busy={loading}
          onSmartSearch={()=>load({q:smartText},true)} placeholder="e.g. quiet flatmate in Auckland under $300, moving by 2026-12-01">
          <form
            className="search-bar"
            onSubmit={(e) => {
              e.preventDefault();
              load(filters);
            }}
          >
            <div className="search-fields">
            <input
              aria-label="Name or lifestyle"
              placeholder="Name or lifestyle, e.g. tidy"
              value={filters.q}
              onChange={(e) => setFilters({ ...filters, q: e.target.value })}
            />
            <LocationFilters city={filters.city} suburb={filters.suburb} onChange={location=>setFilters({...filters,...location})}/>
            <input
              aria-label="Maximum weekly budget"
              type="number"
              min="0"
              placeholder="Max weekly budget"
              value={filters.maxBudget}
              onChange={(e) => setFilters({ ...filters, maxBudget: e.target.value })}
            />
            <input aria-label="Study habits" placeholder="Study routine, e.g. morning" maxLength={160} value={filters.studyHabits}
              onChange={e=>setFilters({...filters,studyHabits:e.target.value})}/>
            <input aria-label="Lifestyle tags" placeholder="Lifestyle tags, e.g. tidy, quiet" maxLength={800} value={filters.lifestyle}
              onChange={e=>setFilters({...filters,lifestyle:e.target.value})}/>
            <div className="move-in-field"><span>Move-in from</span><MoveInDateSelect label="Move-in from" flexibleValue="" value={filters.moveInFrom} onChange={value=>setFilters({...filters,moveInFrom:value})}/></div>
            <div className="move-in-field"><span>Move-in by</span><MoveInDateSelect label="Move-in by" flexibleValue="" value={filters.moveInTo} onChange={value=>setFilters({...filters,moveInTo:value})}/></div>
            </div>
            <div className="search-actions">
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
            </div>
          </form>
          <p className="search-hint">
            ✦ Compatibility scores compare shared preferences. Complete your profile for more
            meaningful results. City and area filter the preferred location. Study routine matches the entered phrase; every lifestyle tag must match a profile tag (case-insensitive). Move-in dates include both endpoints. People who explicitly choose Flexible match any date range; an unspecified date is not treated as Flexible. Maximum budget compares the profile's minimum budget.
          </p>
          {searchInfo&&<p className="notice" role="status">{searchInfo}</p>}
        </SearchSections>
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
          <button className="outline" onClick={() => load(lastSearch.current.values,lastSearch.current.smart)}>
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
