import { useEffect, useRef, useState } from 'react';
import PageHeader from '../components/PageHeader';
import { api } from '../services/api';

function FlatmateChat({ conversation, user, onRead }) {
  const [messages, setMessages] = useState([]);
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const bottom = useRef(null);
  const id = conversation.conversation_id;
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const d = await api(`/flatmate-conversations/${id}/messages`);
        if (!active) return;
        setMessages(d.messages);
        setError('');
        setLoading(false);
        if (d.messages.some((m) => m.sender_id !== user.user_id && !m.read_at)) {
          await api(`/flatmate-conversations/${id}/read`, { method: 'PATCH' });
          if (active) {
            onRead(id);
            window.dispatchEvent(new Event('unread-changed'));
          }
        }
      } catch (e) {
        if (active) {
          setError(e.message);
          setLoading(false);
        }
      }
    };
    load();
    const timer = setInterval(() => {
      if (!document.hidden) load();
    }, 5000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [id, user.user_id, onRead]);
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'nearest' });
  }, [messages.length]);
  const send = async (e) => {
    e.preventDefault();
    if (!body.trim() || sending) return;
    setSending(true);
    setError('');
    try {
      const d = await api(`/flatmate-conversations/${id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ body }),
      });
      setMessages((old) => [...old, { ...d.message, sender_name: user.full_name }]);
      setBody('');
      onRead(id);
    } catch (e) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  };
  return (
    <section className="chat-panel">
      <div className="chat-heading">
        <div>
          <b>{conversation.full_name}</b>
          <span>Private flatmate conversation</span>
        </div>
      </div>
      <div className="messages" aria-label="Conversation messages">
        {loading ? (
          <p>Loading messages…</p>
        ) : (
          messages.map((m) => (
            <div
              key={m.message_id}
              className={`bubble ${m.sender_id === user.user_id ? 'mine' : ''}`}
            >
              <small>{m.sender_name}</small>
              <p>{m.body}</p>
              <small>{new Date(m.created_at).toLocaleString()}</small>
            </div>
          ))
        )}
        <div ref={bottom} />
      </div>
      <form className="chat-input" onSubmit={send}>
        <input
          aria-label="Your message"
          placeholder="Write a message…"
          maxLength={3000}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <button className="primary" disabled={sending || !body.trim()}>
          {sending ? 'Sending…' : 'Send'}
        </button>
      </form>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
export default function FlatmateEnquiriesPage({ user, focusId }) {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(focusId ? Number(focusId) : null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    const load = () =>
      api('/flatmate-conversations')
        .then((d) => {
          if (active) {
            setItems(d.conversations);
            setError('');
            setLoading(false);
          }
        })
        .catch((e) => {
          if (active) {
            setError(e.message);
            setLoading(false);
          }
        });
    load();
    const timer = setInterval(load, 5000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);
  // Stable callback prevents polling effects from restarting on every render.
  const onRead = useRef((id) =>
    setItems((old) => old.map((x) => (x.conversation_id === id ? { ...x, unread_count: 0 } : x)))
  ).current;
  const current = items.find((x) => x.conversation_id === selected) || items[0];
  return (
    <main className="content">
      <PageHeader
        title="Flatmate enquiries"
        subtitle="Your introductions, replies and plans — together in one place."
      />
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <div className="empty">Loading conversations…</div>
      ) : items.length ? (
        <div className="inbox-layout">
          <section className="conversation-list" aria-label="Flatmate conversations">
            {items.map((x) => (
              <button
                key={x.conversation_id}
                className={current?.conversation_id === x.conversation_id ? 'selected' : ''}
                onClick={() => setSelected(x.conversation_id)}
              >
                <b>{x.full_name}</b>
                <span>{x.last_message}</span>
                {x.unread_count > 0 && <em className="unread-badge">{x.unread_count}</em>}
                <small>{new Date(x.updated_at).toLocaleDateString()}</small>
              </button>
            ))}
          </section>
          {current && (
            <FlatmateChat
              key={current.conversation_id}
              conversation={current}
              user={user}
              onRead={onRead}
            />
          )}
        </div>
      ) : (
        !error && (
          <div className="empty">
            No conversations yet. Open a flatmate profile and send an introduction to get started.
          </div>
        )
      )}
    </main>
  );
}
