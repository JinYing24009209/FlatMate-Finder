import { useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader';
import { api } from '../services/api';
export default function AdminPage() {
  const [stats, setStats] = useState({});
  const [reports, setReports] = useState([]);
  const [users, setUsers] = useState([]);
  const [listings, setListings] = useState([]);
  const [code, setCode] = useState('');
  const [notice, setNotice] = useState('');
  const [tab, setTab] = useState('reports');
  const load = async () => {
    try {
      const [s, r, u, l] = await Promise.all([
        api('/admin/stats'),
        api('/admin/reports'),
        api('/admin/users'),
        api('/admin/listings'),
      ]);
      setStats(s.stats);
      setReports(r.reports);
      setUsers(u.users);
      setListings(l.listings);
    } catch (e) {
      setNotice(e.message);
    }
  };
  useEffect(() => {
    load();
  }, []);
  const invite = async (e) => {
    e.preventDefault();
    try {
      await api('/admin/invites', { method: 'POST', body: JSON.stringify({ code }) });
      setNotice(`Invitation “${code}” created for authorised staff.`);
      setCode('');
      load();
    } catch (err) {
      setNotice(err.message);
    }
  };
  const review = async (id, status) => {
    await api(`/admin/reports/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
    load();
  };
  const toggleUser = async (user) => {
    await api(`/admin/users/${user.user_id}`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active: !user.is_active }),
    });
    load();
  };
  const setStatus = async (id, status) => {
    await api(`/admin/listings/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
    load();
  };
  return (
    <main className="content">
      <PageHeader
        title="Platform control room"
        subtitle="Moderate reports, accounts and listing availability from one place."
      />
      <div className="stats">
        {Object.entries(stats).map(([key, value]) => (
          <article key={key}>
            <b>{value}</b>
            <span>{key.replaceAll('_', ' ')}</span>
          </article>
        ))}
      </div>
      {notice && <p className="notice">{notice}</p>}
      <div className="tabs admin-tabs">
        {['reports', 'users', 'listings', 'access'].map((x) => (
          <button key={x} className={tab === x ? 'selected' : ''} onClick={() => setTab(x)}>
            {x}
          </button>
        ))}
      </div>
      {tab === 'reports' && (
        <section>
          <h2>Safety & community reports</h2>
          <div className="stack">
            {reports.map((report) => (
              <article className="row-card" key={report.report_id}>
                <div>
                  <b>{report.reason}</b>
                  <p>
                    {report.reporter_name} · {report.listing_title || 'User report'}
                  </p>
                  <p className="muted">{report.description}</p>
                </div>
                {report.status === 'pending' ? (
                  <div className="button-row">
                    <button
                      className="outline"
                      onClick={() => review(report.report_id, 'reviewed')}
                    >
                      Mark reviewed
                    </button>
                    <button
                      className="danger-button"
                      onClick={() => review(report.report_id, 'dismissed')}
                    >
                      Dismiss
                    </button>
                  </div>
                ) : (
                  <span className={`status ${report.status}`}>{report.status}</span>
                )}
              </article>
            ))}
          </div>
          {!reports.length && <div className="empty">No reports have been submitted.</div>}
        </section>
      )}
      {tab === 'users' && (
        <section>
          <h2>User accounts</h2>
          <div className="stack">
            {users.map((user) => (
              <article className="row-card" key={user.user_id}>
                <div>
                  <b>{user.full_name}</b>
                  <p>
                    {user.email} · {user.role}
                  </p>
                </div>
                <button
                  className={user.is_active ? 'danger-button' : 'outline'}
                  onClick={() => toggleUser(user)}
                >
                  {user.is_active ? 'Deactivate' : 'Reactivate'}
                </button>
              </article>
            ))}
          </div>
        </section>
      )}
      {tab === 'listings' && (
        <section>
          <h2>All listings</h2>
          <div className="stack">
            {listings.map((item) => (
              <article className="row-card" key={item.listing_id}>
                <div>
                  <b>{item.title}</b>
                  <p>
                    ${item.rent}/wk · {item.advertiser_name}
                  </p>
                </div>
                <select
                  className="compact-select"
                  value={item.status}
                  onChange={(e) => setStatus(item.listing_id, e.target.value)}
                >
                  <option value="available">Available</option>
                  <option value="shortlisted">Shortlisted</option>
                  <option value="filled">Filled</option>
                  <option value="closed">Closed</option>
                </select>
              </article>
            ))}
          </div>
        </section>
      )}
      {tab === 'access' && (
        <section className="admin-invite">
          <h2>Administrator access</h2>
          <p className="muted">
            Create a single-use internal invitation. Never publish access codes.
          </p>
          <form onSubmit={invite}>
            <input
              placeholder="e.g. STAFF-2026-01"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
            />
            <button className="primary">Create invite</button>
          </form>
        </section>
      )}
    </main>
  );
}
