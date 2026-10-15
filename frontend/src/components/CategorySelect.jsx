import { useEffect, useId, useRef, useState } from 'react';
import useCategories from '../hooks/useCategories';

export function CategorySelect({
  kind,
  value,
  onChange,
  placeholder = 'Any',
  options: provided,
  name,
  required = false,
  ...props
}) {
  const remote = useCategories();
  const options = provided || remote.options(kind);
  return (
    <select {...props} name={name} required={required} value={value || ''} onChange={onChange}>
      {!required && <option value="">{placeholder}</option>}
      {value && !options.some((item) => item.name === value) && (
        <option value={value}>{value} (existing)</option>
      )}
      {options.map((item) => (
        <option key={item.category_id} value={item.name}>
          {item.name}
        </option>
      ))}
    </select>
  );
}

export function CategoryMultiSelect({
  kind,
  value = [],
  onChange,
  label,
  placeholder = 'Any',
  options: provided,
}) {
  const remote = useCategories(),
    options = provided || remote.options(kind);
  const [open, setOpen] = useState(false);
  const root = useRef(null),
    id = useId();
  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (!root.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);
  const selected = Array.isArray(value) ? value : [];
  const choices = [
    ...options,
    ...selected
      .filter((name) => !options.some((item) => item.name === name))
      .map((name) => ({ category_id: `existing-${name}`, name, existing: true })),
  ];
  const toggle = (name) =>
    onChange(
      selected.includes(name) ? selected.filter((item) => item !== name) : [...selected, name]
    );
  const summary = selected.length
    ? selected.length === 1
      ? selected[0]
      : `${selected.length} selected`
    : placeholder;
  return (
    <span
      className="category-picker"
      ref={root}
      onKeyDown={(e) => {
        if (e.key === 'Escape') setOpen(false);
      }}
    >
      <button
        type="button"
        className="category-trigger"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
      >
        <span>{summary}</span>
        <span aria-hidden="true">▾</span>
      </button>
      {open && (
        <span id={id} className="category-popover" role="group" aria-label={label}>
          <span className="category-popover-head">
            <b>{label}</b>
            {selected.length > 0 && (
              <button type="button" onClick={() => onChange([])}>
                Clear
              </button>
            )}
          </span>
          <span className="category-choice-list">
            {choices.map((item) => (
              <label key={item.category_id}>
                <input
                  type="checkbox"
                  checked={selected.includes(item.name)}
                  onChange={() => toggle(item.name)}
                />
                <span>
                  {item.name}
                  {item.existing ? ' (existing)' : ''}
                </span>
              </label>
            ))}
            {!choices.length && <small>No active options</small>}
          </span>
        </span>
      )}
    </span>
  );
}
