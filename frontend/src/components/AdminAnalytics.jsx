import {useEffect,useState} from 'react';
import {api} from '../services/api';
import {startPolling} from '../utils/polling';
import {formatDateTime} from '../utils/dates';

const palette=['#168579','#5275b8','#b77926','#9966a6','#697b85'];
const statusColors={available:'#168579',shortlisted:'#5275b8',filled:'#9966a6',closed:'#697b85',pending:'#b77926',accepted:'#168579',rejected:'#bd5967'};
const colour=(item,index)=>statusColors[item.label]||palette[index%palette.length];
function Bars({items}) {
  const max=Math.max(1,...items.map(x=>Number(x.value)));
  return <div className="metric-bars">{items.map((item,index)=><div key={item.label}>
    <div><span>{item.label}</span><strong>{item.value}</strong></div>
    <div className="metric-track"><i style={{width:`${Number(item.value)/max*100}%`,background:colour(item,index)}}/></div>
  </div>)}</div>;
}
function Distribution({items,ring=false}) {
  const total=items.reduce((sum,item)=>sum+Number(item.value),0);
  let cursor=0;
  const stops=items.map((item,index)=>{const start=cursor;cursor+=total?Number(item.value)/total*100:0;return `${colour(item,index)} ${start}% ${cursor}%`;});
  return <div className={ring?'distribution ring-layout':'distribution'}>
    {ring?<div className="metric-donut" aria-label={`${total} listings in total`} role="img" style={{background:total?`conic-gradient(${stops.join(',')})`:'#e6eeeb'}}><div><strong>{total}</strong><span>Total listings</span></div></div>
      :<><p className="distribution-total"><strong>{total}</strong> total enquiries</p><div className="stacked-distribution" aria-hidden="true">{items.map((item,index)=><i key={item.label} style={{width:`${total?Number(item.value)/total*100:0}%`,background:colour(item,index)}}/>)}</div></>}
    <ul className="chart-legend">{items.map((item,index)=><li key={item.label}><span><i style={{background:colour(item,index)}}/>{item.label}</span><strong>{item.value}</strong><small>{total?Math.round(Number(item.value)/total*100):0}%</small></li>)}</ul>
    {!total&&<p className="muted">No records yet.</p>}
  </div>;
}
export default function AdminAnalytics(){
  const [days,setDays]=useState(30),[data,setData]=useState(null),[error,setError]=useState('');
  useEffect(()=>{let live=true;
    const load=async()=>{try{const result=await api(`/admin/analytics?days=${days}`);if(live){setData(result);setError('');}}
      catch(e){if(live)setError(e.message);}};
    setData(null);load();const stop=startPolling(load,{interval:30000});return()=>{live=false;stop();};
  },[days]);
  return <section className="analytics-panel" aria-label="Live platform analytics">
    <div className="analytics-heading"><div><span className="eyebrow">LIVE DATABASE RESULTS</span><h2>Platform outcomes</h2>
      <p className="muted">{data?`New listings: ${data.range.from} to ${data.range.to} · Updated ${formatDateTime(data.generated_at)}`:'Loading live results…'}</p>
      <p className="muted">Date range applies to new listings only. Other charts show current totals. Refreshes every 30 seconds.</p></div>
      <div className="range-buttons">{[7,30,90].map(n=><button key={n} aria-pressed={days===n} className={days===n?'selected':''} onClick={()=>setDays(n)}>{n} days</button>)}</div>
    </div>
    {error&&<p role="alert" className="notice">{error}</p>}
    {data&&<PlatformOutcomeCharts data={data}/>}
  </section>;
}

export function PlatformOutcomeCharts({data}) {
  const maximum=Math.max(1,...data.listings_by_day.map(x=>Number(x.listings)));
  return <div className="analytics-grid">
      <article className="chart-card chart-wide"><h3>New listings by day</h3><p className="muted">Scroll horizontally to see every date.</p>
        <div className="daily-chart">{data.listings_by_day.map(item=><div className="daily-column" key={item.day}>
          <div className="daily-value">{item.listings}</div><div className="daily-track"><i style={{height:`${item.listings/maximum*100}%`}}/></div>
          <time>{item.day}</time></div>)}</div></article>
      <article className="chart-card"><h3>Homes & flatmate outcomes</h3><div className="success-metrics">{[
        {label:'Homes rented out',value:data.success_outcomes.rented_homes},
        {label:'People with a mutual flatmate match',value:data.success_outcomes.matched_people}].map((item,index)=><div key={item.label} className={`success-metric outcome-${index}`}><span>{item.label}</span><strong>{item.value}</strong><small>{index===0?'homes':'people'}</small></div>)}</div>
        <p className="muted">Homes: current Filled status, not demo payments. People: active flatmate users counted once across mutually agreed pairs.</p></article>
      <article className="chart-card"><h3>Report outcomes</h3><table className="outcomes-table"><caption className="sr-only">Current report counts</caption><thead><tr><th scope="col">Measure</th><th scope="col">Reports</th></tr></thead><tbody>{[
        {label:'Total reports',value:data.report_outcomes.total},
        {label:'Listing reports upheld',value:data.report_outcomes.listing_upheld},
        {label:'User reports upheld',value:data.report_outcomes.user_upheld}].map(item=><tr key={item.label}><th scope="row">{item.label}</th><td>{item.value}</td></tr>)}</tbody></table>
        <p className="muted">Upheld reports record a listing takedown or account deactivation. Includes chat-user reports; excludes legacy review-only records.</p></article>
      <article className="chart-card"><h3>Listing availability</h3><Distribution items={data.listing_statuses} ring/></article>
      <article className="chart-card needs-summary"><h3>What students need</h3><Bars items={data.student_needs}/></article>
      <article className="chart-card chart-wide"><h3>Enquiry outcomes</h3><Distribution items={data.enquiry_outcomes}/></article>
    </div>;
}
