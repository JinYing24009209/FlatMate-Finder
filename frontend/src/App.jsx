import { useEffect, useLayoutEffect, useState } from 'react';
import { api } from './services/api';
import AppLayout from './components/AppLayout';
import HomePage from './pages/HomePage';
import AuthPage from './pages/AuthPage';
import DashboardPage from './pages/DashboardPage';
import BrowsePage from './pages/BrowsePage';
import ListingDetailPage from './pages/ListingDetailPage';
import ProfilePage from './pages/ProfilePage';
import EnquiriesPage from './pages/EnquiriesPage';
import SavedPage from './pages/SavedPage';
import MatchesPage from './pages/MatchesPage';
import FlatmateDetailPage from './pages/FlatmateDetailPage';
import FlatmateEnquiriesPage from './pages/FlatmateEnquiriesPage';
import ListingFormPage from './pages/ListingFormPage';
import MyListingsPage from './pages/MyListingsPage';
import AdminPage from './pages/AdminPage';
import ReportTargetPage from './pages/ReportTargetPage';
import OutcomesPage from './pages/OutcomesPage';
import PaymentPage from './pages/PaymentPage';
import './styles/app.css';
import './styles/outcomes.css';
import './styles/moderation.css';
import { getDefaultPage, resolveAccountPage } from './utils/accountNavigation';

export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('home');
  const [page, setPageState] = useState('Dashboard');
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(null);
  const [focusEnquiry, setFocusEnquiry] = useState(null);
  const [focusTarget,setFocusTarget]=useState(null);
  const [loading, setLoading] = useState(true);
  const [navigationHistory, setNavigationHistory] = useState([]);
  useEffect(() => {
    const reset = () => {
      if (!user) return;
      setUser(null);
      setSelected(null);
      setEditing(null);
      setFocusEnquiry(null);
      setNavigationHistory([]);
      setPageState('Dashboard');
      setView('auth');
    };
    window.addEventListener('session-invalid', reset);
    return () => window.removeEventListener('session-invalid', reset);
  }, [user]);

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [view, page, selected, editing, focusEnquiry, loading]);

  // Record the current page, including the properties currently being viewed or edited.
  const rememberCurrentPage = () => {
    setNavigationHistory((history) => [
      ...history,
      { view, page, selected, editing, focusEnquiry },
    ]);
  };

  // Switch to outer pages such as the home page and login page.
  const navigateView = (nextView) => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    if (nextView === view) return;

    rememberCurrentPage();
    setView(nextView);
  };

  // Return to the page you just visited.
  const goBack = () => {
    if (navigationHistory.length === 0) return;

    const previous = navigationHistory[navigationHistory.length - 1];

    setNavigationHistory((history) => history.slice(0, -1));
    setView(previous.view);
    setPageState(user ? resolveAccountPage(user, previous.page) : previous.page);
    setSelected(previous.selected);
    setEditing(previous.editing);
    setFocusEnquiry(previous.focusEnquiry);
  };

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
    setFocusTarget(options.focusTarget||null);
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

          setNavigationHistory([]);
          setPageState(getDefaultPage(value));
          setSelected(null);
          setEditing(null);
          setFocusEnquiry(null);
          setView('app');
        }}
        onBack={goBack}
      />
    );
  const logout = async () => {
    await api('/auth/logout', { method: 'POST' });
    setUser(null);
    setNavigationHistory([]);
    setSelected(null);
    setEditing(null);
    setFocusEnquiry(null);
    setView('home');
    setPageState('Dashboard');
  };
  const pages = {
    Dashboard: <DashboardPage user={user} setPage={setPage} setSelected={setSelected} />,
    'Browse listings': <BrowsePage user={user} setPage={setPage} setSelected={setSelected} />,
    'Listing detail': (
      <ListingDetailPage
        listing={selected}
        user={user}
        setPage={setPage}
        onCheckout={() => setPage('Payment checkout')}
      />
    ),
    'Payment checkout': <PaymentPage listing={selected} setPage={setPage} />,
    'Successful payments': <OutcomesPage key="payments" setPage={setPage} setSelected={setSelected}/>,
    'Matched flatmates': <OutcomesPage key="confirmed" flatmates setPage={setPage} setSelected={setSelected}/>,
    'My profile': <ProfilePage user={user} />,
    Enquiries:
      user?.student_type === 'flatmate' ? (
        <FlatmateEnquiriesPage key={focusEnquiry || 'inbox'} user={user} focusId={focusEnquiry} />
      ) : (
        <EnquiriesPage user={user} focusId={focusEnquiry} />
      ),
    'Saved listings': <SavedPage setPage={setPage} setSelected={setSelected} />,
    'Flatmate matches': <MatchesPage key="matches" setPage={setPage} setSelected={setSelected} />,
    'Saved flatmates': (
      <MatchesPage key="saved-flatmates" savedOnly setPage={setPage} setSelected={setSelected} />
    ),
    'Flatmate detail': (
      <FlatmateDetailPage key={selected?.user_id} person={selected} setPage={setPage} />
    ),
    'Create listing': <ListingFormPage editing={editing} setPage={setPage} />,
    'My listings': <MyListingsPage setPage={setPage} setEditing={setEditing} focusTarget={focusTarget} />,
    'Platform management': <AdminPage setPage={setPage} setSelected={setSelected} focusTarget={focusTarget} />,
    'Report target': <ReportTargetPage target={selected} setPage={setPage} />,
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
      {pages[activePage] || pages.Dashboard}
    </AppLayout>
  );
}
