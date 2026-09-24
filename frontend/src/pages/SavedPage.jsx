import { useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader';
import ListingCard from '../components/ListingCard';
import { api } from '../services/api';
export default function SavedPage({ setPage, setSelected }) {
  const [listings, setListings] = useState([]);
  const load = () => api('/saved').then((data) => setListings(data.listings));
  useEffect(() => {
    load();
  }, []);
  const remove = async (listing) => {
    await api(`/listings/${listing.listing_id}/save`, { method: 'DELETE' });
    load();
  };
  return (
    <main className="content">
      <PageHeader title="Saved listings" subtitle="Your shortlist, ready for comparison." />
      <div className="listing-grid">
        {listings.map((listing) => (
          <ListingCard
            key={listing.listing_id}
            listing={listing}
            saved
            onSave={remove}
            onOpen={() => {
              setSelected(listing);
              setPage('Listing detail');
            }}
          />
        ))}
      </div>
      {!listings.length && (
        <div className="empty">Save listings from Browse accommodation to see them here.</div>
      )}
    </main>
  );
}
