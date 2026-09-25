import { useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader';
import { api } from '../services/api';
export default function DashboardPage({ user, setPage }) {
  const [notifications, setNotifications] = useState([]);
  useEffect(() => {
    api('/notifications')
      .then((data) => setNotifications(data.notifications))
      .catch(() => {});
  }, []);
  const cards =
    user.role === 'student'
      ? [
          ['Browse listings', 'Find a room'],
          ['Flatmate matches', 'Find compatible people'],
          ['Saved listings', 'View your shortlist'],
        ]
      : user.role === 'advertiser'
        ? [
            ['Create listing', 'Post a room'],
            ['My listings', 'Manage availability'],
            ['Enquiries', 'Respond to students'],
          ]
        : [['Admin dashboard', 'Review platform health']];
  const openNotification = async (item) => {
    if (!item.is_read)
      await api(`/notifications/${item.notification_id}/read`, { method: 'PATCH' }).catch(() => {});
    setNotifications((old) =>
      old.map((x) => (x.notification_id === item.notification_id ? { ...x, is_read: true } : x))
    );
    window.dispatchEvent(new Event('unread-changed'));
    if (item.related_entity_type === 'enquiry' && item.related_entity_id)
      setPage('Enquiries', { enquiryId: item.related_entity_id });
  };
  return (
    <main className="content">
      <PageHeader
        title={`Hello, ${user.full_name.split(' ')[0]}`}
        subtitle={
          user.role === 'advertiser'
            ? 'Manage your rooms and respond to prospective tenants.'
            : 'Everything you need for your next move.'
        }
      />
      <div className="quick-cards">
        {cards.map(([target, title]) => (
          <button key={target} onClick={() => setPage(target)}>
            <b>{title}</b>
            <span>{target}</span> →
          </button>
        ))}
      </div>
      <h2>Recent notifications</h2>
      {notifications.length ? (
        <div className="stack">
          {notifications.slice(0, 8).map((item) => (
            <button
              className={`row-card notification-row ${item.is_read ? '' : 'unread'}`}
              key={item.notification_id}
              onClick={() => openNotification(item)}
            >
              <div>
                {!item.is_read && <i className="notification-dot" />}
                <b>{item.type.replaceAll('_', ' ')}</b>
                <p>{item.message}</p>
              </div>
              <small>
                {new Date(item.created_at).toLocaleDateString()}{' '}
                {item.related_entity_type === 'enquiry' ? '→' : ''}
              </small>
            </button>
          ))}
        </div>
      ) : (
        <div className="empty">
          You're all caught up. Notifications appear when enquiries or messages arrive.
        </div>
      )}
    </main>
  );
}
