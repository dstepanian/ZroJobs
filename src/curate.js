import config from './config.js';
import { generateJson } from './gemini.js';

const TAGS = ['dev', 'qa', 'design', 'product', 'data', 'devops', 'other-tech'];

const describe = (job, n) => {
  const bits = [
    `${n + 1}. [${job.source}] ${job.title}`,
    job.company && `Company: ${job.company}`,
    job.location && `Location: ${job.location}`,
    job.remote && 'Remote-friendly',
    `Market: ${job.market === 'international' ? 'international/remote' : 'Armenia'}`,
    job.category && `Category: ${job.category}`,
    job.text && `Post text: ${job.text.slice(0, 600)}`,
  ].filter(Boolean);
  return bits.join(' | ');
};

// ---- Pass 1: pick the best tech jobs (no summaries yet — the picked jobs get
// enriched with detail-page text first, then summarized in pass 2). ----

const buildPickPrompt = (jobs, min, max, internationalMin, internationalMax) => `
You are the editor of a daily Armenian tech-jobs digest on Telegram.
Below are ${jobs.length} candidate postings scraped from job boards and Telegram
channels (mixed Armenian/English/Russian, mixed quality, some are not tech jobs).

Your job:
1. Keep ONLY tech/IT vacancies: software development, QA, UI/UX & web design,
   product/project management in tech, data, DevOps/infra. Drop everything else
   (sales, admin, finance, driving, ads, courses, resumes, non-job posts).
2. Merge duplicates: if the same vacancy (same company + same role) appears in
   several sources, keep the one with the better link (prefer job boards over
   Telegram reposts) and output it once.
3. Pick the ${min}-${max} best of what remains — prefer named companies, clear
   roles, senior/interesting positions, and remote-friendly offers. If fewer than
   ${min} real tech jobs exist, return only what's real; never pad with non-tech.
4. Keep a deliberate market mix: choose ${internationalMin}-${internationalMax}
   jobs marked "Market: international/remote" when enough such candidates exist,
   and fill the remaining slots with jobs marked "Market: Armenia". If fewer
   than ${internationalMin} international candidates are available, use all that
   are genuinely suitable; never invent or relabel a job's market. Prefer no
   more than one international job per company when other companies are available.
5. For each pick, output:
   - "index": the NUMBER of the candidate (from the numbered list) — required for linking.
   - "title": the job title in English, cleaned up (e.g. "Senior Backend Engineer").
     If the posting is only in Armenian or Russian, translate the title to English.
   - "company": company name as written, or "" if genuinely unknown.
   - "location": city in Armenian (e.g. "Երևան"), or "Հեռավար" if remote-only, or "".
   - "tag": one of ${TAGS.join(', ')}.

Return ONLY JSON matching the schema. No markdown, no commentary.

Candidates:
${jobs.map(describe).join('\n')}
`.trim();

const pickSchema = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          index: { type: 'integer' },
          title: { type: 'string' },
          company: { type: 'string' },
          location: { type: 'string' },
          tag: { type: 'string', enum: TAGS },
        },
        required: ['index', 'title', 'tag'],
      },
    },
  },
  required: ['items'],
};

// Returns curated [{ id, title, company, location, tag, url, source, ... }].
// Throws on failure so the caller can fall back to an uncurated list.
export const curate = async (jobs) => {
  if (!jobs.length) return [];
  const parsed = await generateJson(
    buildPickPrompt(
      jobs,
      config.digestMin,
      config.digestMax,
      config.internationalMin,
      config.internationalMax,
    ),
    pickSchema,
  );

  const pickedIds = new Set();
  const curated = (Array.isArray(parsed.items) ? parsed.items : [])
    .slice(0, config.digestMax)
    .map(({ index, title, company, location, tag }) => {
      // Gemini returns a 1-based index into the numbered candidate list.
      const raw = jobs[index - 1];
      if (!raw || pickedIds.has(raw.id)) return null;
      pickedIds.add(raw.id);
      return {
        ...raw,
        title: (title || raw.title).trim(),
        company: (company ?? raw.company ?? '').trim(),
        location: (location ?? raw.location ?? '').trim(),
        tag,
      };
    })
    .filter(Boolean);

  // The prompt asks Gemini for a mix, but enforce it here as well. If Gemini
  // under-selects international jobs, replace the least-preferred Armenia picks
  // with eligible remote candidates instead of relying on model compliance.
  const internationalCandidates = jobs.filter((job) => job.market === 'international');
  const maxInternational = Math.min(config.internationalMax, config.digestMax);
  const companyKey = (job) =>
    (job.company || job.id).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const internationalCompanies = new Set();
  const international = curated
    .filter((job) => job.market === 'international')
    .filter((job) => {
      const key = companyKey(job);
      if (internationalCompanies.has(key)) return false;
      internationalCompanies.add(key);
      return true;
    })
    .slice(0, maxInternational);
  const armenia = curated.filter((job) => job.market !== 'international');

  const rawPick = (job) => ({
    ...job,
    title: (job.title || '').trim(),
    company: (job.company || '').trim(),
    location: (job.location || '').trim(),
    tag: job.tag || 'other-tech',
  });

  // Prefer one international job per company. Enforce the minimum here, while
  // allowing Gemini to keep additional strong picks up to the configured max.
  // This avoids exhausting a finite remote feed twice per day.
  const availableInternationalCompanies = new Set(internationalCandidates.map(companyKey));
  const desiredInternational = Math.min(
    config.internationalMin,
    maxInternational,
    availableInternationalCompanies.size,
  );
  const targetSize = Math.min(config.digestMax, curated.length);
  for (const candidate of internationalCandidates) {
    if (international.length >= desiredInternational) break;
    if (pickedIds.has(candidate.id)) continue;
    const key = companyKey(candidate);
    if (internationalCompanies.has(key)) continue;
    pickedIds.add(candidate.id);
    internationalCompanies.add(key);
    if (international.length + armenia.length >= targetSize && armenia.length) armenia.pop();
    international.push(rawPick(candidate));
  }

  // If Gemini selected too many international jobs, use the next local picks to
  // keep the total digest size stable where possible.
  if (international.length + armenia.length < targetSize) {
    for (const candidate of jobs) {
      if (international.length + armenia.length >= targetSize) break;
      if (candidate.market === 'international' || pickedIds.has(candidate.id)) continue;
      pickedIds.add(candidate.id);
      armenia.push(rawPick(candidate));
    }
  }

  return [...international, ...armenia].slice(0, config.digestMax);
};

// ---- Pass 2: one-line Armenian summaries from the enriched detail text. ----

// Each vacancy is its own Telegram post now, so a job gets a few short bullets
// instead of the single line the old shared-message digest could afford.
const MAX_POINTS = 3;

const buildSummaryPrompt = (jobs) => `
You write the body of a tech-job post for a Telegram channel, in Eastern Armenian.
For each numbered job below, write "points": 1-${MAX_POINTS} very short lines
covering, in this order and only where the posting actually says so:
1. what the person will work on and the tech stack,
2. the experience / level required,
3. one standout condition (flexible hours, relocation, hybrid, equity, courses...).

Rules:
- Each line stands alone, max ~90 characters, no trailing period.
- Keep technology names in English (React, Node.js, Python, Kubernetes).
- Never mention the title, company, location, salary or deadline — the post shows
  those separately. Never invent anything the posting doesn't state.
- If the posting genuinely says nothing beyond the title, return an empty list.

Return ONLY JSON matching the schema. No markdown, no commentary.

Jobs:
${jobs.map((j, n) => `${n + 1}. ${j.title} @ ${j.company || '?'}\n${(j.text || '').slice(0, 1800) || '(no details)'}`).join('\n---\n')}
`.trim();

const summarySchema = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          index: { type: 'integer' },
          points: { type: 'array', items: { type: 'string' } },
        },
        required: ['index', 'points'],
      },
    },
  },
  required: ['items'],
};

// Mutates nothing; returns the jobs with summaryHy attached (bullet per line)
// where Gemini had something to say. Callers treat a failure as "no summaries".
export const summarize = async (jobs) => {
  if (!jobs.length) return jobs;
  const parsed = await generateJson(buildSummaryPrompt(jobs), summarySchema);
  const byIndex = new Map(
    (Array.isArray(parsed.items) ? parsed.items : []).map((it) => [it.index, it.points]),
  );
  return jobs.map((j, n) => ({
    ...j,
    summaryHy: (byIndex.get(n + 1) || [])
      .map((p) => (p || '').trim())
      .filter(Boolean)
      .slice(0, MAX_POINTS)
      .map((p) => `• ${p}`)
      .join('\n'),
  }));
};
