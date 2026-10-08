import { useState } from 'react';
export default function ProfilePhoto({ src, name = 'Student', className = '' }) {
  const [failed, setFailed] = useState(null);
  return src && failed !== src ? (
    <img
      className={`profile-portrait ${className}`}
      src={src}
      alt={`${name}'s profile`}
      onError={() => setFailed(src)}
    />
  ) : (
    <div
      className={`profile-portrait portrait-placeholder ${className}`}
      role="img"
      aria-label={`${name}: no profile photo`}
    >
      <span>{name.slice(0, 1).toUpperCase()}</span>
      <small>Photo not added yet</small>
    </div>
  );
}
