# Node Learn — marketing portal

Static Astro site for the public `node-learn.example` portal. Separate from the Expo app in
`src/` on purpose: the app is a product surface behind auth, this is an indexable marketing
site with no client-side framework and no Appwrite SDK.

## Commands

Run these from `site/` (Windows PowerShell — use `;` not `&&` to chain):

```powershell
npm install      # first time only
npm run dev      # http://localhost:4322
npm run build    # -> site/dist
npm run preview  # serve the built output
```

Requires Node >= 22.12 (the repo already runs v22.x).

Port note: the Expo web app uses **8071** and the BFF uses **8070**. This site defaults to
Astro's **4321**, so all three can run at once.

## Structure

```
src/data/site.ts       Nav, principles, journeys, FAQ — single source of truth for copy
src/data/legal.ts      Privacy + Terms, ported from ../src/content/legal.ts, plus a small
                       CommonMark renderer matching the app's @/shared/markdown subset
src/layouts/Base.astro Shell: head/meta/OG, skip link, header, footer, JSON-LD
src/components/        Header, Footer, Logo, Section, Card, RelationDiagram
src/pages/             11 routes (see below)
src/styles/global.css  Design tokens mirrored from ../src/styles/tokens/palette.js
public/robots.txt      Points at the generated sitemap
```

Routes: `/` · `/how-it-works` · `/students` · `/teachers` · `/philosophy` · `/faq` · `/about`
· `/contact` · `/get-started` · `/legal` · `/legal/privacy` · `/legal/terms` · `404`

## Design tokens

`src/styles/global.css` mirrors `../src/styles/tokens/palette.js` one-for-one — the same
light/dark values, type ramp, radii and spacing as the app. Tailwind colour utilities resolve
to `--nl-*` CSS variables, which swap under `prefers-color-scheme: dark`, matching the app's
`darkMode: 'media'`.

**When the app palette changes, update `global.css` too.** Tailwind v4 does not allow `@theme`
inside `@media`, so the variables are declared on `:root` and only referenced from `@theme` —
do not move the dark values into a nested `@theme` block, it will leak into light mode.

## Content rules

Copy follows `docs/planning-prompts/01-frontend-product-design-planning-prompt.md`:

- English, short sentences, active voice, non-judgemental.
- Never imply the platform verifies teachers — profiles are self-described everywhere they appear.
- No pricing page: the MVP has no payments, orders, wallets or subscriptions.
- No growth mechanics in the copy (streaks, leaderboards, follower counts) — they are listed as
  explicit anti-goals instead.
- The About page states honestly what is shipped vs still being built. Keep it current.

Legal text is duplicated from `../src/content/legal.ts` rather than imported, because this
package does not depend on the app's TypeScript build. Keep both in sync until legal review.

## Deploying to Appwrite Sites

Build settings (console → Sites → create site → connect repository):

| Setting | Value |
|---|---|
| Framework | `Astro` |
| Root directory | `site` |
| Install command | `npm install` |
| Build command | `npm run build` |
| Output directory | `./dist` |
| Build runtime | `node-22` |

Or via CLI from `site/`: `appwrite deploy site`.

Before going live, set the real domain in `astro.config.mjs` (`site:`) — it drives canonical
URLs and `sitemap-index.xml` — and replace the `*.example` addresses in `src/data/site.ts`.

