const v = require('./validation');

function categoryIds(value, name = 'Category IDs') {
  if (value == null || value === '') return [];
  const items = typeof value === 'string' ? value.split(',') : value;
  if (!Array.isArray(items) || items.length > 40) 
    throw v.invalid(`${name} must contain at most 40 IDs.`);
  return [...new Set(items.map(x => {
    const id = v.number(x, name, null, 1, 2147483647);
    if (!Number.isInteger(id)) 
      throw v.invalid(`${name} must be positive integers.`);
    return id;
  }))];
}

// Stable IDs keep associations intact after an administrator renames a category.
async function saveCategories(client, listingId, data) {
  let ids;
  if (data.category_ids !== undefined) ids = categoryIds(data.category_ids);
  else {
    // Compatibility for existing clients: only known category names can be selected.
    const names = [...(data.transport_options || []).map(name=>({kind:'transport',name})),
      ...Object.keys(data.utilities || {}).filter(k=>data.utilities[k]).map(name=>({kind:'utility',name}))];
    ids = [];
    for (const item of names) {
      const {rows:[row]} = await client.query('SELECT category_id FROM listing_category WHERE kind=$1 AND lower(name)=lower($2)', [item.kind,item.name]);
      if (!row) 
        throw v.invalid(`Unknown ${item.kind} option. Refresh the form and select a managed option.`);
      ids.push(row.category_id);
    }
  }
  const {rows} = await client.query('SELECT * FROM listing_category WHERE category_id=ANY($1::int[]) ORDER BY category_id FOR SHARE',[ids]);
  if (rows.length !== ids.length) 
    throw v.invalid('One or more categories no longer exist.');
  for (const kind of ['transport','utility']) {
    if (rows.filter(row=>row.kind===kind).length>20) 
      throw v.invalid(`Select at most 20 ${kind} options.`);
  }
  const existing = await client.query('SELECT category_id FROM listing_category_link WHERE listing_id=$1',[listingId]);
  const retained = new Set(existing.rows.map(r=>r.category_id));
  if (rows.some(r=>!r.is_active && !retained.has(r.category_id))) 
    throw v.invalid('An inactive category cannot be newly selected. Refresh the form.');
  await client.query('DELETE FROM listing_category_link WHERE listing_id=$1',[listingId]);
  if(ids.length) await client.query('INSERT INTO listing_category_link(listing_id,category_id) SELECT $1,unnest($2::int[])',[listingId,ids]);
  const utilities = Object.fromEntries(rows.filter(r=>r.kind==='utility').map(r=>[r.name,true]));
  const transport = rows.filter(r=>r.kind==='transport').map(r=>r.name);
  const {rows:[listing]} = await client.query('UPDATE listing SET utilities=$2::jsonb,transport_options=$3::jsonb WHERE listing_id=$1 RETURNING *',
    [listingId,JSON.stringify(utilities),JSON.stringify(transport)]);
  return {...listing,category_ids:ids};
}
module.exports={categoryIds,saveCategories};
