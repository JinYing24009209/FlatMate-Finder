import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../services/api';
import { startPolling } from '../utils/polling';
const labels = { pending: 'Pending', accepted: 'Accepted', declined: 'Declined' };
export default function ChatPanel({ enquiry, user, onStatusChange }) {
  const [messages, setMessages] = useState([]);
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const [sending,setSending]=useState(false);
  const live=useRef(false), sequence=useRef(0), panel=useRef(null), nearBottom=useRef(true);
  const load = useCallback(async () => {
    const request=++sequence.current;
    try {
      const data = await api(`/enquiries/${enquiry.enquiry_id}/messages`);
      if(!live.current || request!==sequence.current)return;
      setMessages(data.messages);
      setError('');
      window.dispatchEvent(new Event('unread-changed'));
    } catch (e) {
      if(live.current && request===sequence.current)setError(e.message);
    }
  }, [enquiry.enquiry_id]);
  useEffect(() => {
    live.current=true;
    load();
    const stop=startPolling(load);
    return()=>{live.current=false;sequence.current++;stop();};
  }, [load]);
  useEffect(()=>{if(panel.current && nearBottom.current)panel.current.scrollTop=panel.current.scrollHeight;},[messages]);
  const send = async (e) => {
    e.preventDefault();
    if (!body.trim() || sending) return;
    setSending(true);
    try {
      await api(`/enquiries/${enquiry.enquiry_id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ body }),
      });
      if(live.current){setBody('');nearBottom.current=true;load();}
    } catch (err) {
      if(live.current)setError(err.message);
    } finally {
      if(live.current)setSending(false);
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
      <div className="messages" ref={panel} onScroll={()=>{const p=panel.current;nearBottom.current=p.scrollHeight-p.scrollTop-p.clientHeight<80;}}>
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
          maxLength={3000}
          disabled={sending}
          onChange={(e) => setBody(e.target.value)}
        />
        <button className="primary" disabled={sending||!body.trim()}>{sending?'Sending…':'Send'}</button>
      </form>
      {error && <p className="error">{error}</p>}
    </section>
  );
}
