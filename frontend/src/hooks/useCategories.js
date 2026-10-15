import { useEffect, useState } from 'react';
import { api } from '../services/api';

// Load administrator-managed category options once for the current page.
export default function useCategories() {
  const [categories, setCategories] = useState([]);
  useEffect(() => {
    let live = true;
    api('/categories')
      .then((data) => {
        if (live) setCategories(data.categories || []);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  // Expose a small selector so forms do not duplicate filtering logic.
  const options = (kind) => categories.filter((item) => item.kind === kind);
  return { categories, options };
}
