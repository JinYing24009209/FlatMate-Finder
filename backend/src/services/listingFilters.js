function listingFilters(query = {}) {
  const number = (value, fallback) => {
    if (value == null || String(value).trim() === '') return fallback;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0)
      throw new Error('Rent must be a non-negative number.');
    return parsed;
  };
  const minRent = number(query.minRent, 0);
  const maxRent = number(query.maxRent, null);
  if (maxRent !== null && minRent > maxRent)
    throw new Error('Minimum rent cannot exceed maximum rent.');
  return { minRent, maxRent };
}
module.exports = { listingFilters };
