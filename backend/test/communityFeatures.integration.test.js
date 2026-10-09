const test = require('node:test');
const assert = require('node:assert/strict');

test('community notifications, reports and free-text filters', {
  skip: process.env.RUN_DATABASE_TESTS !== '1', timeout: 180000,
}, async (t) => {
  require('dotenv').config({ quiet: true });
  process.env.GEMINI_API_KEY = ''; // Never send fixtures to an external AI provider.
  const { pool } = require('../src/config/database');
  const express = require('express');
  const app = express();
  app.use(express.json());
  app.use(require('cookie-parser')());
  for (const [path, file] of [['/auth','authRoutes'], ['/listings','listingRoutes'],
    ['/admin','adminRoutes'], ['/reports','reportRoutes'],
    ['/','communityRoutes'], ['/','aiRoutes']]) app.use(path, require('../src/routes/' + file));
  app.use(require('../src/middleware/errorHandler').errorHandler);
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const base = 'http://127.0.0.1:' + server.address().port;
  const prefix = 'community-' + Date.now() + '-' + process.pid;
  async function call(path, method = 'GET', body, cookie) {
    const response = await fetch(base + path, { method, headers: {'Content-Type':'application/json', ...(cookie ? {Cookie:cookie} : {})},
      ...(body === undefined ? {} : {body:JSON.stringify(body)}) });
    return {status:response.status, data:await response.json(), cookie:response.headers.get('set-cookie')?.split(';')[0]};
  }
  async function account(name, role) {
    const result = await call('/auth/register', 'POST', {full_name:name, email:`${prefix}-${name}@example.invalid`,
      password:'Temporary-test-928!', role, student_type:'housing'});
    assert.equal(result.status, 201, JSON.stringify(result.data));
    return {id:result.data.user.user_id, cookie:result.cookie};
  }
  try {
    const owner = await account('owner', 'advertiser');
    const student = await account('student', 'student');
    const other = await account('other', 'student');
    const admin = await account('admin', 'advertiser');
    await pool.query("UPDATE users SET role='admin' WHERE user_id=$1", [admin.id]);
    let listingId, reportId;
    const payload = {title:prefix, description:'Quiet non-smoking room.', rent:220, bond:0, address:'Fixture only',
      city:'Auckland', room_type:'Single room', available_from:'2026-10-10', photos:[]};
    await t.test('owners can enter transport and facilities without managed options', async () => {
      payload.transport_options=['Bus stop 2 minutes away','Safe cycle lane'];
      payload.utilities={'Fibre internet included':true,'Water':true,'Gas':false};
      const listing = await call('/listings','POST',payload,owner.cookie);
      assert.equal(listing.status,201,JSON.stringify(listing.data)); listingId=listing.data.listing.listing_id;
      const saved = (await pool.query('SELECT transport_options FROM listing WHERE listing_id=$1',[listingId])).rows[0];
      assert.deepEqual(saved.transport_options,payload.transport_options);
    });
    await t.test('normal and smart searches enforce free text, city and every lifestyle phrase', async () => {
      for (const path of ['/listings','/ai/smart-search']) {
        const result=await call(path+'?transport=BUS,cycle&utilities=internet,water&city=Auckland&lifestyle=quiet,non-smoking');
        assert.equal(result.status,200,JSON.stringify(result.data));
        assert.ok(result.data.listings.some(x=>x.listing_id===listingId));
        const noMatch=await call(path+'?transport=bus&utilities=gas&lifestyle=quiet');
        assert.equal(noMatch.status,200,JSON.stringify(noMatch.data));
        assert.ok(!noMatch.data.listings.some(x=>x.listing_id===listingId));
        const wrongCity=await call(path+'?city=Wellington');
        assert.ok(!wrongCity.data.listings.some(x=>x.listing_id===listingId));
      }
    });
    await t.test('free-text edits remain validated and administrative details are protected', async () => {
      assert.equal((await call('/listings','POST',{...payload,transport_options:['x'.repeat(161)]},owner.cookie)).status,400);
      assert.equal((await call('/listings/'+listingId,'PUT',payload,owner.cookie)).status,200);
      assert.equal((await call('/admin/users/'+student.id,'GET',undefined,owner.cookie)).status,403);
      const details=await call('/admin/users/'+student.id,'GET',undefined,admin.cookie);
      assert.equal(details.status,200);assert.equal(details.data.user.password_hash,undefined);
      assert.equal((await call('/admin/listings/'+listingId,'GET',undefined,admin.cookie)).status,200);
    });
    await t.test('flatmate filters use study text, exact lifestyle tags and inclusive dates', async () => {
      await pool.query("UPDATE users SET student_type='flatmate' WHERE user_id=ANY($1::int[])",[ [student.id,other.id] ]);
      await pool.query(`INSERT INTO profiles(user_id,study_habits,lifestyle_tags,move_in_date,visible_for_matching)
        VALUES($1,'Quiet evening study','["quiet","non-smoking"]'::jsonb,'2026-10-10',true)`,[other.id]);
      const match=await call('/matches?studyHabits=evening&lifestyle=quiet,non-smoking&moveInFrom=2026-10-10&moveInTo=2026-10-10','GET',undefined,student.cookie);
      assert.equal(match.status,200,JSON.stringify(match.data));
      assert.ok(match.data.matches.some(x=>x.user_id===other.id));
      const miss=await call('/matches?lifestyle=qui','GET',undefined,student.cookie);
      assert.ok(!miss.data.matches.some(x=>x.user_id===other.id));
      assert.equal((await call('/matches?moveInFrom=2026-10-11&moveInTo=2026-10-10','GET',undefined,student.cookie)).status,400);
    });
    await pool.query('INSERT INTO saved_listing(student_id,listing_id) VALUES($1,$2)',[student.id,listingId]);
    await t.test('important edits notify once; unchanged edits do not notify again', async () => {
      payload.rent=230;
      for(let i=0;i<2;i++) assert.equal((await call('/listings/'+listingId,'PUT',payload,owner.cookie)).status,200);
      const rows=(await pool.query("SELECT * FROM notification WHERE user_id=$1 AND type='listing_updated'",[student.id])).rows;
      assert.equal(rows.length,1); assert.equal(rows[0].metadata.before.rent,220); assert.equal(rows[0].metadata.after.rent,230);
    });
    await t.test('available-date edits and administrator status changes notify savers', async () => {
      payload.available_from='2026-10-12';
      assert.equal((await call('/listings/'+listingId,'PUT',payload,owner.cookie)).status,200);
      for(let i=0;i<2;i++) assert.equal((await call('/admin/listings/'+listingId,'PATCH',{status:'closed'},admin.cookie)).status,200);
      const rows=(await pool.query("SELECT metadata FROM notification WHERE user_id=$1 AND type='listing_updated' ORDER BY notification_id",[student.id])).rows;
      assert.equal(rows.length,3);
      assert.deepEqual(rows[1].metadata.changed,['available_from']);
      assert.deepEqual(rows[2].metadata.changed,['status']);
    });
    await t.test('chat evidence requires participation and uses the server message', async () => {
      const [low,high]=[student.id,other.id].sort((a,b)=>a-b);
      const conversation=(await pool.query('INSERT INTO flatmate_conversation(member_low,member_high) VALUES($1,$2) RETURNING conversation_id',[low,high])).rows[0];
      const message=(await pool.query('INSERT INTO flatmate_message(conversation_id,sender_id,body) VALUES($1,$2,$3) RETURNING message_id',[conversation.conversation_id,other.id,'Fixture evidence'])).rows[0];
      const body={conversation_id:conversation.conversation_id,message_id:message.message_id,reason:'Harassment',description:'Please review this message.'};
      assert.equal((await call('/reports','POST',body,owner.cookie)).status,404);
      const report=await call('/reports','POST',body,student.cookie);
      assert.equal(report.status,201,JSON.stringify(report.data)); reportId=report.data.report_id;
      const stored=(await pool.query('SELECT * FROM report WHERE report_id=$1',[reportId])).rows[0];
      assert.equal(stored.evidence.body,'Fixture evidence'); assert.equal(stored.reported_user_id,other.id);
      assert.equal((await pool.query("SELECT * FROM notification WHERE user_id=$1 AND related_entity_type='report' AND related_entity_id=$2",[admin.id,reportId])).rowCount,1);
    });
    await t.test('review sends one outcome; results are visible only to their reporter', async () => {
      const body={status:'reviewed',resolution_note:'Warning issued after reviewing the message.'};
      assert.equal((await call('/admin/reports/'+reportId,'PATCH',body,admin.cookie)).status,200);
      assert.equal((await call('/admin/reports/'+reportId,'PATCH',body,admin.cookie)).status,409);
      assert.equal((await call('/reports/mine','GET',undefined,student.cookie)).data.reports[0].resolution_note,body.resolution_note);
      assert.equal((await call('/reports/mine','GET',undefined,other.cookie)).data.reports.length,0);
    });
    await t.test('deleting a listing retains useful notification and report snapshots', async () => {
      const {createReport}=require('../src/services/reportService');
      const {transaction}=require('../src/services/transaction');
      const report=await transaction(client=>createReport(client,{reporterId:student.id,listingId,reason:'Listing issue',description:'Fixture report',snapshot:{title:prefix,listing_id:listingId}}));
      assert.equal((await call('/listings/'+listingId,'DELETE',undefined,owner.cookie)).status,200);
      assert.equal((await call('/admin/listings/'+listingId,'GET',undefined,admin.cookie)).status,404);
      const notice=(await pool.query("SELECT * FROM notification WHERE user_id=$1 AND type='listing_deleted'",[student.id])).rows[0];
      assert.equal(notice.metadata.before.title,prefix);
      const retained=(await pool.query('SELECT * FROM report WHERE report_id=$1',[report.report_id])).rows[0];
      assert.equal(retained.listing_id,null); assert.equal(retained.target_snapshot.title,prefix);
    });
  } finally {
    await new Promise(resolve=>server.close(resolve));
    try {
      await pool.query(`DELETE FROM notification WHERE related_entity_type='report' AND related_entity_id IN
        (SELECT report_id FROM report WHERE reporter_id IN (SELECT user_id FROM users WHERE email LIKE $1))`,[prefix+'-%@example.invalid']);
      await pool.query('DELETE FROM users WHERE email LIKE $1',[prefix+'-%@example.invalid']);
    } finally { await pool.end(); }
  }
});
