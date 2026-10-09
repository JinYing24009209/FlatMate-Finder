import { useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader';
import { api } from '../services/api';
import { formatDate } from '../utils/dates';
export default function DashboardPage({ user, setPage }) {
  const [notifications, setNotifications] = useState([]);
  const [profile, setProfile] = useState(null);
  const [counts, setCounts] = useState({ saved: null, conversations: null, unread: null });
  const [error, setError] = useState('');
  const student = user.role === 'student';
  const people = student && user.student_type === 'flatmate';
  const search = people ? 'Flatmate matches' : 'Browse listings';
  const saved = people ? 'Saved flatmates' : 'Saved listings';
  useEffect(() => {
    let active = true;
    const tasks = [api('/notifications'), api('/profile/me'), api('/unread-count')];
    if (student)
      tasks.push(
        api(people ? '/saved-flatmates' : '/saved'),
        api(people ? '/flatmate-conversations' : '/enquiries')
      );
    Promise.allSettled(tasks).then((results) => {
      if (!active) return;
      const value = (i) => (results[i]?.status === 'fulfilled' ? results[i].value : null);
      setNotifications(value(0)?.notifications || []);
      setProfile(value(1)?.profile || null);
      setCounts({
        unread: value(2)?.unread ?? null,
        saved: people ? (value(3)?.matches?.length ?? null) : (value(3)?.listings?.length ?? null),
        conversations: people
          ? (value(4)?.conversations?.length ?? null)
          : (value(4)?.enquiries?.length ?? null),
      });
      if (results.some((x) => x.status === 'rejected'))
        setError('Some dashboard information could not be loaded. Please refresh to try again.');
    });
    return () => {
      active = false;
    };
  }, [student, people]);
  const fields = [
    !!profile?.preferred_location,
    profile?.budget_min != null || profile?.budget_max != null,
    !!profile?.study_habits,
    !!profile?.lifestyle_tags?.length,
    ...(people ? [!!profile?.profile_photo, !!profile?.about_me] : []),
  ];
  const progress = Math.round((fields.filter(Boolean).length / fields.length) * 100);
  const openNotification = async (item) => {
    try {
      if (!item.is_read)
        await api(`/notifications/${item.notification_id}/read`, { method: 'PATCH' });
      setNotifications((old) =>
        old.map((x) => (x.notification_id === item.notification_id ? { ...x, is_read: true } : x))
      );
      window.dispatchEvent(new Event('unread-changed'));
      if (item.related_entity_type === 'flatmate_conversation' && people)
        setPage('Enquiries', { enquiryId: item.related_entity_id });
      else if (item.related_entity_type === 'enquiry' && !people)
        setPage('Enquiries', { enquiryId: item.related_entity_id });
    } catch (e) {
      setError(e.message);
    }
  };
  const cards = student
    ? [
        [
          search,
          people ? 'Meet your next flatmate' : 'Find a place to belong',
          people
            ? 'Explore profiles and shared preferences.'
            : 'Browse rooms available for your next move.',
          '⌕',
        ],
        [saved, 'Your shortlist', 'Keep your favourites close while you decide.', '♡'],
        ['Enquiries', 'Keep the conversation going', 'Read replies and make your next plan.', '✉'],
      ]
    : user.role === 'advertiser'
      ? [
          ['Create listing', 'Share your space', 'Create a welcoming listing for your room.', '+'],
          ['My listings', 'Manage your rooms', 'Keep availability and photos up to date.', '⌂'],
          ['Enquiries', 'Meet prospective tenants', 'Read messages and respond to enquiries.', '✉'],
        ]
      : [
          [
            'Platform management',
            'Open platform management',
            'Review live outcomes, users, listings, reports and staff access.',
            '⌂',
          ],
        ];
  return (
    <main className="content dashboard-page">
      <PageHeader
        title={user.role === 'admin' ? 'Administrator home' : 'Dashboard'}
        subtitle={user.role === 'admin' ? 'Open live outcomes and management tools.' : 'A little closer to your next home.'}
      />
      <section className="dashboard-welcome">
        <div>
          <span className="dashboard-eyebrow">YOUR NEXT CHAPTER</span>
          <h1>Hello, {user.full_name.split(' ')[0]}.</h1>
          <p>
            {student
              ? people
                ? 'Good homes start with the right people. Find someone who fits your everyday life.'
                : 'A room that feels right. A move that feels easier. Pick up your search here.'
              : 'Your workspace for a well-connected rental community.'}
          </p>
          <button className="primary" onClick={() => setPage(cards[0][0])}>
            {student ? (people ? 'Explore flatmates' : 'Explore available rooms') : cards[0][1]} →
          </button>
        </div>
        <div className="dashboard-art" aria-hidden="true">
          <div className="home-outline">⌂</div>
          <span className="art-note">
            {people ? 'Shared routines. New beginnings.' : 'Your place. Your pace.'}
          </span>
        </div>
      </section>
      {error && (
        <p className="notice" role="status">
          {error}
        </p>
      )}
      {student && (
        <div className="dashboard-stats">
          {[
            [counts.saved, 'Saved favourites', saved],
            [counts.conversations, 'Conversations', 'Enquiries'],
            [counts.unread, 'Unread messages', 'Enquiries'],
          ].map(([n, label, target]) => (
            <button key={label} onClick={() => setPage(target)}>
              <strong>{n ?? '—'}</strong>
              <span>{label}</span>
              <i>↗</i>
            </button>
          ))}
        </div>
      )}
      <div className="dashboard-section-title">
        <h2>Make your next move</h2>
        <span className="muted">Everything you need, in one place</span>
      </div>
      <div className="dashboard-actions">
        {cards.map(([target, title, description, icon]) => (
          <button key={target} onClick={() => setPage(target)}>
            <span className="action-symbol">{icon}</span>
            <h3>{title}</h3>
            <p>{description}</p>
            <b>Open {target.toLowerCase()} →</b>
          </button>
        ))}
      </div>
      <div className="dashboard-bottom">
        <section className="dashboard-panel">
          <div className="dashboard-section-title">
            <h2>Recent activity</h2>
            <span className="muted">Your latest updates</span>
          </div>
          {notifications.length ? (
            <div className="stack">
              {notifications.slice(0, 5).map((item) => (
                <button
                  className={`row-card notification-row ${item.is_read ? '' : 'unread'}`}
                  key={item.notification_id}
                  onClick={() => openNotification(item)}
                >
                  <div>
                    <b>{item.type.replaceAll('_', ' ')}</b>
                    <p>{item.message}</p>
                  </div>
                  <small>{formatDate(item.created_at)}</small>
                </button>
              ))}
            </div>
          ) : (
            <div className="dashboard-empty">
              <span>✉</span>
              <h3>A fresh start</h3>
              <p>Your messages and updates will appear here.</p>
            </div>
          )}
        </section>
        {student ? (
          <aside className="dashboard-panel profile-progress">
            <span className="ai-label">YOUR PROFILE</span>
            <h2>Let your preferences do the work</h2>
            <p>
              Add a little about yourself for more useful recommendations
              {people ? ' and a profile others can get to know' : ''}.
            </p>
            <div className="progress-label">
              <b>{progress}% complete</b>
              <span>
                {fields.filter(Boolean).length}/{fields.length} essentials
              </span>
            </div>
            <progress max="100" value={progress} />
            <button className="outline wide" onClick={() => setPage('My profile')}>
              Complete my profile →
            </button>
            <p className="muted">You control whether your profile is visible for matching.</p>
          </aside>
        ) : (
          <aside className="dashboard-panel">
            <h2>Keep things up to date</h2>
            <p>
              Clear information and timely replies help everyone make their next move with
              confidence.
            </p>
          </aside>
        )}
      </div>
    </main>
  );
}
