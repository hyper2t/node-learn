/** English locale. All user-visible strings live here; components call t('key'). */
export const en = {
  app: { name: 'Node Learn', tagline: 'Learn with someone who notices how you think.' },
  common: {
    continue: 'Continue', cancel: 'Cancel', save: 'Save', send: 'Send', done: 'Done', back: 'Back', retry: 'Try again', close: 'Close',
    loading: 'Loading…', offline: 'You are offline. Showing what we have.', empty: 'Nothing here yet.', accept: 'Accept', decline: 'Decline',
    withdraw: 'Withdraw', block: 'Block', report: 'Report', or: 'or', optional: 'Optional', edit: 'Edit', signOut: 'Sign out', notNow: 'Not now',
  },
  errors: {
    generic: 'Something went wrong. Try again.', network: 'No connection. Check your network and try again.', timeout: 'That took too long. Try again.',
    unauthorized: 'Sign in to continue.', forbidden: 'You do not have access to this.', not_found: 'We could not find that.', rate_limited: 'Too many attempts. Wait a moment.',
    validation: 'Some fields need attention.', conflict: 'That conflicts with something that already exists.',
    email_not_verified: 'Verify your email to do this.', age_gate_required: 'Confirm your age and privacy choices first.',
    duplicate_request: 'There is already an open request between you.', blocked: 'You cannot interact with this person.', handle_taken: 'That handle is taken.',
  },
  auth: {
    welcomeTitle: 'Welcome to Node Learn', welcomeBody: 'Set a learning goal, find a teacher, and build understanding through real work and feedback.',
    signIn: 'Sign in', signUp: 'Create account', email: 'Email', password: 'Password', name: 'Your name', forgot: 'Forgot password?',
    noAccount: 'New here?', haveAccount: 'Already have an account?', continueWith: 'Continue with {provider}', google: 'Google', notion: 'Notion',
    notionNote: 'We only use Notion to confirm who you are. We never read your pages.', finishing: 'Finishing sign-in…', oauthFailed: 'Sign-in did not complete. Try again.',
    oauthCancelled: 'Sign-in was cancelled.', backToSignIn: 'Back to sign in', emailExistsLink: 'This email already has an account. Sign in with your password, then link {provider} in Settings.',
    verifyTitle: 'Check your email', verifyBody: 'We sent a verification link to {email}. Verify to send requests and messages.', resend: 'Resend email', sent: 'Email sent.',
    verifying: 'Verifying…', verified: 'Email verified.', recoverTitle: 'Reset your password', recoverBody: 'Enter your email and we will send a reset link.',
    newPassword: 'New password', resetDone: 'Password updated. Sign in to continue.', linked: 'Linked accounts', unlink: 'Unlink', setPassword: 'Set a password',
    keepOne: 'Keep at least one way to sign in.',
    errors: {
      invalid_credentials: 'Email or password is incorrect.', user_exists: 'This email already has an account. Sign in instead.', user_not_found: 'No account with that email.',
      invalid_email: 'Enter a valid email and password.', weak_password: 'Use at least 8 characters that are hard to guess.', rate_limited: 'Too many attempts. Wait a moment.',
      session_expired: 'Your session expired. Sign in again.', unauthorized: 'Sign in to continue.', oauth_cancelled: 'Sign-in was cancelled.', oauth_failed: 'Sign-in did not complete. Try again.',
      network: 'No connection. Check your network and try again.', unknown: 'Something went wrong. Try again.',
    },
  },
  gate: {
    ageTitle: 'A few things first', ageBody: 'Node Learn is for people aged 16 and over. Tell us which group you are in — we do not store your birthday.',
    under16: 'Under 16', b16_17: '16–17', b18: '18 or over', privacy: 'I have read the privacy notice and agree to how Node Learn uses my data.',
    tooYoung: 'Node Learn is not available for your age group yet.', privacyLink: 'Privacy notice', termsLink: 'Terms of use',
  },
  legal: {
    onThisPage: 'On this page', lastUpdated: 'Last updated {date}',
  },
  role: {
    chooseTitle: 'How do you want to start?', chooseBody: 'You can add the other role any time.', student: 'Learn', studentBody: 'Set a goal, work with a teacher, and build evidence of what changed.',
    teacher: 'Teach', teacherBody: 'Share how you think, set tasks, and review real work.', switch: 'Switch role', current: 'Current role', add: 'Add {role} role',
  },
  onboarding: {
    studentTitle: 'What do you want to understand better?', studentBody: 'One sentence is enough. You can refine it with your teacher.', goalLabel: 'Learning goal', goalPlaceholder: 'e.g. Reason about recursion without tracing every call',
    interests: 'Topics', interestsHint: 'Comma separated, up to 10', teacherTitle: 'Tell learners how you teach', teacherBody: 'This is your own description. Node Learn does not verify credentials — trust builds from your work and feedback.',
    headline: 'Headline', headlinePlaceholder: 'e.g. Systems thinking for self-taught programmers', bio: 'About', subjects: 'Subjects', approach: 'How you work with learners', accepting: 'Accepting new learners',
    handle: 'Handle', handleHint: 'People can find you only by exact handle.',
    skip: 'Skip for now', skipHint: 'You can add or change this any time from your Profile.',
  },
  tabs: { home: 'Home', messages: 'Messages', learning: 'Learning', profile: 'Profile', workbench: 'Workbench', students: 'Students' },
  home: {
    studentTitle: 'Your learning', currentFocus: 'Current focus', nextStep: 'Next step', recentChange: 'Recent change', pending: 'Pending requests', findTeacher: 'Find a teacher',
    setGoal: 'Set your learning goal', setGoalBody: 'A goal helps teachers understand what you are working toward. Add it any time from your Profile.',
    noRelation: 'No learning relation yet.', noRelationBody: 'Find a teacher who fits your goal, or accept an invitation.', teacherTitle: 'Workbench', needsAttention: 'Needs your attention',
    toReview: 'Evidence to review', activeStudents: 'Active learners', noStudents: 'No learners yet.', noStudentsBody: 'When someone sends a request, it will show here.',
  },
  teachers: {
    title: 'Find a teacher', search: 'Search by name, handle or subject', empty: 'No teachers match yet.', selfDeclared: 'Self-described profile', verifiedEmail: 'Verified email',
    activeRelations: '{n} active learners', request: 'Send learning request', requestTitle: 'What do you want to work on?', goalTitle: 'Goal', message: 'A short note', sent: 'Request sent.',
    accepting: 'Accepting learners', notAccepting: 'Not accepting right now', memberSince: 'Member since {date}', approach: 'Approach',
    filters: 'Filters', subject: 'Subject', subjectPlaceholder: 'e.g. algebra', onlyAccepting: 'Only teachers accepting learners', sort: 'Sort', sortRelevance: 'Recommended', sortNewest: 'Newest', sortReviewed: 'Most feedback given', reviewed: '{n} pieces of feedback',
  },
  requests: {
    title: 'Requests', incoming: 'Received', outgoing: 'Sent', pending: 'Pending', accepted: 'Accepted', declined: 'Declined', cancelled: 'Cancelled', expired: 'Expired',
    fromStudent: 'Learning request', fromTeacher: 'Invitation to learn', empty: 'No requests.', invite: 'Invite a learner', acceptedBody: 'Learning relation started.',
  },
  relation: {
    title: 'Learning', workspace: 'Workspace', goals: 'Goals', tasks: 'Tasks', evidence: 'Evidence', proof: 'Progress', addGoal: 'Add goal', addTask: 'Assign task', submitEvidence: 'Submit evidence',
    giveFeedback: 'Give feedback', markAchieved: 'Mark achieved', openTasks: '{n} open tasks', evidenceCount: '{n} pieces of evidence', status: { active: 'Active', paused: 'Paused', ended: 'Ended' },
    taskStatus: { open: 'Open', submitted: 'Submitted', reviewed: 'Reviewed', done: 'Done', dropped: 'Dropped' }, goalStatus: { active: 'Active', achieved: 'Achieved', dropped: 'Dropped' },
    evidenceTitle: 'Title', evidenceBody: 'What did you do, and what do you now understand differently?', forTask: 'For task', feedbackBody: 'What did you notice?', nextStep: 'Suggested next step',
    markDone: 'Mark task done', attachments: 'Attachments', addAttachment: 'Add file', addImage: 'Add image', attachmentHint: 'Up to 5 files. Images, PDF, ZIP, text or Markdown, 25 MB each.',
    uploading: 'Uploading…', uploadFailed: 'Upload failed. Tap to remove and try again.', open: 'Open', download: 'Download', noGoals: 'No goals yet.', noTasks: 'No tasks yet.', noEvidence: 'No evidence yet.', due: 'Due {date}', pause: 'Pause', resume: 'Resume', end: 'End relation',
    endConfirm: 'End this learning relation? Evidence and feedback stay visible to both of you.', tasksDone: 'Tasks done', submitted: 'Submitted', feedback: 'Feedback', revisions: 'Revisions',
    milestones: 'Milestones', noProof: 'Progress appears once there is evidence and feedback.', source: 'Every number here links to something you did.',
  },
  messages: {
    title: 'Messages', empty: 'No conversations yet.', emptyBody: 'Conversations start when a learning relation or connection is made.', placeholder: 'Write a message',
    sending: 'Sending…', failed: 'Not sent. Tap to retry.', queued: 'Waiting for connection', system: 'System', goalCreated: 'New goal: {title}', taskAssigned: 'Task assigned: {title}',
    evidenceSubmitted: 'Evidence submitted: {title}', feedbackAdded: 'Feedback added', milestone: 'Milestone reached: {title}', open: 'Open',
  },
  notifications: {
    title: 'Notifications', all: 'All', unread: 'Unread', markAllRead: 'Mark all read', empty: 'You are all caught up.',
    emptyBody: 'Requests, tasks, evidence and feedback will show up here.',
  },
  admin: {
    title: 'Moderation', reports: 'Reports', reportsBody: 'Review reports from members. Suspending disables the account and ends its active learning relations.',
    open: 'Open', resolved: 'Resolved', empty: 'No reports here.', reportedBy: 'Reported by {name}', note: 'Note to the member (optional)',
    actions: { dismiss: 'Dismiss', warn: 'Warn', suspend: 'Suspend' }, suspend: 'Suspend account', suspendConfirm: 'Suspend this account? They will be signed out and all their active learning relations will end.',
    resolvedAs: 'Resolved: {action}',
  },
  contacts: {
    title: 'Contacts', find: 'Find by handle', handle: 'Handle', lookup: 'Look up', notFound: 'No one with that handle.', connect: 'Send connection request', message: 'Why you want to connect',
    incoming: 'Requests', empty: 'No contacts yet.', sent: 'Request sent.', blockConfirm: 'Block this person? They will not be able to contact you.', reportTitle: 'Report', reason: 'Reason',
    reasons: { harassment: 'Harassment', spam: 'Spam', inappropriate: 'Inappropriate content', other: 'Other' }, reported: 'Thanks. We will review this.',
  },
  profile: {
    title: 'Profile', settings: 'Settings', privacy: 'Privacy & data', visibility: 'Who can see your profile', vis: { public: 'Everyone', contacts: 'Contacts', relations: 'Learning relations', private: 'Only you' },
    export: 'Export my data', delete: 'Delete account', deleteConfirm: 'Delete your account? Shared evidence and feedback are anonymised; your profile and private data are removed.', deleted: 'Account deleted.',
    changeAvatar: 'Change photo', avatarHint: 'JPG, PNG or WebP up to 2 MB.', avatarUpdated: 'Photo updated.',
    displayName: 'Display name', handle: 'Handle', email: 'Email', roles: 'Roles', about: 'About', legal: 'Legal', privacyNotice: 'Privacy notice', terms: 'Terms of use',
  },
} as const;

export type Locale = typeof en;
