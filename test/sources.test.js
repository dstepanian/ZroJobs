import test from 'node:test';
import assert from 'node:assert/strict';
import { takeSourceDiverse } from '../src/aggregate.js';
import { parseEpamJobs } from '../src/scrape/epam.js';
import { parseJobAmDescription } from '../src/scrape/jobam.js';
import { parseLinkedInDetail } from '../src/scrape/linkedin.js';
import {
  isArmeniaAccessible, isMarketingRole, roleTag, tagForRole,
} from '../src/scrape/remoteScope.js';
import { fieldOf, isMarketing } from '../src/taxonomy.js';
import { capMarketing } from '../src/curate.js';
import config from '../src/config.js';
import { decodeEntities } from '../src/text.js';
import { parseTonJobs } from '../src/scrape/ton.js';
import { parseWwrFeed } from '../src/scrape/weworkremotely.js';

const nextHtml = (pageProps) =>
  `<html><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps } })}</script></html>`;

test('remote scope accepts global roles and rejects country-locked roles', () => {
  assert.equal(isArmeniaAccessible('Anywhere in the World'), true);
  assert.equal(isArmeniaAccessible('Remote'), true);
  assert.equal(isArmeniaAccessible('EMEA'), true);
  assert.equal(isArmeniaAccessible('United States'), false);
});

test('AI roles get their own tag instead of disappearing into data', () => {
  assert.equal(tagForRole('Machine Learning Engineer', 'Data'), 'ai');
  assert.equal(tagForRole('Senior AI Engineer', 'Software Development'), 'ai');
  assert.equal(tagForRole('LLM Platform Engineer', ''), 'ai');
  // An AI infra role is an AI job first, so the check runs ahead of devops.
  assert.equal(tagForRole('AI Infrastructure Engineer', ''), 'ai');
  // Analytics and BI stay 'data': they build no models and draw a different reader.
  assert.equal(tagForRole('Data Analyst', 'Data and Analytics'), 'data');
  assert.equal(tagForRole('Analytics Engineer', ''), 'data');
  // The rest of the ladder is untouched.
  assert.equal(tagForRole('Site Reliability Engineer', ''), 'devops');
  assert.equal(tagForRole('QA Automation Engineer', ''), 'qa');
  assert.equal(tagForRole('Backend Developer', ''), 'dev');
});

test('the marketing ceiling holds even if the picker ignores it', () => {
  // Marketing has about as much open local supply as the whole IT feed, so an
  // unenforced ceiling is a channel that quietly stops being an IT channel.
  const picked = [
    { id: 'm1', title: 'Brand Manager', tag: 'brand' },
    { id: 'm2', title: 'SMM Specialist', tag: 'smm' },
    { id: 'm3', title: 'Content Writer', tag: 'content' },
    { id: 'm4', title: 'PR Manager', tag: 'pr' },
    { id: 'm5', title: 'SEO Specialist', tag: 'performance' },
    { id: 'd1', title: 'Backend Developer', tag: 'dev' },
  ];
  const candidates = [
    ...picked,
    // Untagged, exactly as the Armenian boards deliver them.
    { id: 'd2', title: 'QA Engineer', category: 'quality-assurance' },
    { id: 'm6', title: 'Marketing Manager', category: 'marketing' },
    { id: 'd3', title: 'Data Analyst', category: 'analytics' },
  ];

  const capped = capMarketing(picked, candidates, new Set(picked.map((j) => j.id)));
  assert.equal(capped.filter(isMarketing).length, config.marketingMax);
  // The freed slots are refilled from IT rather than shrinking the digest...
  assert.equal(capped.length, picked.length);
  // ...and never with the untagged marketing job that was sitting right there.
  assert.ok(!capped.some((job) => job.id === 'm6'));
  assert.deepEqual(capped.slice(-2).map((job) => job.id), ['d2', 'd3']);
});

test('marketing roles are tagged as marketing, and the overlaps go to it', () => {
  assert.equal(tagForRole('SMM Specialist', ''), 'smm');
  assert.equal(tagForRole('Content Writer', ''), 'content');
  assert.equal(tagForRole('Brand Manager', ''), 'brand');
  assert.equal(tagForRole('PR Manager', ''), 'pr');
  assert.equal(tagForRole('SEO Specialist', ''), 'performance');
  assert.equal(tagForRole('Digital Marketing Specialist', ''), 'performance');

  // A generalist title has no honest sub-role, so it lands in the bucket and
  // posts under #marketing alone. What matters is the field, not the shade:
  // a title carrying both fields belongs to marketing, because that is the job.
  for (const title of ['Marketing Manager', 'Product Marketing Manager', 'Marketing Data Analyst']) {
    assert.equal(fieldOf(tagForRole(title, '')).key, 'marketing', title);
  }

  // ...but a soft word alone must not pull a tech role across the line.
  assert.equal(tagForRole('Content Designer', ''), 'design');
  assert.equal(tagForRole('Data Analyst', 'Data and Analytics'), 'data');
  assert.equal(tagForRole('Backend Developer', ''), 'dev');
});

test('sales is not marketing, and a two-field category is not evidence', () => {
  // We Work Remotely files sales and marketing under one category. Read
  // naively, that category turns every engineer in the feed into a marketer.
  const wwr = 'Sales and Marketing';
  assert.equal(tagForRole('SEO Specialist', wwr), 'performance');
  // The title names a field, so it wins over the category that names two.
  assert.equal(tagForRole('GTM AI Engineer', wwr), 'ai');
  assert.equal(tagForRole('Senior Backend Engineer', wwr), 'dev');
  // Title says nothing either way, so the category finally gets a say.
  assert.equal(fieldOf(tagForRole('Creative Strategist', wwr)).key, 'marketing');

  // Sales itself belongs to neither field and is dropped, in both languages.
  for (const title of ['Enterprise Account Executive', 'Director, Sales', 'Վաճառքի մենեջեր']) {
    assert.equal(roleTag(title, wwr), '', title);
    assert.equal(isMarketingRole(title, wwr), false, title);
  }
});

test('TON parser keeps remote technical jobs', () => {
  const html = nextHtml({
    initialState: {
      jobs: {
        found: [
          {
            id: 42,
            title: 'Senior Blockchain Engineer',
            organization: { name: 'TON Co' },
            searchableLocations: ['Remote'],
            locations: ['Remote'],
            workMode: 'remote',
            createdAt: 1_780_000_000,
            url: '/companies/ton-co/jobs/42-engineer',
            skills: ['TypeScript', 'Smart Contracts'],
            seniority: 'senior',
          },
          {
            id: 43,
            title: 'Office Assistant',
            organization: { name: 'TON Co' },
            searchableLocations: ['Remote'],
            locations: ['Remote'],
            workMode: 'remote',
            createdAt: 1_780_000_000,
            url: '/companies/ton-co/jobs/43-assistant',
          },
        ],
      },
    },
  });

  const jobs = parseTonJobs(html);
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].id, 'ton:42');
  assert.equal(jobs[0].market, 'international');
  assert.equal(jobs[0].company, 'TON Co');
});

test('EPAM parser keeps Armenia vacancies and their details', () => {
  const html = nextHtml({
    jobs: {
      jobs: [
        {
          uid: 'blt123',
          name: 'Lead AI Engineer',
          country: [{ id: 'am', name: 'Armenia' }],
          vacancy_type: 'Remote',
          seniority: 'Lead',
          primary_skill: 'AI Engineering',
          skills: ['Python', 'LangChain'],
          description: '<p>Build production AI systems.</p>',
          category: { requirements: ['5+ years of experience'] },
          seo: { url: '/en/vacancy/lead-ai-engineer-blt123_en' },
          created_at: '2026-07-10T12:00:00Z',
        },
      ],
    },
  });

  const jobs = parseEpamJobs(html);
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].id, 'epam:blt123');
  assert.equal(jobs[0].company, 'EPAM');
  assert.equal(jobs[0].candidateWindowMs, 30 * 24 * 60 * 60 * 1000);
  assert.match(jobs[0].text, /LangChain/);
});

test('WWR parser decodes RSS and filters non-technical jobs', () => {
  const xml = `
    <rss><channel>
      <item>
        <title>Acme: Senior Backend Engineer</title>
        <region>Anywhere in the World</region>
        <category>Back-End Programming</category>
        <description>&lt;p&gt;Build APIs with Node.js &amp;amp; PostgreSQL.&lt;/p&gt;</description>
        <pubDate>Wed, 15 Jul 2026 10:00:00 +0000</pubDate>
        <link>https://weworkremotely.com/remote-jobs/acme-senior-backend-engineer</link>
      </item>
      <item>
        <title>Acme: Office Assistant</title>
        <region>Anywhere in the World</region>
        <category>All Other</category>
        <pubDate>Wed, 15 Jul 2026 10:00:00 +0000</pubDate>
        <link>https://weworkremotely.com/remote-jobs/acme-office-assistant</link>
      </item>
    </channel></rss>`;

  const jobs = parseWwrFeed(xml);
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].company, 'Acme');
  assert.equal(jobs[0].source, 'We Work Remotely');
  assert.match(jobs[0].text, /Node\.js & PostgreSQL/);
});

test('job.am detail parser returns the description without its heading', () => {
  const html = `<html><div class="about-container job-descr work-description pb-30">
    <h4>Նկարագրություն</h4><p>Փնտրում ենք Node.js ծրագրավորողի։</p><ul><li>3+ տարվա փորձ</li></ul>
  </div></div></html>`;

  const text = parseJobAmDescription(html);
  assert.match(text, /Node\.js ծրագրավորողի/);
  assert.match(text, /3\+ տարվա փորձ/);
  assert.doesNotMatch(text, /^Նկարագրություն/);
});

test('LinkedIn detail parser keeps the description and stated criteria only', () => {
  const html = `<html>
    <div class="show-more-less-html__markup">Build APIs with &lt;b&gt;Go&lt;/b&gt; and PostgreSQL.</div>
    <h3 class="description__job-criteria-subheader">Seniority level</h3>
    <span class="description__job-criteria-text">Mid-Senior level</span>
    <h3 class="description__job-criteria-subheader">Employment type</h3>
    <span class="description__job-criteria-text">Full-time</span>
    <h3 class="description__job-criteria-subheader">Industries</h3>
    <span class="description__job-criteria-text">Financial Services</span>
  </html>`;

  const text = parseLinkedInDetail(html);
  assert.match(text, /Build APIs with/);
  assert.match(text, /^Seniority: Mid-Senior level$/m);
  assert.match(text, /^Employment: Full-time$/m);
  // Industries isn't shown anywhere, so it stays out of the summarizer's budget.
  assert.doesNotMatch(text, /Financial Services/);
});

test('LinkedIn detail parser drops the criteria the employer left blank', () => {
  const html = `<html>
    <div class="show-more-less-html__markup">Ship things.</div>
    <h3 class="description__job-criteria-subheader">Seniority level</h3>
    <span class="description__job-criteria-text">Not Applicable</span>
  </html>`;

  assert.equal(parseLinkedInDetail(html), 'Ship things.');
});

test('feed fields are decoded, so no HTML entity reaches Telegram verbatim', () => {
  // Remotive writes salaries HTML-encoded; esc() would turn the & into &amp;
  // and readers would see the literal "&#036;120".
  assert.equal(decodeEntities('&#036;120 - &#036;170 /hour'), '$120 - $170 /hour');
  assert.equal(decodeEntities('Ben &amp; Co'), 'Ben & Co');
  assert.equal(decodeEntities('&#x27;quoted&#x27;'), "'quoted'");
  // Single pass only: a double-encoded entity must not decode into a real one.
  assert.equal(decodeEntities('&amp;#036;'), '&#036;');
});

test('WWR splits the company off an escaped RSS title', () => {
  const xml = `
    <rss><channel><item>
      <title>Ben &amp; Co: Senior Backend Engineer</title>
      <region>Anywhere in the World</region>
      <category>Back-End Programming</category>
      <description>&lt;p&gt;Node.js&lt;/p&gt;</description>
      <pubDate>Wed, 15 Jul 2026 10:00:00 +0000</pubDate>
      <link>https://weworkremotely.com/remote-jobs/ben-co-senior-backend-engineer</link>
    </item></channel></rss>`;

  const [job] = parseWwrFeed(xml);
  assert.equal(job.company, 'Ben & Co');
  assert.equal(job.title, 'Senior Backend Engineer');
});

test('international candidate selection rotates across sources', () => {
  const jobs = [
    { id: 'a1', source: 'A' },
    { id: 'a2', source: 'A' },
    { id: 'a3', source: 'A' },
    { id: 'b1', source: 'B' },
    { id: 'b2', source: 'B' },
    { id: 'c1', source: 'C' },
  ];

  assert.deepEqual(
    takeSourceDiverse(jobs, 5).map((job) => job.id),
    ['a1', 'b1', 'c1', 'a2', 'b2'],
  );
});
