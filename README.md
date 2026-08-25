# ZroJobs

Armenian tech-jobs bot. Twice a day it scrapes Armenian job boards,
official company/ecosystem boards, public Telegram channels, and curated remote
feeds. **Gemini Flash** keeps only real tech vacancies, deduplicates cross-source
reposts, and summarizes each in Armenian. The selected jobs enter a queue, and a
lightweight workflow publishes **one vacancy every 30 minutes** through the day.
Free to run — no server, GitHub Actions handles the scheduling.

```
staff.am + job.am ──┐
LinkedIn + EPAM ────┤
Remote feeds + TON ─┼─▶ aggregate/dedupe ─▶ Gemini selects 5–10 jobs
t.me/s/<channels> ──┘                              │
                                                   ▼
detail pages ─▶ salary/deadline/text ─▶ Armenian summary ─▶ queue.json
                                                                  │
                                          every 30 minutes ───────┴─▶ Telegram
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

#IT #Երևան #senior · @zrojob          [ Դիմել ]
```

The Armenian body is 1–3 short bullets (what you'll work on and the stack, the
experience required, one standout condition), written by Gemini from the
vacancy's **detail page** — staff.am, job.am and LinkedIn listings carry no
description, so the picked jobs get one detail fetch each before summarizing. If
a posting genuinely says nothing beyond its title, the card falls back to its
category (`🏷 Ծրագրավորում`) rather than shipping as a bare title.

Hashtags are what keep a vacancy findable after its notification scrolls away:
`#IT` on every post, the location (`#Երևան`, `#remote`, …) and the level
(`#junior` / `#middle` / `#senior`) when the posting states one. Cities are always
tagged in Armenian, whatever language the source wrote them in, so one tag
collects every posting for that city.

A `🆕` badge means the source published the vacancy within the last day, `🔥`
that its deadline is inside three days. Both are computed, never decorative — a
badge that shows up on everything stops meaning anything. job.am is excluded from
`🆕` because its listings carry no publication date (the scraper estimates one
from listing order, which isn't something to stamp "new" on).

## Built-in channel discovery

Every vacancy includes `@zrojob` on its hashtag line. Telegram forwards already
retain their source, but screenshots shared in WhatsApp, Viber, or elsewhere do
not; keeping the handle inside the post makes the channel discoverable even when
Telegram's forwarding header is lost.

Cross-promotion stays out of the high-volume vacancy feed. The pinned intro and
weekly employer spotlight rotate between `@zroaix` and `@zrocry`, one sibling per
day, while ordinary job posts show only the ZroJobs handle. The public site links
to both sibling channels from every page.

## Curate twice, post all day

Curation is expensive — eight sources scraped, two Gemini calls, a detail fetch
per picked job — so it runs **twice a day** and writes rendered messages to
`queue.json`. A second, tiny workflow **drips one post every 30 minutes**
(07:00–21:00 Yerevan) until the queue is empty.

```
Curate Jobs (2×/day)  ─▶  queue.json  ─▶  Post Queued Job (*/30 min)  ─▶  Telegram
   scrape + Gemini            ~10-20 waiting          one message per tick
```

This is why it isn't just a more frequent cron: running the full pipeline every
30 minutes would hit the boards 48× a day (LinkedIn would rate-limit us quickly)
and burn ~100 Gemini calls for the same handful of jobs.

A job is marked in `seen.json` when it is **queued**, not when it is posted, so
the next curation run doesn't pick it again while it waits its turn. A post that
Telegram rejects stays at the head of the queue for the next tick and is retired
after three failed attempts, so one bad entry can't block everything behind it.
Entries older than 36 hours are dropped as stale. Both workflows share a
`zrojobs-state` concurrency group — they read-modify-write the same cached
`seen.json`/`queue.json` and must never run at once.

## Setup

1. `npm install`
2. `cp .env.example .env` and fill in:
   - `TELEGRAM_BOT_TOKEN` — from @BotFather (create a fresh bot for this channel)
   - `TELEGRAM_CHANNEL` — e.g. `@yourjobschannel` (add the bot as **admin** of the channel)
   - `GEMINI_API_KEY` — from [Google AI Studio](https://aistudio.google.com/app/apikey)

## Run

```bash
npm run preview       # dry run, prints every post it would queue (nothing written)
npm run dry           # same, without the console print
npm start             # scrapes, curates, and fills queue.json
npm run drip:preview  # prints the next queued post without sending it
npm run drip          # posts the next queued job and drops it from the queue
npm run intro         # posts the pinned channel intro (one-off, see below)
```

Dry runs never write `seen.json` or `queue.json`, so you can preview as often as
you like.

### Pinned intro post

The message explains in Armenian what the channel is, when it posts, which
hashtags to search, and where an employer submits a vacancy — the handle comes
from `CONTACT_HANDLE` (falling back to `PROMO_CONTACT`). It also carries the
rotating sibling-channel footer. Run it again after editing the copy; Telegram
pins the newest message.

Easiest way to send it is the **Channel Intro** workflow on the Actions tab
(`.github/workflows/intro.yml`) — it uses the secrets already in the repo, and
defaults to preview-only, so untick **Preview only** to actually post. Locally,
`npm run intro:preview` / `npm run intro` do the same but need a `.env` with
`TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHANNEL`.

Pinning needs the bot to be a channel admin — if it isn't, the post still goes
out and the run says so.

## Scheduling (free)

`.github/workflows/digest.yml` curates twice daily at **06:00 and 15:00 UTC
(10:00 and 19:00 Yerevan)**; `.github/workflows/drip.yml` posts one queued job
every 30 minutes between **03:00 and 17:00 UTC (07:00–21:00 Yerevan)**.
Add the secrets in the repo: **Settings → Secrets and variables → Actions**
(`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHANNEL`, `GEMINI_API_KEY`). Optional repo
*variables*: `GEMINI_MODEL`, `CHANNEL_HANDLE`, `PROMO_CONTACT`. Use **Run
workflow** on the Actions tab to fire a manual test.

Each run reserves **2–4 slots for eligible international/remote jobs** from
Remotive, TON Jobs, and We Work Remotely, then fills the remaining slots with
Armenia-market jobs. Override the
range with `INTERNATIONAL_MIN` and `INTERNATIONAL_MAX` if needed. Remote jobs
keep their original link and are credited in the post. When alternatives exist,
the candidate pool balances every source, and the selector prefers one
international job per company.

Each queued job is added to `seen.json` immediately, so the next curation cannot
select it again while it is waiting to be published. The workflow persists the
state in the Actions cache (pruned after 30 days).

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

## The public job site (Google discoverability)

Telegram posts are not indexable — `t.me/s/<channel>` is the only crawlable
surface Telegram offers, it only exists while the channel's web preview is on,
and it ranks poorly for job queries. So every curated vacancy is also kept as a
structured record in `jobs.json` and published as a static site.

```bash
npm run site   # builds site/ from jobs.json
```

The build produces:

```text
site/
├── index.html          current vacancies + Organization/WebSite JSON-LD
├── jobs/*.html         one crawlable page per vacancy + JobPosting JSON-LD
├── about/index.html    bilingual channel description + FAQPage JSON-LD
├── sitemap.xml
├── robots.txt          search and AI crawler rules
├── llms.txt            plain-text map for answer engines
└── CNAME               jobs.zromek.de custom-domain binding
```

Each vacancy page carries
[JobPosting](https://developers.google.com/search/docs/appearance/structured-data/job-posting)
structured data — title, `datePosted`, `validThrough`, hiring organization,
location (or `TELECOMMUTE` + Armenian applicant eligibility for remote roles) —
which is what makes a listing eligible for the **Google Jobs** widget above
normal search results.

An answer engine asked what Armenian channels exist cannot use a wall of dated
pages — it needs one that says what this is. `/about/` is that page: the channel
in prose, in Armenian and English, with an `Organization` node whose `sameAs` ties
the domain, the Telegram handle, `zromek.de` and the two sibling sites into one
entity. It also publishes the Armenian Q&A as `FAQPage` structured data.
`robots.txt` explicitly permits the main search and AI crawlers, while
[`llms.txt`](https://llmstxt.org) provides the same core description without the
HTML. Every page cross-links ZroAIX and ZroCrypto, making all three sites part of
one discoverable publisher network.

Deliberate choices worth knowing:

- **We publish our own Armenian summary, not the scraped description.** Re-hosting
  another board's description verbatim is duplicate content Google discounts, and
  not ours to republish. Each page links out to the original posting instead.
- **Salary reaches the markup only when it parses unambiguously.** Our own
  formatters emit `$3,000–6,000` and `250,000 ֏`; free-text salaries are shown on
  the page but left out of the structured data, because a wrong salary in Google
  Jobs is worse than no salary.
- **Expired vacancies are removed** — once `deadline` passes, or after 45 days
  without one. Google requires this.
- **An empty archive aborts the build** rather than deploying a site with no
  pages, which would deindex everything.

`.github/workflows/pages.yml` rebuilds and deploys after each successful curation
run. The published site includes its own `jobs.json`, so if the Actions cache is
ever evicted the next build recovers the archive from the live site.

**One-time setup:** repo **Settings → Pages → Source: GitHub Actions**, then the
custom domain. The site lives at **https://jobs.zromek.de/** — a CNAME record
pointing `jobs` at `dstepanian.github.io`, with the same host in Settings → Pages.
The build writes `site/CNAME` on every deploy, because a custom domain set only in
repo settings is dropped the next time an artifact deploys. `SITE_BASE_URL`
overrides the default only if the host changes; it has to match exactly, since
canonical URLs and the sitemap are absolute.

The domain matters more here than anywhere else in the three repos: Google Jobs
eligibility depends on crawlable `JobPosting` pages, and a project-Pages path
buried `robots.txt` at `/ZroJobs/robots.txt`, where Google never looked. On
`jobs.zromek.de` it sits at the host root and is read normally. Search Console
verifies once by DNS at `zromek.de` and covers all three subdomains.

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
| `src/scrape/jobam.js` | job.am listing + detail enrichment (description) |
| `src/scrape/linkedin.js` | LinkedIn guest search + guest posting detail (description, seniority) |
| `src/scrape/telegram.js` | generic `t.me/s/` channel scraper |
| `src/scrape/remotive.js` | Remotive public remote-jobs feed, filtered for technical and broad-location roles |
| `src/scrape/weworkremotely.js` | Official WWR RSS feeds, filtered for technical Armenia-accessible roles |
| `src/scrape/ton.js` | Official TON ecosystem job board |
| `src/scrape/epam.js` | Official EPAM Armenia careers page |
| `src/text.js` | shared HTML-to-text helper |
| `src/fetchJobs.js` | parallel fetch, fail-soft per source |
| `src/aggregate.js` | 7-day window, drop seen, dedupe, cap |
| `src/seen.js` | `seen.json` load/mark/prune (30 days) |
| `src/queue.js` | `queue.json` — enqueue, pop, retry/retire, 36h staleness |
| `src/archive.js` | `jobs.json` — structured records behind the public site, expiry rules |
| `src/about.js` | bilingual About-page and FAQ copy |
| `src/siblings.js` | shared Zro channel registry, rotating Telegram promo, web cross-links and `sameAs` URLs |
| `src/render.js` | job/index/About pages, sitemap, robots, `llms.txt` and JSON-LD renderers |
| `src/site.js` | builds `site/` from the archive and writes the custom-domain `CNAME` |
| `src/gemini.js` | shared Gemini JSON call (model fallback chain) |
| `src/curate.js` | Gemini pass 1 (pick/tag/translate) + pass 2 (HY summaries from detail text) |
| `src/format.js` | per-job post, featured post, hashtags, apply button, intro copy |
| `src/post.js` | Telegram Bot API send (message, photo, pin) with flood-limit retry |
| `src/index.js` | orchestrate curation — build the posts, fill the queue |
| `src/drip.js` | release one queued post per tick |
| `src/intro.js` | one-off pinned channel intro |
| `src/spotlight.js` | weekly "Employer of the week" photo post |
