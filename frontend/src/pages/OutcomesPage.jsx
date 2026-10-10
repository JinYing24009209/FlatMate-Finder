import { useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader';
import ListingCard from '../components/ListingCard';
import FlatmateCard from '../components/FlatmateCard';
import { api } from '../services/api';
import { formatDateTime } from '../utils/dates';
import { startPolling } from '../utils/polling';

export default function OutcomesPage({
  flatmates = false,
  setPage,
  setSelected,
}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const d = await api(
          flatmates ? '/flatmates/matched' : '/payments/successful'
        );

        if (active) {
          setItems(flatmates ? d.matches : d.listings);
          setError('');
        }
      } catch (e) {
        if (active) setError(e.message);
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    const stop = startPolling(load, { interval: 5000 });

    return () => {
      active = false;
      stop();
    };
  }, [flatmates]);

  const open = (item) => {
    setSelected(item);
    setPage(flatmates ? 'Flatmate detail' : 'Listing detail');
  };

  return (
    <main className="content">
      <PageHeader
        title={flatmates ? 'Matched flatmates' : 'Successful payments'}
        subtitle={
          flatmates
            ? 'People with whom you have both agreed to be flatmates. This is not an AI compatibility score.'
            : 'Your successful demonstration payments. No real funds were transferred.'
        }
      />

      {error ? (
        <p className="notice" role="alert">{error}</p>
      ) : loading ? (
        <div className="empty">Loading records…</div>
      ) : items.length ? (
        <div className={flatmates ? 'people-grid' : 'listing-grid'}>
          {items.map((item) => (
            <div key={flatmates ? item.conversation_id : item.payment_id}>
              {flatmates ? (
                <FlatmateCard flatmate={item} onOpen={open} />
              ) : (
                <ListingCard listing={item} onOpen={open} paid />
              )}

              <p className="muted">
                {flatmates
                  ? `Matched ${formatDateTime(item.matched_at)}`
                  : `Paid NZD $${Number(item.paid_amount).toFixed(2)} · ${formatDateTime(item.completed_at)}`}
              </p>

              {flatmates && (
                <button
                  className="outline"
                  onClick={() =>
                    setPage('Enquiries', { enquiryId: item.conversation_id })
                  }
                >
                  Open conversation
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="empty">
          {flatmates
            ? 'No mutual matches yet. Both people must agree in Enquiries.'
            : 'No successful payments yet.'}
        </div>
      )}
    </main>
  );
}

