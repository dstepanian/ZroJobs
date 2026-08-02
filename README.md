# ZroJobs

Armenian tech-jobs bot. Twice a day it scrapes Armenian job boards,
official company/ecosystem boards, public Telegram channels, and curated remote feeds,
then uses **Gemini Flash** to keep only real tech vacancies, dedupe cross-source
reposts and summarize each in Armenian. Each vacancy is posted to the Telegram
channel as **its own message**. Free to run — no server, GitHub Actions cron does
the scheduling.

```
staff.am (IT cats) ─┐                                enrich picks
job.am + LinkedIn   ├─▶ aggregate ─▶ Gemini pick ─▶ (detail pages: ─▶ Gemini ─▶ format ─▶ Telegram
Remote feeds + TON  ┤    (new only,    (2-4 remote +  salary, descr.,   summarize  (one post (2/day)
EPAM Armenia        ┤
t.me/s/<channels>  ─┘     seen.json)   Armenia jobs)   deadline)        (one HY line) per job)
```

## Why one post per job

A digest is one shareable unit that is fully relevant to almost nobody. Five
separate posts are five shareable units, each fully relevant to *someone* —
forwardable person-to-person ("this one's for you"), searchable in Telegram, and
hashtaggable. Person-to-person forwarding is the channel's main growth engine.

Each post carries the role and company in bold, salary when known, location or
`Հեռավար`, a near deadline, one Armenian summary line, hashtags, and an inline
**Դիմել** button linking to the vacancy:

```
💻 Senior Backend Engineer
   Acme

💰 $3,000–4,500
📍 Երևան
⏳ մինչև հուլիսի 31-ը
Node.js, PostgreSQL, 5+ տարվա փորձ

#IT #Երևան #senior          [ Դիմել ]
```

Hashtags are what keep a vacancy findable after its notification scrolls away:
`#IT` on every post, the location (`#Երևան`, `#remote`, …) and the level
(`#junior` / `#middle` / `#senior`) when the posting states one. Cities are always
tagged in Armenian, whatever language the source wrote them in, so one tag
collects every posting for that city.

Posts go out sequentially with a `POST_DELAY_MS` (default 3s) gap so Telegram's
flood limit isn't hit; a 429 is retried once for as long as Telegram asks. Every
successful send is recorded in `seen.json` immediately, so a failure halfway
through a run leaves the unposted jobs eligible for the next one.

## Setup

1. `npm install`
2. `cp .env.example .env` and fill in:
   - `TELEGRAM_BOT_TOKEN` — from @BotFather (create a fresh bot for this channel)
   - `TELEGRAM_CHANNEL` — e.g. `@yourjobschannel` (add the bot as **admin** of the channel)
   - `GEMINI_API_KEY` — from [Google AI Studio](https://aistudio.google.com/app/apikey)

## Run

```bash
npm run preview   # dry run, prints every individual post to console (no posting)
npm run dry       # dry run, no console print
npm start         # scrapes, curates AND posts, recording each posted id as it goes
npm run intro     # posts the pinned channel intro (one-off, see below)
```

Dry runs never write `seen.json`, so you can preview as often as you like.

### Pinned intro post

`npm run intro:preview` prints it, `npm run intro` posts and pins it. The message
explains in Armenian what the channel is, when it posts, which hashtags to search,
and where an employer submits a vacancy — the handle comes from `CONTACT_HANDLE`
(falling back to `PROMO_CONTACT`). Run it again after editing the copy; Telegram
pins the newest message. Pinning needs the bot to be a channel admin — if it
isn't, the post still goes out and the run says so.

## Scheduling (free)

`.github/workflows/digest.yml` runs twice daily at **06:00 and 15:00 UTC
(10:00 and 19:00 Yerevan)**.
Add the secrets in the repo: **Settings → Secrets and variables → Actions**
(`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHANNEL`, `GEMINI_API_KEY`). Optional repo
*variables*: `GEMINI_MODEL`, `CHANNEL_HANDLE`, `PROMO_CONTACT`, `POST_DELAY_MS`. Use **Run
workflow** on the Actions tab to fire a manual test.

Each run reserves **2–4 slots for eligible international/remote jobs** from
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

`featured.json` holds paid listings. They are posted **first in the run**, before
any curated job, marked with 💼 and a **Հովանավորվող** label, and — when a logo is
available — sent as a photo card instead of plain text:

```json
[
  {
    "title": "Senior QA Engineer",
    "company": "Acme",
    "location": "Երևան",
    "salary": "$3,000–4,500",
    "summaryHy": "Ավտոմատացված թեստավորում, 3+ տարի փորձ",
    "url": "https://example.com/apply",
    "logo": "https://example.com/logo.png",
    "until": "2026-07-31"
  }
]
```

Only `title` and `url` really matter; everything else renders when present. The
logo is optional: without it, the company is looked up in `companies.json` and
that entry's `logo` is reused. A dead image URL never costs the post — it falls
back to text.

Entries expire automatically after their `until` date (`YYYY-MM-DD`). A listing is
posted **once per day**, not once per run, so a two-a-day schedule doesn't show
the same ad twice in a row — it is tracked in `seen.json` under a `featured:…:<date>`
key. Set `PROMO_CONTACT` (e.g. `@yourusername`) to print the "your vacancy here"
line at the bottom of featured posts.

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
| `src/format.js` | per-job post, featured post, hashtags, apply button, intro copy |
| `src/post.js` | Telegram Bot API send (message, photo, pin) with flood-limit retry |
| `src/index.js` | orchestrate the run — build the queue, post one by one |
| `src/intro.js` | one-off pinned channel intro |
| `src/spotlight.js` | weekly "Employer of the week" photo post |
