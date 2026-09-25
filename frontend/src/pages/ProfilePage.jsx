import { useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader';
import { api } from '../services/api';
export default function ProfilePage({ user }) {
  const [account, setAccount] = useState({ full_name: '', email: '', phone: '' });
  const [profile, setProfile] = useState({
    budget_min: '',
    budget_max: '',
    preferred_location: '',
    lifestyle_tags: [],
    study_habits: '',
    contact_preference: 'Email',
    move_in_date: '',
    visible_for_matching: true,
    advertiser_bio: '',
    display_phone: true,
  });
  const [tags, setTags] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => {
    Promise.all([api('/auth/me'), api('/profile/me')])
      .then(([a, p]) => {
        setAccount(a.user);
        if (p.profile) {
          setProfile(p.profile);
          setTags((p.profile.lifestyle_tags || []).join(', '));
        }
      })
      .catch((e) => setNotice(e.message));
  }, []);
  const save = async () => {
    try {
      await Promise.all([
        api('/auth/me', { method: 'PATCH', body: JSON.stringify(account) }),
        api('/profile/me', {
          method: 'PUT',
          body: JSON.stringify({
            ...profile,
            lifestyle_tags: tags
              .split(',')
              .map((x) => x.trim())
              .filter(Boolean),
          }),
        }),
      ]);
      setNotice('Profile saved successfully.');
    } catch (e) {
      setNotice(e.message);
    }
  };
  const field = (name, label, type = 'text') => (
    <label>
      {label}
      <input
        type={type}
        value={profile[name] || ''}
        onChange={(e) => setProfile({ ...profile, [name]: e.target.value })}
      />
    </label>
  );
  return (
    <main className="content">
      <PageHeader
        title={user.role === 'advertiser' ? 'Advertiser profile' : 'Account & preferences'}
        subtitle={
          user.role === 'advertiser'
            ? 'Control the information prospective tenants see.'
            : 'Keep your details current and control what matching can use.'
        }
      />
      <section className="form-section">
        <h2>Account details</h2>
        <div className="form-grid">
          <label>
            Full name
            <input
              value={account.full_name || ''}
              onChange={(e) => setAccount({ ...account, full_name: e.target.value })}
            />
          </label>
          <label>
            Email
            <input value={account.email || ''} disabled />
          </label>
          <label>
            Phone (optional)
            <input
              value={account.phone || ''}
              onChange={(e) => setAccount({ ...account, phone: e.target.value })}
            />
          </label>
        </div>
      </section>
      {user.role === 'advertiser' ? (
        <section className="form-section">
          <h2>Public advertiser information</h2>
          <label>
            About you or your property team
            <textarea
              value={profile.advertiser_bio || ''}
              maxLength="500"
              placeholder="Introduce yourself, how you manage viewings, and when tenants can expect a reply."
              onChange={(e) => setProfile({ ...profile, advertiser_bio: e.target.value })}
            />
          </label>
          <div className="form-grid">
            <label>
              Preferred contact method
              <select
                value={profile.contact_preference || 'Email'}
                onChange={(e) => setProfile({ ...profile, contact_preference: e.target.value })}
              >
                <option>Email</option>
                <option>Phone</option>
                <option>In-app message</option>
              </select>
            </label>
          </div>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={profile.display_phone !== false}
              onChange={(e) => setProfile({ ...profile, display_phone: e.target.checked })}
            />{' '}
            Show my phone number to signed-in students on my listings
          </label>
          <p className="muted">
            Your email address is never displayed publicly. Students contact you through private
            enquiries.
          </p>
        </section>
      ) : (
        <section className="form-section">
          <div className="split">
            <h2>Matching preferences</h2>
            <span className="ai-label">Used by AI matching</span>
          </div>
          <div className="form-grid">
            {field('budget_min', 'Minimum weekly budget', 'number')}
            {field('budget_max', 'Maximum weekly budget', 'number')}
            {field('preferred_location', 'Preferred location')}
            {field('study_habits', 'Study routine')}
            {field('move_in_date', 'Move-in date', 'date')}
            <label>
              Lifestyle preferences
              <input
                value={tags}
                placeholder="quiet, tidy, non-smoker"
                onChange={(e) => setTags(e.target.value)}
              />
            </label>
            <label>
              Contact preference
              <select
                value={profile.contact_preference || 'Email'}
                onChange={(e) => setProfile({ ...profile, contact_preference: e.target.value })}
              >
                <option>Email</option>
                <option>Phone</option>
                <option>In-app message</option>
              </select>
            </label>
          </div>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={profile.visible_for_matching}
              onChange={(e) => setProfile({ ...profile, visible_for_matching: e.target.checked })}
            />{' '}
            Show my profile to compatible students
          </label>
          <p className="muted">Contact details and private messages are never used for matching.</p>
        </section>
      )}
      <button className="primary" onClick={save}>
        Save profile
      </button>
      {notice && <p className="notice">{notice}</p>}
    </main>
  );
}
