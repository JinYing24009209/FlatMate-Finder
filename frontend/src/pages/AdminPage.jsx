import { useCallback, useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader';
import { formatDateTime } from '../utils/dates';
import '../styles/community.css';
import { api } from '../services/api';
export default function AdminPage({setPage,setSelected}) {
  const [reports, setReports] = useState([]);
  const [users, setUsers] = useState([]);
  const [listings, setListings] = useState([]);
  const [code, setCode] = useState('');
  const [notice, setNotice] = useState('');
  const [outcomes, setOutcomes] = useState({});
  const [tab, setTab] = useState('reports');
  const [days, setDays] = useState(30);
  const [analytics, setAnalytics] = useState(null);
  const [loadError, setLoadError] = useState('');
  const load = useCallback(async () => {
      const results = await Promise.allSettled([
        api('/admin/reports'),
        api('/admin/users'),
        api('/admin/listings'),
        api(`/admin/analytics?days=${days}`),
      ]);
      const setters = [
        (data) => setReports(data.reports),
        (data) => setUsers(data.users),
        (data) => setListings(data.listings),
        setAnalytics,
      ];
      const labels = ['Safety reports', 'User accounts', 'Listing status', 'Analytics'];
      const errors = [];
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') setters[index](result.value);
        else errors.push(`${labels[index]}: ${result.reason.message}`);
      });
      setLoadError(errors.join(' · '));
  }, [days]);
  useEffect(() => {
    load();
    const timer = window.setInterval(load, 30000);
    return () => window.clearInterval(timer);
  }, [load]);
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
    if (!outcomes[id]?.trim()) return setNotice('Please explain the outcome for the reporter.');
    try {
      await api(`/admin/reports/${id}`, { method: 'PATCH', body: JSON.stringify({ status, resolution_note: outcomes[id] }) });
      setNotice('Report processed. The reporter has been notified.');
      load();
    } catch (error) { setNotice(error.message); }
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
        title="Platform management"
        subtitle="Track real platform outcomes and manage reports, people, homes and staff access."
      />
      {loadError && <p className="notice" role="alert">{loadError}</p>}
      {analytics && (
        <section className="analytics-panel" aria-label="Live platform analytics">
          <div className="analytics-heading">
            <div>
              <span className="eyebrow">LIVE DATABASE RESULTS</span>
              <h2>Platform outcomes</h2>
              <p className="muted">{analytics.range.from} to {analytics.range.to} · refreshed {new Date(analytics.generated_at).toLocaleTimeString()}</p>
            </div>
            <div className="range-buttons" aria-label="Analytics date range">
              {[7, 30, 90].map((value) => (
                <button key={value} className={days === value ? 'selected' : ''} onClick={() => setDays(value)}>{value} days</button>
              ))}
            </div>
          </div>
          <div className="analytics-grid">
            <article className="chart-card chart-wide">
              <h3>New listings by day</h3>
              <p className="muted">Publication activity in the selected period</p>
              <div className="vertical-chart">
                {analytics.listings_by_day.map((item) => {
                  const max = Math.max(1, ...analytics.listings_by_day.map((x) => x.listings));
                  return <div className="vertical-bar-wrap" key={item.day} title={`${item.day}: ${item.listings} listings`}>
                    <span>{item.listings || ''}</span><i style={{ height: `${Math.max(3, item.listings / max * 100)}%` }} />
                  </div>;
                })}
              </div>
            </article>
            <article className="chart-card">
              <h3>Listing availability</h3>
              <div className="horizontal-chart">
                {analytics.listing_statuses.map((item) => <div key={item.label}><span>{item.label}</span><i style={{ width: `${item.value / Math.max(1, ...analytics.listing_statuses.map((x) => x.value)) * 100}%` }} /><b>{item.value}</b></div>)}
              </div>
            </article>
            <article className="chart-card">
              <h3>What students need</h3>
              <div className="horizontal-chart needs-chart">
                {analytics.student_needs.map((item) => <div key={item.label}><span>{item.label}</span><i style={{ width: `${item.value / Math.max(1, ...analytics.student_needs.map((x) => x.value)) * 100}%` }} /><b>{item.value}</b></div>)}
              </div>
            </article>
            <article className="chart-card">
              <h3>Enquiry outcomes</h3>
              <div className="horizontal-chart outcome-chart">
                {analytics.enquiry_outcomes.map((item) => <div key={item.label}><span>{item.label}</span><i style={{ width: `${item.value / Math.max(1, ...analytics.enquiry_outcomes.map((x) => x.value)) * 100}%` }} /><b>{item.value}</b></div>)}
              </div>
            </article>
            <article className="chart-card engagement-card">
              <h3>Flatmate engagement</h3>
              <div><b>{analytics.flatmate_engagement.visible_seekers}</b><span>visible seekers</span></div>
              <div><b>{analytics.flatmate_engagement.conversations}</b><span>conversations started</span></div>
              <div><b>{analytics.flatmate_engagement.messages}</b><span>messages exchanged</span></div>
            </article>
          </div>
        </section>
      )}
      {notice && <p className="notice">{notice}</p>}
      <div className="tabs admin-tabs">
        {['reports', 'users', 'listings', 'access'].map((x) => (
          <button key={x} className={tab === x ? 'selected' : ''} onClick={() => setTab(x)}>
            {{ reports: 'Safety reports', users: 'User accounts', listings: 'Listing status', access: 'Staff access' }[x]}
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
                    {report.reporter_name} · {report.target_type} · {report.listing_title || report.reported_user_name || report.target_snapshot?.title || report.target_snapshot?.name || 'Removed target'}
                  </p>
                  <p className="muted">{report.description}</p>
                  <button className="outline" onClick={()=>{
                    const isListing=report.target_type==='listing';
                    const id=isListing?report.listing_id:report.reported_user_id;
                    if(!id){setNotice('This target was deleted. Its report snapshot is retained.');return;}
                    setSelected({targetType:isListing?'listing':'user',id});setPage('Report target');
                  }}>View reported {report.target_type==='listing'?'listing':'user'}</button>
                  {report.evidence?.body && <blockquote className="report-evidence">{report.evidence.body}</blockquote>}
                  {report.evidence?.sent_at && <p className="muted">Message #{report.evidence.message_id} · conversation #{report.evidence.conversation_id} · {formatDateTime(report.evidence.sent_at)}</p>}
                  {report.evidence?.note && <p>Evidence note: {report.evidence.note}</p>}
                  {report.resolution_note && <p>Outcome: {report.resolution_note}</p>}
                  {report.status === 'pending' && <label>Outcome shared with reporter<textarea maxLength={1000} value={outcomes[report.report_id] || ''} onChange={(e) => setOutcomes({ ...outcomes, [report.report_id]: e.target.value })} /></label>}
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
