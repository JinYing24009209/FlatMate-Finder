const { pool } = require('../config/database');
const notify = (userId, type, message, entityType = null, entityId = null) =>
  pool.query(
    'INSERT INTO notification (user_id,type,message,related_entity_type,related_entity_id) VALUES ($1,$2,$3,$4,$5)',
    [userId, type, message, entityType, entityId]
  );
module.exports = { notify };
