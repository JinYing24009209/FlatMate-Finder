import { useEffect, useState } from 'react';
import { api } from '../services/api';
export default function HomePage({
  user,
  onStart,
  onBrowse,
  onListing,
  onBack,
  canGoBack,
}) {

  const [listings, setListings] = useState([]);
  useEffect(() => {
    const load = () =>
      api('/listings')
        .then((data) => setListings(data.listings.slice(0, 6)))
        .catch(() => {});
    const storage = (event) => {
      if (event.key === 'listings-updated-at') load();
    };
    load();
    window.addEventListener('listings-changed', load);
    window.addEventListener('storage', storage);
    window.addEventListener('focus', load);
    return () => {
      window.removeEventListener('listings-changed', load);
      window.removeEventListener('storage', storage);
      window.removeEventListener('focus', load);
    };
  }, []);
  return (
    <main className="home">
      <nav className="home-nav">
        <div className="home-brand-group">
          {canGoBack && (
            <button
              type="button"
              className="page-back-button"
              onClick={onBack}
              aria-label="Back to previous page"
            >
              ← Back
            </button>
          )}

          <div className="home-brand home-brand-prominent">
            <b aria-hidden="true">FM</b>
            <h1 className="home-site-title">FlatMate Finder</h1>
          </div>
        </div>  
        <div>
          {(!user || user.role === 'student') && (
            <button className="text-button" onClick={onBrowse}>
              Find a home
            </button>
          )}
          <button className="primary" onClick={onStart}>
            {user ? 'Go to workspace' : 'Join free'}
          </button>
        </div>
      </nav>
      <section className="hero-section">
        <div>
          <p className="eyebrow">NEW ZEALAND STUDENT LIVING</p>
          <h2 className="home-hero-title">
            Your next home.
            <br />
            <em>Your kind of people.</em>
          </h2>
          <p>
            Discover rooms that fit your budget and flatmates who fit your rhythm—with transparent
            matching and safer conversations built in.
          </p>
          <div className="hero-actions">
            <button className="primary" onClick={onStart}>
              {user ? 'Open my dashboard →' : 'Find my match →'}
            </button>
            {(!user || user.role === 'student') && (
              <button className="outline" onClick={onBrowse}>
                Explore rooms
              </button>
            )}
          </div>
          <div className="trust-row">
            <span>✓ Explainable matches</span>
            <span>✓ Private messaging</span>
            <span>✓ Human-reviewed reports</span>
          </div>
        </div>
        <div className="hero-visual">
          <div className="property-shot">
            <div className="floating-card top">
              <small>BEST MATCH</small>
              <strong>92% compatible</strong>
            </div>
            <div className="house-illustration">⌂</div>
            <div className="floating-card bottom">
              <b>
                $235 <small>/ week</small>
              </b>
              <span>Mount Eden · 8 min to campus</span>
            </div>
          </div>
        </div>
      </section>
      <section className="featured-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">FRESH ON FLATMATE FINDER</p>
            <h2>Quality rooms worth a look</h2>
          </div>
          {(!user || user.role === 'student') && (
            <button className="text-button" onClick={onBrowse}>
              See all homes →
            </button>
          )}
        </div>
        <div className="featured-grid">
          {listings.map((item) => (
            <button
              type="button"
              className="featured-card"
              key={item.listing_id}
              onClick={() => onListing(item)}
              aria-label={`View details for ${item.title}`}
            >
              <div className="featured-photo">
                {item.photos?.[0] ? <img src={item.photos[0]} alt={item.title} /> : <span>⌂</span>}
                <b>
                  ${Number(item.rent).toFixed(0)}
                  <small>/wk</small>
                </b>
              </div>
              <div className="featured-card-body">
                <span className="status accepted">Available</span>
                <h3>{item.title}</h3>
                <p>
                  ⌖ {item.suburb || item.city}, {item.city}
                </p>
                <small>
                  {item.room_type} · Available {String(item.available_from).slice(0, 10)}
                </small>
                <span className="featured-card-link">View details →</span>
              </div>
            </button>
          ))}
        </div>
        {!listings.length && (
          <div className="featured-empty">
            <b>Quality listings are coming soon.</b>
            <span>Sign in as an advertiser to publish the first room.</span>
          </div>
        )}
      </section>
      <section className="home-features">
        <article>
          <span>01</span>
          <h3>Search naturally</h3>
          <p>
            Try “quiet furnished room near campus under $250” and let smart search do the filtering.
          </p>
        </article>
        <article>
          <span>02</span>
          <h3>Know why it matches</h3>
          <p>Compare homes and people with clear reasons—not a mysterious black-box score.</p>
        </article>
        <article>
          <span>03</span>
          <h3>Move with confidence</h3>
          <p>Chat privately, save favourites and report anything that does not feel right.</p>
        </article>
      </section>
      <section className="home-cta">
        <p className="eyebrow">BUILT FOR REAL STUDENT LIFE</p>
        <h2>Less scrolling. Better flatting.</h2>
        <button className="primary" onClick={onStart}>
          {user ? 'Return to dashboard' : 'Create your profile'}
        </button>
      </section>
      <footer>© 2026 FlatMate Finder · Privacy-first student housing</footer>
    </main>
  );
}
