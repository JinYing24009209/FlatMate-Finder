import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { getAccountPages } from '../utils/accountNavigation';

const iconPaths = {
  Dashboard: <path d="M3 10.5 12 3l9 7.5V21H6a3 3 0 0 1-3-3v-7.5Z" />,
  'Browse listings': (
    <>
      <circle cx="10.5" cy="10.5" r="5.5" />
      <path d="m15 15 5 5" />
    </>
  ),
  'Saved listings': (
    <path
      d={
        'M20.8 5.8a5.5 5.5 0 0 0-7.8 0L12 6.9l-1.1-1.1' +
        'a5.5 5.5 0 0 0-7.8 7.8L12 22l8.8-8.4a5.5 5.5 0 0 0 0-7.8Z'
      }
    />
  ),
  Enquiries: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m4 7 8 6 8-6" />
    </>
  ),
  'Flatmate matches': (
    <>
      <circle cx="9" cy="8" r="3" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M3.5 20a5.5 5.5 0 0 1 11 0M14 16a4.5 4.5 0 0 1 6.5 4" />
    </>
  ),
  'Saved flatmates': (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
      <path d="M16 14.5c1.8-2 5-.7 5 1.7 0 2-2.1 3.5-5 5.8-2.9-2.3-5-3.8-5-5.8 0-2.4 3.2-3.7 5-1.7Z" />
    </>
  ),
  'My profile': (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  'My listings': (
    <>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </>
  ),
  'Create listing': <path d="M12 5v14M5 12h14" />,
  'Admin dashboard': (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </>
  ),
};

function NavIcon({ name }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {iconPaths[name]}
    </svg>
  );
}

// const student = [
//   'Dashboard',
//   'Browse listings',
//   'Saved listings',
//   'Flatmate matches',
//   'Saved flatmates',
//   'Enquiries',
//   'My profile',
// ];
// const advertiser = ['Dashboard', 'My listings', 'Create listing', 'Enquiries', 'My profile'];
// const admin = ['Dashboard', 'Admin dashboard'];
export default function AppLayout({
  user,
  page,
  setPage,
  onHome,
  onLogout,
  onBack,
  canGoBack,
  children,
}) {
  const [collapsed, setCollapsed] = useState(
    () => window.matchMedia('(max-width: 1360px)').matches
  );
  const [unread, setUnread] = useState(0);
  const links = getAccountPages(user);
  const refresh = () =>
    api('/unread-count')
      .then((data) => setUnread(data.unread || 0))
      .catch(() => {});
  useEffect(() => {
    refresh();
    const handler = () => refresh();
    window.addEventListener('unread-changed', handler);
    const timer = setInterval(refresh, 30000);
    return () => {
      clearInterval(timer);
      window.removeEventListener('unread-changed', handler);
    };
  }, []);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 1360px)');
    const resize = (event) => setCollapsed(event.matches);
    media.addEventListener('change', resize);
    return () => media.removeEventListener('change', resize);
  }, []);
  return (
    <div className={`app-shell ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <aside className="sidebar">

        {/* return key */}

        <button
          type="button"
          className="sidebar-back"
          onClick={onBack}
          disabled={!canGoBack}
          aria-label="Back to previous page"
          title={canGoBack ? 'Back to previous page' : 'No previous page'}
        >
          <svg
            viewBox="0 0 24 24"
            width="22"
            height="22"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>

          {!collapsed && <span>Back</span>}
        </button>
        <div className="brand">
          <button className="brand-home" onClick={onHome} title="Back to homepage">
            <b>FM</b>
            {!collapsed && (
              <span>
                FlatMate
                <br />
                <strong>Finder</strong>
              </span>
            )}
          </button>
          <button
            className="sidebar-toggle"
            aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
            title={collapsed ? 'Expand navigation' : 'Collapse navigation'}
            aria-expanded={!collapsed}
            onClick={() => setCollapsed(!collapsed)}
          >
            <span aria-hidden="true">{collapsed ? '→' : '←'}</span>
          </button>
        </div>
        {!collapsed && (
          <div className="user-chip">
            <span>{user.full_name.slice(0, 1)}</span>
            <div>
              <strong>{user.full_name}</strong>
              <small>
                {user.role === 'student'
                  ? user.student_type === 'flatmate'
                    ? 'Student · Find a flatmate'
                    : 'Student · Find housing'
                  : `${user.role} account`}
              </small>
            </div>
          </div>
        )}
        <nav aria-label="Main navigation">
          {links.map((link) => (
            <button
              key={link}
              title={link}
              className={page === link ? 'active' : ''}
              onClick={() => setPage(link)}
            >
              <i>
                <NavIcon name={link} />
              </i>
              {!collapsed && <span className="nav-label">{link}</span>}
              {link === 'Enquiries' && unread > 0 && <em className="unread-badge">{unread}</em>}
            </button>
          ))}
        </nav>
        <button className="logout" onClick={onLogout}>
          <span aria-hidden="true">↪</span>
          {!collapsed && <span>Log out</span>}
        </button>
      </aside>
      {children}
    </div>
  );
}
