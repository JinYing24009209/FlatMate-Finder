import { useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader';
import { api } from '../services/api';

export default function ListingDetailPage({ listing, user, setPage, onSignIn }) {
  const [message, setMessage] = useState('');
  const [notice, setNotice] = useState('');
  const [summary, setSummary] = useState('');
  const [summaryMode, setSummaryMode] = useState('');
  const [screening, setScreening] = useState(null);
  const [checkingSafety, setCheckingSafety] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [report, setReport] = useState({ reason: 'Suspicious listing', description: '' });
  const [saved, setSaved] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveRetry, setSaveRetry] = useState(0);
  const listingId = listing?.listing_id;

  useEffect(() => {
    let active = true;

    setSaved(null);
    setSaveError('');

    if (user?.role === 'student' && listingId != null) {
      api('/saved')
        .then((data) => {
          if (active)
            setSaved(
              data.listings.some(
                (item) => String(item.listing_id) === String(listingId)
              )
            );
        })
        .catch((error) => {
          if (active) setSaveError(`Unable to load saved status: ${error.message}`);
        });
    }
    return () => { active = false; };
  }, [listingId, user?.user_id, user?.role, saveRetry]);

  const toggleSave = async () => {
    if (saved === null || saving) return;

    setSaving(true);
    setSaveError('');

    try {
      await api(`/listings/${listingId}/save`, { 
        method: saved ? 'DELETE' : 'POST' 
      });
      
      setSaved(!saved);
    } catch (error) {
      setSaveError(`Unable to update saved listing: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (!listing)
    return (
      <main className="content">
        <div className="empty">Choose a listing from Browse accommodation.</div>
      </main>
    );

  const send = async () => {
    try {
      await api(`/listings/${listing.listing_id}/enquiries`, {
        method: 'POST',
        body: JSON.stringify({ message }),
      });
      setNotice('Enquiry sent. Continue in Enquiries.');
      setMessage('');
    } catch (error) {
      setNotice(error.message);
    }
  };
  const summarise = async () => {
    try {
      const data = await api('/ai/summary', { method: 'POST', body: JSON.stringify(listing) });
      setSummary(data.summary);
      setSummaryMode(data.mode);
    } catch (error) {
      setNotice(error.message);
    }
  };
  const checkSafety = async () => {
    setCheckingSafety(true);
    setScreening(null);
    try {
      setScreening(
        await api('/ai/safety-check', { method: 'POST', body: JSON.stringify(listing) })
      );
    } catch (error) {
      setNotice(`Safety check unavailable: ${error.message}`);
    } finally {
      setCheckingSafety(false);
    }
  };
  const submitReport = async () => {
    try {
      const data = await api(`/listings/${listing.listing_id}/report`, {
        method: 'POST',
        body: JSON.stringify(report),
      });
      setNotice(data.message);
      setReporting(false);
    } catch (error) {
      setNotice(error.message);
    }
  };
  const utilityNames = Object.keys(listing.utilities || {}).filter((key) => listing.utilities[key]);

  return (
    <main className="content">
      <PageHeader
        title={listing.title}
        subtitle={`${listing.suburb || listing.address}, ${listing.city}`}
        actions={
          user?.role === 'student' && (
            <div className="detail-save-actions">
              <button
                type="button"
                className={`save-button ${saved ? 'saved' : ''}`}
                aria-pressed={saved === true}
                aria-busy={saving || (saved === null && !saveError)}
                disabled={saving || saved === null}
                onClick={toggleSave}
              >
                <span aria-hidden="true">{saved ? '♥' : '♡'}</span>{' '}
                {saving
                  ? 'Saving…'
                  : saved === null
                    ? 'Loading saved status…'
                    : saved
                      ? 'Saved · Remove'
                      : 'Save listing'}
              </button>

              {saveError && (
                <div role="alert">
                  <p className="error">{saveError}</p>

                  {saved === null && (
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => setSaveRetry((count) => count + 1)}
                    >
                      Retry
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        }
      />
      <div className="detail-layout">
        <section className="detail-card">
          <div className="detail-photos">
            {listing.photos?.length ? (
              listing.photos.map((photo) => <img key={photo} src={photo} alt={listing.title} />)
            ) : (
              <div className="big-placeholder">⌂</div>
            )}
          </div>
          <div className="split">
            <h2>
              ${Number(listing.rent).toFixed(0)} <small>/ week</small>
            </h2>
            <span className="status accepted">{listing.status}</span>
          </div>
          <p className="lead-copy">
            {listing.description || 'The advertiser has not added a description yet.'}
          </p>
          <button className="outline" onClick={summarise}>
            ✦ Summarise this listing
          </button>
          {summary && (
            <div className="ai-summary">
              <span>
                AI SUMMARY · {summaryMode === 'gemini' ? 'GEMINI' : 'LOCAL FALLBACK'}
              </span>
              <p>{summary}</p>
              <small>
                Generated from the listing content—verify important details with the advertiser.
              </small>
            </div>
          )}
          <h3>Home details</h3>
          <dl>
            <dt>Room</dt>
            <dd>
              {listing.room_type} · {listing.bedrooms || 1} bed · {listing.bathrooms || 1} bath
            </dd>
            <dt>Available</dt>
            <dd>{String(listing.available_from).slice(0, 10)}</dd>
            <dt>Bond</dt>
            <dd>${listing.bond || 0}</dd>
            <dt>Utilities</dt>
            <dd>{utilityNames.join(', ') || 'Ask the advertiser'}</dd>
            <dt>Transport</dt>
            <dd>{(listing.transport_options || []).join(', ') || 'Ask the advertiser'}</dd>
            <dt>House rules</dt>
            <dd>{listing.house_rules || 'No rules provided'}</dd>
          </dl>
        </section>
        <aside className="contact-card">
          <span className="eyebrow">ADVERTISER</span>
          <h3>{listing.advertiser_name}</h3>
          {user?.role === 'student' ? (
            <>
              <textarea
                value={message}
                placeholder="Introduce yourself and ask about the room…"
                onChange={(event) => setMessage(event.target.value)}
              />
              <button className="primary wide" onClick={send}>
                Start conversation
              </button>
              <section className="safety-check-card">
                <span className="eyebrow">AI SAFETY SUPPORT</span>
                <h3>Check this listing</h3>
                <p>
                  Scan the listing text for common pressure, payment and missing-information warning
                  signs.
                </p>
                <button className="outline wide" onClick={checkSafety} disabled={checkingSafety}>
                  {checkingSafety ? 'Checking listing…' : '✦ Run safety check'}
                </button>
                {screening && (
                  <div className={`safety-result ${screening.safe ? 'safe' : 'warning'}`}>
                    <strong>
                      {screening.safe
                        ? 'No obvious warning signs found'
                        : `Review carefully · risk score ${screening.risk_score}%`}
                    </strong>
                    <p>{screening.flags?.join(' ') || screening.explanation}</p>
                    <small>
                      {screening.mode === 'gemini' ? 'Gemini-assisted review. ' : ''}
                      This is an automated text check, not a guarantee. Verify details and never pay
                      before viewing.
                    </small>
                  </div>
                )}
              </section>
            </>
          ) : user ? (
            <p>Students can begin an enquiry from this page.</p>
          ) : (
            <>
              <p>Sign in with a student account to contact the advertiser.</p>
              <button className="primary wide" onClick={onSignIn}>
                Sign in to enquire
              </button>
            </>
          )}
          {notice && <p className="notice">{notice}</p>}
          {user && (
            <>
              <hr />
              <button className="text-button danger-link" onClick={() => setReporting(!reporting)}>
                ⚑ Report this listing
              </button>
              {reporting && (
                <div className="report-box">
                  <select
                    value={report.reason}
                    onChange={(event) => setReport({ ...report, reason: event.target.value })}
                  >
                    <option>Suspicious listing</option>
                    <option>Incorrect information</option>
                    <option>Inappropriate content</option>
                    <option>Discriminatory behaviour</option>
                  </select>
                  <textarea
                    placeholder="Tell the moderation team what happened"
                    value={report.description}
                    onChange={(event) => setReport({ ...report, description: event.target.value })}
                  />
                  <button className="danger-button wide" onClick={submitReport}>
                    Submit report
                  </button>
                </div>
              )}
            </>
          )}
          <button className="text-button" onClick={() => setPage('Browse listings')}>
            ← Back to results
          </button>
        </aside>
      </div>
    </main>
  );
}
