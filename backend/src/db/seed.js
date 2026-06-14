'use strict';
// Seeds a demo admin, sample brands, branches, pricing, and (if a Gemini key is
// present) a few knowledge chunks. Idempotent-ish: uses ON CONFLICT where it can.
const bcrypt = require('bcryptjs');
const { pool, query } = require('./pool');
const config = require('../config');
const knowledge = require('../services/knowledge');

async function main() {
  // ── Admin user ──
  const adminEmail = 'admin@example.com';
  const adminPass = 'admin1234';
  const hash = await bcrypt.hash(adminPass, 10);
  const admin = await query(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ('Admin', $1, $2, 'admin')
     ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
     RETURNING id`,
    [adminEmail, hash]
  );
  const adminId = admin.rows[0].id;
  console.log(`✓ Admin user: ${adminEmail} / ${adminPass}`);

  // A demo team leader and agent.
  await query(
    `INSERT INTO users (name, email, password_hash, role) VALUES
       ('Team Leader', 'leader@example.com', $1, 'team_leader'),
       ('Agent One',   'agent@example.com',  $1, 'agent')
     ON CONFLICT (email) DO NOTHING`,
    [hash]
  );
  console.log('✓ Demo users: leader@example.com, agent@example.com (password: admin1234)');

  // ── Brands ──
  const brand = await query(
    `INSERT INTO brands (name, description)
     VALUES ('Acme Telecom', 'Sample brand for demo')
     ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description
     RETURNING id`
  );
  const brandId = brand.rows[0].id;
  console.log('✓ Brand: Acme Telecom');

  // ── Structured data ──
  await query(
    `INSERT INTO branches (brand_id, name, address, city, phone, working_hours)
     VALUES
       ($1, 'Downtown Branch', '12 Tahrir St', 'Cairo', '+20 2 1234 5678', 'Sun–Thu 9:00–17:00'),
       ($1, 'Alexandria Branch', '5 Corniche Rd', 'Alexandria', '+20 3 8765 4321', 'Sat–Thu 10:00–18:00')
     ON CONFLICT DO NOTHING`,
    [brandId]
  );
  await query(
    `INSERT INTO pricing (brand_id, item_name, price, currency, notes)
     VALUES
       ($1, 'Basic Plan', 150.00, 'EGP', 'Monthly, 20GB'),
       ($1, 'Premium Plan', 350.00, 'EGP', 'Monthly, unlimited')
     ON CONFLICT DO NOTHING`,
    [brandId]
  );
  console.log('✓ Sample branches & pricing');

  // ── Knowledge chunks (needs Gemini for embeddings) ──
  if (config.gemini.apiKey) {
    const samples = [
      { content: 'Customers can request a refund within 14 days of purchase by contacting support with their invoice number.', language: 'en' },
      { content: 'يمكن للعملاء طلب استرداد الأموال خلال 14 يومًا من الشراء عبر التواصل مع الدعم وذكر رقم الفاتورة.', language: 'ar' },
      { content: 'SIM card replacement is free for the first time; subsequent replacements cost 50 EGP.', language: 'en' },
    ];
    for (const s of samples) {
      await knowledge.addChunk({ brandId, content: s.content, language: s.language, source: 'seed', createdBy: adminId });
    }
    console.log(`✓ ${samples.length} knowledge chunks embedded`);
  } else {
    console.log('⚠ Skipped knowledge chunks — GEMINI_API_KEY not set. Re-run `npm run seed` after adding it.');
  }

  await pool.end();
  console.log('\nDone.');
}

main().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
