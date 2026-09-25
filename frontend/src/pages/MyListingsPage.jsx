import { useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader';
import { api } from '../services/api';
export default function MyListingsPage({ setPage, setEditing }) {
  const [listings, setListings] = useState([]);
  const [notice, setNotice] = useState('');
  const load = () =>
    api('/listings/mine')
      .then((data) => setListings(data.listings))
      .catch((e) => setNotice(e.message));
  useEffect(() => {
    load();
  }, []);
  const remove = async (listing) => {
    if (!window.confirm(`Delete “${listing.title}”?`)) return;
    try {
      await api(`/listings/${listing.listing_id}`, { method: 'DELETE' });
      setNotice('Listing deleted.');
      localStorage.setItem('listings-updated-at', String(Date.now()));
      window.dispatchEvent(new Event('listings-changed'));
      load();
    } catch (e) {
      setNotice(e.message);
    }
  };
  return (
    <main className="content">
      <PageHeader
        title="My listings"
        subtitle="A consistent overview of every room you advertise."
        actions={
          <button
            className="primary"
            onClick={() => {
              setEditing(null);
              setPage('Create listing');
            }}
          >
            + New listing
          </button>
        }
      />
      {notice && <p className="notice">{notice}</p>}
      <div className="owner-listing-grid">
        {listings.map((item) => (
          <article className="owner-listing-card" key={item.listing_id}>
            <div className="owner-cover">
              {item.photos?.[0] ? <img src={item.photos[0]} alt={item.title} /> : <span>⌂</span>}
              <em className={`status ${item.status}`}>{item.status}</em>
            </div>
            <div className="owner-listing-body">
              <h3>{item.title}</h3>
              <p className="listing-location">
                ⌖ {item.suburb || item.city}, {item.city}
              </p>
              <div className="owner-facts">
                <span>
                  <b>${Number(item.rent).toFixed(0)}</b>/wk
                </span>
                <span>{item.room_type}</span>
                <span>{String(item.available_from).slice(0, 10)}</span>
              </div>
              <div className="button-row">
                <button
                  className="primary"
                  onClick={() => {
                    setEditing(item);
                    setPage('Create listing');
                  }}
                >
                  Edit listing
                </button>
                <button className="danger-button" onClick={() => remove(item)}>
                  Delete
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
      {!listings.length && <div className="empty">Create your first room listing.</div>}
    </main>
  );
}
