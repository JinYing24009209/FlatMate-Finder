import { useEffect, useState } from 'react';
import CategoryFields from '../components/CategoryFields';
import PageHeader from '../components/PageHeader';
import PhotoUploader from '../components/PhotoUploader';
import DateInput from '../components/DateInput';
import { api } from '../services/api';
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
  photos: [],
};
export default function ListingFormPage({ editing, setPage }) {
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
  const [categories,setCategories]=useState([]);
  const [categoriesReady,setCategoriesReady]=useState(false);
  useEffect(()=>{api('/categories').then(d=>{
    setCategories(d.categories);
    setForm(old=>({...old,category_ids:old.category_ids || d.categories.filter(c=>c.kind==='transport'
      ?(old.transport_options||[]).some(n=>n.toLowerCase()===c.name.toLowerCase())
      :Object.keys(old.utilities||{}).some(n=>old.utilities[n]&&n.toLowerCase()===c.name.toLowerCase())).map(c=>c.category_id)}));
    setCategoriesReady(true);
  }).catch(e=>setNotice(`Could not load categories: ${e.message}`));},[]);
  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const payload = () => ({
    ...form,
    bedrooms: 1,
    utilities: {},
    transport_options: [],
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
            <select name="room_type" value={form.room_type} onChange={change}>
              <option>Single room</option>
              <option>Double room</option>
              <option>Shared room</option>
              <option>Studio</option>
            </select>
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
          <label>
            Suburb
            <input name="suburb" value={form.suburb} onChange={change} />
          </label>
          <label>
            City
            <input name="city" required value={form.city} onChange={change} />
          </label>
          <label>
            Available from
            <DateInput
              name="available_from"
              aria-label="Available from"
              required
              value={String(form.available_from || '').slice(0, 10)}
              onChange={change}
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
          <CategoryFields categories={categories} selected={form.category_ids} kind="utility" label="Facilities & utilities included"
            onChange={category_ids=>setForm({...form,category_ids})}/>
          <CategoryFields categories={categories} selected={form.category_ids} kind="transport" label="Transport access"
            onChange={category_ids=>setForm({...form,category_ids})}/>
        </div>
        <PhotoUploader photos={form.photos} onChange={(photos) => setForm({ ...form, photos })} />
      </section>
      <div className="button-row sticky-actions">
        <button className="primary" onClick={save} disabled={busy||!categoriesReady}>
          {busy ? 'Saving photos and details…' : editing ? 'Save changes' : 'Publish listing'}
        </button>
      </div>
      {notice && <p className={notice.startsWith('Could') ? 'error' : 'notice'}>{notice}</p>}
    </main>
  );
}
