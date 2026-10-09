const test = require('node:test');
const assert = require('node:assert/strict');

// Opt-in only. Creates uniquely named fixtures and removes them in finally; no real accounts are edited.
test('security and data-integrity regressions against PostgreSQL', {
  skip: process.env.RUN_DATABASE_TESTS !== '1', timeout: 180000,
}, async (t) => {
  require('dotenv').config({quiet:true});
  const key = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = ''; // Tests must not spend provider quota or send fixture data externally.
  const express = require('express');
  const { pool } = require('../src/config/database');
  const app = express();
  app.use(express.json({limit:'8mb'}));
  app.use(require('cookie-parser')());
  for (const [path, file] of [['/auth','authRoutes'],['/profile','profileRoutes'],
    ['/listings','listingRoutes'],['/admin','adminRoutes'],['/','communityRoutes'],['/','aiRoutes']])
    app.use(path, require('../src/routes/' + file));
  app.use(require('../src/middleware/errorHandler').errorHandler);
  const server = await new Promise(resolve => { const s = app.listen(0,'127.0.0.1',()=>resolve(s)); });
  const base = 'http://127.0.0.1:' + server.address().port;
  const prefix = 'hardening-' + Date.now() + '-' + process.pid;
  const userIds = [];
  async function call(path, method='GET', body, cookie) {
    const r = await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},
      ...(body === undefined ? {} : {body:JSON.stringify(body)})});
    return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};
  }
  async function register(name, role='student', extra={}) {
    const body = {full_name:'Temporary regression account',email:`${prefix}-${name}@example.invalid`,
      password:'Temporary-test-928!',role,student_type:'housing',...extra};
    const result = await call('/auth/register','POST',body);
    if (result.data.user) userIds.push(result.data.user.user_id);
    return {...result,input:body};
  }
  let listingId;
  try {
    const owner = await register('owner','advertiser');
    const student = await register('student');
    const admin = await register('admin','advertiser');
    for (const account of [owner,student,admin]) assert.equal(account.status,201,JSON.stringify(account.data));
    await pool.query("UPDATE users SET role='admin' WHERE user_id=$1",[admin.data.user.user_id]);
    await t.test('current DB role and inactive status override existing JWT claims',async()=>{
      assert.equal((await call('/admin/users','GET',undefined,admin.cookie)).status,200);
      await pool.query('UPDATE users SET is_active=false WHERE user_id=$1',[student.data.user.user_id]);
      const result = await call('/profile/me','GET',undefined,student.cookie);
      assert.equal(result.status,401); assert.equal(result.data.code,'ACCOUNT_INACTIVE');
      await pool.query('UPDATE users SET is_active=true WHERE user_id=$1',[student.data.user.user_id]);
    });
    await pool.query('INSERT INTO admin_invite(code,max_uses) VALUES($1,1)',[prefix]);
    await t.test('duplicate email does not consume an invite; two concurrent registrations cannot exceed one use',async()=>{
      const duplicate = await call('/auth/register','POST',{...student.input,role:'admin',admin_invite_code:prefix});
      assert.equal(duplicate.status,409);
      assert.equal((await pool.query('SELECT used_count FROM admin_invite WHERE code=$1',[prefix])).rows[0].used_count,0);
      const results = await Promise.all([register('invite-a','admin',{admin_invite_code:prefix}),
        register('invite-b','admin',{admin_invite_code:prefix})]);
      assert.deepEqual(results.map(r=>r.status).sort(),[201,403]);
      assert.equal((await pool.query('SELECT used_count FROM admin_invite WHERE code=$1',[prefix])).rows[0].used_count,1);
    });
    const payload = {title:'Regression room',description:'Quiet furnished room.',rent:220,bond:0,
      address:'Fixture only',city:'Auckland',room_type:'Single room',available_from:'2026-10-10',
      photos:['/photos/room2.jpg','/photos/room1.jpg']};
    const created = await call('/listings','POST',payload,owner.cookie);
    assert.equal(created.status,201,JSON.stringify(created.data)); listingId=created.data.listing.listing_id;
    await t.test('create and edit share validation; ordered cover photo is preserved',async()=>{
      for (const method of ['POST','PUT']) assert.equal((await call('/listings'+(method==='PUT'?'/'+listingId:''),method,
        {...payload,rent:-1},owner.cookie)).status,400);
      assert.deepEqual((await call('/listings/'+listingId)).data.listing.photos,payload.photos);
      assert.equal((await call('/profile/me','PUT',{budget_min:0,budget_max:0},student.cookie)).status,200);
      assert.equal(Number((await call('/profile/me','GET',undefined,student.cookie)).data.profile.budget_max),0);
    });
    await t.test('ordinary and smart search reject the same invalid filters and preserve zero',async()=>{
      for (const path of ['/listings','/ai/smart-search']) {
        for (const query of ['minRent=-1','minRent=10&maxRent=0','availableFrom=2026-02-30','roomType=Castle'])
          assert.equal((await call(path+'?'+query)).status,400);
        const zero = await call(path+'?maxRent=0'); assert.equal(zero.status,200); assert.equal(zero.data.listings.length,0);
      }
    });
    await t.test('unavailable listing rejects new enquiries, and status changes update timestamps',async()=>{
      await pool.query("UPDATE listing SET updated_at='2000-01-01' WHERE listing_id=$1",[listingId]);
      const closed=await call('/admin/listings/'+listingId,'PATCH',{status:'closed'},admin.cookie);
      assert.equal(closed.status,200); assert.ok(new Date(closed.data.listing.updated_at).getFullYear()>2000);
      assert.equal((await call(`/listings/${listingId}/enquiries`,'POST',{message:'Hello'},student.cookie)).status,409);
      await call('/admin/listings/'+listingId,'PATCH',{status:'available'},admin.cookie);
    });
    await t.test('a notification failure rolls back enquiry and first message',async(st)=>{
      const connect = pool.connect.bind(pool);
      const mock = st.mock.method(pool,'connect', (...args)=>{
        if (args.length) return connect(...args);
        return connect().then(client=>({release:()=>client.release(), query:(sql,params)=>{
          if (/INSERT INTO notification/i.test(sql)) throw new Error('Injected notification failure');
          return client.query(sql,params);
        }}));
      });
      st.mock.method(console,'error',()=>{});
      try {
        const failed=await call(`/listings/${listingId}/enquiries`,'POST',{message:'Rollback fixture'},student.cookie);
        assert.equal(failed.status,500);
      } finally { mock.mock.restore(); }
      assert.equal((await pool.query('SELECT * FROM enquiry WHERE listing_id=$1',[listingId])).rowCount,0);
    });
    const enquiry = await call(`/listings/${listingId}/enquiries`,'POST',{message:'First message'},student.cookie);
    assert.equal(enquiry.status,201,JSON.stringify(enquiry.data));
    const enquiryId=enquiry.data.enquiry.enquiry_id;
    await t.test('messages and status changes update enquiry activity; existing conversations remain usable after closure',async()=>{
      await call('/admin/listings/'+listingId,'PATCH',{status:'closed'},admin.cookie);
      await pool.query("UPDATE enquiry SET updated_at='2000-01-01' WHERE enquiry_id=$1",[enquiryId]);
      assert.equal((await call(`/enquiries/${enquiryId}/messages`,'POST',{body:'Follow-up'},student.cookie)).status,201);
      assert.ok(new Date((await pool.query('SELECT updated_at FROM enquiry WHERE enquiry_id=$1',[enquiryId])).rows[0].updated_at).getFullYear()>2000);
      await pool.query("UPDATE enquiry SET updated_at='2000-01-01' WHERE enquiry_id=$1",[enquiryId]);
      const status=await call(`/enquiries/${enquiryId}/status`,'PATCH',{status:'accepted'},owner.cookie);
      assert.equal(status.status,200); assert.ok(new Date(status.data.enquiry.updated_at).getFullYear()>2000);
      assert.equal((await pool.query('SELECT * FROM enquiry_message WHERE enquiry_id=$1',[enquiryId])).rowCount,2);
    });
    await t.test('edits rescreen and refresh one pending auto-report rather than duplicate it',async()=>{
      for (let i=0;i<2;i++) {
        const result=await call('/listings/'+listingId,'PUT',{...payload,description:'Pay by wire transfer immediately. Send deposit before viewing.'},owner.cookie);
        assert.equal(result.status,200,JSON.stringify(result.data)); assert.equal(result.data.screening.safe,false);
      }
      const reports=await pool.query("SELECT * FROM report WHERE listing_id=$1 AND reason='AI safety screening' AND status='pending'",[listingId]);
      assert.equal(reports.rowCount,1);
      const id=reports.rows[0].report_id;
      assert.equal((await call('/admin/reports/'+id,'PATCH',{status:'bad'},admin.cookie)).status,400);
      assert.equal((await call('/admin/reports/2147483647','PATCH',{status:'reviewed'},admin.cookie)).status,404);
      assert.equal((await call('/admin/reports/'+id,'PATCH',{status:'reviewed'},admin.cookie)).status,200);
      assert.equal((await call('/admin/reports/'+id,'PATCH',{status:'dismissed'},admin.cookie)).status,409);
    });
  } finally {
    await new Promise(resolve=>server.close(resolve));
    try {
      // Catch any fixture registered just before an assertion failed.
      await pool.query(`DELETE FROM notification WHERE related_entity_type='report' AND related_entity_id IN
        (SELECT report_id FROM report WHERE reporter_id IN (SELECT user_id FROM users WHERE email LIKE $1))`,[prefix+'-%@example.invalid']);
      await pool.query('DELETE FROM users WHERE email LIKE $1',[prefix+'-%@example.invalid']);
      await pool.query('DELETE FROM admin_invite WHERE code=$1',[prefix]);
    } finally {
      await pool.end();
      if(key === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY=key;
    }
  }
});
