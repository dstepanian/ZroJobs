import test from 'node:test';
import assert from 'node:assert/strict';
import { isLive } from '../src/archive.js';
import {
  faqLd, jobPostingLd, organizationLd, parseSalary, renderAbout, renderIndex,
  renderJobPage, renderLlms, renderRobots, renderSitemap, slug,
} from '../src/render.js';

const job = {
  id: 'staffam:123',
  title: 'Senior Backend Engineer',
  company: 'Acme',
  location: 'Երևան',
  salary: '$3,000–6,000',
  summaryHy: '• Node.js և PostgreSQL\n• 5+ տարվա փորձ',
  deadline: '2026-12-31',
  url: 'https://staff.am/en/jobs/x',
  source: 'staff.am',
  publishedAt: '2026-08-01T10:00:00.000Z',
};

test('slugs stay ascii, short and unique even when the title is not', () => {
  assert.match(slug(job), /^senior-backend-engineer-[0-9a-f]{8}$/);
  assert.match(slug({ id: 'jobam:77', title: 'Ծրագրավորող' }), /^job-[0-9a-f]{8}$/);

  // A board whose id is itself the title must not repeat it in the URL.
  const wwr = slug({ id: 'wwr:stripe-staff-product-manager-ml', title: 'Staff Product Manager, ML' });
  assert.equal(wwr.match(/product/g).length, 1);
  assert.ok(wwr.length < 60, `slug should stay short, got ${wwr.length}`);

  // Same title at two companies must not collide.
  assert.notEqual(slug({ id: 'a:1', title: 'QA Engineer' }), slug({ id: 'b:2', title: 'QA Engineer' }));
});

test('JobPosting carries the fields Google requires', () => {
  const ld = jobPostingLd(job);
  assert.equal(ld['@type'], 'JobPosting');
  assert.equal(ld.title, 'Senior Backend Engineer');
  assert.equal(ld.datePosted, '2026-08-01');
  assert.equal(ld.validThrough, '2026-12-31T23:59:59+04:00');
  assert.equal(ld.hiringOrganization.name, 'Acme');
  assert.equal(ld.jobLocation.address.addressLocality, 'Երևան');
  assert.equal(ld.jobLocation.address.addressCountry, 'AM');
  assert.match(ld.description, /^<p>/);
});

test('a remote job declares telecommute and Armenian applicant eligibility', () => {
  const ld = jobPostingLd({ ...job, location: 'Հեռավար', remote: true, market: 'international' });
  assert.equal(ld.jobLocationType, 'TELECOMMUTE');
  assert.equal(ld.applicantLocationRequirements.name, 'Armenia');
  assert.equal(ld.jobLocation, undefined, 'no Place when there is no city');
});

test('salary reaches the markup only when it parses unambiguously', () => {
  assert.deepEqual(parseSalary('$3,000–6,000'), { currency: 'USD', min: 3000, max: 6000 });
  assert.deepEqual(parseSalary('250,000 ֏'), { currency: 'AMD', min: 250000, max: 250000 });
  // Free-text salaries from the boards are shown on the page but never marked up.
  assert.equal(parseSalary('Competitive, depending on experience'), null);
  assert.equal(parseSalary('$1,000 to $2,000 plus 10% bonus'), null);

  assert.equal(jobPostingLd(job).baseSalary.currency, 'USD');
  assert.equal(jobPostingLd({ ...job, salary: 'Բանակցելի' }).baseSalary, undefined);
});

test('the rendered page embeds valid, non-breaking JSON-LD', () => {
  const html = renderJobPage({ ...job, title: 'Dev </script><script>alert(1)</script>' });
  const embedded = html.match(/<script type="application\/ld\+json">\n([\s\S]*?)\n<\/script>/)[1];

  assert.doesNotMatch(embedded, /<\/script>/, 'a title cannot break out of the JSON-LD block');
  assert.equal(JSON.parse(embedded)['@type'], 'JobPosting');
  assert.match(html, /rel="nofollow noopener"/, 'outbound apply links are not endorsements');
});

test('sitemap lists the index, the about page and every job, in a valid namespace', () => {
  const xml = renderSitemap([job]);
  assert.match(xml, /xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9"/);
  assert.equal([...xml.matchAll(/<loc>/g)].length, 3);
  assert.match(xml, /<loc>[^<]*\/about\/<\/loc>/);
});

test('a vacancy leaves the site once its deadline passes', () => {
  const now = Date.parse('2026-08-03T12:00:00Z');
  assert.equal(isLive({ deadline: '2026-08-04', publishedAt: '2026-07-01T00:00:00Z' }, now), true);
  assert.equal(isLive({ deadline: '2026-08-02', publishedAt: '2026-08-01T00:00:00Z' }, now), false);
  // No deadline stated — falls back to the 45-day window.
  assert.equal(isLive({ publishedAt: '2026-07-20T00:00:00Z' }, now), true);
  assert.equal(isLive({ publishedAt: '2026-05-01T00:00:00Z' }, now), false);
});

// Every other page is one vacancy. Nothing on the site answered "what is
// ZroJobs", which is the question a search engine or an assistant is actually
// asked. These lock the page that does.
test('the about page states what the channel is, in both languages', () => {
  const html = renderAbout();
  assert.match(html, /ZroJobs-ը հայալեզու Telegram ալիք է/);
  assert.match(html, /Armenian-language Telegram channel/);
  assert.match(html, /<section lang="en">/);
});

// The footer used to fall back to "ZroJobs" when CHANNEL_HANDLE was unset, and
// @ZroJobs is an unclaimed username, not this channel — every such link was a
// dead end. The fallback now comes from the registry.
test('the channel handle never falls back to the unclaimed @ZroJobs', () => {
  for (const html of [renderAbout(), renderJobPage(job)]) {
    assert.match(html, /https:\/\/t\.me\/zrojob\b/);
    assert.doesNotMatch(html, /t\.me\/ZroJobs\b/);
  }
});

test('the about page publishes its Q&A as FAQPage structured data', () => {
  const faq = faqLd();
  assert.equal(faq['@type'], 'FAQPage');
  assert.ok(faq.mainEntity.length >= 5);
  for (const q of faq.mainEntity) {
    assert.equal(q['@type'], 'Question');
    assert.equal(q.acceptedAnswer['@type'], 'Answer');
    assert.ok(q.acceptedAnswer.text.length > 20, `answer too thin: ${q.name}`);
  }
});

// sameAs is what merges the domain, the Telegram handle and the portfolio into
// one entity. Drop it and they are five unrelated pages sharing a word.
test('the organization node claims the Telegram handle and both siblings', () => {
  const org = organizationLd();
  assert.equal(org['@type'], 'Organization');
  assert.deepEqual(org.sameAs, [
    'https://t.me/zrojob',
    'https://zromek.de',
    'https://crypto.zromek.de',
    'https://ai.zromek.de',
  ]);
});

test('the index carries the entity graph it previously had no structured data for', () => {
  const html = renderIndex([job]);
  const block = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  assert.ok(block, 'index has no JSON-LD');
  const types = JSON.parse(block[1])['@graph'].map((n) => n['@type']);
  assert.deepEqual(types, ['Organization', 'WebSite']);
});

test('every page links out to both sibling channels', () => {
  for (const html of [renderAbout(), renderJobPage(job), renderIndex([job])]) {
    assert.match(html, /https:\/\/crypto\.zromek\.de\//);
    assert.match(html, /https:\/\/ai\.zromek\.de\//);
  }
});

test('robots.txt names the AI crawlers rather than relying on the wildcard', () => {
  const robots = renderRobots();
  for (const ua of ['GPTBot', 'OAI-SearchBot', 'ClaudeBot', 'PerplexityBot', 'Google-Extended']) {
    assert.match(robots, new RegExp(`User-agent: ${ua}\nAllow: /`), `${ua} not allowed`);
  }
});

test('llms.txt describes the channel in English and points at the siblings', () => {
  const txt = renderLlms([job]);
  assert.match(txt, /^# ZroJobs\n/);
  assert.match(txt, /Armenian-language Telegram channel/);
  assert.match(txt, /@zroaix/);
  assert.match(txt, /@zrocry/);
  assert.match(txt, /Senior Backend Engineer/);
});
