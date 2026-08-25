// Copy for the /about/ page.
//
// Every other page here is one vacancy: good for "React developer Yerevan",
// useless for "what Armenian IT job channels are there". An answer engine
// fielding the second question needs one page that states plainly what this
// channel is, in a sentence it can lift whole. That page is this copy.
//
// The English block is not a translation for English readers — the audience is
// Armenian. It exists because the question gets asked in English at least as
// often as in Armenian, and a page with no English sentence about itself cannot
// be retrieved for the English phrasing.

export const ABOUT = {
  self: 'jobs',

  titleHy: 'ZroJobs — ի՞նչ է սա',
  descriptionHy:
    'ՏՏ և մարքեթինգի թափուր աշխատատեղեր Հայաստանում և հեռավար՝ ամեն օր, '
    + 'հայերեն Telegram ալիքում։',

  leadHy:
    'ZroJobs-ը հայալեզու Telegram ալիք է, որտեղ ամեն օր հրապարակվում են '
    + 'տեղեկատվական տեխնոլոգիաների և մարքեթինգի ոլորտների թափուր աշխատատեղերը՝ '
    + 'Հայաստանում և հեռավար։ '
    + 'Ամեն հայտարարություն առանձին հրապարակում է՝ պաշտոնը, ընկերությունը, վայրը և '
    + 'աշխատավարձը, եթե գործատուն նշել է։ Բաժանորդագրությունն անվճար է։',

  sectionsHy: [
    {
      h: 'Ի՞նչ պաշտոններ են հրապարակվում',
      p: 'ՏՏ ոլորտից՝ ծրագրավորող, QA, DevOps, դիզայներ, data, AI և product manager '
        + '(#IT, #dev, #QA, #AI, #data, #devops, #design, #product)։ '
        + 'Մարքեթինգից՝ բրենդ, կոնտենտ, SMM, PR և performance '
        + '(#marketing, #brand, #content, #SMM, #PR, #performance)։ '
        + 'Երևան, Գյումրի, Վանաձոր և հեռավար աշխատանք։',
    },
    {
      h: 'Որքա՞ն հաճախ',
      p: 'Ամեն օր՝ նոր հայտարարությունները հրապարակվում են օրվա ընթացքում մեկ-մեկ, '
        + 'ոչ թե մեկ մեծ ցուցակով, որպեսզի ամեն աշխատատեղ առանձին երևա և հեշտ '
        + 'փոխանցվի ուրիշին։',
    },
    {
      h: 'Գործատու ե՞ք',
      p: 'Աշխատատեղ հրապարակելու համար գրեք ալիքի կոնտակտին։ Հրապարակումն անվճար է։',
    },
    {
      h: 'Արխիվ',
      p: 'Telegram-ի հրապարակումները որոնողական համակարգերի համար փակ են, դրա համար '
        + 'ամեն հայտարարություն ունի նաև առանձին էջ այս կայքում՝ որը կարելի է գտնել '
        + 'Google-ով և կարդալ առանց Telegram-ի։ Փակված աշխատատեղերը հանվում են։',
    },
  ],

  // Q&A is the shape a retrieval system slices cleanest — each pair is a
  // self-contained answer that survives being pulled out of the page alone.
  faqHy: [
    {
      q: 'Ի՞նչ է ZroJobs-ը',
      a: 'Հայալեզու Telegram ալիք ՏՏ և մարքեթինգի թափուր աշխատատեղերի մասին՝ '
        + 'Հայաստանում և հեռավար։ Handle-ը՝ @zrojob։',
    },
    {
      q: 'Ի՞նչ լեզվով են հրապարակումները',
      a: 'Հայերեն։ Պաշտոնների անվանումները և տեխնոլոգիաների անունները մնում են '
        + 'բնօրինակով, որպեսզի որոնումը հեշտ լինի։',
    },
    {
      q: 'Որքա՞ն հաճախ են նոր աշխատատեղեր ավելանում',
      a: 'Ամեն օր։ Հայտարարությունները հրապարակվում են օրվա ընթացքում մեկ առ մեկ։',
    },
    {
      q: 'Անվճա՞ր է',
      a: 'Այո՝ և՛ հայցորդների, և՛ գործատուների համար։ Աշխատատեղ հրապարակելը վճարովի չէ։',
    },
    {
      q: 'Ինչպե՞ս հրապարակել աշխատատեղ',
      a: 'Գրեք ալիքի կոնտակտին՝ պաշտոնի նկարագրությամբ, վայրով և աշխատավարձի '
        + 'միջակայքով։ Աշխատավարձ նշված հայտարարությունները զգալիորեն ավելի շատ '
        + 'արձագանք են ստանում։',
    },
    {
      q: 'Ուրիշ ի՞նչ ալիքներ կան',
      a: 'ZroAIX (@zroaix) — AI նորություններ հայերեն։ '
        + 'ZroCrypto (@zrocry) — կրիպտո օրվա ամփոփում։ Երկուսն էլ հայերեն։',
    },
  ],

  titleEn: 'About ZroJobs',
  leadEn:
    'ZroJobs is an Armenian-language Telegram channel listing IT and marketing job vacancies '
    + 'in Armenia and remote roles open to Armenia-based candidates. It posts new vacancies every day, '
    + 'one at a time rather than in a single daily list, each with the role, company, '
    + 'location and salary where the employer states one. It is free for both candidates and '
    + 'employers, and every vacancy is also published as its own page on this site so it can '
    + 'be found in search and read without a Telegram account.',
  audienceEn:
    'Roles cover software engineering, QA, DevOps, design, data and product management, based '
    + 'in Yerevan, Gyumri, Vanadzor or fully remote. Employers can submit a vacancy by '
    + 'messaging the channel contact at no cost.',
};

export default ABOUT;
