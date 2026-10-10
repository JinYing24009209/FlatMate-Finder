import {useEffect,useState} from 'react';
import {api} from '../services/api';
import ListingDetailPage from './ListingDetailPage';
import FlatmateDetailPage from './FlatmateDetailPage';

export default function ReportTargetPage({target,setPage}) {
  const [data,setData]=useState(null),[error,setError]=useState('');
  const listing=target?.targetType==='listing';

  useEffect(()=>{
    let active=true;
    setData(null);
    setError('');

    if(!target?.id){
      setError('No report target selected.');
      return;
    }

    api(`/admin/${listing?'listings':'users'}/${target.id}`)
      .then(d=>{
        if(active)setData(listing?d.listing:d.user);
      })
      .catch(e=>{
        if(active)setError(e.message);
      });

    return()=>{
      active=false;
    };
  },[target?.id,listing]);

  if(error||!data)
    return (
      <main className="content">
        <button className="text-button" onClick={()=>setPage('Platform management')}>← Back to reports</button>
        <p className="notice" role={error?'alert':'status'}>{error||'Loading report target…'}</p>
      </main>
    );

  return listing
    ? <ListingDetailPage key={data.listing_id} listing={data} user={{role:'admin'}} adminReview setPage={setPage}/>
    : <FlatmateDetailPage key={data.user_id} person={data} profileOverride={data} adminReview setPage={setPage}/>;
}