function invalid(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

function object(value, name = 'Body') {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw invalid(`${name} must be an object.`);
  return value;
}

function text(value, name, max, required = false) {
  if (value == null && !required) return '';
  if (typeof value !== 'string')
    throw invalid(`${name} must be text.`);
  const result = value.trim();
  if ((required && !result) || value.length > max)
    throw invalid(`${name} must be ${required ? '1' : '0'}-${max} characters.`);
  return result;
}

function number(value, name, fallback = null, min = 0, max = 10000000) {
  if (value == null || (typeof value === 'string' && !value.trim())) return fallback;
  if (!['string', 'number'].includes(typeof value) ||
      (typeof value === 'string' && !/^\d+(?:\.\d+)?$/.test(value.trim())))
    throw invalid(`${name} must be a non-negative decimal number.`);
  const result = Number(value);
  if (!Number.isFinite(result) || result < min || result > max)
    throw invalid(`${name} must be between ${min} and ${max}.`);
  return result;
}

function date(value, name, required = false) {
  const result = text(value, name, 10, required);
  if (!result && !required) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result) || Number(result.slice(0, 4)) < 1900 ||
      !Number.isFinite(Date.parse(result)) || new Date(result).toISOString().slice(0, 10) !== result)
    throw invalid(`${name} must be a valid date in YYYY-MM-DD format.`);
  return result;
}

const roomTypes = [
  'Single room',
  'Double room',
  'Shared room',
  'Studio'
];

function roomType(value, required = false) {
  const result = text(value, 'Room type', 80, required);
  if (!result && !required) return '';
  const canonical = roomTypes.find((item) => item.toLowerCase() === result.toLowerCase());
  if (!canonical)
    throw invalid('Choose Single room, Double room, Shared room or Studio.');
  return canonical;
}

function strings(value, name, count, length) {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > count)
    throw invalid(`${name} must be an array with at most ${count} items.`);
  return value.map((item) => text(item, name, length, true));
}

function boolean(value, name, fallback = true) {
  if (value == null) return fallback;
  if (typeof value !== 'boolean')
    throw invalid(`${name} must be true or false.`);
  return value;
}

function photo(value, profile = false) {
  if (typeof value !== 'string') throw invalid('Photo must be a string.');
  if (!profile && ( /^\/photos\/[\w.-]+$/.test(value) || /^https?:\/\//.test(value))) {
    if (value.length > 2048) throw invalid('Photo URL is too long.');
    if (!value.startsWith('/')) {
      try {
        new URL(value);
      } catch {
        throw invalid('Invalid photo URL.');
      }
    }
    return value;
  }
  const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match || match[2].length % 4 !== 0 || Buffer.from(match[2], 'base64').length > 1000000)
    throw invalid('Photos must be JPEG, PNG or WebP data below 1 MB.');
  const bytes = Buffer.from(match[2], 'base64');
  const validHeader = match[1] === 'png'
    ? bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
    : match[1] === 'jpeg'
      ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
      : bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
  if (!validHeader) throw invalid('Photo contents do not match the declared image type.');
  return value;
}

function listing(input) {
  object(input);
  const d = { ...input };
  for (const [key, max, required] of [
    ['title',180,true],
    ['description',10000,false],
    ['address',255,true],
    ['suburb',120,false],
    ['city',120,true],
    ['house_rules',3000,false]
  ])
    d[key] = text(d[key], key, max, required);
  d.rent = number(d.rent, 'Rent', null, 0.01);
  if (d.rent == null) throw invalid('Rent is required.');
  d.bond = number(d.bond, 'Bond', 0);
  for (const key of ['rent', 'bond'])
    if (Math.abs(d[key] * 100 - Math.round(d[key] * 100)) > 0.00001)
      throw invalid(`${key} allows at most two decimal places.`);
  d.bathrooms = number(d.bathrooms, 'Bathrooms', 1, 0.5, 50);
  if (d.bedrooms != null && number(d.bedrooms, 'Bedrooms') !== 1)
    throw invalid('Each listing represents one bedroom.');
  d.available_from = date(d.available_from, 'Available from', true);
  d.room_type = roomType(d.room_type, true);
  d.status = d.status ?? 'available';
  if (!['available','shortlisted','filled','closed'].includes(d.status))
    throw invalid('Invalid listing status.');
  d.utilities = object(d.utilities ?? {}, 'Utilities');
  if (Object.keys(d.utilities).length > 20)
    throw invalid('At most 20 utilities are allowed.');
  for (const [key, value] of Object.entries(d.utilities)) {
    text(key, 'Utility name', 160, true);
    boolean(value, 'Utility value');
    if (value == null) throw invalid('Utility value must be boolean.');
  }
  d.transport_options = strings(d.transport_options, 'Transport options', 20, 160);
  if (d.photos !== undefined) {
    if (!Array.isArray(d.photos) || d.photos.length > 5)
      throw invalid('Provide at most five photos.');
    d.photos = d.photos.map((value) => photo(value));
  }
  return d;
}

function profile(input) {
  object(input);
  const p = { ...input };
  p.budget_min = number(p.budget_min, 'Minimum budget');
  p.budget_max = number(p.budget_max, 'Maximum budget');
  if (p.budget_min != null && p.budget_max != null && p.budget_min > p.budget_max)
    throw invalid('Minimum budget cannot exceed maximum budget.');
  for (const [key,max] of [
    ['preferred_location',160],
    ['study_habits',160],
    ['contact_preference',80],
    ['advertiser_bio',500],
    ['about_me',1000]
  ])
    p[key] = text(p[key], key, max);
  p.lifestyle_tags = strings(p.lifestyle_tags, 'Lifestyle tags', 20, 80);
  p.move_in_date = date(p.move_in_date, 'Move-in date');
  p.move_in_flexible = boolean(p.move_in_flexible, 'Flexible move-in date', false);
  if(p.move_in_flexible) p.move_in_date = null;
  if(input.preferred_city != null || input.preferred_suburb != null) {
    p.preferred_city = text(p.preferred_city, 'Preferred city', 120);
    p.preferred_suburb = text(p.preferred_suburb, 'Preferred area', 120);
    if(p.preferred_suburb && !p.preferred_city)throw invalid('Choose a city before choosing an area.');
    if(p.preferred_city && !require('../../../shared/nzCities.json').includes(p.preferred_city))throw invalid('Choose a supported New Zealand city or town.');
    p.preferred_location = text(
      [p.preferred_suburb,p.preferred_city].filter(Boolean).join(', '),
      'Preferred location',
      160
    );
  }
  p.visible_for_matching = boolean(p.visible_for_matching, 'Matching visibility');
  p.display_phone = boolean(p.display_phone, 'Phone visibility');
  p.profile_photo = p.profile_photo == null || p.profile_photo === '' ? null : photo(p.profile_photo, true);
  return p;
}

module.exports = {
  invalid,
  object,
  text,
  number,
  date,
  roomType,
  strings,
  boolean,
  photo,
  listing,
  profile
};