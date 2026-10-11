const test = require('node:test');
const assert = require('node:assert/strict');

test(
  'structured profile locations and flexible dates persist and filter correctly',
  {
    skip: process.env.RUN_DATABASE_TESTS !== '1',
    timeout: 120000
  },
  async t => {
    require('dotenv').config({ quiet: true });
    process.env.GEMINI_API_KEY = '';

    const { pool } = require('../src/config/database');
    const express = require('express'),
      app = express();

    app.use(express.json());
    app.use(require('cookie-parser')());
    app.use('/auth', require('../src/routes/authRoutes'));
    app.use('/profile', require('../src/routes/profileRoutes'));
    app.use('/', require('../src/routes/communityRoutes'));
    app.use('/flatmates', require('../src/routes/flatmateRoutes').profiles);
    app.use(require('../src/middleware/errorHandler').errorHandler);

    const server = await new Promise(resolve => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });

    const prefix = `profile-options-${Date.now()}-${process.pid}`;

    const call = async (path, method = 'GET', body, cookie) => {
      const response = await fetch(
        `http://127.0.0.1:${server.address().port}${path}`,
        {
          method,
          headers: {
            'Content-Type': 'application/json',
            ...(cookie ? { Cookie: cookie } : {})
          },
          ...(body ? { body: JSON.stringify(body) } : {})
        }
      );
      return {
        status: response.status,
        data: await response.json(),
        cookie: response.headers.get('set-cookie')?.split(';')[0]
      };
    };

    const create = async name => {
      const r = await call(
        '/auth/register',
        'POST',
        {
          email: `${prefix}-${name}@example.invalid`,
          password: 'Test-only-password-928!',
          full_name: name,
          role: 'student',
          student_type: 'flatmate'
        }
      );
      assert.equal(r.status, 201, JSON.stringify(r.data));
      return { id: r.data.user.user_id, cookie: r.cookie };
    };

    try {
      const seeker = await create('Seeker'),
        flex = await create('Flexible'),
        fixed = await create('Fixed'),
        unset = await create('Unspecified');

      const profile = {
        preferred_city: 'Wellington',
        preferred_suburb: 'Kelburn',
        visible_for_matching: true,
        budget_min: 200
      };

      for (const [who, extra] of [
        [flex, { move_in_flexible: true }],
        [fixed, { move_in_date: '2026-12-10' }],
        [unset, {}]
      ]) {
        const r = await call(
          '/profile/me',
          'PUT',
          { ...profile, ...extra },
          who.cookie
        );
        assert.equal(r.status, 200, JSON.stringify(r.data));
      }

      const matches = async query => {
        const r = await call(
          '/matches?' + query,
          'GET',
          null,
          seeker.cookie
        );
        assert.equal(r.status, 200, JSON.stringify(r.data));
        return r.data.matches.map(p => p.user_id);
      };

      await t.test(
        'saved flexible flag and city/area survive reload and detail display',
        async () => {
          const saved = (await call('/profile/me', 'GET', null, flex.cookie)).data.profile;
          assert.equal(saved.move_in_flexible, true);
          assert.equal(saved.move_in_date, null);
          assert.equal(saved.preferred_city, 'Wellington');
          assert.equal(saved.preferred_suburb, 'Kelburn');
          assert.equal(saved.preferred_location, 'Kelburn, Wellington');

          const detail = await call('/flatmates/' + flex.id, 'GET', null, seeker.cookie);
          assert.equal(detail.status, 200);
          assert.equal(detail.data.flatmate.move_in_flexible, true);
        }
      );

      await t.test(
        'flexible people pass date bounds but unknown dates and out-of-range fixed dates do not',
        async () => {
          for (const query of [
            'moveInFrom=2027-01-01',
            'moveInTo=2026-01-01',
            'moveInFrom=2027-01-01&moveInTo=2027-01-02'
          ]) {
            const ids = await matches(query);
            assert.ok(ids.includes(flex.id));
            assert.ok(!ids.includes(fixed.id));
            assert.ok(!ids.includes(unset.id));
          }

          const exact = await matches('moveInFrom=2026-12-10&moveInTo=2026-12-10');
          assert.ok(exact.includes(flex.id));
          assert.ok(exact.includes(fixed.id));
          assert.ok((await matches('')).includes(unset.id));

          assert.equal(
            (await call('/matches?moveInFrom=2027-01-02&moveInTo=2027-01-01', 'GET', null, seeker.cookie)).status,
            400
          );

          const smart = await call(
            '/matches/smart-search?q=' + encodeURIComponent('in Wellington by 2026-01-01'),
            'GET',
            null,
            seeker.cookie
          );
          assert.equal(smart.status, 200, JSON.stringify(smart.data));
          assert.ok(smart.data.matches.some(person => person.user_id === flex.id));
          assert.ok(!smart.data.matches.some(person => person.user_id === fixed.id));
        }
      );

      await t.test(
        'structured city and area match exactly and flexibility does not bypass location',
        async () => {
          assert.ok(
            (await matches('city=Wellington&suburb=kelburn&moveInTo=2026-01-01')).includes(flex.id)
          );

          for (const query of [
            'city=Auckland',
            'city=Wellington&suburb=Kel',
            'city=Wellington&suburb=Newtown'
          ])
            assert.ok(!(await matches(query)).includes(flex.id));

          assert.equal(
            (await call('/profile/me', 'PUT', { ...profile, preferred_city: '' }, flex.cookie)).status,
            400
          );
        }
      );

      await t.test(
        'switching to a fixed date removes flexibility and partial dates are rejected',
        async () => {
          const r = await call(
            '/profile/me',
            'PUT',
            { ...profile, move_in_flexible: false, move_in_date: '2026-12-10' },
            flex.cookie
          );
          assert.equal(r.status, 200);
          assert.ok(!(await matches('moveInTo=2026-01-01')).includes(flex.id));
          assert.equal(
            (await call('/profile/me', 'PUT', { ...profile, move_in_date: '2026-12' }, flex.cookie)).status,
            400
          );
        }
      );
    } finally {
      try {
        await pool.query(
          'DELETE FROM users WHERE email LIKE $1',
          [prefix + '-%@example.invalid']
        );
      } finally {
        await new Promise(resolve => server.close(resolve));
        await pool.end();
      }
    }
  }
);