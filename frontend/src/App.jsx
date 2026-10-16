import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { api } from './services/api';
import AppLayout from './components/AppLayout';
import AppPages from './components/AppPages';
import HomePage from './pages/HomePage';
import AuthPage from './pages/AuthPage';
import ListingDetailPage from './pages/ListingDetailPage';
import './styles/app.css';
import './styles/outcomes.css';
import './styles/moderation.css';
import { getDefaultPage, resolveAccountPage } from './utils/accountNavigation';

// Own the application session, navigation history, and top-level views.
export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('home');
  const [page, setPageState] = useState('Dashboard');
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(null);
  const [focusEnquiry, setFocusEnquiry] = useState(null);
  const [focusTarget, setFocusTarget] = useState(null);
  const [loading, setLoading] = useState(true);
  const [navigationHistory, setNavigationHistory] = useState([]);
  const navigationHistoryRef = useRef([]);
  const [browseState, setBrowseState] = useState(null);
  const [flatmateSearchState, setFlatmateSearchState] = useState(null);

  const clearNavigationHistory = () => {
    navigationHistoryRef.current = [];
    setNavigationHistory([]);
    window.history.replaceState({ flatMateFinder: true }, '');
  };
  useEffect(() => {
    // Reset private state when the API reports an invalid session.
    const reset = () => {
      if (!user) return;
      setUser(null);
      setSelected(null);
      setEditing(null);
      setFocusEnquiry(null);
      setBrowseState(null);
      setFlatmateSearchState(null);
      clearNavigationHistory();
      setPageState('Dashboard');
      setView('auth');
    };
    window.addEventListener('session-invalid', reset);
    return () => window.removeEventListener('session-invalid', reset);
  }, [user]);

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [view, page, selected, editing, focusEnquiry, loading]);

  // Preserve page context so Back can restore selections and edit state.
  const rememberCurrentPage = () => {
    const snapshot = { view, page, selected, editing, focusEnquiry };
    setNavigationHistory((history) => {
      const next = [...history, snapshot];
      navigationHistoryRef.current = next;
      return next;
    });
    window.history.pushState({ flatMateFinder: true }, '');
  };

  // Switch between public, authentication, and account views.
  const navigateView = (nextView) => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    if (nextView === view) return;

    rememberCurrentPage();
    setView(nextView);
  };

  // Restore the most recent in-app navigation snapshot.
  const restorePreviousPage = useCallback(() => {
    const history = navigationHistoryRef.current;
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    const next = history.slice(0, -1);
    navigationHistoryRef.current = next;
    setNavigationHistory(next);
    setView(previous.view);
    setPageState(user ? resolveAccountPage(user, previous.page) : previous.page);
    setSelected(previous.selected);
    setEditing(previous.editing);
    setFocusEnquiry(previous.focusEnquiry);
  }, [user]);

  const goBack = () => {
    if (navigationHistoryRef.current.length) window.history.back();
  };

  useEffect(() => {
    window.history.replaceState({ flatMateFinder: true }, '');
    const handlePopState = () => restorePreviousPage();
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [restorePreviousPage]);

  const canGoBack = navigationHistory.length > 0;

  useEffect(() => {
    api('/auth/me')
      .then((data) => {
        setUser(data.user);
        setPageState(getDefaultPage(data.user));
        setView('app');
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const setPage = (next, options = {}) => {
    setFocusTarget(options.focusTarget || null);
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    next = resolveAccountPage(user, next);
    const nextFocus = next === 'Enquiries' ? options.enquiryId || focusEnquiry : null;

    if (view !== 'app' || page !== next || focusEnquiry !== nextFocus) {
      rememberCurrentPage();
    }

    setFocusEnquiry(nextFocus);
    setPageState(next);
    setView('app');
  };

  if (loading) return <div className="loading">Loading FlatMate Finder…</div>;
  if (view === 'home')
    return (
      <HomePage
        user={user}
        onBack={goBack}
        canGoBack={canGoBack}
        onStart={() => (user ? setPage(getDefaultPage(user)) : navigateView('auth'))}
        onBrowse={() => (user ? setPage('Browse listings') : navigateView('auth'))}
        onListing={(listing) => {
          setSelected(listing);

          if (user) {
            setPage('Listing detail');
          } else {
            navigateView('public-listing');
          }
        }}
      />
    );
  if (view === 'public-listing')
    return (
      <>
        <div className="public-back-bar">
          <button type="button" className="page-back-button" onClick={goBack} disabled={!canGoBack}>
            ← Back
          </button>
        </div>

        <ListingDetailPage
          listing={selected}
          user={null}
          setPage={goBack}
          onSignIn={() => navigateView('auth')}
        />
      </>
    );
  if (view === 'auth')
    return (
      <AuthPage
        setUser={(value) => {
          setUser(value);

          clearNavigationHistory();
          setPageState(getDefaultPage(value));
          setSelected(null);
          setEditing(null);
          setFocusEnquiry(null);
          setBrowseState(null);
          setFlatmateSearchState(null);
          setView('app');
        }}
        onBack={goBack}
      />
    );
  const logout = async () => {
    await api('/auth/logout', { method: 'POST' });
    setUser(null);
    clearNavigationHistory();
    setSelected(null);
    setEditing(null);
    setFocusEnquiry(null);
    setBrowseState(null);
    setFlatmateSearchState(null);
    setView('home');
    setPageState('Dashboard');
  };
  const activePage = resolveAccountPage(user, page);
  return (
    <AppLayout
      user={user}
      page={activePage}
      setPage={setPage}
      onHome={() => navigateView('home')}
      onLogout={logout}
      onBack={goBack}
      canGoBack={canGoBack}
    >
      <AppPages
        activePage={activePage}
        browseState={browseState}
        flatmateSearchState={flatmateSearchState}
        editing={editing}
        focusEnquiry={focusEnquiry}
        focusTarget={focusTarget}
        selected={selected}
        setEditing={setEditing}
        setBrowseState={setBrowseState}
        setFlatmateSearchState={setFlatmateSearchState}
        setPage={setPage}
        setSelected={setSelected}
        user={user}
      />
    </AppLayout>
  );
}
