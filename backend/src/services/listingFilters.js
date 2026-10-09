const v = require('./validation');
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
    transport:keywords(query.transport,'Transport'),utilities:keywords(query.utilities,'Facilities'),
    lifestyle:keywords(query.lifestyle) };
}
// Every phrase must match literally; wildcard characters have no special meaning.
function extraListingConditions(start=7) {
  return `AND NOT EXISTS (SELECT 1 FROM unnest($${start}::text[]) phrase
      WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements_text(l.transport_options) item WHERE position(phrase in lower(item))>0))
    AND NOT EXISTS (SELECT 1 FROM unnest($${start+1}::text[]) phrase
      WHERE NOT EXISTS(SELECT 1 FROM jsonb_each(l.utilities) item WHERE item.value='true'::jsonb AND position(phrase in lower(item.key))>0))
    AND NOT EXISTS(SELECT 1 FROM unnest($${start+2}::text[]) preference
      WHERE position(lower(preference) in lower(COALESCE(l.description,'') || ' ' || COALESCE(l.house_rules,'')))=0)`;
}
module.exports = { listingFilters, searchFilters, keywords, extraListingConditions };
