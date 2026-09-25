/*
 * AI integration boundary. Replace the transparent local functions below with
 * an LLM/embedding provider (OpenAI, etc.) by adding its API key to .env.
 * Keeping this file separate makes the AI evidence easy to explain in a demo.
 */
function parseNaturalLanguageSearch(input = '') {
  const text = input.toLowerCase();
  const between = /(?:between|from)\s*\$?(\d+)\s*(?:and|to|-)\s*\$?(\d+)/.exec(text);
  return {
    minRent:
      Number(between?.[1]) ||
      Number(/(?:over|above|at least|minimum|min)\s*\$?(\d+)/.exec(text)?.[1]) ||
      null,
    maxRent:
      Number(between?.[2]) ||
      Number(/(?:under|below|less than|up to|maximum|max)\s*\$?(\d+)/.exec(text)?.[1]) ||
      Number(/\$\s?(\d+)/.exec(text)?.[1]) ||
      null,
    city:
      ['auckland', 'wellington', 'palmerston north', 'christchurch', 'hamilton', 'dunedin'].find(
        (city) => text.includes(city)
      ) || '',
    quiet: text.includes('quiet'),
    furnished: text.includes('furnished'),
    transport:
      ['bus', 'train', 'shuttle', 'walk', 'cycle'].find((item) => text.includes(item)) || '',
    roomType:
      ['studio', 'single room', 'double room', 'shared room'].find((item) => text.includes(item)) ||
      '',
    lifestyle: ['non-smoker', 'tidy', 'social', 'pet friendly', 'student'].filter((item) =>
      text.includes(item)
    ),
  };
}
function summariseListing({ description = '', rent, city, available_from }) {
  const sentence = description.split(/(?<=[.!?])\s+/)[0].slice(0, 220);
  return [
    sentence,
    rent && `Rent: $${rent}/week`,
    city && `Location: ${city}`,
    available_from && `Available: ${available_from}`,
  ]
    .filter(Boolean)
    .join(' · ');
}
function safetyCheck({ description = '', address = '' }) {
  const content = description.toLowerCase();
  const flags = [];
  if (content.length < 30) flags.push('Description is too short to assess.');
  if (/western union|crypto|gift card|pay before viewing/.test(content))
    flags.push('Contains a payment/scam risk phrase.');
  if (!address.trim()) flags.push('Address is incomplete.');
  if (/urgent payment|no viewing|cash only|send deposit|too good to be true/.test(content))
    flags.push('Contains high-pressure or no-viewing language.');
  if (/whatsapp|telegram|contact me off.?site|bit\.ly|tinyurl/.test(content))
    flags.push('Asks users to move quickly to an off-platform channel or shortened link.');
  return {
    safe: flags.length === 0,
    risk_score: Math.min(100, flags.length * 34),
    flags,
    explanation:
      'Explainable rule-based screening only; an administrator makes the final decision.',
  };
}

function getAiProviderStatus() {
  const mode = process.env.AI_MODE || 'local';
  const configured =
    (mode === 'gemini' && Boolean(process.env.GEMINI_API_KEY)) ||
    (mode === 'openai' && Boolean(process.env.OPENAI_API_KEY));
  return {
    mode: configured ? mode : 'local',
    configured,
    embeddingModel:
      mode === 'gemini'
        ? process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-001'
        : process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
    textModel: mode === 'gemini' ? process.env.GEMINI_TEXT_MODEL || 'gemini-3.6-flash' : null,
  };
}

async function fetchWithRetry(url, options) {
  let response;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    response = await fetch(url, options);
    if (response.ok || ![429, 500, 502, 503, 504].includes(response.status)) return response;
    if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 400));
  }
  return response;
}

async function generateGeminiJson(prompt) {
  const status = getAiProviderStatus();
  if (status.mode !== 'gemini' || !status.configured) return null;
  const response = await fetchWithRetry(
    `https://generativelanguage.googleapis.com/v1beta/models/${status.textModel}:generateContent`,
    {
      method: 'POST',
      headers: {
        'x-goog-api-key': process.env.GEMINI_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json',
        },
      }),
    }
  );
  if (!response.ok) throw new Error(`Gemini text service returned ${response.status}.`);
  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('');
  return text ? JSON.parse(text) : null;
}

async function generateListingSummary(listing) {
  const localSummary = summariseListing(listing);
  try {
    const result = await generateGeminiJson(
      [
        'Summarise this student accommodation listing in one factual sentence under 55 words.',
        'Do not invent facts. Return JSON with exactly one string field named summary.',
        JSON.stringify({
          title: listing.title,
          description: listing.description,
          rent_per_week: listing.rent,
          suburb: listing.suburb,
          city: listing.city,
          available_from: listing.available_from,
          room_type: listing.room_type,
          utilities: listing.utilities,
          transport_options: listing.transport_options,
        }),
      ].join('\n')
    );
    if (result?.summary) return { summary: result.summary, mode: 'gemini' };
  } catch (error) {
    console.warn(`AI summary fallback: ${error.message}`);
  }
  return { summary: localSummary, mode: 'local-fallback' };
}

async function enhancedSafetyCheck(listing) {
  const local = safetyCheck(listing);
  try {
    const result = await generateGeminiJson(
      [
        'Review this student accommodation text for scam pressure, suspicious payment requests,',
        'requests to move off-platform, discrimination, and important missing information.',
        'Return JSON with safe (boolean), risk_score (integer 0-100), and flags (string array).',
        'This is decision support only. Do not invent facts.',
        JSON.stringify({
          title: listing.title,
          description: listing.description,
          suburb: listing.suburb,
          city: listing.city,
          rent_per_week: listing.rent,
          bond: listing.bond,
        }),
      ].join('\n')
    );
    if (result && Array.isArray(result.flags)) {
      const flags = [...new Set([...local.flags, ...result.flags.map(String)])];
      const risk = Math.max(local.risk_score, Number(result.risk_score) || 0);
      return {
        safe: Boolean(result.safe) && flags.length === 0,
        risk_score: Math.min(100, Math.max(0, Math.round(risk))),
        flags,
        explanation: 'Gemini-assisted screening combined with transparent local safety rules.',
        mode: 'gemini',
      };
    }
  } catch (error) {
    console.warn(`AI safety fallback: ${error.message}`);
  }
  return { ...local, mode: 'local-fallback' };
}

function keywordSimilarity(query, listing) {
  const stopWords = new Set(['a', 'an', 'and', 'for', 'in', 'near', 'of', 'room', 'the', 'to']);
  const queryTerms = String(query || '')
    .toLowerCase()
    .match(/[a-z0-9]+/g)
    ?.filter((term) => term.length > 1 && !stopWords.has(term));
  if (!queryTerms?.length) return 0;
  const listingText = [
    listing.title,
    listing.description,
    listing.suburb,
    listing.city,
    listing.room_type,
    listing.house_rules,
    JSON.stringify(listing.transport_options || []),
  ]
    .join(' ')
    .toLowerCase();
  const matches = queryTerms.filter((term) => listingText.includes(term)).length;
  return Math.round((matches / new Set(queryTerms).size) * 100);
}
// Optional semantic provider. Local mode remains the reliable privacy-first fallback.
async function createEmbedding(text, taskType = 'SEMANTIC_SIMILARITY') {
  try {
    if (process.env.AI_MODE === 'gemini' && process.env.GEMINI_API_KEY) {
      const model = process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-001';
      const response = await fetchWithRetry(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent`,
        {
          method: 'POST',
          headers: {
            'x-goog-api-key': process.env.GEMINI_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            taskType,
            content: { parts: [{ text: text.slice(0, 8000) }] },
          }),
        }
      );
      if (!response.ok) throw new Error(`Gemini embedding service returned ${response.status}.`);
      const data = await response.json();
      return data.embedding?.values || data.embeddings?.[0]?.values || null;
    }
    if (process.env.AI_MODE !== 'openai' || !process.env.OPENAI_API_KEY) return null;
    const response = await fetchWithRetry('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
        input: text.slice(0, 8000),
      }),
    });
    if (!response.ok) throw new Error(`Embedding service returned ${response.status}.`);
    const data = await response.json();
    return data.data[0].embedding;
  } catch (error) {
    console.warn(`Embedding fallback: ${error.message}`);
    return null;
  }
}
function cosineSimilarity(a, b) {
  if (!a?.length || !b?.length || a.length !== b.length) return 0;
  let dot = 0,
    aa = 0,
    bb = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    aa += a[i] ** 2;
    bb += b[i] ** 2;
  }
  return dot / (Math.sqrt(aa) * Math.sqrt(bb) || 1);
}
