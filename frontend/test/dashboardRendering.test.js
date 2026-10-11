import test,{before} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'vite';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFile} from 'node:fs/promises';
import Module from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

let Charts,Dashboard,Locations,Detail,Home,MoveInDate,Profile,Matches;
before(async()=>{
  const root=fileURLToPath(new URL('../',import.meta.url));
  const result=await build({
    root,
    configFile:false,
    logLevel:'silent',
    build:{
      ssr:true,
      write:false,
      minify:false,
      rollupOptions:{
        input:'virtual:render-test',
        external:id=>id==='react'||id.startsWith('react/'),
        output:{format:'cjs'}
      }
    },
    plugins:[{
      name:'render-test-entry',
      resolveId(id){
        if(id==='virtual:render-test')return id;
      },
      load(id){
        if(id==='virtual:render-test')return `
      export {PlatformOutcomeCharts as Charts} from '/src/components/AdminAnalytics.jsx';
      export {default as Dashboard} from '/src/pages/DashboardPage.jsx';
      export {default as Locations} from '/src/components/LocationFilters.jsx';
      export {default as Detail} from '/src/pages/ListingDetailPage.jsx';
      export {default as Home} from '/src/pages/HomePage.jsx';
      export {default as MoveInDate} from '/src/components/MoveInDateSelect.jsx';
      export {default as Profile} from '/src/pages/ProfilePage.jsx';
      export {default as Matches} from '/src/pages/MatchesPage.jsx';`;
      }
    }]
  });
  const filename=path.join(root,'test','render-bundle.cjs');
  const bundle=new Module(filename);
  bundle.filename=filename;
  bundle.paths=Module._nodeModulePaths(path.dirname(filename));
  bundle._compile(result.output.find(item=>item.type==='chunk'&&item.isEntry).code,filename);
  ({Charts,Dashboard,Locations,Detail,Home,MoveInDate,Profile,Matches}=bundle.exports);
});
const render=(component,props)=>renderToStaticMarkup(createElement(component,props));
const data={
  listings_by_day:[{day:'2026-10-10',listings:3}],
  success_outcomes:{rented_homes:4,matched_people:6},
  report_outcomes:{total:8,listing_upheld:2,user_upheld:1},
  listing_statuses:[{label:'available',value:8},{label:'filled',value:4}],
  student_needs:[{label:'Seeking a room',value:10},{label:'Seeking a flatmate',value:6}],
  enquiry_outcomes:[{label:'pending',value:5},{label:'accepted',value:2}]
};

test('six analytics cards preserve categories and use distinct visual presentations',()=>{
  const html=render(Charts,{data});
  assert.equal((html.match(/<article/g)||[]).length,6);
  for(const token of ['daily-chart','success-metrics','outcomes-table','metric-donut','metric-bars','stacked-distribution','2026-10-10','Listing reports upheld','Seeking a flatmate'])assert.ok(html.includes(token),token);
  assert.ok(html.includes('12 listings in total'));
  assert.ok(!/NaN|Infinity/.test(html));
});
test('zero totals and empty chart categories render without invalid dimensions',()=>{
  const empty={listings_by_day:[],success_outcomes:{rented_homes:0,matched_people:0},report_outcomes:{total:0,listing_upheld:0,user_upheld:0},listing_statuses:[],student_needs:[],enquiry_outcomes:[]};
  for(const fixture of [empty,{...empty,listing_statuses:[{label:'available',value:0}],enquiry_outcomes:[{label:'pending',value:0}]}]){
    const html=render(Charts,{data:fixture});
    assert.ok(!/NaN|Infinity/.test(html));
    assert.ok(html.includes('No records yet.'));
  }
});
test('only administrator dashboards omit personal reports',()=>{
  for(const role of ['admin','student','advertiser']){
    const html=render(Dashboard,{user:{role,full_name:'Test User',student_type:'housing'},setPage:()=>{}});
    assert.equal(html.includes('My reports &amp; outcomes'),role!=='admin');
  }
});
test('every supported city has selectable areas and no city disables the area field',async()=>{
  const cities=JSON.parse(await readFile(new URL('../../shared/nzCities.json',import.meta.url),'utf8'));
  for(const city of cities){
    const html=render(Locations,{city,suburb:'',onChange:()=>{}});
    assert.ok(html.includes('All areas'));
    assert.ok(!html.includes('disabled=""'));
    assert.ok(!html.includes('Choose a city first'));
  }
  const initial=render(Locations,{city:'',suburb:'',onChange:()=>{}});
  assert.ok(initial.includes('Choose a city first'));
  assert.ok(initial.includes('disabled=""'));
});
test('admin listing detail has one return action and housing detail retains back to results',()=>{
  const listing={listing_id:1,title:'Test room',city:'Wellington',suburb:'Kelburn',rent:250,status:'available',photos:[],utilities:{},transport_options:[]};
  const html=render(Detail,{listing,user:{role:'admin'},adminReview:true,setPage:()=>{}});
  assert.equal((html.match(/Return to report management/g)||[]).length,1);
  assert.ok(!html.includes('Back to reports'));
  assert.ok(render(Detail,{listing,user:{role:'student',student_type:'housing'},setPage:()=>{}}).includes('Back to results'));
});
test('home feature cards describe room search, flatmate matching and AI',()=>{
  const html=render(Home,{onStart:()=>{}});
  for(const title of ['Find your next room','Meet your kind of flatmate','A little help from AI'])assert.ok(html.includes(title));
});

test('move-in control shows one complete date or explicit Flexible, not partial date fields',()=>{
  for(const [value,expected] of [['2026-12-10','2026-12-10'],['flexible','Flexible'],['','Choose a date']]){
    const html=render(MoveInDate,{value,onChange:()=>{}});
    assert.ok(html.includes(expected));
    assert.equal((html.match(/<button/g)||[]).length,1);
    assert.ok(!html.includes('<select'));
    assert.ok(html.includes('aria-haspopup="dialog"'));
  }
  assert.ok(render(MoveInDate,{value:'',flexibleValue:'',onChange:()=>{}}).includes('Flexible'));
});
test('flatmate profile and search use compact dates and profile city/area controls',()=>{
  const profile=render(Profile,{user:{role:'student',student_type:'flatmate'}});
  assert.ok(profile.includes('Preferred city / town'));
  assert.ok(profile.includes('Preferred area / suburb'));
  assert.ok(profile.includes('move-in-trigger'));
  assert.ok(!profile.includes('date-input-ymd'));
  const matches=render(Matches,{setPage:()=>{},setSelected:()=>{}});
  assert.equal((matches.match(/class="move-in-trigger"/g)||[]).length,2);
  assert.ok(!matches.includes('date-input-ymd'));
});