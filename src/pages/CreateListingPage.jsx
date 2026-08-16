import React, { useState } from 'react';
import ListingForm from '../components/listings/ListingForm';
import { createListing } from '../api/listingApi';

const CreateListingPage = () => {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  const handleFormSubmit = async (data) => {
    setLoading(true);
    setMessage(null);
    try {
      const response = await createListing(data);
      setMessage({ type: 'success', text: 'Listing published successfully!' });
      console.log('Server response:', response);
    } catch (error) {
      setMessage({
        type: 'error',
        text: 'Failed to publish: ' + (error.message || 'Server connection failed')
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative">
      {message && (
        <div
          className={`p-4 text-xs text-center font-medium ${
            message.type === 'success' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
          }`}
        >
          {message.text}
        </div>
      )}
      
      {loading && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
          <div className="bg-white px-6 py-4 rounded-lg shadow-lg text-sm font-semibold text-gray-700">
            Publishing listing...
          </div>
        </div>
      )}

      <ListingForm onSubmit={handleFormSubmit} />
    </div>
  );
};

export default CreateListingPage;