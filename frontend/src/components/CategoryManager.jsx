import {useEffect,useState} from 'react';
import {api} from '../services/api';
function CategoryRow({category,onSave,busy}){
  const [name,setName]=useState(category.name);
  return <article className="row-card category-row"><label>{category.kind==='transport'?'Transport':'Facility / utility'}
    <input aria-label={`Name for ${category.name}`} value={name} maxLength={160} onChange={e=>setName(e.target.value)}/></label>
    <span>{category.is_active?'Active':'Inactive'}</span><div className="button-row">
    <button className="outline" disabled={busy||!name.trim()||name.trim()===category.name} onClick={()=>onSave(category.category_id,{name})}>Save name</button>
    <button className={category.is_active?'danger-button':'outline'} disabled={busy}
      onClick={()=>onSave(category.category_id,{is_active:!category.is_active})}>{category.is_active?'Deactivate':'Reactivate'}</button>
    </div></article>;
}
export default function CategoryManager(){
  const [items,setItems]=useState([]),[name,setName]=useState(''),[kind,setKind]=useState('transport');
  const [notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
  const load=()=>api('/categories').then(d=>setItems(d.categories));
  useEffect(()=>{load().catch(e=>setNotice(e.message));},[]);
  const save=async(id,body)=>{setBusy(true);try{
    const result=await api(id?`/categories/${id}`:'/categories',{method:id?'PATCH':'POST',body:JSON.stringify(body)});
    if(!id)setName('');await load();setNotice(result.message);
  }catch(e){setNotice(e.message);}finally{setBusy(false);}};
  return <section><h2>Transport & facilities</h2>
    <p className="muted">Changes appear in listing forms and search filters. Deactivation prevents new selections; existing listings keep their choices.</p>
    <form className="form-grid category-create" onSubmit={e=>{e.preventDefault();save(null,{name,kind});}}>
      <label>Category type<select value={kind} onChange={e=>setKind(e.target.value)}><option value="transport">Transport</option><option value="utility">Facility / utility</option></select></label>
      <label>Name<input value={name} maxLength={160} required onChange={e=>setName(e.target.value)}/></label>
      <button className="primary" disabled={busy||!name.trim()}>Add option</button>
    </form>
    {notice&&<p className="notice" role="status">{notice}</p>}
    <div className="stack">{items.map(c=><CategoryRow key={`${c.category_id}:${c.name}:${c.is_active}`} category={c} onSave={save} busy={busy}/>)}</div>
    <p className="muted">Room types stay fixed as Single room, Double room, Shared room and Studio so listings, search and matching use consistent definitions.</p>
  </section>;
}
