import { useEffect, useState } from 'react';

// Explicit year/month/day controls avoid browser-dependent date ordering.
export default function DateInput({ value = '', onChange, name, required, 'aria-label': label = 'Date' }) {
  const normalized = String(value || '').slice(0, 10);
  const [parts, setParts] = useState(() => normalized.split('-'));
  useEffect(() => setParts(normalized.split('-')), [normalized]);
  const [year = '', month = '', day = ''] = parts;
  const currentYear = new Date().getFullYear();
  const firstYear = Math.min(currentYear - 5, Number(year) || currentYear);
  const lastYear = Math.max(currentYear + 15, Number(year) || currentYear);
  const dayCount = year && month ? new Date(Number(year), Number(month), 0).getDate() : 31;
  const change = (index, next) => {
    const updated = [year, month, day];
    updated[index] = next;
    if (updated[0] && updated[1] && updated[2]) {
      const max = new Date(Number(updated[0]), Number(updated[1]), 0).getDate();
      updated[2] = String(Math.min(Number(updated[2]), max)).padStart(2, '0');
    }
    setParts(updated);
    onChange({ target: { name, value: updated.every(Boolean) ? updated.join('-') : '' } });
  };
  return (
    <span className="date-input-ymd" role="group" aria-label={`${label} (year, month, day)`}>
      {[
        ['Year', year, Array.from({ length: lastYear - firstYear + 1 }, (_, i) => String(firstYear + i))],
        ['Month', month, Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'))],
        ['Day', day, Array.from({ length: dayCount }, (_, i) => String(i + 1).padStart(2, '0'))],
      ].map(([title, selected, options], index) => (
        <select key={title} aria-label={`${label}: ${title}`} value={selected} required={required} onChange={(event) => change(index, event.target.value)}>
          <option value="">{title}</option>
          {options.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      ))}
    </span>
  );
}
