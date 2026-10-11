const test = require('node:test');
const assert = require('node:assert/strict');
const v = require('../src/services/validation');
const { searchFilters } = require('../src/services/listingFilters');
const { createBudget } = require('../src/services/aiBudget');
const { createAiRateLimit } = require('../src/middleware/aiRateLimit');

const listing = {
  title: 'Room',
  rent: 200,
  address: 'Test address',
  city: 'Auckland',
  room_type: 'Single room',
  available_from: '2026-10-10'
};

test('shared filters reject invalid types, negatives, dates and room types with 400', () => {
  for (const input of [
    { minRent: [] },
    { maxRent: true },
    { minRent: '-1' },
    { maxRent: 'NaN' },
    { minRent: 5, maxRent: 0 },
    { availableFrom: '2026-02-30' },
    { roomType: 'Castle' },
    { q: { bad: 1 } }
  ])
    assert.throws(() => searchFilters(input), { status: 400 });

  assert.equal(searchFilters({ maxRent: '0' }).maxRent, 0);
  assert.equal(searchFilters({ maxRent: ' ' }).maxRent, null);
  assert.equal(searchFilters({ roomType: 'single room' }).roomType, 'Single room');
});

test('create/edit validation rejects bad amounts, lengths, dates, arrays and image data', () => {
  for (const patch of [
    { rent: 0 },
    { rent: 1.234 },
    { bond: -1 },
    { title: 'x'.repeat(181) },
    { available_from: '2026-13-10' },
    { photos: Array(6).fill('/photos/a.jpg') },
    { photos: ['data:image/png;base64,YWJjZA=='] },
    { photos: [42] },
    { bedrooms: true },
    { transport_options: 'bus' },
    { utilities: { water: 'yes' } }
  ])
    assert.throws(() => v.listing({ ...listing, ...patch }), { status: 400 });

  assert.deepEqual(
    v.listing({ ...listing, photos: ['/photos/b.jpg', '/photos/a.jpg'] }).photos,
    ['/photos/b.jpg', '/photos/a.jpg']
  );
});

test('profile preserves zero and rejects invalid types, booleans and oversized photos', () => {
  assert.equal(v.profile({ budget_min: 0, budget_max: 0 }).budget_max, 0);

  for (const input of [
    { budget_min: 1, budget_max: 0 },
    { visible_for_matching: 'false' },
    { about_me: [] },
    { lifestyle_tags: [42] },
    { move_in_date: '2026-02-29' },
    { profile_photo: 'data:image/png;base64,' + 'A'.repeat(1333340) }
  ])
    assert.throws(() => v.profile(input), { status: 400 });
});

test('AI quota enforces concurrency, attempts and daily reset', () => {
  let clock = 0;
  const acquire = createBudget({
    daily: 2,
    perMinute: 1,
    concurrency: 1,
    now: () => clock
  });

  const release = acquire();
  assert.throws(acquire);
  release();
  release();
  assert.throws(acquire);

  clock = 60000;
  acquire()();
  clock = 120000;
  assert.throws(acquire);

  clock = 86400000;
  acquire()();
});

test('profile stores explicit flexibility and structured location without overwriting legacy text', () => {
  const flexible = v.profile({
    move_in_flexible: true,
    move_in_date: '2026-10-10',
    preferred_city: 'Wellington',
    preferred_suburb: 'Kelburn'
  });

  assert.equal(flexible.move_in_date, null);
  assert.equal(flexible.move_in_flexible, true);
  assert.equal(flexible.preferred_location, 'Kelburn, Wellington');
  assert.equal(v.profile({}).move_in_flexible, false);
  assert.equal(
    v.profile({
      preferred_location: 'Near campus',
      preferred_city: null,
      preferred_suburb: null
    }).preferred_location,
    'Near campus'
  );

  for (const input of [
    { move_in_flexible: 'true' },
    { move_in_date: '2026-10' },
    { move_in_date: '2026-02-30' },
    { preferred_suburb: 'Kelburn' },
    { preferred_city: 'Invalid city' },
    { preferred_city: 'Wellington', preferred_suburb: [] },
    { preferred_city: 'Wellington', preferred_suburb: 'a'.repeat(121) }
  ])
    assert.throws(() => v.profile(input), { status: 400 });
});

test('AI HTTP rate limit returns 429 and Retry-After, then resets', () => {
  let clock = 0,
    next = 0;

  const limit = createAiRateLimit({
    limit: 1,
    windowMs: 1000,
    now: () => clock
  });

  const res = {
    set(k, v) {
      this[k] = v;
    },
    status(v) {
      this.code = v;
      return this;
    },
    json(v) {
      this.body = v;
    }
  };

  limit({ ip: 'test' }, res, () => next++);
  limit({ ip: 'test' }, res, () => next++);
  assert.equal(next, 1);
  assert.equal(res.code, 429);
  assert.equal(res['Retry-After'], '1');

  clock = 1000;
  limit({ ip: 'test' }, res, () => next++);
  assert.equal(next, 2);
});