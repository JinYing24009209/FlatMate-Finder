function getAiProviderStatus() {
  const configured = Boolean(process.env.GEMINI_API_KEY);
  return {
    mode: configured ? 'gemini' : 'local',
    configured,
    embeddingModel: process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-001',
    textModel: process.env.GEMINI_TEXT_MODEL || 'gemini-3.5-flash',
  };
}

async function fetchWithRetry(url, options) {
  const { acquire } = require('./aiBudget');
  const timeout = AbortSignal.timeout(12000);
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
  const timed = async (work) => {
    signal.throwIfAborted();
    let onAbort;
    const aborted = new Promise((_, reject) => {
      onAbort = () => reject(signal.reason);
      signal.addEventListener('abort', onAbort, { once: true });
    });
    try { return await Promise.race([work(), aborted]); }
    finally { signal.removeEventListener('abort', onAbort); }
  };
  let response;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    signal.throwIfAborted();
    const release = acquire();
    try {
      response = await timed(() => fetch(url, { ...options, signal }));
      if (response.ok) {
        const data = await timed(() => response.json());
        return { ok: true, status: response.status, json: async () => data };
      }
      await response.body?.cancel();
    } finally { release(); }
    if (response.ok || ![429, 500, 502, 503, 504].includes(response.status)) return response;
    if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 400));
  }
  return response;
}

async function generateGeminiJson(prompt, signal) {
  const status = getAiProviderStatus();
  if (status.mode !== 'gemini' || !status.configured) return null;
  if (typeof prompt !== 'string' || prompt.length > 40000) throw new Error('AI prompt exceeds the input limit.');
  const response = await fetchWithRetry(
    `https://generativelanguage.googleapis.com/v1beta/models/${status.textModel}:generateContent`,
    {
      method: 'POST',
      signal,
      headers: {
        'x-goog-api-key': process.env.GEMINI_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 4096,
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

module.exports={getAiProviderStatus,fetchWithRetry,generateGeminiJson};
