import test from 'node:test';
import assert from 'node:assert/strict';
import { isLive } from '../src/archive.js';
import { jobPostingLd, parseSalary, renderJobPage, renderSitemap, slug } from '../src/render.js';

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

test('sitemap lists the index and every job, in a valid namespace', () => {
  const xml = renderSitemap([job]);
  assert.match(xml, /xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9"/);
  assert.equal([...xml.matchAll(/<loc>/g)].length, 2);
});

test('a vacancy leaves the site once its deadline passes', () => {
  const now = Date.parse('2026-08-03T12:00:00Z');
  assert.equal(isLive({ deadline: '2026-08-04', publishedAt: '2026-07-01T00:00:00Z' }, now), true);
  assert.equal(isLive({ deadline: '2026-08-02', publishedAt: '2026-08-01T00:00:00Z' }, now), false);
  // No deadline stated — falls back to the 45-day window.
  assert.equal(isLive({ publishedAt: '2026-07-20T00:00:00Z' }, now), true);
  assert.equal(isLive({ publishedAt: '2026-05-01T00:00:00Z' }, now), false);
});
