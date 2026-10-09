import {useEffect,useState} from 'react';
import {api} from '../services/api';
import {formatDate} from '../utils/dates';
export default function ReportTargetPage({target,setPage}) {
  const [data,setData]=useState(null),[error,setError]=useState('');
  const listing=target?.targetType==='listing';
  useEffect(()=>{let active=true;setData(null);setError('');
    if(!target?.id){setError('No report target selected.');return;}
    api(`/admin/${listing?'listings':'users'}/${target.id}`).then(d=>{if(active)setData(listing?d.listing:d.user);})
      .catch(e=>{if(active)setError(e.message);});return()=>{active=false;};
  },[target?.id,listing]);
  return <main className="content"><button className="text-button" onClick={()=>setPage('Platform management')}>← Back to reports</button>
    <h1>{listing?'Reported listing details':'Reported user details'}</h1>
    <p className="muted">Administrator-only review. This view does not change public visibility.</p>
    {error?<p className="notice" role="alert">{error}</p>:!data?<p>Loading…</p>:<section className="form-section">
      <h2>{listing?data.title:data.full_name}</h2>
      {listing?<><p>{data.address}, {data.suburb}, {data.city}</p><p>${data.rent}/week · Bond ${data.bond} · {data.room_type} · {data.status}</p>
        <p>Advertiser: {data.advertiser_name} · Available: {formatDate(data.available_from)}</p>
        <p className="preserve-lines">{data.description}</p><p>House rules: {data.house_rules || 'Not provided'}</p>
        <p>Transport: {(data.transport_options||[]).join(', ')}</p><p>Facilities: {Object.keys(data.utilities||{}).filter(k=>data.utilities[k]).join(', ')}</p>
        {(data.photos||[]).map((src,i)=><img key={i} src={src} alt={`Listing photo ${i+1}`} style={{maxWidth:'100%',width:320,borderRadius:12,margin:8}}/>)}</>
      :<><p>User #{data.user_id} · {data.role} · {data.is_active?'Active':'Deactivated'}</p>
        <p className="preserve-lines">{data.about_me || data.advertiser_bio || 'No introduction provided.'}</p>
        <p>Preferred location: {data.preferred_location || 'Not provided'}</p><p>Budget: {data.budget_min ?? '—'} – {data.budget_max ?? '—'}</p>
        <p>Study habits: {data.study_habits || 'Not provided'}</p><p>Lifestyle: {(data.lifestyle_tags||[]).join(', ') || 'Not provided'}</p><p>Move-in date: {formatDate(data.move_in_date)}</p></>}
    </section>}
  </main>;
}
