import { useEffect, useState } from 'react';
import { api } from '../services/api';
const labels = { pending: 'Pending', accepted: 'Accepted', declined: 'Declined' };
export default function ChatPanel({ enquiry, user, onStatusChange }) {
  const [messages, setMessages] = useState([]);
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const load = async () => {
    try {
      const data = await api(`/enquiries/${enquiry.enquiry_id}/messages`);
      setMessages(data.messages);
      window.dispatchEvent(new Event('unread-changed'));
    } catch (e) {
      setError(e.message);
    }
  };
  useEffect(() => {
    load();
  }, [enquiry.enquiry_id]);
  const send = async (e) => {
    e.preventDefault();
    if (!body.trim()) return;
    try {
      await api(`/enquiries/${enquiry.enquiry_id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ body }),
      });
      setBody('');
      load();
    } catch (err) {
      setError(err.message);
    }
  };
  const decide = async (status) => {
    try {
      await api(`/enquiries/${enquiry.enquiry_id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      await onStatusChange(enquiry.enquiry_id);
    } catch (e) {
      setError(e.message);
    }
  };
  return (
    <section className="chat-panel">
      <div className="chat-heading">
        <div>
          <b>{enquiry.title}</b>
          <span>{enquiry.student_name || enquiry.advertiser_name}</span>
        </div>
        {user.role === 'advertiser' ? (
          <div className="status-actions" aria-label="Enquiry status">
            {['pending', 'accepted', 'declined'].map((status) => (
              <button
                key={status}
                className={`status-choice ${status} ${enquiry.status === status ? 'selected' : ''}`}
                onClick={() => decide(status)}
              >
                {labels[status]}
              </button>
            ))}
          </div>
        ) : (
          <span className={`status ${enquiry.status}`}>{labels[enquiry.status]}</span>
        )}
      </div>
      <div className="messages">
        {messages.map((message) => (
          <div
            className={`bubble ${message.sender_id === user.user_id ? 'mine' : ''}`}
            key={message.message_id}
          >
            <small>{message.sender_name}</small>
            <p>{message.body}</p>
          </div>
        ))}
      </div>
      <form className="chat-input" onSubmit={send}>
        <input
          placeholder="Write a message…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <button className="primary">Send</button>
      </form>
      {error && <p className="error">{error}</p>}
    </section>
  );
}
