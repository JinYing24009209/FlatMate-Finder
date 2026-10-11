import cities from '../../../shared/nzCities.json';
export default function CitySelect({value,onChange,required=false,name='city',emptyLabel}) {
  return <select aria-label="New Zealand city or town" name={name} value={value} onChange={onChange} required={required}>
    <option value="">{emptyLabel||(required?'Choose a city / town':'All cities / towns')}</option>
    {value && !cities.includes(value) && <option value={value}>{value} (existing location)</option>}
    {cities.map(city=><option key={city} value={city}>{city}</option>)}
  </select>;
}
