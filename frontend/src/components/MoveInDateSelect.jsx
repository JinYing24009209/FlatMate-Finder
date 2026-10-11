import {useEffect,useId,useRef,useState} from 'react';
import '../styles/move-in-date.css';

// 只提交完整日期；月份导航不会把未完成的选择当成已选日期。
export default function MoveInDateSelect({value='',onChange,label='Move-in date',flexibleValue='flexible',allowUnspecified=false}) {
  const [open,setOpen]=useState(false);
  const [month,setMonth]=useState('');
  const root=useRef(null),trigger=useRef(null);
  const id=useId();
  const today=new Date();
  const currentMonth=`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}`;
  const activeMonth=month||currentMonth;
  const [year,monthNumber]=activeMonth.split('-').map(Number);
  const count=new Date(year,monthNumber,0).getDate();
  useEffect(()=>{
    if(!open)return;
    const close=event=>{if(!root.current?.contains(event.target))setOpen(false);};
    document.addEventListener('pointerdown',close);
    return()=>document.removeEventListener('pointerdown',close);
  },[open]);
  const choose=next=>{onChange(next);setOpen(false);trigger.current?.focus();};
  const shift=amount=>{
    const date=new Date(year,monthNumber-1+amount,1);
    if(date.getFullYear()<1900||date.getFullYear()>2100)return;
    setMonth(`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`);
  };
  return <span className="move-in-picker" ref={root} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget))setOpen(false);}} onKeyDown={event=>{
    if(event.key==='Escape'){event.preventDefault();setOpen(false);trigger.current?.focus();}
  }}>
    <button type="button" className="move-in-trigger" ref={trigger} aria-label={label} aria-expanded={open} aria-controls={id} aria-haspopup="dialog"
      onClick={()=>{if(!open)setMonth(/^\d{4}-\d{2}-\d{2}$/.test(value)?value.slice(0,7):currentMonth);setOpen(!open);}}>
      <span>{value===flexibleValue?'Flexible':value||'Choose a date'}</span><span aria-hidden="true">▾</span>
    </button>
    {open&&<span className="move-in-popover" id={id} role="dialog" aria-label={`${label}: choose a complete date`}>
      <button type="button" className="date-choice flexible-choice" aria-pressed={value===flexibleValue} onClick={()=>choose(flexibleValue)}>Flexible — any date</button>
      <span className="date-month-navigation">
        <button type="button" aria-label="Previous month" onClick={()=>shift(-1)}>‹</button>
        <input type="month" aria-label="Browse month" value={activeMonth} min="1900-01" max="2100-12" onChange={event=>{
          if(/^(19\d{2}|20\d{2}|2100)-(0[1-9]|1[0-2])$/.test(event.target.value))setMonth(event.target.value);
        }}/>
        <button type="button" aria-label="Next month" onClick={()=>shift(1)}>›</button>
      </span>
      <span className="date-choices" onKeyDown={event=>{
        const buttons=[...event.currentTarget.querySelectorAll('button')],index=buttons.indexOf(document.activeElement);
        const next=event.key==='ArrowDown'?Math.min(index+1,buttons.length-1):event.key==='ArrowUp'?Math.max(index-1,0):event.key==='Home'?0:event.key==='End'?buttons.length-1:null;
        if(next!==null){event.preventDefault();buttons[next]?.focus();}
      }}>
        {Array.from({length:count},(_,i)=>`${activeMonth}-${String(i+1).padStart(2,'0')}`).map(date=><button type="button" className="date-choice" key={date} aria-pressed={value===date} onClick={()=>choose(date)}>{date}</button>)}
      </span>
      {allowUnspecified&&<button type="button" className="date-choice" onClick={()=>choose('')}>Clear — not specified</button>}
    </span>}
  </span>;
}
