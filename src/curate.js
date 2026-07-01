import config from './config.js';
import { generateJson } from './gemini.js';

const TAGS = ['dev', 'qa', 'design', 'product', 'data', 'devops', 'other-tech'];

const describe = (job, n) => {
  const bits = [
    `${n + 1}. [${job.source}] ${job.title}`,
    job.company && `Company: ${job.company}`,
    job.location && `Location: ${job.location}`,
    job.remote && 'Remote-friendly',
    job.category && `Category: ${job.category}`,
    job.text && `Post text: ${job.text}`,
  ].filter(Boolean);
  return bits.join(' | ');
};

const buildPrompt = (jobs, min, max) => `
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
4. For each pick, output:
   - "index": the NUMBER of the candidate (from the numbered list) — required for linking.
   - "title": the job title in English, cleaned up (e.g. "Senior Backend Engineer").
     If the posting is only in Armenian or Russian, translate the title to English.
   - "company": company name as written, or "" if genuinely unknown.
   - "location": city in Armenian (e.g. "Երևան"), or "Հեռավար" if remote-only, or "".
   - "tag": one of ${TAGS.join(', ')}.
   - "summaryHy": ONE short line in Eastern Armenian with the essentials a job-seeker
     scans for: stack/skills, seniority, remote option, salary if stated. Keep
     technology names in English (React, Node.js, Python). No fluff.

Return ONLY JSON matching the schema. No markdown, no commentary.

Candidates:
${jobs.map(describe).join('\n')}
`.trim();

const schema = {
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
          summaryHy: { type: 'string' },
        },
        required: ['index', 'title', 'tag', 'summaryHy'],
      },
    },
  },
  required: ['items'],
};

// Returns curated [{ title, company, location, tag, summaryHy, url, source }].
// Throws on failure so the caller can fall back to an uncurated list.
export const curate = async (jobs) => {
  if (!jobs.length) return [];
  const parsed = await generateJson(buildPrompt(jobs, config.digestMin, config.digestMax), schema);
  return (Array.isArray(parsed.items) ? parsed.items : [])
    .slice(0, config.digestMax)
    .map(({ index, title, company, location, tag, summaryHy }) => {
      // Gemini returns a 1-based index into the numbered candidate list.
      const raw = jobs[index - 1];
      if (!raw) return null;
      return {
        id: raw.id,
        title: (title || raw.title).trim(),
        company: (company ?? raw.company ?? '').trim(),
        location: (location ?? raw.location ?? '').trim(),
        tag,
        summaryHy: (summaryHy || '').trim(),
        url: raw.url,
        source: raw.source,
      };
    })
    .filter(Boolean);
};
