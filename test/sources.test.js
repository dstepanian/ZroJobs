import test from 'node:test';
import assert from 'node:assert/strict';
import { takeSourceDiverse } from '../src/aggregate.js';
import { parseEpamJobs } from '../src/scrape/epam.js';
import { isArmeniaAccessible } from '../src/scrape/remoteScope.js';
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
