import { useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader';
import { formatDate } from '../utils/dates';
import ProfilePhoto from '../components/ProfilePhoto';
import ReportForm from '../components/ReportForm';
import { api } from '../services/api';
export default function FlatmateDetailPage({ person, setPage }) {
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let active = true;
    setProfile(null);
    setError('');
    if (!person?.user_id) {
      setError('Choose a flatmate from the search page.');
      return;
    }
    api(`/flatmates/${person.user_id}`)
      .then((d) => {
        if (active) setProfile(d.flatmate);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [person?.user_id]);
  const save = async () => {
    setSaving(true);
    setNotice('');
    try {
      await api(`/flatmates/${profile.user_id}/save`, {
        method: profile.is_saved ? 'DELETE' : 'POST',
      });
      setProfile({ ...profile, is_saved: !profile.is_saved });
      setNotice(
        profile.is_saved ? 'Removed from saved flatmates.' : 'Saved to your flatmate shortlist.'
      );
    } catch (e) {
      setNotice(e.message);
    } finally {
      setSaving(false);
    }
  };
  const send = async (e) => {
    e.preventDefault();
    if (!body.trim() || busy) return;
    setBusy(true);
    setNotice('');
    try {
      const d = await api(`/flatmates/${profile.user_id}/enquiries`, {
        method: 'POST',
        body: JSON.stringify({ body }),
      });
      setPage('Enquiries', { enquiryId: d.conversation_id });
    } catch (e) {
      setNotice(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="content">
      <button className="text-button" onClick={() => setPage('Flatmate matches')}>
        ← Explore flatmates
      </button>
      {error ? (
        <div className="empty" role="alert">
          {error}
        </div>
      ) : !profile ? (
        <div className="empty" role="status">
          Loading profile…
        </div>
      ) : (
        <>
          <PageHeader
            title={profile.full_name}
            subtitle={profile.preferred_location || 'Location flexible'}
          />
          <div className="person-detail-grid">
            <section className="person-detail-main">
              <ProfilePhoto src={profile.profile_photo} name={profile.full_name} />
              <div className="form-section">
                <h2>Meet {profile.full_name.split(' ')[0]}</h2>
                <p className="preserve-lines">
                  {profile.about_me || 'This student has not added an introduction yet.'}
                </p>
                <div className="match-tags">
                  {(profile.lifestyle_tags || []).map((tag, i) => (
                    <em key={i}>{tag.replaceAll('_', ' ')}</em>
                  ))}
                </div>
                <dl className="person-facts">
                  <div>
                    <dt>Weekly budget</dt>
                    <dd>
                      {profile.budget_min != null || profile.budget_max != null
                        ? `$${profile.budget_min ?? 0}–${profile.budget_max ?? 'open'}`
                        : 'Not added'}
                    </dd>
                  </div>
                  <div>
                    <dt>Move-in date</dt>
                    <dd>{formatDate(profile.move_in_date, 'Flexible')}</dd>
                  </div>
                  <div>
                    <dt>Study routine</dt>
                    <dd>{profile.study_habits || 'Not added'}</dd>
                  </div>
                  <div>
                    <dt>Contact preference</dt>
                    <dd>{profile.contact_preference || 'In-app message'}</dd>
                  </div>
                </dl>
              </div>
            </section>
            <aside className="person-detail-aside">
              <section className="form-section">
                <span className="ai-label">
                  {profile.compatibility_score == null
                    ? 'Complete preferences'
                    : profile.score_source === 'gemini'
                      ? 'Gemini AI compatibility'
                      : 'Local fallback compatibility'}
                </span>
                <h2 className="large-score">
                  {profile.compatibility_score == null ? '—' : `${profile.compatibility_score}%`}
                </h2>
                <p className="muted">
                  Based on preferences you both provided, not a guarantee of suitability.
                </p>
                <ul>
                  {(profile.score_breakdown || []).map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
                <button
                  className="outline wide"
                  disabled={saving}
                  aria-pressed={!!profile.is_saved}
                  onClick={save}
                >
                  {profile.is_saved ? '♥ Saved flatmate' : '♡ Save flatmate'}
                </button>
              </section>
              <form className="form-section" onSubmit={send}>
                <h2>Start a conversation</h2>
                <p className="muted">
                  Introduce yourself. Your message will appear in Enquiries for both of you.
                </p>
                <label>
                  Your message
                  <textarea
                    required
                    maxLength={3000}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Hi! I noticed we are looking in the same area…"
                  />
                </label>
                <button className="primary wide" disabled={busy || !body.trim()}>
                  {busy ? 'Sending…' : 'Send enquiry'}
                </button>
                {notice && (
                  <p role="status" className="notice">
                    {notice}
                  </p>
                )}
              </form>
              <ReportForm userId={profile.user_id} />
            </aside>
          </div>
        </>
      )}
    </main>
  );
}
