if (process.env.NODE_ENV !== 'production') {
  console.log('Skipping seedDemo in development. Data already exists.');
  process.exit(0);
}
require('dotenv').config();
const bcrypt = require('bcrypt');
const { pool } = require('../src/config/database');
const svg = (label, a, b) => {
  const markup = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 600">
      <defs>
        <linearGradient id="g" x2="1" y2="1">
          <stop stop-color="${a}"/>
          <stop offset="1" stop-color="${b}"/>
        </linearGradient>
      </defs>
      <rect width="900" height="600" fill="url(#g)"/>
      <rect x="120" y="150" width="660" height="330" rx="28" fill="#fff" opacity=".9"/>
      <path d="M235 356 450 190l215 166v112H530V350H370v118H235Z" fill="${a}"/>
      <text x="450" y="540" text-anchor="middle" font-family="Arial" font-size="38"
        fill="#173d36">${label}</text>
    </svg>
  `;
  return `data:image/svg+xml;base64,${Buffer.from(markup).toString('base64')}`;
};
const users = [
  ['Mia Chen', 'demo.student1@flatmate.test', 'student', '0211000001'],
  ['Liam Patel', 'demo.student2@flatmate.test', 'student', '0211000002'],
  ['Sophie Williams', 'demo.student3@flatmate.test', 'student', '0211000003'],
  ['Harbour Homes', 'demo.advertiser1@flatmate.test', 'advertiser', '0212000001'],
  ['Campus Living NZ', 'demo.advertiser2@flatmate.test', 'advertiser', '0212000002'],
];
const listings = [
  [
    'Sunny single room near Massey campus',
    225,
    450,
    '12 Albany Highway',
    'Albany',
    'Auckland',
    'Single room',
    'A bright furnished room in a calm student flat. ' +
      'Ten minutes by bus to campus, with a desk, wardrobe and sunny garden.',
    'Quiet after 10pm; non-smoking.',
    { Internet: true, Water: true },
    ['Bus stop 2 min walk', 'Cycle lane'],
    '2026-09-05',
    '#83c5be',
    '#edf6f3',
  ],
  [
    'Modern studio in Mount Eden',
    310,
    620,
    '28 Dominion Road',
    'Mount Eden',
    'Auckland',
    'Studio',
    'Private modern studio with kitchenette and excellent natural light. ' +
      'Supermarket, cafes and frequent buses are nearby.',
    'No indoor smoking.',
    { Water: true },
    ['Bus stop 1 min walk'],
    '2026-09-12',
    '#d6a85f',
    '#f6ead2',
  ],
  [
    'Quiet double room by university shuttle',
    245,
    490,
    '6 College Street',
    'Palmerston North Central',
    'Palmerston North',
    'Double room',
    'Spacious double room in a tidy home shared with two postgraduate students. ' +
      'Ideal for focused study and an easy commute.',
    'Tidy shared spaces; no parties on weekdays.',
    { Internet: true, Power: true },
    ['University shuttle', 'Walk to campus'],
    '2026-09-01',
    '#739d8d',
    '#dcebe5',
  ],
  [
    'Social shared room in Te Aro',
    190,
    380,
    '41 Cuba Street',
    'Te Aro',
    'Wellington',
    'Shared room',
    'Affordable shared room in a friendly central flat. ' +
      'Great for students new to Wellington who enjoy shared meals and city life.',
    'Respectful noise and shared cleaning roster.',
    { Internet: true },
    ['Bus interchange', 'Walk to campus'],
    '2026-09-18',
    '#af7e7a',
    '#f0dcda',
  ],
  [
    'Furnished room close to Hamilton campus',
    215,
    430,
    '19 Knighton Road',
    'Hillcrest',
    'Hamilton',
    'Single room',
    'Fully furnished single room with fast internet and secure bike storage. ' +
      'Current flatmates are friendly, tidy and active.',
    'Non-smoking; pets by discussion.',
    { Internet: true, Water: true },
    ['Cycle lane', 'Bus stop 4 min walk'],
    '2026-09-08',
    '#7193ad',
    '#dce9f2',
  ],
  [
    'Peaceful garden room in Riccarton',
    235,
    470,
    '52 Riccarton Road',
    'Riccarton',
    'Christchurch',
    'Double room',
    'Warm double room overlooking a garden in an established student flat. ' +
      'Close to shops and a direct bus route to university.',
    'Quiet household; shared weekly cleaning.',
    { Internet: true },
    ['Direct university bus'],
    '2026-09-20',
    '#7f9f72',
    '#e2eddd',
  ],
];
async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('ALTER TABLE enquiry_message ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ');
    await client.query('ALTER TABLE profiles ADD COLUMN IF NOT EXISTS advertiser_bio TEXT');
    await client.query(
      'ALTER TABLE profiles ADD COLUMN IF NOT EXISTS display_phone BOOLEAN NOT NULL DEFAULT TRUE'
    );
    await client.query(
      "ALTER TABLE listing ADD COLUMN IF NOT EXISTS transport_options JSONB NOT NULL DEFAULT '[]'::jsonb"
    );
    await client.query('ALTER TABLE listing_photo ALTER COLUMN photo_url TYPE TEXT');
    const hash = await bcrypt.hash('Demo123!', 12);
    const ids = {};
    for (const [name, email, role, phone] of users) {
      const {
        rows: [u],
      } = await client.query(
        `
          INSERT INTO users (full_name, email, password_hash, role, phone)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT(email) DO NOTHING
          RETURNING user_id
        `,
        [name, email, hash, role, phone]
      );
      ids[email] = u.user_id;
    }
    const studentProfiles = [
      [
        'demo.student1@flatmate.test',
        180,
        260,
        'Albany',
        ['quiet', 'tidy', 'non-smoker'],
        'Morning study',
      ],
      [
        'demo.student2@flatmate.test',
        200,
        320,
        'Mount Eden',
        ['social', 'gym', 'tidy'],
        'Evening study',
      ],
      [
        'demo.student3@flatmate.test',
        170,
        250,
        'Palmerston North',
        ['quiet', 'cooking', 'early_bird'],
        'Morning study',
      ],
    ];
    for (const [email, min, max, location, tags, habits] of studentProfiles)
      await client.query(
        `
          INSERT INTO profiles (
            user_id, budget_min, budget_max, preferred_location, lifestyle_tags,
            study_habits, contact_preference, move_in_date, visible_for_matching
          )
          VALUES ($1, $2, $3, $4, $5::jsonb, $6, 'In-app message', '2026-09-01', true)
          ON CONFLICT(user_id) DO UPDATE SET
            budget_min = EXCLUDED.budget_min,
            budget_max = EXCLUDED.budget_max,
            preferred_location = EXCLUDED.preferred_location,
            lifestyle_tags = EXCLUDED.lifestyle_tags,
            study_habits = EXCLUDED.study_habits
        `,
        [ids[email], min, max, location, JSON.stringify(tags), habits]
      );
    for (const email of ['demo.advertiser1@flatmate.test', 'demo.advertiser2@flatmate.test'])
      await client.query(
        `
          INSERT INTO profiles (
            user_id, contact_preference, advertiser_bio, display_phone
          )
          VALUES ($1, 'In-app message', $2, true)
          ON CONFLICT(user_id) DO UPDATE SET
            advertiser_bio = EXCLUDED.advertiser_bio
        `,
        [
          ids[email],
          'Responsive local property team offering clear viewing times and student-friendly tenancy information.',
        ]
      );
    for (let i = 0; i < listings.length; i++) {
      const [
        title,
        rent,
        bond,
        address,
        suburb,
        city,
        type,
        description,
        rules,
        utilities,
        transport,
        date,
        a,
        b,
      ] = listings[i];
      const owner =
        i % 2 ? ids['demo.advertiser2@flatmate.test'] : ids['demo.advertiser1@flatmate.test'];
      let {
        rows: [item],
      } = await client.query('SELECT listing_id FROM listing WHERE title=$1 AND advertiser_id=$2', [
        title,
        owner,
      ]);
      if (!item) {
        ({
          rows: [item],
        } = await client.query(
          `
            INSERT INTO listing (
              advertiser_id, title, description, rent, bond, address, suburb,
              city, room_type, bedrooms, bathrooms, house_rules, utilities,
              transport_options, available_from, status
            )
            VALUES (
              $1, $2, $3, $4, $5, $6, $7,
              $8, $9, 1, 1, $10, $11::jsonb, $12::jsonb, $13, 'available'
            )
            RETURNING listing_id
          `,
          [
            owner,
            title,
            description,
            rent,
            bond,
            address,
            suburb,
            city,
            type,
            rules,
            JSON.stringify(utilities),
            JSON.stringify(transport),
            date,
          ]
        ));
      }
      await client.query('DELETE FROM listing_photo WHERE listing_id=$1', [item.listing_id]);
      await client.query(
        'INSERT INTO listing_photo(listing_id,photo_url,display_order) VALUES($1,$2,0)',
        [item.listing_id, svg(suburb, a, b)]
      );
    }
    await client.query('COMMIT');
    console.log(
      'Demo seed complete: 5 users, 6 listings and matching profiles are ready. Password: Demo123!'
    );
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}
main().catch((error) => {
  console.error(`Demo seed failed: ${error.message}`);
  process.exitCode = 1;
});
