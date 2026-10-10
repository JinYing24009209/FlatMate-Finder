const test=require('node:test');
const assert=require('node:assert/strict');
test('mutual flatmate outcomes, paid listings and separated search',{
  skip:process.env.RUN_DATABASE_TESTS!=='1',timeout:180000,
},async t=>{
  require('dotenv').config({quiet:true});process.env.GEMINI_API_KEY='';
  const {pool}=require('../src/config/database');
  const express=require('express'),app=express();app.use(express.json());app.use(require('cookie-parser')());
  const flatmates=require('../src/routes/flatmateRoutes');
  app.use('/flatmates',flatmates.profiles);app.use('/flatmate-conversations',flatmates.conversations);
  for(const [path,file] of [['/auth','authRoutes'],['/listings','listingRoutes'],['/payments','paymentRoutes'],['/admin','adminRoutes'],['/','communityRoutes'],['/','aiRoutes']])app.use(path,require('../src/routes/'+file));
  app.use(require('../src/middleware/errorHandler').errorHandler);
  const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
  const base='http://127.0.0.1:'+server.address().port,prefix='outcomes-'+Date.now()+'-'+process.pid;
  const call=async(path,method='GET',body,cookie)=>{
    const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
    return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};
  };
  const account=async(name,role='student',type='flatmate')=>{
    const r=await call('/auth/register','POST',{full_name:name,email:`${prefix}-${name}@example.invalid`,password:'Temporary-test-928!',role,student_type:type});
    assert.equal(r.status,201,JSON.stringify(r.data));return{id:r.data.user.user_id,cookie:r.cookie};
  };
  try{
    const a=await account('A'),b=await account('B'),outsider=await account('C');
    const owner=await account('Owner','advertiser'),housing=await account('Housing','student','housing'),otherHousing=await account('OtherHousing','student','housing');
    await pool.query(`INSERT INTO profiles(user_id,visible_for_matching,preferred_location,study_habits,lifestyle_tags,budget_min,budget_max,move_in_date)
      SELECT unnest($1::int[]),true,'Auckland','morning','["quiet"]'::jsonb,200,300,'2026-12-01'`,[[a.id,b.id,outsider.id]]);
    const start=await call(`/flatmates/${b.id}/enquiries`,'POST',{body:'Hello, let us discuss sharing a home.'},a.cookie);
    assert.equal(start.status,201,JSON.stringify(start.data));const id=start.data.conversation_id;
    const agree=(who,value)=>call(`/flatmate-conversations/${id}/agreement`,'PATCH',{agreed:value},who.cookie);
    const matched=async who=>(await call('/flatmates/matched','GET',undefined,who.cookie)).data.matches;
    await t.test('both start unagreed and each participant can change only their own side',async()=>{
      const initial=(await call('/flatmate-conversations','GET',undefined,a.cookie)).data.conversations[0];
      assert.equal(initial.my_agreed,false);assert.equal(initial.other_agreed,false);
      assert.equal((await agree(outsider,true)).status,404);
      assert.equal((await agree(a,'yes')).status,400);
      const first=await call(`/flatmate-conversations/${id}/agreement`,'PATCH',{agreed:true,high_agreed:true,other_agreed:true},a.cookie);
      assert.equal(first.status,200);assert.equal(first.data.my_agreed,true);assert.equal(first.data.other_agreed,false);
      assert.equal((await matched(a)).length,0);assert.equal((await agree(a,false)).status,200);
    });
    await t.test('concurrent agreements form one mutual pair, repeats do not add notifications',async()=>{
      const responses=await Promise.all([agree(a,true),agree(b,true)]);responses.forEach(r=>assert.equal(r.status,200,JSON.stringify(r.data)));
      assert.equal((await matched(a))[0].user_id,b.id);assert.equal((await matched(b))[0].user_id,a.id);
      assert.equal((await matched(outsider)).length,0);
      const count=async()=>(await pool.query("SELECT count(*)::int n FROM notification WHERE related_entity_type='flatmate_conversation' AND related_entity_id=$1 AND type='flatmate_agreement'",[id])).rows[0].n;
      const before=await count();await agree(a,true);await agree(b,true);assert.equal(await count(),before);
    });
    await t.test('withdrawal removes the match and hidden profile access remains relationship-scoped',async()=>{
      await pool.query('UPDATE profiles SET visible_for_matching=false WHERE user_id=$1',[b.id]);
      assert.equal((await call('/flatmates/'+b.id,'GET',undefined,a.cookie)).status,200);
      assert.equal((await call('/flatmates/'+b.id,'GET',undefined,outsider.cookie)).status,404);
      await agree(a,false);assert.equal((await matched(a)).length,0);assert.equal((await matched(b)).length,0);
      assert.equal((await call('/flatmates/'+b.id,'GET',undefined,a.cookie)).status,404);
      await pool.query('UPDATE profiles SET visible_for_matching=true WHERE user_id=$1',[b.id]);
      await agree(a,true);await pool.query('UPDATE users SET is_active=false WHERE user_id=$1',[b.id]);
      assert.equal((await agree(a,true)).status,409);await pool.query('UPDATE users SET is_active=true WHERE user_id=$1',[b.id]);
    });
    const payload={title:prefix,description:'Quiet room near campus.',rent:250,bond:0,address:'Test only',city:'Auckland',suburb:'Test Area '+prefix,room_type:'Single room',available_from:'2026-12-01',photos:['/photos/room1.jpg']};
    const created=await call('/listings','POST',payload,owner.cookie);assert.equal(created.status,201,JSON.stringify(created.data));const listingId=created.data.listing.listing_id;
    await t.test('areas belong to the selected city and both search modes enforce area',async()=>{
      const areas=await call('/listings/areas?city=Auckland');assert.ok(areas.data.areas.includes(payload.suburb));
      const wrongAreas=await call('/listings/areas?city=Wellington');assert.ok(!wrongAreas.data.areas.includes(payload.suburb));
      for(const path of ['/listings','/ai/smart-search']){
        const yes=await call(path+'?city=Auckland&suburb='+encodeURIComponent(payload.suburb));
        assert.equal(yes.status,200,JSON.stringify(yes.data));assert.ok(yes.data.listings.some(l=>l.listing_id===listingId));
        const no=await call(path+'?city=Auckland&suburb=NoSuchArea');assert.ok(!no.data.listings.some(l=>l.listing_id===listingId));
      }
    });
    await t.test('smart flatmate search parses current text and applies filters on the server',async()=>{
      const r=await call('/matches/smart-search?q='+encodeURIComponent('quiet in Auckland under $300 morning from 2026-12-01 by 2026-12-01'),'GET',undefined,a.cookie);
      assert.equal(r.status,200,JSON.stringify(r.data));assert.equal(r.data.search_mode,'local-fallback');
      assert.equal(r.data.interpretation.maxBudget,300);assert.ok(r.data.matches.some(p=>p.user_id===b.id));
      const miss=await call('/matches/smart-search?q='+encodeURIComponent('in Auckland under $100'),'GET',undefined,a.cookie);
      assert.ok(!miss.data.matches.some(p=>p.user_id===b.id));
      assert.equal((await call('/matches/smart-search?q=','GET',undefined,a.cookie)).status,400);
    });
    await t.test('successful payments contain only the current housing student records',async()=>{
      const first=await call('/payments/checkout','POST',{listing_id:listingId},housing.cookie);
      const pending=await call('/payments/checkout','POST',{listing_id:listingId},otherHousing.cookie);
      assert.equal(first.status,201);assert.equal(pending.status,201);
      assert.equal((await call('/payments/successful','GET',undefined,housing.cookie)).data.listings.length,0);
      assert.equal((await call(`/payments/${first.data.payment.payment_id}/complete-demo`,'POST',{},housing.cookie)).status,200);
      const paid=await call('/payments/successful','GET',undefined,housing.cookie);
      assert.equal(paid.data.listings.length,1);assert.equal(paid.data.listings[0].listing_id,listingId);
      assert.equal(paid.data.listings[0].status,'shortlisted');assert.deepEqual(paid.data.listings[0].photos,['/photos/room1.jpg']);
      assert.equal((await call('/payments/successful','GET',undefined,otherHousing.cookie)).data.listings.length,0);
      assert.equal((await call('/payments/successful','GET',undefined,a.cookie)).status,403);
      assert.equal((await call('/flatmates/matched','GET',undefined,housing.cookie)).status,403);
      assert.equal((await call('/listings/'+listingId,'DELETE',undefined,owner.cookie)).status,200);
      const retained=(await call('/payments/successful','GET',undefined,housing.cookie)).data.listings;
      assert.equal(retained.length,1);assert.equal(retained[0].removed,true);assert.equal(retained[0].title,payload.title);
    });
  }finally{
    await new Promise(resolve=>server.close(resolve));
    try{
      await pool.query(`DELETE FROM notification WHERE related_entity_type='report' AND related_entity_id IN
        (SELECT report_id FROM report WHERE reporter_id IN (SELECT user_id FROM users WHERE email LIKE $1))`,[prefix+'-%@example.invalid']);
      await pool.query('DELETE FROM users WHERE email LIKE $1',[prefix+'-%@example.invalid']);
    }finally{await pool.end();}
  }
});
