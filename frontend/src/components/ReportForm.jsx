import { useState } from 'react';
import { api } from '../services/api';
import '../styles/community.css';

export default function ReportForm({
  userId,
  conversationId,
  messageId,
  label = 'Report this user'
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('Harassment or inappropriate behaviour');
  const [description, setDescription] = useState('');
  const [evidence, setEvidence] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async e => {
    e.preventDefault();
    setBusy(true);
    try {
      const result = await api('/reports', {
        method: 'POST',
        body: JSON.stringify({
          user_id: userId,
          conversation_id: conversationId,
          message_id: messageId,
          reason,
          description,
          evidence_note: evidence
        })
      });
      setNotice(result.message);
      setOpen(false);
      setDescription('');
      setEvidence('');
    } catch (error) {
      setNotice(error.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="behaviour-report">
      <button
        type="button"
        className="text-button danger-link"
        onClick={() => setOpen(!open)}
      >
        {open ? 'Cancel report' : label}
      </button>

      {open && (
        <form className="report-box" onSubmit={submit}>
          <label>
            Reason
            <select
              value={reason}
              onChange={e => setReason(e.target.value)}
            >
              <option>Harassment or inappropriate behaviour</option>
              <option>Scam or suspicious payment request</option>
              <option>Discrimination</option>
              <option>Misleading profile</option>
              <option>Other concern</option>
            </select>
          </label>

          <label>
            What happened?
            <textarea
              value={description}
              required
              maxLength={3000}
              onChange={e => setDescription(e.target.value)}
            />
          </label>

          <label>
            Supporting details (optional)
            <textarea
              value={evidence}
              maxLength={1000}
              onChange={e => setEvidence(e.target.value)}
              placeholder="Relevant dates or context; do not include passwords or unrelated private information."
            />
          </label>

          <p className="muted">
            {messageId
              ? 'A copy of this message and its timestamp will be included. Only administrators can review the submitted evidence.'
              : 'Administrators receive your explanation and the reported profile identity.'}
            {' '}Track the result in Dashboard.
          </p>

          <button
            className="primary"
            disabled={busy || !description.trim()}
          >
            {busy ? 'Submitting…' : 'Submit report'}
          </button>
        </form>
      )}

      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
    </div>
  );
}