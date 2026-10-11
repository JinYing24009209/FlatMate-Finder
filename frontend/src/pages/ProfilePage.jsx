import { useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader';
import { api } from '../services/api';
import ProfilePhoto from '../components/ProfilePhoto';
import DateInput from '../components/DateInput';
import MoveInDateSelect from '../components/MoveInDateSelect';
import LocationFilters from '../components/LocationFilters';
import cities from '../../../shared/nzCities.json';

export default function ProfilePage({ user }) {
  const flatmate=user.role==='student'&&user.student_type==='flatmate';
  const [account, setAccount] = useState({ full_name: '', email: '', phone: '' });
  const [profile, setProfile] = useState({
    profile_photo: '',
    about_me: '',
    budget_min: '',
    budget_max: '',
    preferred_location: '',
    lifestyle_tags: [],
    study_habits: '',
    contact_preference: 'Email',
    move_in_date: '',
    move_in_flexible: false,
    preferred_city: null,
    preferred_suburb: null,
    visible_for_matching: true,
    advertiser_bio: '',
    display_phone: true,
  });
  const [tags, setTags] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    Promise.all([api('/auth/me'), api('/profile/me')])
      .then(([a, p]) => {
        setAccount(a.user);
        if (p.profile) {
          const saved=p.profile;
          const parts=String(saved.preferred_location||'').split(',').map(part=>part.trim());
          const city=cities.find(item=>parts.some(part=>part.toLowerCase()===item.toLowerCase()));
          setProfile(flatmate&&!saved.preferred_city&&city?{...saved,preferred_city:city,preferred_suburb:parts.filter(part=>part.toLowerCase()!==city.toLowerCase()).join(', ')}:saved);
          setTags((p.profile.lifestyle_tags || []).join(', '));
        }
      })
      .catch((e) => setNotice(e.message))
      .finally(() => setLoading(false));
  }, [flatmate]);
  const save = async () => {
    if (loading || saving) return;
    setSaving(true);
    setNotice('');
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
    } finally {
      setSaving(false);
    }
  };
  const field = (name, label, type = 'text') => (
    <label>
      {label}
      {type === 'date' ? <DateInput
        aria-label={label}
        value={profile[name] || ''}
        onChange={(e) => setProfile({ ...profile, [name]: e.target.value })}
      /> : <input
        type={type}
        value={profile[name] || ''}
        onChange={(e) => setProfile({ ...profile, [name]: e.target.value })}
      />}
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
      {user.role === 'student' && user.student_type === 'flatmate' && (
        <section className="form-section profile-photo-editor">
          <h2>Your public flatmate profile</h2>
          <p className="muted">
            Your photo and introduction appear to other flatmate students when matching visibility
            is enabled.
          </p>
          <ProfilePhoto src={profile.profile_photo} name={account.full_name || 'Student'} />
          <label>
            Profile photo (JPEG, PNG or WebP, below 1 MB)
            <input
              type="file"
              disabled={loading || saving}
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                if (
                  !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
                  file.size > 1000000
                ) {
                  setNotice('Choose a JPEG, PNG or WebP image below 1 MB.');
                  return;
                }
                const reader = new FileReader();
                reader.onload = () => {
                  setProfile((old) => ({ ...old, profile_photo: reader.result }));
                  setNotice('Photo selected. Save your profile to publish it.');
                };
                reader.onerror = () => setNotice('Could not read this photo. Please try another.');
                reader.readAsDataURL(file);
              }}
            />
          </label>
          {profile.profile_photo && (
            <button
              className="text-button"
              onClick={() => setProfile({ ...profile, profile_photo: '' })}
            >
              Remove photo
            </button>
          )}
          <label>
            About me
            <textarea
              maxLength={1000}
              value={profile.about_me || ''}
              placeholder="Tell potential flatmates about yourself and the home you are looking for."
              onChange={(event) => setProfile({ ...profile, about_me: event.target.value })}
            />
          </label>
        </section>
      )}
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
            {flatmate?<>
              <LocationFilters showLabels city={profile.preferred_city||''} suburb={profile.preferred_suburb||''} onChange={({city,suburb})=>setProfile({...profile,preferred_city:city,preferred_suburb:suburb,preferred_location:[suburb,city].filter(Boolean).join(', ')})}/>
              {!profile.preferred_city&&profile.preferred_location&&<p className="muted">Existing preference: {profile.preferred_location}. Select a city and area to replace this text.</p>}
            </>:field('preferred_location', 'Preferred location')}
            {field('study_habits', 'Study routine')}
            {flatmate?<div className="move-in-field"><span>Move-in date</span><MoveInDateSelect allowUnspecified value={profile.move_in_flexible?'flexible':profile.move_in_date||''} onChange={value=>setProfile({...profile,move_in_flexible:value==='flexible',move_in_date:value==='flexible'?'':value})}/></div>:field('move_in_date', 'Move-in date', 'date')}
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
      <button className="primary" disabled={loading || saving} onClick={save}>
        {loading ? 'Loading profile…' : saving ? 'Saving…' : 'Save profile'}
      </button>
      {notice && <p className="notice">{notice}</p>}
    </main>
  );
}