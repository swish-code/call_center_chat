'use strict';
// Retrieval = vector search over knowledge_chunks + direct SQL for structured data.
// Structured data (branches, pricing) is NEVER fetched via vectors — accuracy matters.
const { query } = require('../db/pool');
const gemini = require('./gemini');
const config = require('../config');

/** Detect language naively: any Arabic character => 'ar', else 'en'. */
function detectLanguage(text) {
  return /[؀-ۿ]/.test(text) ? 'ar' : 'en';
}

/**
 * Vector search. Returns rows with a `similarity` in [0,1] (1 = identical).
 * pgvector's <=> is cosine DISTANCE, so similarity = 1 - distance.
 */
async function searchChunks(queryText, brandId, topK = config.retrieval.topK) {
  const vec = await gemini.embed(queryText);
  const literal = gemini.toVectorLiteral(vec);
  const params = [literal, topK];
  let where = 'WHERE embedding IS NOT NULL';
  if (brandId) {
    params.push(brandId);
    where += ` AND brand_id = $${params.length}`;
  }
  const sql = `
    SELECT id, brand_id, content, language, source,
           1 - (embedding <=> $1::vector) AS similarity
    FROM knowledge_chunks
    ${where}
    ORDER BY embedding <=> $1::vector
    LIMIT $2`;
  const { rows } = await query(sql, params);
  return rows;
}

// Brand aliases (Arabic + English) for detecting a brand mentioned in a question
// even when the UI filter is on "All brands".
const BRAND_ALIASES = {
  'Shawarma Shakir': ['shawarma shakir', 'shakir', 'شاورما شاكر', 'شاكر'],
  'Yelo Pizza': ['yelo pizza', 'yelo', 'يلو بيتزا', 'يلو'],
  'BBT': ['bbt', 'بي بي تي'],
  'Slice': ['slice', 'سلايس'],
  'Pattie Pattie': ['pattie pattie', 'pattie', 'باتي باتي', 'باتي'],
  'Just C': ['just c', 'جست سي', 'جست'],
  'Chili pepper': ['chili pepper', 'chili', 'chilli', 'تشيلي بيبر', 'تشيلي', 'شيلي'],
};

/** Detect a brand mentioned in free text; returns its id or null. */
async function detectBrandId(text) {
  if (!text) return null;
  const lower = String(text).toLowerCase();
  const { rows } = await query('SELECT id, name FROM brands');
  for (const r of rows) {
    const aliases = BRAND_ALIASES[r.name] || [r.name.toLowerCase()];
    if (aliases.some((a) => lower.includes(a.toLowerCase()))) return r.id;
  }
  return null;
}

/** Pull structured branch/pricing rows for a brand to enrich the context. */
async function fetchStructured(brandId) {
  if (!brandId) return { brandName: null, branches: [], pricing: [] };
  const [brand, branches, pricing] = await Promise.all([
    query('SELECT name FROM brands WHERE id = $1', [brandId]),
    query('SELECT name, address, city, phone, working_hours FROM branches WHERE brand_id = $1', [brandId]),
    query('SELECT item_name, price, currency, notes FROM pricing WHERE brand_id = $1', [brandId]),
  ]);
  return { brandName: brand.rows[0] ? brand.rows[0].name : null, branches: branches.rows, pricing: pricing.rows };
}

/** Build the CONTEXT block fed to Gemini from chunks + structured rows. */
function buildContext(chunks, structured) {
  const parts = [];
  if (chunks.length) {
    parts.push('# Knowledge base');
    chunks.forEach((c, i) => parts.push(`[${i + 1}] ${c.content}`));
  }
  const forBrand = structured.brandName ? ` for ${structured.brandName}` : '';
  if (structured.branches.length) {
    parts.push(`\n# Branches${forBrand} (total: ${structured.branches.length})`);
    structured.branches.forEach((b) =>
      parts.push(`- ${b.name}${b.city ? ', ' + b.city : ''}${b.address ? ' — ' + b.address : ''}` +
        `${b.phone ? ' | tel: ' + b.phone : ''}${b.working_hours ? ' | hours: ' + b.working_hours : ''}`));
  }
  if (structured.pricing.length) {
    parts.push(`\n# Pricing${forBrand} (total: ${structured.pricing.length})`);
    structured.pricing.forEach((p) =>
      parts.push(`- ${p.item_name}: ${p.price} ${p.currency}${p.notes ? ' (' + p.notes + ')' : ''}`));
  }
  return parts.join('\n');
}

module.exports = { detectLanguage, detectBrandId, searchChunks, fetchStructured, buildContext };
