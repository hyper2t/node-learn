#!/usr/bin/env node
/**
 * Local guard for Appwrite Auth email templates.
 *
 * This intentionally does not call Appwrite: it validates the source templates,
 * redirect wiring, and release configuration that can be checked before cloud
 * login / custom SMTP are available.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const rel = (path) => resolve(root, path);
const read = (path) => readFileSync(rel(path), 'utf8');

const templates = [
  {
    id: 'verification',
    file: 'appwrite/email-templates/verification.en.html',
    subject: 'Confirm your email for Node Learn',
    requiredText: /7 days/i,
    sendRouteFile: 'src/app/auth/verify.tsx',
    sendRouteNeedle: "${env.webUrl}/auth/verify",
    completeRouteFile: 'src/app/auth/verify.tsx',
    completeNeedle: 'completeEmailVerification',
  },
  {
    id: 'recovery',
    file: 'appwrite/email-templates/recovery.en.html',
    subject: 'Reset your Node Learn password',
    requiredText: /1 hour/i,
    sendRouteFile: 'src/app/auth/recover.tsx',
    sendRouteNeedle: "${env.webUrl}/auth/reset",
    completeRouteFile: 'src/app/auth/reset.tsx',
    completeNeedle: 'completePasswordRecovery',
  },
];

const allowedPlaceholders = new Set(['user', 'project', 'redirect', 'b', '/b']);
const failures = [];
const warnings = [];

function fail(message) { failures.push(message); }
function warn(message) { warnings.push(message); }
function ok(message) { console.log(`  ok ${message}`); }

function requireFile(path) {
  if (!existsSync(rel(path))) fail(`${path} is missing`);
}

console.log('check-email-templates: local Appwrite Auth email checks');

const pushScript = read('appwrite/push-email-templates.ps1');

for (const template of templates) {
  requireFile(template.file);
  if (!existsSync(rel(template.file))) continue;

  const body = read(template.file);
  const prefix = `${template.id}:`;
  const placeholders = [...body.matchAll(/{{\s*([^}]+?)\s*}}/g)].map((m) => m[1].trim());
  const placeholderSet = new Set(placeholders);
  const unknown = [...placeholderSet].filter((p) => !allowedPlaceholders.has(p));

  if (unknown.length) fail(`${prefix} unknown placeholder(s): ${unknown.join(', ')}`);
  for (const required of ['user', 'redirect', 'b', '/b']) {
    if (!placeholderSet.has(required)) fail(`${prefix} missing {{${required}}}`);
  }
  if (/{{\s+|\s+}}/.test(body)) fail(`${prefix} placeholders must not contain whitespace inside {{...}}`);
  if (!body.includes("href='{{redirect}}'")) fail(`${prefix} primary CTA must link to href='{{redirect}}'`);
  if ((body.match(/{{redirect}}/g) ?? []).length < 2) fail(`${prefix} include {{redirect}} in both CTA and fallback text`);
  if (body.includes('"')) fail(`${prefix} use single quotes only in HTML; PowerShell/Appwrite CLI mangles double quotes in --message`);
  if (!template.requiredText.test(body)) fail(`${prefix} missing expected expiry copy (${template.requiredText})`);
  if (!pushScript.includes(`id = "${template.id}"`) || !pushScript.includes(`subject = "${template.subject}"`)) {
    fail(`${prefix} subject/id is not declared in appwrite/push-email-templates.ps1`);
  }

  const sendRoute = read(template.sendRouteFile);
  const completeRoute = read(template.completeRouteFile);
  if (!sendRoute.includes(template.sendRouteNeedle)) fail(`${prefix} ${template.sendRouteFile} does not send ${template.sendRouteNeedle}`);
  if (!completeRoute.includes(template.completeNeedle)) fail(`${prefix} ${template.completeRouteFile} does not complete with ${template.completeNeedle}`);

  ok(`${template.id} template and redirect wiring`);
}

const eas = JSON.parse(read('eas.json'));
for (const profile of ['preview', 'production']) {
  const value = eas.build?.[profile]?.env?.EXPO_PUBLIC_WEB_URL;
  if (!value) {
    fail(`eas.json ${profile} is missing EXPO_PUBLIC_WEB_URL`);
    continue;
  }
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    fail(`eas.json ${profile} EXPO_PUBLIC_WEB_URL is not a valid URL: ${value}`);
    continue;
  }
  if (parsed.protocol !== 'https:') fail(`eas.json ${profile} EXPO_PUBLIC_WEB_URL must be https in release builds: ${value}`);
  if (value.endsWith('/')) fail(`eas.json ${profile} EXPO_PUBLIC_WEB_URL must not have a trailing slash: ${value}`);
  // .example is reserved for documentation (RFC 2606) — any such host is still a placeholder.
  if (parsed.hostname.endsWith('.example')) warn(`eas.json ${profile} still uses a placeholder web domain: ${parsed.hostname}`);
}
ok('EAS web URL values are syntactically valid');

const appJson = JSON.parse(read('app.json'));
const prodWebUrl = eas.build?.production?.env?.EXPO_PUBLIC_WEB_URL;
const prodHost = prodWebUrl ? new URL(prodWebUrl).hostname : '';
const androidHosts = (appJson.expo?.android?.intentFilters ?? [])
  .flatMap((filter) => filter.data ?? [])
  .map((data) => data.host)
  .filter(Boolean);
if (prodHost && !androidHosts.includes(prodHost)) {
  fail(`app.json Android App Link hosts (${androidHosts.join(', ') || 'none'}) do not include production web host ${prodHost}`);
}
ok('Android App Link host matches production web URL host');

for (const warning of warnings) console.warn(`  warn ${warning}`);
if (failures.length) {
  console.error('\ncheck-email-templates failed:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(`\ncheck-email-templates: ${templates.length} templates passed${warnings.length ? ` (${warnings.length} warning(s))` : ''}`);
