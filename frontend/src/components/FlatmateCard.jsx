import ProfilePhoto from './ProfilePhoto';
export default function FlatmateCard({ flatmate, onOpen, onSave, busy = false }) {
  const score = flatmate.compatibility_score;
  return (
    <article className="people-card">
      <button
        className="people-open"
        onClick={() => onOpen(flatmate)}
        aria-label={`View ${flatmate.full_name}'s profile`}
      >
        <div className="people-photo">
          <ProfilePhoto src={flatmate.profile_photo} name={flatmate.full_name} />
          <span className="people-score">
            {flatmate.mutually_agreed?'✓ Both agreed':`✦ ${score == null ? 'Complete preferences' : `${score}% match`}`}
          </span>
        </div>
        <div className="people-copy">
          <p className="people-location">{flatmate.preferred_location || 'Location flexible'}</p>
          <h2>{flatmate.full_name}</h2>
          <p className="muted">
            {flatmate.mutually_agreed ? 'Mutually confirmed flatmates' : score == null
              ? 'Add preferences to compare'
              : flatmate.score_source === 'gemini'
                ? 'Gemini AI matching'
                : 'Local fallback matching'}
          </p>
          <p className="people-budget">
            {flatmate.budget_min != null || flatmate.budget_max != null
              ? `$${flatmate.budget_min ?? 0}–${flatmate.budget_max ?? 'open'} / week`
              : 'Budget not added'}
          </p>
          <p className="people-intro">
            {flatmate.about_me ||
              'Open this profile to explore shared preferences and start a conversation.'}
          </p>
          <div className="match-tags">
            {(flatmate.lifestyle_tags || []).slice(0, 3).map((tag, i) => (
              <em key={`${tag}-${i}`}>{tag.replaceAll('_', ' ')}</em>
            ))}
          </div>
        </div>
      </button>
      <div className="people-actions">
        <button className="text-button" onClick={() => onOpen(flatmate)}>
          View details →
        </button>
        {onSave && <button
          className={`save-button ${flatmate.is_saved ? 'saved' : ''}`}
          aria-pressed={!!flatmate.is_saved}
          disabled={busy}
          onClick={() => onSave(flatmate)}
        >
          {flatmate.is_saved ? '♥ Saved' : '♡ Save'}
        </button>}
      </div>
    </article>
  );
}
