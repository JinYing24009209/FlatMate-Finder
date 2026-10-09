// G. 站内通知服务 | G. In-app notification service.
const { pool } = require('../config/database');

// G01：接收通知的用户、通知类型、提示文字，以及可选的关联对象信息。 | G01. Accept the recipient, notification type, message and optional related entity.
const notify = (userId, type, message, entityType = null, entityId = null, database = pool) =>
  database.query(
    'INSERT INTO notification (user_id,type,message,related_entity_type,related_entity_id) VALUES ($1,$2,$3,$4,$5)',
    [userId, type, message, entityType, entityId]
  );
const dateOnly = (value) => value instanceof Date ? value.toISOString().slice(0,10) : String(value || '').slice(0,10);
function listingSnapshot(listing) {
  return { listing_id:listing.listing_id,title:listing.title,rent:Number(listing.rent),bond:Number(listing.bond || 0),
    available_from:dateOnly(listing.available_from),status:listing.status };
}
async function notifyListingChange(client, before, after) {
  const old=listingSnapshot(before),current=after?listingSnapshot(after):null;
  const changed=current?['rent','bond','available_from','status'].filter(k=>old[k]!==current[k]):['deleted'];
  if(!changed.length)return;
  const labels={rent:'Weekly rent',bond:'Bond',available_from:'Available from',status:'Status'};
  const details=current?changed.map(k=>`${labels[k]}: ${old[k]} → ${current[k]}`).join('; '):'The advertiser or administrator removed this listing. It can no longer be opened.';
  const message=`Saved listing “${old.title}”: ${details}`.slice(0,500);
  // Notifications have no listing FK, so both text and snapshot survive deletion.
  await client.query(`INSERT INTO notification(user_id,type,message,related_entity_type,related_entity_id,metadata)
    SELECT student_id,$2,$3,$4,$1,$5::jsonb FROM saved_listing WHERE listing_id=$1`,
    [old.listing_id,current?'listing_updated':'listing_deleted',message,current?'listing':'deleted_listing',
      JSON.stringify({before:old,after:current,changed})]);
}
async function notifyAdminsOfReport(client, report) {
  await client.query(`INSERT INTO notification(user_id,type,message,related_entity_type,related_entity_id)
    SELECT user_id,'new_report',$1,'report',$2 FROM users WHERE role='admin' AND is_active=true`,
    [`New ${report.target_type || 'listing'} report #${report.report_id}: ${report.reason}`.slice(0,500),report.report_id]);
}
module.exports = { notify, notifyListingChange, notifyAdminsOfReport, listingSnapshot };
 
