import '../styles/community.css';

export default function CategoryFields({
  categories,
  selected = [],
  onChange,
  kind,
  label
}) {
  const options = categories.filter(
    c => c.kind === kind && (c.is_active || selected.includes(c.category_id))
  );

  return (
    <fieldset className="category-options">
      <legend>{label}</legend>
      {options.length ? (
        options.map(c => (
          <label key={c.category_id}>
            <input
              type="checkbox"
              checked={selected.includes(c.category_id)}
              disabled={!c.is_active && !selected.includes(c.category_id)}
              onChange={e =>
                onChange(
                  e.target.checked
                    ? [...selected, c.category_id]
                    : selected.filter(id => id !== c.category_id)
                )
              }
            />
            <span>
              {c.name}
              {!c.is_active ? ' (retired; existing selection only)' : ''}
            </span>
          </label>
        ))
      ) : (
        <p className="muted">No active options available.</p>
      )}
    </fieldset>
  );
}