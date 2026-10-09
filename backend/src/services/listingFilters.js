const v = require('./validation');
const {categoryIds}=require('./categoryService');
function keywords(value,name='Lifestyle preferences') {
  if(value==null||value==='')return [];
  const items=typeof value==='string'?value.split(',').map(x=>x.trim()).filter(Boolean):value;
  return [...new Set(v.strings(items,name,10,80).map(x=>x.toLowerCase()))];
}
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
    availableFrom: v.date(query.availableFrom, 'Available date'),
    transportIds:categoryIds(query.transportIds,'Transport IDs'),utilityIds:categoryIds(query.utilityIds,'Utility IDs'),
    lifestyle:keywords(query.lifestyle) };
}
// Every selected category/keyword must match. Stable IDs, never fuzzy category names.
function extraListingConditions(start=7) {
  return `AND NOT EXISTS (SELECT 1 FROM unnest($${start}::int[]) requested(id)
    WHERE NOT EXISTS(SELECT 1 FROM listing_category_link x JOIN listing_category c USING(category_id)
      WHERE x.listing_id=l.listing_id AND c.category_id=requested.id AND c.kind='transport' AND c.is_active))
    AND NOT EXISTS (SELECT 1 FROM unnest($${start+1}::int[]) requested(id)
    WHERE NOT EXISTS(SELECT 1 FROM listing_category_link x JOIN listing_category c USING(category_id)
      WHERE x.listing_id=l.listing_id AND c.category_id=requested.id AND c.kind='utility' AND c.is_active))
    AND NOT EXISTS(SELECT 1 FROM unnest($${start+2}::text[]) preference
      WHERE position(lower(preference) in lower(COALESCE(l.description,'') || ' ' || COALESCE(l.house_rules,'')))=0)`;
}
module.exports = { listingFilters, searchFilters, keywords, extraListingConditions };
