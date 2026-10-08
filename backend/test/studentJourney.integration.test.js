const test = require('node:test');
const assert = require('node:assert/strict');

// Opt-in: uses temporary accounts in the configured database, and removes them in finally.
test(
  'student journeys persist photos, favourites, private conversations and read state',
  { skip: process.env.RUN_DATABASE_TESTS !== '1', timeout: 180000 },
  async () => {
    require('dotenv').config({ quiet: true });
    const express = require('express');
    const cookieParser = require('cookie-parser');
    const { pool } = require('../src/config/database');
    const app = express();
    app.use(express.json({ limit: '8mb' }));
    app.use(cookieParser());
    app.use('/auth', require('../src/routes/authRoutes'));
    app.use('/profile', require('../src/routes/profileRoutes'));
    app.use('/listings', require('../src/routes/listingRoutes'));
    app.use('/', require('../src/routes/communityRoutes'));
    app.use('/flatmates', require('../src/routes/flatmateRoutes').profiles);
    app.use('/flatmate-conversations', require('../src/routes/flatmateRoutes').conversations);
    app.use(require('../src/middleware/errorHandler').errorHandler);
    const server = await new Promise((resolve) => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    const base = 'http://127.0.0.1:' + server.address().port;
    const ids = [];
    const stamp = Date.now();
    async function call(path, { cookie, method = 'GET', body } = {}) {
      const r = await fetch(base + path, {
        method,
        headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      return {
        status: r.status,
        data: await r.json(),
        cookie: r.headers.get('set-cookie')?.split(';')[0],
      };
    }
    try {
      const actors = [];
      for (const [i, type] of ['flatmate', 'flatmate', 'flatmate', 'housing'].entries()) {
        const email = 'journey-test-' + stamp + '-' + i + '@example.invalid';
        const a = await call('/auth/register', {
          method: 'POST',
          body: {
            full_name: 'Journey test ' + i,
            email,
            password: 'Temporary-test-pass-927!',
            role: 'student',
            student_type: type,
          },
        });
        assert.equal(a.status, 201, JSON.stringify(a.data));
        ids.push(a.data.user.user_id);
        actors.push({ ...a, email, id: a.data.user.user_id });
      }
      const [a, b, c, h] = actors;
      const photo =
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l1sAAAAASUVORK5CYII=';
      for (const actor of actors)
        assert.equal(
          (
            await call('/profile/me', {
              cookie: actor.cookie,
              method: 'PUT',
              body: {
                preferred_location: 'Auckland',
                budget_min: 150,
                budget_max: 300,
                study_habits: 'Morning',
                lifestyle_tags: ['tidy'],
                move_in_date: '2026-10-10',
                profile_photo: photo,
                about_me: 'A test introduction.',
                visible_for_matching: true,
              },
            })
          ).status,
          200
        );
      const persisted = await call('/profile/me', { cookie: b.cookie });
      assert.equal(persisted.data.profile.profile_photo, photo);
      assert.equal(persisted.data.profile.move_in_date, '2026-10-10');
      const login = await call('/auth/login', {
        method: 'POST',
        body: { email: b.email, password: 'Temporary-test-pass-927!' },
      });
      assert.equal(login.data.user.student_type, 'flatmate');
      assert.equal(
        (await call('/auth/me', { cookie: login.cookie })).data.user.student_type,
        'flatmate'
      );
      const {
        rows: [expected],
      } = await pool.query("SELECT count(*)::int total FROM listing WHERE status='available'");
      const all = await call('/listings?q=&city=&minRent=&maxRent=&roomType=&availableFrom=');
      assert.equal(all.status, 200);
      assert.equal(all.data.listings.length, expected.total);
      assert.equal((await call('/listings?minRent=500&maxRent=100')).status, 400);
      const matches = await call('/matches', { cookie: a.cookie });
      assert(matches.data.matches.some((x) => x.user_id === b.id));
      assert(!matches.data.matches.some((x) => x.user_id === h.id || x.user_id === a.id));
      assert.equal((await call('/flatmates/' + b.id, { cookie: h.cookie })).status, 403);
      const detail = await call('/flatmates/' + b.id, { cookie: a.cookie });
      assert.equal(detail.data.flatmate.profile_photo, photo);
      assert(!('email' in detail.data.flatmate));
      assert.equal(
        (await call('/flatmates/' + b.id + '/save', { cookie: a.cookie, method: 'POST' })).status,
        201
      );
      assert(
        (await call('/saved-flatmates', { cookie: a.cookie })).data.matches.some(
          (x) => x.user_id === b.id
        )
      );
      const started = await call('/flatmates/' + b.id + '/enquiries', {
        cookie: a.cookie,
        method: 'POST',
        body: { body: 'Hello from A' },
      });
      assert.equal(started.status, 201, JSON.stringify(started.data));
      const id = started.data.conversation_id;
      const again = await call('/flatmates/' + a.id + '/enquiries', {
        cookie: b.cookie,
        method: 'POST',
        body: { body: 'Hello from B' },
      });
      assert.equal(again.data.conversation_id, id);
      for (const actor of [a, b])
        assert.equal(
          (await call('/flatmate-conversations', { cookie: actor.cookie })).data.conversations
            .length,
          1
        );
      assert.equal(
        (await call('/flatmate-conversations/' + id + '/messages', { cookie: c.cookie })).status,
        404
      );
      assert.equal(
        (
          await call('/flatmate-conversations/' + id + '/messages', {
            cookie: c.cookie,
            method: 'POST',
            body: { body: 'intrusion' },
          })
        ).status,
        404
      );
      assert.equal(
        (
          await call('/flatmate-conversations/' + id + '/read', {
            cookie: c.cookie,
            method: 'PATCH',
          })
        ).status,
        404
      );
      assert.equal(
        (
          await call('/flatmate-conversations/' + id + '/messages', {
            cookie: a.cookie,
            method: 'POST',
            body: { body: '   ' },
          })
        ).status,
        400
      );
      assert.equal((await call('/unread-count', { cookie: b.cookie })).data.unread, 1);
      assert.equal(
        (await call('/flatmate-conversations/' + id + '/messages', { cookie: b.cookie })).data
          .messages.length,
        2
      );
      await call('/flatmate-conversations/' + id + '/read', { cookie: b.cookie, method: 'PATCH' });
      assert.equal((await call('/unread-count', { cookie: b.cookie })).data.unread, 0);
      assert(
        (await call('/notifications', { cookie: b.cookie })).data.notifications.every(
          (x) => x.is_read
        )
      );
      assert.equal(
        (
          await call('/flatmate-conversations/' + id + '/messages', {
            cookie: b.cookie,
            method: 'POST',
            body: { body: 'A reply' },
          })
        ).status,
        201
      );
      await pool.query('UPDATE profiles SET visible_for_matching=false WHERE user_id=$1', [b.id]);
      assert.equal((await call('/flatmates/' + b.id, { cookie: a.cookie })).status, 404);
      assert.equal(
        (
          await call('/flatmates/' + b.id + '/enquiries', {
            cookie: a.cookie,
            method: 'POST',
            body: { body: 'new intro' },
          })
        ).status,
        404
      );
      assert.equal(
        (await call('/flatmate-conversations/' + id + '/messages', { cookie: a.cookie })).data
          .messages.length,
        3
      );
      await call('/flatmates/' + b.id + '/save', { cookie: a.cookie, method: 'DELETE' });
      assert.equal((await call('/saved-flatmates', { cookie: a.cookie })).data.matches.length, 0);
      console.log('Database journey checks passed; available listings: ' + expected.total);
    } finally {
      await pool.query('DELETE FROM users WHERE user_id=ANY($1::int[])', [ids]);
      await new Promise((resolve) => server.close(resolve));
      await pool.end();
    }
  }
);
