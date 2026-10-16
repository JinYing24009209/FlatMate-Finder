import { useState } from 'react';
import PageHeader from '../components/PageHeader';
import PhotoUploader from '../components/PhotoUploader';
import MoveInDateSelect from '../components/MoveInDateSelect';
import LocationFilters from '../components/LocationFilters';
import { CategoryMultiSelect, CategorySelect } from '../components/CategorySelect';
import useCategories from '../hooks/useCategories';
import { api } from '../services/api';

// Provide stable defaults for both create and edit flows.
const blank = {
  title: '',
  description: '',
  rent: '',
  bond: '',
  address: '',
  suburb: '',
  city: 'Auckland',
  room_type: 'Single room',
  bedrooms: 1,
  bathrooms: 1,
  house_rules: '',
  available_from: '',
  status: 'available',
  utilities: {},
  transport_options: [],
  lifestyle_tags: [],
  photos: [],
};
export default function ListingFormPage({ editing, setPage }) {
  // Convert persisted listing data into form-friendly values.
  const initial = editing
    ? {
        ...editing,
        available_from: String(editing.available_from || '').slice(0, 10),
        bedrooms: 1,
        photos: editing.photos || [],
        transport_options: editing.transport_options || [],
      }
    : blank;
  const [form, setForm] = useState(initial);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [transport, setTransport] = useState(initial.transport_options || []);
  const [utilities, setUtilities] = useState(
    Object.keys(initial.utilities || {}).filter((key) => initial.utilities[key])
  );
  const [lifestyle, setLifestyle] = useState(initial.lifestyle_tags || []);
  const { options } = useCategories();
  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  // Rebuild category arrays into the API's expected listing payload.
  const payload = () => ({
    ...form,
    bedrooms: 1,
    utilities: Object.fromEntries(utilities.map((x) => [x, true])),
    transport_options: transport,
    lifestyle_tags: lifestyle,
  });
  const save = async () => {
    setBusy(true);
    setNotice('');
    try {
      const path = editing ? `/listings/${editing.listing_id}` : '/listings';
      const data = await api(path, {
        method: editing ? 'PUT' : 'POST',
        body: JSON.stringify(payload()),
      });
      setNotice(
        `✓ ${data.message} ${form.photos.length} photo${form.photos.length === 1 ? '' : 's'} saved.`
      );
      localStorage.setItem('listings-updated-at', String(Date.now()));
      window.dispatchEvent(new Event('listings-changed'));
      setPage('My listings');
    } catch (e) {
      setNotice(`Could not save: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="content">
      <PageHeader
        title={editing ? 'Edit listing' : 'Create a room listing'}
        subtitle="Each listing represents one available room, so the bedroom count is fixed automatically."
      />
      <section className="form-section">
        <h2>Room essentials</h2>
        <div className="form-grid">
          <label>
            Listing title
            <input name="title" required value={form.title} onChange={change} />
          </label>
          <label>
            Room type
            <CategorySelect
              name="room_type"
              required
              options={options('room_type')}
              value={form.room_type}
              onChange={change}
            />
          </label>
          <label>
            Weekly rent
            <input name="rent" type="number" min="1" required value={form.rent} onChange={change} />
          </label>
          <label>
            Bond
            <input name="bond" type="number" min="0" value={form.bond} onChange={change} />
          </label>
          <label>
            Bathroom access
            <select name="bathrooms" value={form.bathrooms} onChange={change}>
              <option value="1">1 bathroom</option>
              <option value="1.5">1.5 bathrooms</option>
              <option value="2">2 bathrooms</option>
              <option value="2.5">2.5 bathrooms</option>
              <option value="3">3 bathrooms</option>
            </select>
          </label>
        </div>
      </section>
      <section className="form-section">
        <h2>Location & availability</h2>
        <div className="form-grid">
          <label>
            Street address
            <input name="address" required value={form.address} onChange={change} />
          </label>
          <LocationFilters
            showLabels
            cityLabel="City"
            suburbLabel="Suburb"
            city={form.city}
            suburb={form.suburb}
            onChange={({ city, suburb }) => setForm({ ...form, city, suburb })}
          />
          <label>
            Available from
            <MoveInDateSelect
              label="Available from"
              allowFlexible={false}
              value={String(form.available_from || '').slice(0, 10)}
              onChange={(value) => setForm({ ...form, available_from: value })}
            />
          </label>
          <label>
            Listing status
            <select name="status" value={form.status} onChange={change}>
              <option value="available">Available</option>
              <option value="shortlisted">Shortlisted</option>
              <option value="filled">Filled</option>
              <option value="closed">Closed</option>
            </select>
          </label>
        </div>
      </section>
      <section className="form-section">
        <h2>Life in the flat</h2>
        <label>
          Description
          <textarea
            name="description"
            value={form.description || ''}
            onChange={change}
            placeholder="Describe the room, current flatmates, atmosphere and nearby essentials…"
          />
        </label>
        <div className="form-grid">
          <label>
            House rules
            <textarea name="house_rules" value={form.house_rules || ''} onChange={change} />
          </label>
          <label>
            Facilities & utilities included
            <CategoryMultiSelect
              label="Facilities and utilities"
              options={options('utility')}
              value={utilities}
              onChange={setUtilities}
            />
          </label>
          <label>
            Transport access
            <CategoryMultiSelect
              label="Transport access"
              options={options('transport')}
              value={transport}
              onChange={setTransport}
            />
          </label>
          <label>
            Life in the flat
            <CategoryMultiSelect
              label="Life in the flat"
              options={options('listing_lifestyle')}
              value={lifestyle}
              onChange={setLifestyle}
            />
          </label>
        </div>
        <PhotoUploader photos={form.photos} onChange={(photos) => setForm({ ...form, photos })} />
      </section>
      <div className="button-row sticky-actions">
        <button className="primary" onClick={save} disabled={busy}>
          {busy ? 'Saving photos and details…' : editing ? 'Save changes' : 'Publish listing'}
        </button>
      </div>
      {notice && <p className={notice.startsWith('Could') ? 'error' : 'notice'}>{notice}</p>}
    </main>
  );
}
