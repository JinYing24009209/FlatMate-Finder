export default function ListingCard({ listing, onOpen, onSave, recommendation, saved = false, paid = false }) {
  const photo = listing.photos?.[0];
  const unavailable = listing.status && listing.status !== 'available';
  const statusLabels = {
    shortlisted: 'Temporarily reserved',
    filled: 'Rented / no longer available',
    closed: 'Listing closed',
    removed: 'Listing removed · payment record retained',
  };
  return (
    <article className={`listing-card ${unavailable ? 'listing-unavailable' : ''}`}>
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
          ⌖ {[listing.suburb, listing.city].filter(Boolean).join(', ')} · {listing.room_type}
        </p>
        <div className="listing-meta">
          <span>{unavailable ? statusLabels[listing.status] || listing.status : `Available ${String(listing.available_from || '').slice(0, 10)}`}</span>
          <span>{listing.bathrooms || 1} bath</span>
        </div>
        {unavailable && (
          <p className="availability-warning">
            {paid?'Your payment succeeded. This listing is shown for your records.':'This home cannot currently accept new enquiries.'}
          </p>
        )}
        {recommendation && (
          <p className="ai-score">
            AI match: {recommendation.score}% — {recommendation.reasons.join(', ')}
          </p>
        )}
        {listing.semantic_source === 'filters' ? (
          <p className="ai-score">Matches all selected filters</p>
        ) : listing.semantic_score != null ? (
          <p className="ai-score">
            Smart search relevance: {listing.semantic_score}% ·{' '}
            {listing.semantic_source === 'gemini' ? 'Gemini semantic match' : 'local relevance'}
          </p>
        ) : null}
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
