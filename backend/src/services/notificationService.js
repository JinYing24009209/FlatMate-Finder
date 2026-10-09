// G. 站内通知服务 | G. In-app notification service.
const { pool } = require('../config/database');

// G01：接收通知的用户、通知类型、提示文字，以及可选的关联对象信息。 | G01. Accept the recipient, notification type, message and optional related entity.
const notify = (userId, type, message, entityType = null, entityId = null, database = pool) =>
  database.query(
    'INSERT INTO notification (user_id,type,message,related_entity_type,related_entity_id) VALUES ($1,$2,$3,$4,$5)',
    [userId, type, message, entityType, entityId]
  );
module.exports = { notify };
 
