const v = require('./validation');
function listingFilters(query = {}) {
  const minRent = v.number(query.minRent, 'Minimum rent', 0);
  const maxRent = v.number(query.maxRent, 'Maximum rent', null);
  if (maxRent !== null && minRent > maxRent)
    throw v.invalid('Minimum rent cannot exceed maximum rent.');
  return { minRent, maxRent };
}
function searchFilters(query = {}) {
  return { ...listingFilters(query), q: v.text(query.q, 'Search text', 1000),
    city: v.text(query.city, 'City', 120), roomType: v.roomType(query.roomType),
    availableFrom: v.date(query.availableFrom, 'Available date') };
}
module.exports = { listingFilters, searchFilters };
