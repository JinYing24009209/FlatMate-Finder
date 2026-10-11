import {useEffect,useState} from 'react';
import CitySelect from './CitySelect';
import suburbs from '../../../shared/nzSuburbs.json';
import {api} from '../services/api';

export default function LocationFilters({city,suburb,onChange,showLabels=false}) {
  const [remote,setRemote]=useState({city:'',areas:[]});
  useEffect(()=>{let active=true;
    if(city)api(`/listings/areas?city=${encodeURIComponent(city)}`)
      .then(data=>{if(active)setRemote({city,areas:data.areas});})
      .catch(()=>{if(active)setRemote({city,areas:[]});});
    return()=>{active=false;};
  },[city]);
  const names=new Map();
  [...(suburbs[city]||[]),...(remote.city===city?remote.areas:[])].forEach(name=>names.set(name.toLocaleLowerCase('en-NZ'),name));
  const areas=[...names.values()].sort((a,b)=>a.localeCompare(b,'en-NZ'));
  const cityField=<CitySelect value={city} emptyLabel={showLabels?'Any city / town':undefined} onChange={event=>onChange({city:event.target.value,suburb:''})}/>;
  const suburbField=<select aria-label="Area or suburb" value={suburb} disabled={!city} onChange={event=>onChange({city,suburb:event.target.value})}>
      <option value="">{city?'All areas':'Choose a city first'}</option>
      {suburb&&!areas.includes(suburb)&&<option value={suburb}>{suburb}</option>}
      {areas.map(area=><option key={area} value={area}>{area}</option>)}
    </select>;
  return showLabels?<div className="profile-location-controls"><label>Preferred city / town{cityField}</label><label>Preferred area / suburb{suburbField}</label></div>:<>{cityField}{suburbField}</>;
}
