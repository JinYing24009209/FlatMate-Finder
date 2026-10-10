import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { startPolling } from '../utils/polling';
import { formatDateTime } from '../utils/dates';

function Bars({ items }) {
  const max = Math.max(1, ...items.map(x => Number(x.value)));
  return (
    <div className="metric-bars">
      {items.map(item => (
        <div key={item.label}>
          <div>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
          <div className="metric-track">
            <i style={{ width: `${Number(item.value) / max * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AdminAnalytics() {
  const [days, setDays] = useState(30),
        [data, setData] = useState(null),
        [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    const load = async () => {
      try {
        const result = await api(`/admin/analytics?days=${days}`);
        if (live) {
          setData(result);
          setError('');
        }
      } catch (e) {
        if (live) setError(e.message);
      }
    };
    setData(null);
    load();
    const stop = startPolling(load, { interval: 30000 });
    return () => {
      live = false;
      stop();
    };
  }, [days]);

  const maximum = Math.max(1, ...(data?.listings_by_day || []).map(x => x.listings));

  return (
    <section className="analytics-panel" aria-label="Live platform analytics">
      <div className="analytics-heading">
        <div>
          <span className="eyebrow">LIVE DATABASE RESULTS</span>
          <h2>Platform outcomes</h2>
          <p className="muted">
            {data
              ? `New listings: ${data.range.from} to ${data.range.to} · Updated ${formatDateTime(data.generated_at)}`
              : 'Loading live results…'}
          </p>
          <p className="muted">
            Date range applies to new listings only. Other charts show current totals. Refreshes every 30 seconds.
          </p>
        </div>
        <div className="range-buttons">
          {[7, 30, 90].map(n => (
            <button
              key={n}
              aria-pressed={days === n}
              className={days === n ? 'selected' : ''}
              onClick={() => setDays(n)}
            >
              {n} days
            </button>
          ))}
        </div>
      </div>
      {error && <p role="alert" className="notice">{error}</p>}
      {data && (
        <div className="analytics-grid">
          <article className="chart-card chart-wide">
            <h3>New listings by day</h3>
            <p className="muted">Scroll horizontally to see every date.</p>
            <div className="daily-chart">
              {data.listings_by_day.map(item => (
                <div className="daily-column" key={item.day}>
                  <div className="daily-value">{item.listings}</div>
                  <div className="daily-track">
                    <i style={{ height: `${item.listings / maximum * 100}%` }} />
                  </div>
                  <time>{item.day}</time>
                </div>
              ))}
            </div>
          </article>
          <article className="chart-card">
            <h3>Homes & flatmate outcomes</h3>
            <Bars
              items={[
                { label: 'Homes rented out', value: data.success_outcomes.rented_homes },
                { label: 'People with a mutual flatmate match', value: data.success_outcomes.matched_people }
              ]}
            />
            <p className="muted">
              Homes: current Filled status, not demo payments. People: active flatmate users counted once across mutually agreed pairs.
            </p>
          </article>
          <article className="chart-card">
            <h3>Report outcomes</h3>
            <Bars
              items={[
                { label: 'Total reports', value: data.report_outcomes.total },
                { label: 'Listing reports upheld', value: data.report_outcomes.listing_upheld },
                { label: 'User reports upheld', value: data.report_outcomes.user_upheld }
              ]}
            />
            <p className="muted">
              Upheld reports record a listing takedown or account deactivation. Includes chat-user reports; excludes legacy review-only records.
            </p>
          </article>
          <article className="chart-card">
            <h3>Listing availability</h3>
            <Bars items={data.listing_statuses} />
          </article>
          <article className="chart-card needs-summary">
            <h3>What students need</h3>
            <Bars items={data.student_needs} />
          </article>
          <article className="chart-card">
            <h3>Enquiry outcomes</h3>
            <Bars items={data.enquiry_outcomes} />
          </article>
        </div>
      )}
    </section>
  );
}