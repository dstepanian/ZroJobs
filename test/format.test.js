import test from 'node:test';
import assert from 'node:assert/strict';
import { formatFeaturedPost, formatJobPost, hashtags } from '../src/format.js';

test('hashtags tag the city in Armenian whatever the source wrote', () => {
  assert.equal(hashtags({ location: 'Kanaker-Zeytun, Yerevan' }), '#IT #Երևան');
  assert.equal(hashtags({ location: 'Գյումրի' }), '#IT #Գյումրի');
  // Multi-word unmapped places would only produce an unsearchable tag.
  assert.equal(hashtags({ location: 'Kotayk Province, Armenia' }), '#IT');
});

test('hashtags mark remote and stated seniority', () => {
  assert.equal(
    hashtags({ location: 'Anywhere in the World', market: 'international', title: 'Senior QA Engineer' }),
    '#IT #remote #senior',
  );
  assert.equal(hashtags({ location: 'Երևան', title: 'Backend Developer', text: 'Level: Junior' }), '#IT #Երևան #junior');
  assert.equal(hashtags({ location: 'Երևան', title: 'Backend Developer' }), '#IT #Երևան');
});

test('a job post keeps role, company, details and tags in separate blocks', () => {
  const post = formatJobPost({
    title: 'Senior Backend Engineer',
    company: 'Acme',
    location: 'Երևան',
    salary: '400,000  ֏',
    summaryHy: 'Node.js, 5+ տարվա փորձ',
    tag: 'dev',
  });

  assert.equal(post, [
    '💻 <b>Senior Backend Engineer</b>',
    '<b>Acme</b>',
    '',
    '💰 400,000 ֏', // stray double space from the board is normalized
    '📍 Երևան',
    'Node.js, 5+ տարվա փորձ',
    '',
    '#IT #Երևան #senior',
  ].join('\n'));
});

test('a posting with no summary falls back to its category, never a bare title', () => {
  assert.equal(
    formatJobPost({ title: 'Разработчик', tag: 'dev' }),
    '💻 <b>Разработчик</b>\n\n🏷 Ծրագրավորում\n\n#IT',
  );
});

test('summary bullets replace the category line and survive intact', () => {
  const post = formatJobPost({
    title: 'Backend Engineer',
    company: 'Acme',
    location: 'Երևան',
    tag: 'dev',
    summaryHy: '• Node.js և PostgreSQL միկրոսերվիսներ\n• 3+ տարվա փորձ\n• Հիբրիդ գրաֆիկ',
  });

  assert.match(post, /• Node\.js և PostgreSQL միկրոսերվիսներ\n• 3\+ տարվա փորձ\n• Հիբրիդ գրաֆիկ/);
  assert.doesNotMatch(post, /🏷/);
});

test('a featured post is labelled and carries the same details', () => {
  const post = formatFeaturedPost({ title: 'QA Engineer', company: 'Acme', location: 'Երևան' });
  assert.match(post, /^💼 <b>Հովանավորվող<\/b>\n\n<b>QA Engineer<\/b>\n<b>Acme<\/b>/);
  assert.match(post, /#IT #Երևան$/);
});
