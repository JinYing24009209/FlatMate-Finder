// AI-enhanced feature: Safety Support
// This AI feature prefers an external AI implementation, with a local fallback when the AI call fails.

const {generateGeminiJson}=require('./geminiClient');

// ==================== External AI call (Gemini preferred) ====================
async function enhancedSafetyCheck(listing) {
  // 1. GEMINI IMPLEMENTATION
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
      // 2. LOCAL FALLBACK RULES ALSO PROVIDE A SAFETY FLOOR
      const local = safetyCheck(listing);
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
  // 2. LOCAL FALLBACK (Gemini unavailable or invalid)
  return { ...safetyCheck(listing), mode: 'local-fallback' };
}

// ==================== Local algorithm (fallback) ====================
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

module.exports={enhancedSafetyCheck,safetyCheck};