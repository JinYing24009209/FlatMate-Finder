import { useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader';
import { api } from '../services/api';

export default function PaymentPage({ listing, setPage }) {
  const [payment, setPayment] = useState(null);
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!listing?.listing_id) return setLoading(false);
    api('/payments/checkout', {
      method: 'POST',
      body: JSON.stringify({ listing_id: listing.listing_id }),
    })
      .then((data) => setPayment(data.payment))
      .catch((error) => setNotice(error.message))
      .finally(() => setLoading(false));
  }, [listing?.listing_id]);

  const complete = async () => {
    setLoading(true);
    try {
      const data = await api(`/payments/${payment.payment_id}/complete-demo`, { method: 'POST' });
      setPayment((old) => ({ ...old, ...data.payment }));
      setNotice(data.message);
    } catch (error) {
      setNotice(error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!listing)
    return <main className="content"><div className="empty">Choose an available listing first.</div></main>;

  return (
    <main className="content payment-page">
      <PageHeader title="Secure rental payment" subtitle="Review the home and amount before continuing." />
      <div className="payment-layout">
        <section className="payment-card">
          <span className="eyebrow">COURSEWORK DEMONSTRATION</span>
          <h2>{listing.title}</h2>
          <p>{[listing.address, listing.suburb, listing.city].filter(Boolean).join(', ')}</p>
          <div className="payment-total">
            <span>One-week holding payment</span>
            <strong>NZD ${Number(payment?.amount ?? listing.rent).toFixed(2)}</strong>
          </div>
          <div className="demo-payment-notice">
            No real card details or money are collected. This page demonstrates the checkout,
            server validation, payment record and confirmation flow safely.
          </div>
          {payment?.status === 'succeeded' ? (
            <div className="payment-success">
              <strong>✓ Demo payment confirmed</strong>
              <p>Reference: {payment.provider_reference}</p>
            </div>
          ) : (
            <>
              <label className="payment-consent">
                <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
                I understand this is a demonstration and does not create a tenancy agreement.
              </label>
              <button className="primary wide" disabled={!accepted || loading || !payment} onClick={complete}>
                {loading ? 'Preparing…' : 'Complete demo payment'}
              </button>
            </>
          )}
          {notice && <p className="notice" role="status">{notice}</p>}
          <button className="text-button" onClick={() => setPage('Listing detail')}>← Back to listing</button>
        </section>
        <aside className="payment-summary-card">
          <h3>Payment summary</h3>
          <p><span>Purpose</span><b>Holding payment</b></p>
          <p><span>Provider</span><b>Coursework demo</b></p>
          <p><span>Status</span><b>{payment?.status || (loading ? 'Preparing' : 'Unable to prepare')}</b></p>
          <p><span>Listing status</span><b>{payment?.listing_status || listing.status}</b></p>
        </aside>
      </div>
    </main>
  );
}
