/**
 * Shared site metadata and navigation.
 * Product facts here are grounded in the app repo: README.md, app.json,
 * docs/planning-prompts/ and src/content/.
 */

export const SITE = {
  name: 'Node Learn',
  tagline: 'Learning is a relationship, not a catalogue.',
  description:
    'Node Learn pairs learners with teachers around a shared goal, then keeps the goals, tasks, evidence and feedback in one place you both can see. No courses to buy, no streaks to protect.',
  url: 'https://node-learn.com',
  /** Expo app scheme + bundle id, from app.json. */
  bundleId: 'com.hyperter96.nodelearn',
  appUrl: 'https://app.node-learn.com',
  email: {
    hello: 'hello@node-learn.com',
    privacy: 'privacy@node-learn.com',
    legal: 'legal@node-learn.com',
    safety: 'safety@node-learn.com',
  },
  /** MVP status shown honestly across the site. */
  status: 'Early access · MVP',
} as const;

export const NAV: { href: string; label: string }[] = [
  { href: '/how-it-works', label: 'How it works' },
  { href: '/students', label: 'For students' },
  { href: '/teachers', label: 'For teachers' },
  { href: '/philosophy', label: 'Philosophy' },
  { href: '/faq', label: 'FAQ' },
  { href: '/about', label: 'About' },
];

export const FOOTER_NAV: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: 'Product',
    links: [
      { href: '/how-it-works', label: 'How it works' },
      { href: '/students', label: 'For students' },
      { href: '/teachers', label: 'For teachers' },
      { href: '/get-started', label: 'Get started' },
    ],
  },
  {
    title: 'Company',
    links: [
      { href: '/philosophy', label: 'Philosophy' },
      { href: '/about', label: 'About' },
      { href: '/faq', label: 'FAQ' },
      { href: '/contact', label: 'Contact' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { href: '/legal/privacy', label: 'Privacy notice' },
      { href: '/legal/terms', label: 'Terms of use' },
      { href: '/contact#safety', label: 'Report a problem' },
    ],
  },
];

/**
 * The ten product first principles, from
 * docs/planning-prompts/01-frontend-product-design-planning-prompt.md §2.
 * Wording is the English product voice; intent is unchanged.
 */
export const PRINCIPLES: {
  id: string;
  title: string;
  claim: string;
  detail: string;
  antiGoal: string;
}[] = [
  {
    id: 'nodes-before-courses',
    title: 'Nodes before courses',
    claim: 'Knowledge is a graph of ideas, not a shelf of products.',
    detail:
      'A knowledge node is the first-class object. A "course" is only a temporary path between nodes — useful, but never the thing you own.',
    antiGoal: 'Not a course marketplace',
  },
  {
    id: 'structural-change',
    title: 'Learning is structural change',
    claim: 'We measure how your understanding is built, not how long you sat still.',
    detail:
      'Progress means clearer structure, better explanations, steadier reasoning and transfer to new problems — not watch time, check-ins or play counts.',
    antiGoal: 'No hours-watched metrics',
  },
  {
    id: 'evidence',
    title: 'Capability through evidence',
    claim: 'Ability comes from work you can point at.',
    detail:
      'Projects, tasks, traceable contributions and real feedback build a record. Unverifiable badges and stacked certificates do not.',
    antiGoal: 'No certificate theatre',
  },
  {
    id: 'learning-relation',
    title: 'The learning relation is the core',
    claim: 'One durable relationship holds everything together.',
    detail:
      'Matching, goals, tasks, messages, feedback, progress and proof all organise around a single LearningRelation that evolves over time.',
    antiGoal: 'Not one-off transactions',
  },
  {
    id: 'messages-as-events',
    title: 'Messages are collaboration events',
    claim: 'A message can be a goal, a task, a submission or a milestone.',
    detail:
      'Conversation is structured. A piece of evidence or a round of feedback is a first-class event in the thread, not a file lost in chat scrollback.',
    antiGoal: 'Not a plain chat app',
  },
  {
    id: 'trust-over-time',
    title: 'Trust accumulates over time',
    claim: 'Consistency earns credibility. Popularity does not.',
    detail:
      'Teacher standing grows from verified email, shown work, learner feedback and sustained contribution — never from follower counts or a black-box ranking.',
    antiGoal: 'No follower counts',
  },
  {
    id: 'ui-as-projection',
    title: 'The interface projects structure',
    claim: 'You should be able to see the shape of your learning.',
    detail:
      'Every screen makes the goal → task → evidence → feedback → change chain visible. The interface is a window onto structure, not an information feed.',
    antiGoal: 'No endless feed',
  },
  {
    id: 'anti-addiction',
    title: 'Anti-addiction by design',
    claim: 'We do not compete for your attention.',
    detail:
      'No infinite scroll, no streaks to protect, no anxiety-inducing red dots, no variable rewards, no mechanics that exist only to extend a session.',
    antiGoal: 'No streaks or dark patterns',
  },
  {
    id: 'ai-assists',
    title: 'AI assists, never declares truth',
    claim: 'If a machine suggests something, it shows its work.',
    detail:
      'Any AI may summarise, structure or explain — always with sources, stated confidence and your ability to correct it. The MVP ships no autonomous AI at all.',
    antiGoal: 'No oracle answers',
  },
  {
    id: 'user-owned-data',
    title: 'Your data stays yours',
    claim: 'Export it or delete it, whenever you want.',
    detail:
      'Settings give you a full JSON export and real account deletion. Recommendations explain themselves and can be turned off. No lock-in.',
    antiGoal: 'No platform lock-in',
  },
];

/** The MVP loop, from planning prompt §4. */
export const STUDENT_JOURNEY: { step: string; title: string; body: string }[] = [
  {
    step: '01',
    title: 'Describe a learning goal',
    body: 'Say what you actually want to be able to do — in your own words. No placement quiz, no catalogue to browse first.',
  },
  {
    step: '02',
    title: 'Find or invite a teacher',
    body: 'Search by topic and read self-described profiles. Send a short request explaining your context, or accept an invitation.',
  },
  {
    step: '03',
    title: 'Establish a learning relation',
    body: 'When a teacher accepts, you get a shared workspace. That relation is the container for everything that follows.',
  },
  {
    step: '04',
    title: 'Agree on goals and next tasks',
    body: 'Break the goal into a small number of concrete tasks you both can see. One next step is always clear.',
  },
  {
    step: '05',
    title: 'Submit evidence, get feedback',
    body: 'Share the actual work — a file, a write-up, a link. Feedback attaches to the evidence, so revisions have a visible history.',
  },
  {
    step: '06',
    title: 'See a change you can explain',
    body: 'Progress is recorded as a short, explainable proof: what you can now do, and the evidence chain behind it.',
  },
];

export const TEACHER_JOURNEY: { step: string; title: string; body: string }[] = [
  {
    step: '01',
    title: 'Write a concise teaching profile',
    body: 'Describe your experience, method and the topics you take on. Self-described — the platform never pretends to have vetted you.',
  },
  {
    step: '02',
    title: 'Receive a relevant request',
    body: 'Requests arrive with the learner\u2019s stated goal and context, so you can judge fit before replying.',
  },
  {
    step: '03',
    title: 'Review and accept or decline',
    body: 'Declining is a normal, low-friction action. There is no response-rate score punishing you for saying no.',
  },
  {
    step: '04',
    title: 'Set goals and tasks',
    body: 'Turn the goal into a short task list in the shared workspace. Both sides see the same structure.',
  },
  {
    step: '05',
    title: 'Review evidence and give feedback',
    body: 'Comment directly on submitted work. Your feedback becomes part of the learner\u2019s traceable record.',
  },
  {
    step: '06',
    title: 'Track who needs attention',
    body: 'A quiet workbench shows active relations, pending reviews and which learners are waiting — no vanity dashboard.',
  },
];

/** Topic suggestions mirrored from src/content/topics.ts in the app. */
export const TOPICS = [
  'Programming',
  'Math',
  'Physics',
  'Languages',
  'Writing',
  'Music',
  'Art & design',
  'Science',
  'History',
  'Exam prep',
  'Public speaking',
  'Learning how to learn',
] as const;

export const FAQS: { category: string; items: { q: string; a: string }[] }[] = [
  {
    category: 'The basics',
    items: [
      {
        q: 'What exactly is Node Learn?',
        a: 'A place to build one good learning relationship at a time. You describe a goal, connect with a teacher, and the goals, tasks, evidence and feedback you exchange live in a shared workspace. It runs on iOS, Android and the web from a single codebase.',
      },
      {
        q: 'Is this a course platform?',
        a: 'No. There is no catalogue, no video library and nothing to buy. A course is at most a temporary path between knowledge nodes — the durable object here is the relationship and the record of work inside it.',
      },
      {
        q: 'How much does it cost?',
        a: 'Nothing today. The MVP has no payments, orders, wallets, refunds or subscriptions, and the platform does not process money between members. Any future plans will be announced before they exist, not hidden in the terms.',
      },
      {
        q: 'What stage is the product at?',
        a: 'Early access MVP. The core loop — sign up, set a goal, match, agree tasks, exchange evidence and feedback, record a proof — works end to end. Realtime messaging, uploads in the client and notifications are still being built.',
      },
    ],
  },
  {
    category: 'Accounts and access',
    items: [
      {
        q: 'How do I sign in?',
        a: 'Three equal options: email and password (with verification and recovery), Continue with Google, or Continue with Notion. All three appear side by side with the same visual weight — none is hidden behind a secondary menu.',
      },
      {
        q: 'Does connecting Notion give you my notes?',
        a: 'No. Notion is used strictly for identity — we receive your name and email, nothing else. We never read your workspace pages or databases. The same applies to Google.',
      },
      {
        q: 'What if I sign up with email and later use Google?',
        a: 'The same email address always resolves to one account. You will be guided to link the new identity rather than create a duplicate. You can unlink Google or Notion later in settings, as long as one working sign-in method remains.',
      },
      {
        q: 'Is there an age requirement?',
        a: 'You must be 16 or older. We ask only for an age band — "16–17" or "18 or over" — and never store your birthday. Accounts below the threshold are blocked at sign-up.',
      },
      {
        q: 'Can I be both a student and a teacher?',
        a: 'Yes. One account can hold both roles and switch between them. Many of the best teachers are also actively learning something else.',
      },
    ],
  },
  {
    category: 'Trust and safety',
    items: [
      {
        q: 'Do you verify teachers?',
        a: 'No, and we never imply otherwise. Teacher profiles are self-described. Credibility is built from a verified email address, work and evidence they choose to show, learner feedback, and consistency over time. We do not run identity checks, licence validation or KYC.',
      },
      {
        q: 'Who can see my work?',
        a: 'Evidence, feedback and messages are visible only to the two members of a learning relation — plus a moderator if someone files a report. Student profiles default to contacts-only; teacher profiles can be set public.',
      },
      {
        q: 'How do I deal with someone behaving badly?',
        a: 'You can block or report any member. Moderators can warn or suspend accounts, and a suspension ends that person\u2019s active learning relations. Messaging is only possible once you share a connection or a learning relation, so unsolicited contact is limited by design.',
      },
    ],
  },
  {
    category: 'Your data',
    items: [
      {
        q: 'Can I get my data out?',
        a: 'Settings → Export my data returns a JSON copy of everything linked to your account. No support ticket, no waiting period.',
      },
      {
        q: 'What happens when I delete my account?',
        a: 'Your profile is anonymised immediately. Messages and evidence files are removed within 30 days. Aggregated proof records are anonymised and retained. Server logs are kept 30 days; reports and audit records 12 months after resolution.',
      },
      {
        q: 'Do you sell data or run ads?',
        a: 'Neither. There is no advertising on Node Learn and no data sale. Analytics never capture message bodies, evidence contents or sensitive information about minors.',
      },
    ],
  },
];

