// ai：Listing Summary

const {generateGeminiJson}=require('./geminiClient');

// External AI invocation
async function generateListingSummary(listing) {
  // 1. GEMINI IMPLEMENTATION
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
          available_from: formatDateOnly(listing.available_from),
          room_type: listing.room_type,
          utilities: listing.utilities,
          transport_options: listing.transport_options,
        }),
      ].join('\n')
    );
    if (result?.summary)
      return { summary: removeIsoTimes(result.summary), mode: 'gemini' };
  } catch (error) {
    console.warn(`AI summary fallback: ${error.message}`);
  }
  // 2. LOCAL FALLBACK (Gemini unavailable or invalid)
  return { summary: summariseListing(listing), mode: 'local-fallback' };
}

// Local translation
function summariseListing({ description = '', rent, city, available_from }) {
  const sentence = description.split(/(?<=[.!?])\s+/)[0].slice(0, 220);
  return [
    sentence,
    rent && `Rent: $${rent}/week`,
    city && `Location: ${city}`,
    available_from && `Available: ${formatDateOnly(available_from)}`,
  ]
    .filter(Boolean)
    .join(' · ');
}

function formatDateOnly(value) {
  if (!value) return '';
  const isoDate = String(value).match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  return isoDate || String(value);
}

function removeIsoTimes(value = '') {
  return String(value).replace(
    /(\d{4}-\d{2}-\d{2})T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?/g,
    '$1'
  );
}

module.exports={generateListingSummary,summariseListing,formatDateOnly};
