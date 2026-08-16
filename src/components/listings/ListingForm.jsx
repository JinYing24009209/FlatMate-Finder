import React, { useState, useRef } from 'react';

const ListingForm = ({ onSubmit }) => {
  const [formData, setFormData] = useState({
    title: '',
    weeklyRent: '',
    bond: '',
    roomType: 'Single',
    availableFrom: '',
    address: '',
    suburb: '',
    description: '',
    houseRules: '',
    amenities: ['Wifi', 'Laundry', 'Parking'],
    transport: ['Bus route'],
    status: 'Available'
  });

  const [photos, setPhotos] = useState([]);
  const [newAmenity, setNewAmenity] = useState('');
  const [newTransport, setNewTransport] = useState('');

  const fileInputRef = useRef(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAddAmenity = () => {
    if (newAmenity.trim() !== '' && !formData.amenities.includes(newAmenity.trim())) {
      setFormData(prev => ({ ...prev, amenities: [...prev.amenities, newAmenity.trim()] }));
      setNewAmenity('');
    }
  };

  const handleRemoveAmenity = (indexToRemove) => {
    setFormData(prev => ({
      ...prev,
      amenities: prev.amenities.filter((_, index) => index !== indexToRemove)
    }));
  };

  const handleAddTransport = () => {
    if (newTransport.trim() !== '' && !formData.transport.includes(newTransport.trim())) {
      setFormData(prev => ({ ...prev, transport: [...prev.transport, newTransport.trim()] }));
      setNewTransport('');
    }
  };

  const handleRemoveTransport = (indexToRemove) => {
    setFormData(prev => ({
      ...prev,
      transport: prev.transport.filter((_, index) => index !== indexToRemove)
    }));
  };

  const handlePhotoUpload = (e) => {
    const files = Array.from(e.target.files);
    const newPhotoUrls = files.map(file => URL.createObjectURL(file));
    setPhotos(prev => [...prev, ...newPhotoUrls]);
  };

  const handleRemovePhoto = (indexToRemove) => {
    setPhotos(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({ ...formData, photos });
  };

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6 bg-gray-50 min-h-screen">
      <div className="lg:col-span-2 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <span className="text-xs text-gray-500 uppercase tracking-wide">Step 1 of 1 — Draft saves automatically</span>
            <h1 className="text-2xl font-bold text-gray-800">Publish a room listing</h1>
          </div>
        </div>

        <section className="bg-white p-5 rounded-lg border border-gray-200 space-y-4">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Basics</h2>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Listing title</label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="e.g. Sunny single room, Albany"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-600"
              required
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Weekly rent (NZD)</label>
              <input
                type="number"
                name="weeklyRent"
                value={formData.weeklyRent}
                onChange={handleChange}
                placeholder="255"
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-600"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Bond (NZD)</label>
              <input
                type="number"
                name="bond"
                value={formData.bond}
                onChange={handleChange}
                placeholder="1020"
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Room type</label>
              <select
                name="roomType"
                value={formData.roomType}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-600"
              >
                <option value="Single">Single</option>
                <option value="Double">Double</option>
                <option value="Ensuite">Ensuite</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Available from</label>
            <input
              type="date"
              name="availableFrom"
              value={formData.availableFrom}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-600"
            />
          </div>
        </section>

        <section className="bg-white p-5 rounded-lg border border-gray-200 space-y-4">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Location</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Address</label>
              <input
                type="text"
                name="address"
                value={formData.address}
                onChange={handleChange}
                placeholder="14 Sunrise Terrace"
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Suburb</label>
              <input
                type="text"
                name="suburb"
                value={formData.suburb}
                onChange={handleChange}
                placeholder="Albany"
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-600"
              />
            </div>
          </div>
          <div className="h-36 bg-emerald-50/50 rounded border border-dashed border-emerald-300 flex flex-col items-center justify-center text-xs text-emerald-800 p-4">
            <span className="font-semibold mb-1">📍 Map Location Preview</span>
            <span className="text-gray-500">
              {formData.address || formData.suburb
                ? `${formData.address} ${formData.suburb}`
                : 'Enter address above to pin location'}
            </span>
          </div>
        </section>

        <section className="bg-white p-5 rounded-lg border border-gray-200 space-y-4">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Description & Rules</h2>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Flat description</label>
            <textarea
              name="description"
              rows="4"
              value={formData.description}
              onChange={handleChange}
              placeholder="Fully furnished single room in a quiet 3-bedroom flat..."
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-600"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">House rules</label>
            <input
              type="text"
              name="houseRules"
              value={formData.houseRules}
              onChange={handleChange}
              placeholder="No smoking indoors, quiet hours after 10pm"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-600"
            />
          </div>
        </section>

        <section className="bg-white p-5 rounded-lg border border-gray-200 space-y-4">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Amenities & Transport</h2>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2">Amenities</label>
            <div className="flex flex-wrap gap-2 items-center">
              {formData.amenities.map((item, index) => (
                <span key={index} className="bg-emerald-50 text-emerald-700 text-xs px-2.5 py-1 rounded-full border border-emerald-200 flex items-center gap-1.5">
                  ✓ {item}
                  <button type="button" onClick={() => handleRemoveAmenity(index)} className="text-emerald-500 hover:text-emerald-900 font-bold ml-1">
                    ×
                  </button>
                </span>
              ))}
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={newAmenity}
                  onChange={(e) => setNewAmenity(e.target.value)}
                  placeholder="Add amenity"
                  className="border border-gray-300 rounded-full px-3 py-1 text-xs focus:outline-none"
                />
                <button type="button" onClick={handleAddAmenity} className="text-xs bg-emerald-700 text-white px-2.5 py-1 rounded-full hover:bg-emerald-800">
                  +
                </button>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2">Transport Options</label>
            <div className="flex flex-wrap gap-2 items-center">
              {formData.transport.map((item, index) => (
                <span key={index} className="bg-emerald-50 text-emerald-700 text-xs px-2.5 py-1 rounded-full border border-emerald-200 flex items-center gap-1.5">
                  ✓ {item}
                  <button type="button" onClick={() => handleRemoveTransport(index)} className="text-emerald-500 hover:text-emerald-900 font-bold ml-1">
                    ×
                  </button>
                </span>
              ))}
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={newTransport}
                  onChange={(e) => setNewTransport(e.target.value)}
                  placeholder="Add transport option"
                  className="border border-gray-300 rounded-full px-3 py-1 text-xs focus:outline-none"
                />
                <button type="button" onClick={handleAddTransport} className="text-xs bg-emerald-700 text-white px-2.5 py-1 rounded-full hover:bg-emerald-800">
                  +
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white p-5 rounded-lg border border-gray-200 space-y-4">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Photos</h2>
          
          <input
            type="file"
            multiple
            accept="image/*"
            ref={fileInputRef}
            onChange={handlePhotoUpload}
            className="hidden"
          />

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div
              onClick={() => fileInputRef.current.click()}
              className="h-28 bg-amber-50/60 hover:bg-amber-100/60 rounded border border-dashed border-amber-300 flex flex-col items-center justify-center text-xs text-amber-800 cursor-pointer transition-colors"
            >
              <span className="text-lg font-bold">+</span>
              <span>Add Photo</span>
            </div>

            {photos.map((url, index) => (
              <div key={index} className="relative h-28 rounded overflow-hidden border border-gray-200 group">
                <img src={url} alt={`Upload ${index}`} className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => handleRemovePhoto(index)}
                  className="absolute top-1 right-1 bg-black/60 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs hover:bg-red-600 transition-colors"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="space-y-6">
        <div className="flex justify-end gap-2">
          <button type="button" className="px-4 py-2 border border-gray-300 rounded text-xs text-gray-700 bg-white hover:bg-gray-50">
            Save draft
          </button>
          <button type="submit" className="px-4 py-2 bg-emerald-800 text-white rounded text-xs hover:bg-emerald-900">
            Publish listing
          </button>
        </div>

        <div className="bg-white p-4 rounded-lg border border-gray-200 space-y-2">
          <label className="block text-xs font-semibold text-gray-700">Status</label>
          <select
            name="status"
            value={formData.status}
            onChange={handleChange}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none"
          >
            <option value="Available">Available</option>
            <option value="Draft">Draft</option>
            <option value="Closed">Closed</option>
          </select>
        </div>

        <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg space-y-1">
          <h3 className="text-xs font-bold text-amber-900 tracking-wider uppercase">AI Safety Check</h3>
          <p className="text-xs text-amber-800 leading-relaxed">
            Listing looks complete — rent, bond, address and photos are all present. Flagged listings are queued for admin review before going live.
          </p>
        </div>
      </div>
    </form>
  );
};

export default ListingForm;