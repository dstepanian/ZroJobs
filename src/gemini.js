import config from './config.js';

const endpoint = (model, key) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

// Fallback chain, tried in order after the configured primary. Mixing the 2.5 and
// 2.0 generations matters: when all of 2.5 is overloaded (503), the 2.0 models run
// on separate infrastructure and are rarely congested at the same moment.
const FALLBACK_MODELS = [
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
];
const TRANSIENT = new Set([500, 502, 503]); // momentary overload — retry same model
const MAX_ATTEMPTS = 3;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const callOnce = async (model, body) => {
  const res = await fetch(endpoint(model, config.geminiKey), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (res.ok) {
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Gemini returned no text');
    return JSON.parse(text);
  }
  const detail = await res.text().catch(() => '');
  const err = new Error(`Gemini ${res.status} (${model}): ${detail.slice(0, 160)}`);
  err.status = res.status;
  throw err;
};

// Single place that calls Gemini and returns parsed JSON matching responseSchema.
// Retries transient overloads on the primary model, then falls back to a second
// model (fresh quota) on 429/persistent failure. Throws only if everything fails.
export const generateJson = async (prompt, responseSchema) => {
  if (!config.geminiKey) throw new Error('GEMINI_API_KEY missing');

  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.3, responseMimeType: 'application/json', responseSchema },
  };

  // Primary first, then each fallback that isn't already the primary.
  const models = [config.geminiModel, ...FALLBACK_MODELS.filter((m) => m !== config.geminiModel)];

  let lastErr;
  for (let m = 0; m < models.length; m++) {
    const model = models[m];
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        return await callOnce(model, body);
      } catch (e) {
        lastErr = e;
        // 429 (quota) won't clear by retrying this model — jump to the fallback.
        if (e.status === 429) break;
        // Non-transient (e.g. 400/403) — no point retrying or falling back.
        if (e.status && !TRANSIENT.has(e.status)) throw e;
        if (attempt < MAX_ATTEMPTS) {
          const wait = attempt * 2000;
          console.error(`[gemini] ${e.message} — retry ${attempt}/${MAX_ATTEMPTS - 1} in ${wait}ms`);
          await sleep(wait);
        }
      }
    }
    // Only announce a fallback when there's actually a different model left to try.
    const next = models[m + 1];
    if (next) console.error(`[gemini] ${model} exhausted — trying ${next}`);
    else console.error(`[gemini] ${model} exhausted — no models left`);
  }
  throw lastErr;
};
