/**
 * Legal copy — ported verbatim from the app repo's src/content/legal.ts so the
 * marketing site and the product show identical text (single source of truth in
 * spirit; keep both in sync when legal review lands).
 *
 * Headings become TOC entries with GitHub-style anchors, matching the app's
 * @/shared/markdown behaviour (`## Your rights` -> #your-rights).
 */
export type LegalDoc = {
  slug: string;
  title: string;
  updated: string;
  intro: string;
  markdown: string;
};

export const PRIVACY: LegalDoc = {
  slug: 'privacy',
  title: 'Privacy notice',
  updated: '2026-09-23',
  intro:
    'Node Learn connects learners with teachers and keeps a record of the work you do together. This notice explains what we store, why, and how to get it back or delete it.',
  markdown: `
## What we collect

- **Account:** email address, display name, optional handle and avatar, sign-in provider (email, Google or Notion). From Notion and Google we only receive your identity (name, email) — never your documents or pages.
- **Age band:** one of "16–17" or "18 or over". We do not store your birthday.
- **Learning data:** requests, learning relations, goals, tasks, evidence you upload, feedback you write or receive, and messages inside a relation.
- **Safety data:** blocks and reports you make, and moderation decisions.
- **Technical data:** request logs with a request id, route, status and latency. Logs never contain message bodies, tokens or file contents.

## Why we process it

- **To run the service you asked for** (contract): matching, workspaces, messaging, evidence and feedback.
- **To keep people safe** (legitimate interest): blocking, reporting, rate limiting and moderation.
- **To meet legal obligations:** age gating and responding to lawful requests.

## Who can see what

- Your teacher profile is public inside Node Learn when you set visibility to "public". Student profiles default to contacts only.
- Evidence, feedback and messages are visible only to the two members of a learning relation and to moderators handling a report.
- We do not sell data and we do not show advertising.

## Where it lives

Data is stored with Appwrite Cloud (region: US West). Uploads are stored in private buckets and served through short-lived signed links.

## How long we keep it

- **Active account:** for as long as the account exists.
- **Deleted account:** profile is anonymised immediately; messages and evidence files are removed within 30 days; aggregated proof records are anonymised and kept.
- **Reports and audit records:** 12 months after resolution, for safety and dispute handling.
- **Server logs:** 30 days.

## Your rights

- **Export:** Settings → Export my data gives you a JSON copy of everything linked to your account.
- **Delete:** Settings → Delete account removes your account and starts the deletion schedule above.
- **Correct:** edit your profile at any time. For anything else write to [privacy@node-learn.com](mailto:privacy@node-learn.com).

## Under 16

Node Learn is not available to people under 16. If you believe a younger person has an account, report it and we will remove it.

See also the [Terms of use](/legal/terms).
`,
};

export const TERMS: LegalDoc = {
  slug: 'terms',
  title: 'Terms of use',
  updated: '2026-09-22',
  intro:
    'Short version: be honest about who you are, be respectful, and remember that teacher profiles are self-described — Node Learn does not verify qualifications.',
  markdown: `
## Using Node Learn

- You must be 16 or older. One account per person. Keep your sign-in method secure.
- Teachers describe their own experience. Node Learn does not vet, certify or employ teachers, and does not process payments between members.

## Your content

- You own what you upload. You give Node Learn permission to store and show it to the people you share it with, so the service can work.
- Do not upload content you do not have the right to share, or content that is illegal, harassing, sexual, or dangerous.

## Safety and moderation

You can block or report anyone. Moderators may warn, or suspend accounts that break these terms. Suspension ends that person's active learning relations.

## Liability

Node Learn is provided as-is during the MVP period. We are not responsible for the accuracy of teaching, outcomes of learning, or interactions between members outside the platform.

## Changes

We will show a notice in the app before material changes take effect. Continuing to use Node Learn after that means you accept the new terms.

## Contact

[legal@node-learn.com](mailto:legal@node-learn.com) — how we handle your data is described in the [Privacy notice](/legal/privacy).
`,
};

export const LEGAL_DOCS = [PRIVACY, TERMS];

/** GitHub-style slug, matching the app's markdown renderer. */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-');
}

export type TocEntry = { level: 2 | 3; text: string; id: string };

export function tocOf(markdown: string): TocEntry[] {
  const out: TocEntry[] = [];
  for (const line of markdown.split('\n')) {
    const m = /^(#{2,3})\s+(.*)$/.exec(line.trim());
    if (m) {
      const text = m[2].trim();
      out.push({ level: m[1].length as 2 | 3, text, id: slugify(text) });
    }
  }
  return out;
}

/**
 * Minimal CommonMark subset renderer matching what the app supports:
 * ##/### headings, paragraphs, - and 1. lists, > quotes, ---,
 * **bold**, _italic_, `code`, [links](...). Raw HTML is escaped.
 */
export function renderMarkdown(markdown: string): string {
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const inline = (s: string) =>
    esc(s)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[\s(])_([^_]+)_/g, '$1<em>$2</em>')
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label: string, href: string) => {
        const external = /^https?:\/\//.test(href);
        const rel = external ? ' rel="noopener noreferrer" target="_blank"' : '';
        return `<a href="${href}"${rel}>${label}</a>`;
      });

  const lines = markdown.split('\n');
  const html: string[] = [];
  let list: 'ul' | 'ol' | null = null;
  let para: string[] = [];

  const flushPara = () => {
    if (para.length) {
      html.push(`<p>${inline(para.join(' '))}</p>`);
      para = [];
    }
  };
  const flushList = () => {
    if (list) {
      html.push(`</${list}>`);
      list = null;
    }
  };

  for (const raw of lines) {
    const line = raw.trim();

    if (!line) {
      flushPara();
      flushList();
      continue;
    }

    const heading = /^(#{2,3})\s+(.*)$/.exec(line);
    if (heading) {
      flushPara();
      flushList();
      const level = heading[1].length;
      const text = heading[2].trim();
      html.push(`<h${level} id="${slugify(text)}">${inline(text)}</h${level}>`);
      continue;
    }

    if (line === '---') {
      flushPara();
      flushList();
      html.push('<hr />');
      continue;
    }

    const ul = /^[-*]\s+(.*)$/.exec(line);
    if (ul) {
      flushPara();
      if (list !== 'ul') {
        flushList();
        html.push('<ul>');
        list = 'ul';
      }
      html.push(`<li>${inline(ul[1])}</li>`);
      continue;
    }

    const ol = /^\d+\.\s+(.*)$/.exec(line);
    if (ol) {
      flushPara();
      if (list !== 'ol') {
        flushList();
        html.push('<ol>');
        list = 'ol';
      }
      html.push(`<li>${inline(ol[1])}</li>`);
      continue;
    }

    const quote = /^>\s?(.*)$/.exec(line);
    if (quote) {
      flushPara();
      flushList();
      html.push(`<blockquote>${inline(quote[1])}</blockquote>`);
      continue;
    }

    flushList();
    para.push(line);
  }

  flushPara();
  flushList();
  return html.join('\n');
}

