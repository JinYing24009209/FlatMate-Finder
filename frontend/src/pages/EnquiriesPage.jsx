import { useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader';
import ChatPanel from '../components/ChatPanel';
import { api } from '../services/api';
const labels = { pending: 'Pending', accepted: 'Accepted', declined: 'Declined' };
export default function EnquiriesPage({ user, focusId }) {
  const [enquiries, setEnquiries] = useState([]);
  const [active, setActive] = useState(null);
  const [error, setError] = useState('');
  const load = async (preferredId = focusId) => {
    try {
      const data = await api('/enquiries');
      setEnquiries(data.enquiries);
      setActive(
        (current) =>
          data.enquiries.find((x) => x.enquiry_id === Number(preferredId || current?.enquiry_id)) ||
          data.enquiries[0] ||
          null
      );
    } catch (e) {
      setError(e.message);
    }
  };
  useEffect(() => {
    load(focusId);
  }, [focusId]);
  const open = (enquiry) => {
    setActive(enquiry);
    setEnquiries((old) =>
      old.map((x) => (x.enquiry_id === enquiry.enquiry_id ? { ...x, unread_count: 0 } : x))
    );
  };
  const total = enquiries.reduce((sum, x) => sum + (x.unread_count || 0), 0);
  return (
    <main className="content">
      <PageHeader
        title="Enquiries and chat"
        subtitle="Keep conversations together and track every application decision."
        actions={
          total > 0 && (
            <span className="inbox-alert">
              <i />
              {total} unread
            </span>
          )
        }
      />
      {error && <p className="error">{error}</p>}
      {enquiries.length ? (
        <div className="inbox-layout">
          <section className="conversation-list">
            {enquiries.map((enquiry) => (
              <button
                key={enquiry.enquiry_id}
                className={active?.enquiry_id === enquiry.enquiry_id ? 'selected' : ''}
                onClick={() => open(enquiry)}
              >
                {enquiry.unread_count > 0 && (
                  <em className="unread-badge">{enquiry.unread_count}</em>
                )}
                <b>{enquiry.title}</b>
                <span>{enquiry.student_name || enquiry.advertiser_name}</span>
                <small>{labels[enquiry.status]}</small>
              </button>
            ))}
          </section>
          {active && <ChatPanel enquiry={active} user={user} onStatusChange={load} />}
        </div>
      ) : (
        <div className="empty">No enquiries yet. A new student message will appear here.</div>
      )}
    </main>
  );
}
