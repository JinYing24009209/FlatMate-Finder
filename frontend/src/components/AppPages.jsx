import AdminPage from '../pages/AdminPage';
import BrowsePage from '../pages/BrowsePage';
import DashboardPage from '../pages/DashboardPage';
import EnquiriesPage from '../pages/EnquiriesPage';
import FlatmateDetailPage from '../pages/FlatmateDetailPage';
import FlatmateEnquiriesPage from '../pages/FlatmateEnquiriesPage';
import ListingDetailPage from '../pages/ListingDetailPage';
import ListingFormPage from '../pages/ListingFormPage';
import MatchesPage from '../pages/MatchesPage';
import MyListingsPage from '../pages/MyListingsPage';
import OutcomesPage from '../pages/OutcomesPage';
import PaymentPage from '../pages/PaymentPage';
import ProfilePage from '../pages/ProfilePage';
import ReportTargetPage from '../pages/ReportTargetPage';
import SavedPage from '../pages/SavedPage';

// Keep account-page composition separate from application navigation state.
export default function AppPages({
  activePage,
  browseState,
  flatmateSearchState,
  editing,
  focusEnquiry,
  focusTarget,
  selected,
  setEditing,
  setBrowseState,
  setFlatmateSearchState,
  setPage,
  setSelected,
  user,
}) {
  const pages = {
    Dashboard: <DashboardPage user={user} setPage={setPage} setSelected={setSelected} />,
    'Browse listings': (
      <BrowsePage
        user={user}
        setPage={setPage}
        setSelected={setSelected}
        initialState={browseState}
        onStateChange={setBrowseState}
      />
    ),
    'Listing detail': (
      <ListingDetailPage
        listing={selected}
        user={user}
        setPage={setPage}
        onCheckout={() => setPage('Payment checkout')}
      />
    ),
    'Payment checkout': <PaymentPage listing={selected} setPage={setPage} />,
    'Successful payments': (
      <OutcomesPage key="payments" setPage={setPage} setSelected={setSelected} />
    ),
    'Matched flatmates': (
      <OutcomesPage key="confirmed" flatmates setPage={setPage} setSelected={setSelected} />
    ),
    'My profile': <ProfilePage user={user} />,
    Enquiries:
      user?.student_type === 'flatmate' ? (
        <FlatmateEnquiriesPage key={focusEnquiry || 'inbox'} user={user} focusId={focusEnquiry} />
      ) : (
        <EnquiriesPage user={user} focusId={focusEnquiry} />
      ),
    'Saved listings': <SavedPage setPage={setPage} setSelected={setSelected} />,
    'Flatmate matches': (
      <MatchesPage
        key="matches"
        setPage={setPage}
        setSelected={setSelected}
        initialState={flatmateSearchState}
        onStateChange={setFlatmateSearchState}
      />
    ),
    'Saved flatmates': (
      <MatchesPage key="saved-flatmates" savedOnly setPage={setPage} setSelected={setSelected} />
    ),
    'Flatmate detail': (
      <FlatmateDetailPage key={selected?.user_id} person={selected} setPage={setPage} />
    ),
    'Create listing': <ListingFormPage editing={editing} setPage={setPage} />,
    'My listings': (
      <MyListingsPage setPage={setPage} setEditing={setEditing} focusTarget={focusTarget} />
    ),
    'Platform management': (
      <AdminPage setPage={setPage} setSelected={setSelected} focusTarget={focusTarget} />
    ),
    'Report target': <ReportTargetPage target={selected} setPage={setPage} />,
  };

  return pages[activePage] || pages.Dashboard;
}
