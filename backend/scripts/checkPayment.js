// Database smoke check: all test data and status changes are rolled back.
require('dotenv').config({ quiet: true });
const assert = require('node:assert/strict');
const { pool } = require('../src/config/database');
const router = require('../src/routes/paymentRoutes');

async function main() {
  const client = await pool.connect();
  const originalQuery = pool.query;
  const originalConnect = pool.connect;
  try {
    await client.query('BEGIN');
    const suffix = `payment-check-${Date.now()}`;
    const { rows: [student] } = await client.query(
      `INSERT INTO users(full_name,email,password_hash,role,student_type)
       VALUES('Payment check',$1,'not-a-login','student','housing') RETURNING user_id`,
      [`${suffix}@example.invalid`]
    );
    const { rows: [listing] } = await client.query(
      `INSERT INTO listing(advertiser_id,title,rent,address,city,room_type,available_from)
       VALUES($1,'Payment check',255,'Test address','Test city','Single room',CURRENT_DATE)
       RETURNING listing_id`, [student.user_id]
    );
    pool.query = client.query.bind(client);
    pool.connect = async () => ({
      query: (sql, values) => client.query(
        sql === 'BEGIN' ? 'SAVEPOINT payment_check' :
          sql === 'COMMIT' ? 'RELEASE SAVEPOINT payment_check' :
            sql === 'ROLLBACK' ? 'ROLLBACK TO SAVEPOINT payment_check' : sql, values
      ),
      release() {},
    });
    const call = (path, req) => new Promise((resolve, reject) => {
      const handler = router.stack.find((layer) => layer.route?.path === path).route.stack[0].handle;
      const res = { statusCode: 200, status(code) { this.statusCode = code; return this; },
        json(data) { resolve({ status: this.statusCode, data }); } };
      handler({ user: { userId: student.user_id }, ...req }, res, reject);
    });
    const first = await call('/checkout', { body: { listing_id: listing.listing_id } });
    assert.equal(first.status, 201);
    assert.equal(first.data.payment.status, 'pending');
    assert.equal(first.data.payment.listing_status, 'available');
    const repeated = await call('/checkout', { body: { listing_id: listing.listing_id } });
    assert.equal(repeated.data.payment.payment_id, first.data.payment.payment_id);
    const result = await call('/:id/complete-demo', { params: { id: first.data.payment.payment_id } });
    assert.equal(result.status, 200);
    assert.equal(result.data.payment.status, 'succeeded');
    const closed = await call('/checkout', { body: { listing_id: listing.listing_id } });
    assert.equal(closed.status, 409);
    console.log('PASS: checkout, pending reuse, completion and unavailable listing rejection.');
  } finally {
    pool.query = originalQuery;
    pool.connect = originalConnect;
    await client.query('ROLLBACK');
    client.release();
    await pool.end();
    console.log('All smoke-check records rolled back.');
  }
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
