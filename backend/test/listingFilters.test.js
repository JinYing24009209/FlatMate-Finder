const test = require('node:test');
const assert = require('node:assert/strict');
const { listingFilters } = require('../src/services/listingFilters');
test('blank browser rent filters do not restrict available listings to zero rent', () => {
  assert.deepEqual(listingFilters({ minRent: '', maxRent: '' }), { minRent: 0, maxRent: null });
  assert.deepEqual(listingFilters({}), { minRent: 0, maxRent: null });
});
test('an explicit zero maximum is preserved and valid ranges are parsed', () => {
  assert.equal(listingFilters({ maxRent: '0' }).maxRent, 0);
  assert.deepEqual(listingFilters({ minRent: '150', maxRent: '300' }), {
    minRent: 150,
    maxRent: 300,
  });
});
test('invalid or reversed rent ranges are rejected', () => {
  for (const query of [
    { minRent: 'oops' },
    { maxRent: '-1' },
    { maxRent: 'Infinity' },
    { minRent: '300', maxRent: '100' },
  ])
    assert.throws(() => listingFilters(query));
});
