import test from 'node:test';
import assert from 'node:assert/strict';
import { formatFeaturedPost, formatJobPost, hashtags, plain } from '../src/format.js';

test('hashtags tag the city in Armenian whatever the source wrote', () => {
  assert.equal(hashtags({ location: 'Kanaker-Zeytun, Yerevan' }), '#IT #Երևան');
  assert.equal(hashtags({ location: 'Գյումրի' }), '#IT #Գյումրի');
  // Multi-word unmapped places would only produce an unsearchable tag.
  assert.equal(hashtags({ location: 'Kotayk Province, Armenia' }), '#IT');
});

test('hashtags carry the role, so a feed of 20 a day can be filtered', () => {
  // #IT is the channel; the role tag is what a reader actually searches.
  assert.equal(hashtags({ tag: 'ai', location: 'Երևան' }), '#IT #AI #Երևան');
  assert.equal(hashtags({ tag: 'qa', location: 'Գյումրի' }), '#IT #QA #Գյումրի');
  // 'other-tech' knows nothing #IT doesn't already say, so it adds no tag.
  assert.equal(hashtags({ tag: 'other-tech', location: 'Երևան' }), '#IT #Երևան');
  // Featured listings are hand-written and carry no tag at all.
  assert.equal(hashtags({ location: 'Երևան' }), '#IT #Երևան');
});

test('the dry-run preview shows what subscribers see, not the escapes', () => {
  // "Product & Design" is correctly sent as "&amp;" and rendered by Telegram as
  // "&". A preview printing the escape reports a bug that does not exist.
  const post = formatJobPost({ title: 'Product & Design Lead', tag: 'product' });
  assert.match(post, /Product &amp; Design Lead/); // what Telegram receives
  assert.match(plain(post), /Product & Design Lead/); // what the reader sees
  assert.doesNotMatch(plain(post), /&amp;|<b>/);
});

test('marketing carries its own umbrella hashtag, never #IT', () => {
  // The two feeds share a channel, so #IT has to stay a real filter: someone
  // following it must not be shown marketing.
  assert.equal(hashtags({ tag: 'brand', location: 'Երևան' }), '#marketing #brand #Երևան');
  assert.equal(hashtags({ tag: 'smm', location: 'Գյումրի' }), '#marketing #SMM #Գյումրի');
  assert.equal(hashtags({ tag: 'other-marketing', location: 'Երևան' }), '#marketing #Երևան');
  assert.doesNotMatch(hashtags({ tag: 'performance', location: 'Երևան' }), /#IT/);
});

test('a marketing post announces its field; an IT post stays as it was', () => {
  const marketing = formatJobPost({
    title: 'Brand Manager',
    company: 'Menu Group',
    location: 'Երևան',
    tag: 'brand',
  });
  // The label opens the post, above the title, so it reads in the notification.
  assert.match(marketing, /^📣 <b>ՄԱՐՔԵԹԻՆԳ<\/b>\n\n🎯 <b>Brand Manager<\/b>\n<b>Menu Group<\/b>/);

  // IT is the channel's default feed and gains no label, so nothing changes for
  // the posts subscribers already know.
  const it = formatJobPost({ title: 'Backend Engineer', company: 'Acme', tag: 'dev' });
  assert.doesNotMatch(it, /ՄԱՐՔԵԹԻՆԳ/);
  assert.match(it, /^💻 <b>Backend Engineer<\/b>\n<b>Acme<\/b>/);
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
    '#IT #dev #Երևան #senior · @zrojob', // the handle rides the tag line so a screenshot still leads back
  ].join('\n'));
});

test('a posting with no summary falls back to its category, never a bare title', () => {
  assert.equal(
    formatJobPost({ title: 'Разработчик', tag: 'dev' }),
    '💻 <b>Разработчик</b>\n\n🏷 Ծրագրավորում\n\n#IT #dev · @zrojob',
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
  assert.match(post, /#IT #Երևան · @zrojob$/);
});

test('every job post carries the channel handle, so a screenshot still leads back', () => {
  // Forwarding is this channel's growth engine, but most of the spread is
  // screenshots into WhatsApp and Viber groups, which drop Telegram's
  // "Forwarded from" header entirely. The handle has to be in the pixels.
  const post = formatJobPost({ title: 'QA Engineer', tag: 'qa', location: 'Երևան' });
  assert.match(post, /@zrojob$/);
  // ...and only once: the tag line is the only place it belongs.
  assert.equal(post.match(/@zrojob/g).length, 1);
});

test('a job post never carries a sibling-channel pitch', () => {
  // Cross-promo belongs in the pinned intro and the spotlight, which post rarely.
  // A vacancy goes out 10-20 times a day; a promo line on each is what makes
  // people mute the channel.
  const post = formatJobPost({ title: 'QA Engineer', tag: 'qa', location: 'Երևան' });
  assert.doesNotMatch(post, /@zrocry|@zroaix|Նաև՝/);
});
