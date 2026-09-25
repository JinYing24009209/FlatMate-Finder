import { useState } from 'react';
export default function PhotoUploader({ photos = [], onChange }) {
  const [error, setError] = useState('');
  const addFiles = async (event) => {
    const files = [...event.target.files].slice(0, 5 - photos.length);
    try {
      const values = await Promise.all(
        files.map(
          (file) =>
            new Promise((resolve, reject) => {
              if (!file.type.startsWith('image/'))
                return reject(new Error('Please choose image files only.'));
              if (file.size > 1000000)
                return reject(new Error('Each image must be below 1 MB for this coursework demo.'));
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result);
              reader.onerror = reject;
              reader.readAsDataURL(file);
            })
        )
      );
      onChange([...photos, ...values]);
      setError('');
    } catch (e) {
      setError(e.message);
    }
  };
  return (
    <section className="photo-uploader">
      <label>
        Property photos (up to 5)
        <input type="file" accept="image/*" multiple onChange={addFiles} />
      </label>
      <p className="muted">
        Choose real photos from your device. They are stored with the listing.
      </p>
      <div className="thumbs">
        {photos.map((photo, index) => (
          <div key={photo} className="thumb">
            <img src={photo} alt={`Property ${index + 1}`} />
            <button type="button" onClick={() => onChange(photos.filter((_, i) => i !== index))}>
              ×
            </button>
          </div>
        ))}
      </div>
      {error && <p className="error">{error}</p>}
    </section>
  );
}
