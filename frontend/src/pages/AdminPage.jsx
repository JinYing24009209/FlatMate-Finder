import { useCallback, useEffect, useRef, useState } from 'react';
import PageHeader from '../components/PageHeader';
import { formatDateTime } from '../utils/dates';
import { api } from '../services/api';
import '../styles/community.css';

// Combine moderation, account, listing, staff, and category administration.
export default function AdminPage({ setPage, setSelected, focusTarget }) {
  const [reports, setReports] = useState([]),
    [users, setUsers] = useState([]),
    [listings, setListings] = useState([]),
    [categories, setCategories] = useState([]);
  const [tab, setTab] = useState('reports'),
    [notice, setNotice] = useState(''),
    [error, setError] = useState('');
  const [outcomes, setOutcomes] = useState({}),
    [code, setCode] = useState(''),
    [busy, setBusy] = useState(null);
  const [checks, setChecks] = useState({}),
    [checking, setChecking] = useState(false);
  const [newCategory, setNewCategory] = useState({ kind: 'room_type', name: '' }),
    [categoryNames, setCategoryNames] = useState({});
  const live = useRef(false),
    running = useRef(false);
  const positioned = useRef(null);
  // Load each independent admin dataset without hiding successful sections.
  const load = useCallback(async () => {
    const result = await Promise.allSettled([
      api('/admin/reports'),
      api('/admin/users'),
      api('/admin/listings'),
      api('/admin/categories'),
    ]);
    if (!live.current) return;
    const setters = [
      (d) => setReports(d.reports),
      (d) => setUsers(d.users),
      (d) => setListings(d.listings),
      (d) => {
        setCategories(d.categories);
        setCategoryNames(Object.fromEntries(d.categories.map((c) => [c.category_id, c.name])));
      },
    ];
    const failures = [];
    result.forEach((r, i) =>
      r.status === 'fulfilled' ? setters[i](r.value) : failures.push(r.reason.message)
    );
    setError(failures.join(' · '));
  }, []);
  useEffect(() => {
    live.current = true;
    load();
    const t = setInterval(load, 30000);
    return () => {
      live.current = false;
      clearInterval(t);
    };
  }, [load]);
  useEffect(() => {
    if (focusTarget?.type === 'report') setTab('reports');
  }, [focusTarget]);
  useEffect(() => {
    if (tab === 'reports' && focusTarget?.type === 'report' && positioned.current !== focusTarget) {
      const element = document.getElementById(`admin-report-${focusTarget.id}`);
      element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element?.focus({ preventScroll: true });
      if (element) positioned.current = focusTarget;
    }
  }, [tab, focusTarget, reports]);
  const act = async (key, operation, popup = false) => {
    // Serialise mutations and refresh all admin data after each action.
    if (busy) return;
    setBusy(key);
    setNotice('');
    try {
      await operation();
      await load();
    } catch (e) {
      if (popup) window.alert(e.message);
      else setNotice(e.message);
    } finally {
      setBusy(null);
    }
  };
  const review = (report, status) => {
    if (!outcomes[report.report_id]?.trim()) {
      window.alert('Please explain the decision for the reporter.');
      return;
    }
    const action =
      report.target_type === 'listing' ? 'take down this listing' : 'deactivate this user';
    if (status === 'reviewed' && !window.confirm(`Uphold this report and ${action}?`)) return;
    act(
      `report-${report.report_id}`,
      async () => {
        await api(`/admin/reports/${report.report_id}`, {
          method: 'PATCH',
          body: JSON.stringify({ status, resolution_note: outcomes[report.report_id] }),
        });
        window.alert('Decision saved and reporter notified.');
      },
      true
    );
  };
  const checkAll = async () => {
    if (running.current) return;
    running.current = true;
    setChecking(true);
    setChecks({});
    for (const item of listings) {
      if (!live.current) break;
      setChecks((old) => ({ ...old, [item.listing_id]: { loading: true } }));
      try {
        const result = await api(`/admin/listings/${item.listing_id}/safety-check`, {
          method: 'POST',
        });
        if (live.current) setChecks((old) => ({ ...old, [item.listing_id]: result }));
      } catch (e) {
        if (live.current) setChecks((old) => ({ ...old, [item.listing_id]: { error: e.message } }));
      }
    }
    running.current = false;
    if (live.current) setChecking(false);
  };
  return (
    <main className="content management-page">
      <PageHeader
        title="Platform management"
        subtitle="Review safety signals, resolve reports and manage accounts, listings and staff access."
      />
      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      <div className="tabs admin-tabs">
        {Object.entries({
          reports: 'Safety reports',
          users: 'User accounts',
          listings: 'Listing status',
          categories: 'Category Management',
          access: 'Staff access',
        }).map(([key, label]) => (
          <button key={key} className={tab === key ? 'selected' : ''} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'reports' && (
        <section>
          <h2 className="management-section-title">Safety & community reports</h2>
          <div className="stack">
            {reports.map((r, index) => {
              const listing = r.target_type === 'listing';
              const typeLabel =
                { listing: 'Listing', user: 'User profile', flatmate_message: 'Flatmate message' }[
                  r.target_type
                ] || r.target_type;
              const target =
                r.listing_title ||
                r.reported_user_name ||
                r.target_snapshot?.title ||
                r.target_snapshot?.name ||
                'Deleted target';
              return (
                <article
                  tabIndex={-1}
                  id={`admin-report-${r.report_id}`}
                  className={`row-card report-card ${String(focusTarget?.id) === String(r.report_id) ? 'focused-record' : ''}`}
                  key={r.report_id}
                >
                  <div className="report-card-content">
                    <div className="report-card-heading">
                      <span className="report-sequence">
                        Report {String(index + 1).padStart(2, '0')}
                      </span>
                      <span className="report-type">{typeLabel}</span>
                    </div>
                    <h3>{r.reason}</h3>
                    <dl className="report-summary">
                      <div>
                        <dt>Reported by</dt>
                        <dd>
                          {r.reporter_name}
                          {r.reporter_email ? ` · ${r.reporter_email}` : ''}
                        </dd>
                      </div>
                      <div>
                        <dt>Reported target</dt>
                        <dd>
                          {target}
                          {listing && r.listing_owner_name
                            ? ` · Advertiser: ${r.listing_owner_name}`
                            : ''}
                        </dd>
                      </div>
                      <div>
                        <dt>Report details</dt>
                        <dd>{r.description || 'No additional description supplied.'}</dd>
                      </div>
                    </dl>
                    <button
                      className="outline"
                      onClick={() => {
                        const listing = r.target_type === 'listing',
                          id = listing ? r.listing_id : r.reported_user_id;
                        if (!id) {
                          setNotice('This target was deleted; its report snapshot is retained.');
                          return;
                        }
                        setSelected({ targetType: listing ? 'listing' : 'user', id });
                        setPage('Report target');
                      }}
                    >
                      View reported {r.target_type === 'listing' ? 'listing' : 'user'}
                    </button>
                    {r.evidence?.body && (
                      <blockquote className="report-evidence">{r.evidence.body}</blockquote>
                    )}
                    {r.evidence?.sent_at && (
                      <p className="muted">
                        Message #{r.evidence.message_id} · {formatDateTime(r.evidence.sent_at)}
                      </p>
                    )}
                    {r.evidence?.note && <p>Evidence: {r.evidence.note}</p>}
                    {r.resolution_note && <p>Outcome: {r.resolution_note}</p>}
                    {r.status === 'pending' && (
                      <label className="report-decision">
                        Decision shared with reporter
                        <textarea
                          maxLength={1000}
                          value={outcomes[r.report_id] || ''}
                          onChange={(e) =>
                            setOutcomes({ ...outcomes, [r.report_id]: e.target.value })
                          }
                        />
                      </label>
                    )}
                  </div>
                  {r.status === 'pending' ? (
                    <div className="button-row">
                      <button
                        disabled={!!busy}
                        className="danger-button"
                        onClick={() => review(r, 'reviewed')}
                      >
                        {r.target_type === 'listing' ? 'Take down listing' : 'Deactivate user'}
                      </button>
                      <button
                        disabled={!!busy}
                        className="outline"
                        onClick={() => review(r, 'dismissed')}
                      >
                        Dismiss
                      </button>
                    </div>
                  ) : (
                    <span className={`status ${r.status}`}>
                      {r.resolution_action
                        ? 'Upheld'
                        : r.status === 'reviewed'
                          ? 'Reviewed (legacy)'
                          : r.status}
                    </span>
                  )}
                </article>
              );
            })}
          </div>
          {!reports.length && <div className="empty">No reports submitted.</div>}
        </section>
      )}
      {tab === 'users' && (
        <section>
          <h2 className="management-section-title">All user accounts</h2>
          <div className="stack">
            {users.map((u) => (
              <article className="row-card" key={u.user_id}>
                <div>
                  <h3>{u.full_name}</h3>
                  <p>
                    {u.email} · {u.role}
                  </p>
                </div>
                <button
                  disabled={!!busy}
                  className={u.is_active ? 'danger-button' : 'outline'}
                  onClick={() =>
                    act(`user-${u.user_id}`, () =>
                      api(`/admin/users/${u.user_id}`, {
                        method: 'PATCH',
                        body: JSON.stringify({ is_active: !u.is_active }),
                      })
                    )
                  }
                >
                  {u.is_active ? 'Deactivate' : 'Reactivate'}
                </button>
              </article>
            ))}
          </div>
        </section>
      )}
      {tab === 'listings' && (
        <section>
          <div className="management-heading">
            <h2 className="management-section-title">All listings</h2>
            <button className="outline" disabled={checking || !listings.length} onClick={checkAll}>
              {checking ? 'Checking listings…' : '✦ AI safety check'}
            </button>
          </div>
          <p className="muted">
            Checks do not change availability. Review the signals before choosing a status. Grey
            means unchecked or failed, not safe.
          </p>
          <div className="stack">
            {listings.map((item) => {
              const result = checks[item.listing_id];
              const level =
                !result || result.loading || result.error
                  ? 'unknown'
                  : result.risk_score >= 67
                    ? 'high'
                    : result.risk_score >= 34 || !result.safe
                      ? 'medium'
                      : 'low';
              const label = {
                unknown: 'Not assessed',
                high: 'High risk',
                medium: 'Needs review',
                low: 'Lower risk',
              }[level];
              return (
                <article className="listing-review-card" key={item.listing_id}>
                  <div className="row-card">
                    <div>
                      <h3>
                        <button
                          className="listing-title-link"
                          onClick={() => {
                            setSelected({ targetType: 'listing', id: item.listing_id });
                            setPage('Report target');
                          }}
                        >
                          {item.title} <span aria-hidden="true">↗</span>
                        </button>
                      </h3>
                      <p>
                        ${item.rent}/wk · {item.advertiser_name}
                      </p>
                    </div>
                    <div className="listing-controls">
                      <select
                        aria-label={`Status for ${item.title}`}
                        disabled={!!busy}
                        value={item.status}
                        onChange={(e) =>
                          act(`listing-${item.listing_id}`, () =>
                            api(`/admin/listings/${item.listing_id}`, {
                              method: 'PATCH',
                              body: JSON.stringify({ status: e.target.value }),
                            })
                          )
                        }
                      >
                        {['available', 'shortlisted', 'filled', 'closed'].map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                      <span className={`risk-indicator ${level}`} title={label}>
                        <i />
                        {label}
                      </span>
                    </div>
                  </div>
                  {result && (
                    <div className={`safety-result ${level}`} role="status">
                      {result.loading ? (
                        'Checking…'
                      ) : result.error ? (
                        <p>Unable to assess: {result.error}</p>
                      ) : (
                        <>
                          <strong>
                            {label} · {result.risk_score}/100
                          </strong>
                          <p>
                            {result.mode === 'gemini'
                              ? 'Gemini safety assessment'
                              : 'Local safety fallback'}{' '}
                            · {formatDateTime(result.checked_at)}
                          </p>
                          <ul>
                            {(result.flags?.length
                              ? result.flags
                              : ['No listed risk signals found; this is not a safety guarantee.']
                            ).map((flag, i) => (
                              <li key={i}>{flag}</li>
                            ))}
                          </ul>
                          <p>AI advice is not proof. Check the listing before taking action.</p>
                        </>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      )}
      {tab === 'access' && (
        <section className="admin-invite">
          <h2 className="management-section-title">Administrator access</h2>
          <p>Create a single-use invitation. Never publish access codes.</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              act('invite', async () => {
                await api('/admin/invites', { method: 'POST', body: JSON.stringify({ code }) });
                setCode('');
                setNotice('Staff invitation created.');
              });
            }}
          >
            <input
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Internal invitation code"
            />
            <button className="primary" disabled={!!busy}>
              Create invite
            </button>
          </form>
        </section>
      )}
      {tab === 'categories' && (
        <section className="category-management">
          <h2 className="management-section-title">Category Management</h2>
          <p className="muted">
            Manage the options used in listing forms, searches and flatmate profiles. Disable an
            option to hide it without changing existing records.
          </p>
          <form
            className="category-add"
            onSubmit={(e) => {
              e.preventDefault();
              act('category-add', async () => {
                await api('/admin/categories', {
                  method: 'POST',
                  body: JSON.stringify(newCategory),
                });
                setNewCategory({ ...newCategory, name: '' });
                setNotice('Category added.');
              });
            }}
          >
            <select
              value={newCategory.kind}
              onChange={(e) => setNewCategory({ ...newCategory, kind: e.target.value })}
            >
              {Object.entries({
                room_type: 'Room type',
                transport: 'Transport',
                utility: 'Facilities & utilities',
                listing_lifestyle: 'Life in the flat',
                flatmate_lifestyle: 'Flatmate lifestyle tags',
              }).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <input
              required
              maxLength={160}
              value={newCategory.name}
              placeholder="New category name"
              onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
            />
            <button className="primary" disabled={!!busy}>
              Add category
            </button>
          </form>
          {Object.entries({
            room_type: 'Room type',
            transport: 'Transport',
            utility: 'Facilities & utilities',
            listing_lifestyle: 'Life in the flat',
            flatmate_lifestyle: 'Flatmate lifestyle tags',
          }).map(([kind, label]) => (
            <div className="category-group" key={kind}>
              <h3>{label}</h3>
              <div className="category-admin-list">
                {categories
                  .filter((c) => c.kind === kind)
                  .map((c) => (
                    <div
                      className={`category-admin-row ${c.is_active ? '' : 'inactive'}`}
                      key={c.category_id}
                    >
                      <input
                        aria-label={`${label} name`}
                        value={categoryNames[c.category_id] ?? c.name}
                        onChange={(e) =>
                          setCategoryNames({ ...categoryNames, [c.category_id]: e.target.value })
                        }
                      />
                      <span className={`status ${c.is_active ? 'available' : 'closed'}`}>
                        {c.is_active ? 'Active' : 'Inactive'}
                      </span>
                      <button
                        className="outline"
                        disabled={!!busy || !String(categoryNames[c.category_id] || '').trim()}
                        onClick={() =>
                          act(`category-name-${c.category_id}`, () =>
                            api(`/admin/categories/${c.category_id}`, {
                              method: 'PATCH',
                              body: JSON.stringify({ name: categoryNames[c.category_id] }),
                            })
                          )
                        }
                      >
                        Save
                      </button>
                      <button
                        className={c.is_active ? 'danger-button' : 'outline'}
                        disabled={!!busy}
                        onClick={() =>
                          act(`category-state-${c.category_id}`, () =>
                            api(`/admin/categories/${c.category_id}`, {
                              method: 'PATCH',
                              body: JSON.stringify({ is_active: !c.is_active }),
                            })
                          )
                        }
                      >
                        {c.is_active ? 'Disable' : 'Activate'}
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </section>
      )}
    </main>
  );
}
