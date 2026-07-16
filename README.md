# ZroJobs

Armenian tech-jobs **digest** bot. Twice a day it scrapes Armenian job boards,
official company/ecosystem boards, public Telegram channels, and curated remote feeds,
then uses **Gemini Flash** to keep only real tech vacancies, dedupe cross-source
reposts and summarize each in Armenian. It posts one clean bilingual digest to
a Telegram channel. Free to run — no server, GitHub Actions cron does the
scheduling.

```
staff.am (IT cats) ─┐                                enrich picks
job.am + LinkedIn   ├─▶ aggregate ─▶ Gemini pick ─▶ (detail pages: ─▶ Gemini ─▶ format ─▶ Telegram
Remote feeds + TON  ┤    (new only,    (2-4 remote +  salary, descr.,   summarize   (HY/EN)  (2/day)
EPAM Armenia        ┤
t.me/s/<channels>  ─┘     seen.json)   Armenia jobs)   deadline)        (one HY line)
```

## Setup

1. `npm install`
2. `cp .env.example .env` and fill in:
   - `TELEGRAM_BOT_TOKEN` — from @BotFather (create a fresh bot for this channel)
   - `TELEGRAM_CHANNEL` — e.g. `@yourjobschannel` (add the bot as **admin** of the channel)
   - `GEMINI_API_KEY` — from [Google AI Studio](https://aistudio.google.com/app/apikey)

## Run

```bash
npm run preview   # dry run, prints the digest to console (no posting)
npm run dry       # dry run, no console print
npm start         # scrapes, curates AND posts, then records posted ids in seen.json
```

Dry runs never write `seen.json`, so you can preview as often as you like.

## Scheduling (free)

`.github/workflows/digest.yml` runs twice daily at **06:00 and 15:00 UTC
(10:00 and 19:00 Yerevan)**.
Add the secrets in the repo: **Settings → Secrets and variables → Actions**
(`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHANNEL`, `GEMINI_API_KEY`). Optional repo
*variables*: `GEMINI_MODEL`, `CHANNEL_HANDLE`, `PROMO_CONTACT`. Use **Run
workflow** on the Actions tab to fire a manual test.

The digest reserves **2–4 slots for eligible international/remote jobs** from
Remotive, TON Jobs, and We Work Remotely, then fills the remaining slots with
Armenia-market jobs. Override the
range with `INTERNATIONAL_MIN` and `INTERNATIONAL_MAX` if needed. Remote jobs
keep their original link and are credited in the post. When alternatives exist,
the candidate pool balances every source, and the selector prefers one
international job per company.

Each successful post appends the posted job ids to `seen.json`; the workflow
persists it in the Actions cache (pruned after 30 days), so a job is never posted twice.

## Sources

- **staff.am** — no RSS, but the Next.js listing page embeds the job list as
  JSON (`__NEXT_DATA__`), which `src/scrape/staffam.js` parses. One request with
  repeated `?category=` params covers all six IT categories
  (software-development, quality-assurance, web-design, product/project,
  hardware-design, other-it).
- **Telegram channels** — scraped via their public `t.me/s/<name>` preview pages
  (no API/auth). Add channels in `src/sources.js`; mixed-content channels are
  fine, curation drops non-tech posts.
- **EPAM Armenia** — official careers page, parsed from its structured Next.js
  listing data. Adds direct EPAM vacancies for Armenia without repost links.
- **TON Jobs** — official TON ecosystem board. Only remote, technical roles with
  Armenia-compatible scope enter the international pool.
- **Remotive** — public remote-jobs JSON feed; technical roles with broad
  location eligibility are marked international and mixed into each digest.
- **We Work Remotely** — official public programming, product, design, and
  DevOps RSS feeds, with source attribution and location eligibility filtering.

## Monetization: featured listings

`featured.json` holds paid listings that render **pinned at the top with a ⭐**:

```json
[
  {
    "title": "Senior QA Engineer",
    "company": "Acme",
    "location": "Երևան",
    "summaryHy": "Ավտոմատացված թեստավորում, 3+ տարի փորձ",
    "url": "https://example.com/apply",
    "until": "2026-07-31"
  }
]
```

Entries expire automatically after their `until` date. Set the `PROMO_CONTACT`
variable (e.g. `@yourusername`) to advertise the option in the digest footer.

## Structure

| File | Role |
|------|------|
| `src/sources.js` | staff.am category ids + Telegram channel list |
| `src/scrape/staffam.js` | staff.am `__NEXT_DATA__` scraper — listing + detail enrichment (salary, description, deadline) |
| `src/scrape/telegram.js` | generic `t.me/s/` channel scraper |
| `src/scrape/remotive.js` | Remotive public remote-jobs feed, filtered for technical and broad-location roles |
| `src/scrape/weworkremotely.js` | Official WWR RSS feeds, filtered for technical Armenia-accessible roles |
| `src/scrape/ton.js` | Official TON ecosystem job board |
| `src/scrape/epam.js` | Official EPAM Armenia careers page |
| `src/text.js` | shared HTML-to-text helper |
| `src/fetchJobs.js` | parallel fetch, fail-soft per source |
| `src/aggregate.js` | 7-day window, drop seen, dedupe, cap |
| `src/seen.js` | `seen.json` load/mark/prune (30 days) |
| `src/gemini.js` | shared Gemini JSON call (model fallback chain) |
| `src/curate.js` | Gemini pass 1 (pick/tag/translate) + pass 2 (HY summaries from detail text) |
| `src/format.js` | bilingual digest — salary 💰, near deadlines, featured listings |
| `src/post.js` | Telegram Bot API send |
| `src/index.js` | orchestrate the daily run |
