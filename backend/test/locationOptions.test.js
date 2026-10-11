const test=require('node:test');
const assert=require('node:assert/strict');
const cities=require('../../shared/nzCities.json');
const suburbs=require('../../shared/nzSuburbs.json');

test('every supported city has nonempty, unique area options',()=>{
  assert.deepEqual(Object.keys(suburbs).sort(),[...cities].sort());
  for(const city of cities){
    assert.ok(suburbs[city].length>0,city);
    assert.equal(new Set(suburbs[city].map(s=>s.toLowerCase())).size,suburbs[city].length,city);
    for(const name of suburbs[city])assert.ok(typeof name==='string'&&name.trim()===name&&name.length<=120);
  }
});
