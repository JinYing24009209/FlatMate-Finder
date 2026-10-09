const router=require('express').Router();
const {pool}=require('../config/database');
const {auth,allow}=require('../middleware/auth');
const {asyncRoute}=require('../middleware/errorHandler');
const {transaction}=require('../services/transaction');
const v=require('../services/validation');
router.get('/',asyncRoute(async (_req,res)=>{
  // Inactive names remain readable on existing listings; form/search selection disables them.
  const {rows}=await pool.query('SELECT category_id,kind,name,is_active FROM listing_category ORDER BY kind,lower(name),category_id');
  res.json({categories:rows});
}));
router.post('/',auth,allow('admin'),asyncRoute(async(req,res)=>{
  const name=v.text(req.body.name,'Category name',160,true),kind=req.body.kind;
  if(!['transport','utility'].includes(kind))
    throw v.invalid('Category kind must be transport or utility.');
  const {rows:[category]}=await pool.query('INSERT INTO listing_category(kind,name) VALUES($1,$2) RETURNING *',[kind,name]);
  res.status(201).json({category,message:'Category created.'});
}));
router.patch('/:id',auth,allow('admin'),asyncRoute(async(req,res)=>{
  const id=v.number(req.params.id,'Category ID',null,1,2147483647);
  if(!Number.isInteger(id))
    throw v.invalid('Category ID must be an integer.');
  if(req.body.is_active!==undefined && typeof req.body.is_active!=='boolean')
    throw v.invalid('Active status must be true or false.');
  const category=await transaction(async client=>{
    // Same lock order as listing edits: listings first, then category rows.
    await client.query('SELECT listing_id FROM listing WHERE listing_id IN (SELECT listing_id FROM listing_category_link WHERE category_id=$1) ORDER BY listing_id FOR UPDATE',[id]);
    const {rows:[old]}=await client.query('SELECT * FROM listing_category WHERE category_id=$1 FOR UPDATE',[id]);
    if(!old)
      throw v.invalid('Category not found.',404);
    const name=req.body.name===undefined?old.name:v.text(req.body.name,'Category name',160,true);
    const active=req.body.is_active===undefined?old.is_active:v.boolean(req.body.is_active,'Active status');
    const {rows:[updated]}=await client.query('UPDATE listing_category SET name=$2,is_active=$3 WHERE category_id=$1 RETURNING *',[id,name,active]);
    // Keep legacy display/AI text consistent with canonical category names.
    if(name!==old.name) await client.query(`UPDATE listing l SET
      utilities=COALESCE((SELECT jsonb_object_agg(c.name,true) 
      FROM listing_category_link x JOIN listing_category c USING(category_id) 
      WHERE x.listing_id=l.listing_id AND c.kind='utility'),'{}'::jsonb),
      transport_options=COALESCE((SELECT jsonb_agg(c.name ORDER BY c.category_id) 
      FROM listing_category_link x JOIN listing_category c USING(category_id) 
      WHERE x.listing_id=l.listing_id AND c.kind='transport'),'[]'::jsonb)
      WHERE EXISTS(SELECT 1 FROM listing_category_link x WHERE x.listing_id=l.listing_id AND x.category_id=$1)`,[id]);
    return updated;
  });
  res.json({category,message:'Category updated. Existing listing associations are preserved.'});
}));
module.exports=router;
