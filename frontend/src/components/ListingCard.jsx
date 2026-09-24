export default function ListingCard({ listing, onOpen, onSave, recommendation, saved = false }) {
  const photo = listing.photos?.[0];
  return (
    <article className="listing-card">
      <div className="listing-image">{photo ? <img src={photo} alt={listing.title} /> : '⌂'}</div>
      <div className="listing-body">
        <div className="split">
          <h3>{listing.title}</h3>
          <b>
            ${Number(listing.rent).toFixed(0)}
            <small>/wk</small>
          </b>
        </div>
        <p className="listing-location">
          ⌖ {listing.suburb || listing.city}, {listing.city} · {listing.room_type}
        </p>
        <div className="listing-meta">
          <span>Available {String(listing.available_from || '').slice(0, 10)}</span>
          <span>{listing.bathrooms || 1} bath</span>
        </div>
        {recommendation && (
          <p className="ai-score">
            AI match: {recommendation.score}% — {recommendation.reasons.join(', ')}
          </p>
        )}
        {listing.semantic_score != null && (
          <p className="ai-score">
            Smart search relevance: {listing.semantic_score}% ·{' '}
            {listing.semantic_source === 'gemini' ? 'Gemini semantic match' : 'local relevance'}
          </p>
        )}
        <p className="muted">
          {(listing.description || 'No description yet.').slice(0, 130)}
          {listing.description?.length > 130 ? '…' : ''}
        </p>
        <div className="split">
          <button
            type="button"
            className="text-button listing-open"
            aria-label={`View details for ${listing.title}`}
            onClick={() => onOpen?.(listing)}
          >
            View details
          </button>
          {onSave && (
            <button
              type="button"
              className={`save-button ${saved ? 'saved' : ''}`}
              aria-pressed={saved}
              aria-label={saved ? 'Remove from saved listings' : 'Save listing'}
              onClick={() => onSave(listing, !saved)}
            >
              <span>{saved ? '♥' : '♡'}</span>
              {saved ? ' Saved' : ' Save'}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
