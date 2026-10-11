const test=require('node:test');
const assert=require('node:assert/strict');

test('flatmate location endpoint binds both filters and rejects malformed input without a database',async()=>{
  const express=require('express');
  const jwt=require('jsonwebtoken');
  const {pool}=require('../src/config/database');
  const originalQuery=pool.query,originalSecret=process.env.JWT_SECRET;
  process.env.JWT_SECRET='isolated-location-test-only';
  const queries=[];
  pool.query=async(sql,values)=>{
    if(sql.startsWith('SELECT user_id,role'))return {rows:[{user_id:1,role:'student',student_type:'flatmate',is_active:true}]};
    if(sql.startsWith('SELECT * FROM profiles'))return {rows:[]};
    if(sql.includes('LEFT JOIN saved_flatmate')){queries.push({sql,values});return {rows:[]};}
    throw new Error('Unexpected test query');
  };
  const app=express();app.use(require('../src/routes/communityRoutes'));
  app.use(require('../src/middleware/errorHandler').errorHandler);
  let server;
  try{
    server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
    const token=jwt.sign({userId:1},process.env.JWT_SECRET);
    const call=async query=>{
      const result=await fetch(`http://127.0.0.1:${server.address().port}/matches?${query}`,{headers:{Authorization:`Bearer ${token}`}});
      return {status:result.status,data:await result.json()};
    };
    const result=await call('city=Wellington&suburb=Kelburn');
    assert.equal(result.status,200,JSON.stringify(result.data));
    assert.deepEqual(queries.at(-1).values.slice(-2),['Wellington','Kelburn']);
    assert.ok(queries.at(-1).sql.includes("position(lower($10)"));
    assert.ok(queries.at(-1).sql.includes("position(lower($11)"));
    assert.equal((await call('')).status,200);
    assert.deepEqual(queries.at(-1).values.slice(-2),['','']);
    const count=queries.length;
    for(const query of ['suburb=Kelburn','city='+('a'.repeat(121)),'city=Wellington&city=Auckland','city=Wellington&suburb=Kelburn&suburb=Newtown'])assert.equal((await call(query)).status,400,query);
    assert.equal(queries.length,count);
  }finally{
    pool.query=originalQuery;
    if(originalSecret===undefined)delete process.env.JWT_SECRET;else process.env.JWT_SECRET=originalSecret;
    if(server)await new Promise(resolve=>server.close(resolve));
    await pool.end();
  }
});
