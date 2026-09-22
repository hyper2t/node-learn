# Transactional email templates (Appwrite → Auth → Templates)

Source of truth for the branded `verification` and `recovery` emails, locale `en`.
`{{user}}`, `{{project}}`, `{{redirect}}`, `{{b}}…{{/b}}` are Appwrite placeholders; `{{redirect}}`
is the URL the app passes to `account.createVerification` / `account.createRecovery`
(`EXPO_PUBLIC_WEB_URL/auth/verify` and `/auth/reset`).

Use single quotes for HTML attributes: the CLI is invoked from Windows PowerShell and double quotes
inside the `--message` argument get mangled. Push after editing (subjects live in `../push-email-templates.ps1`):

```powershell
npm run appwrite:email-templates
```

**Blocked until custom SMTP is configured.** Appwrite Cloud rejects template updates with
`400 SMTP must be enabled on the project to configure custom email templates.` (verified 2026-09-22).
Order of operations once an SMTP provider is chosen (plan E5 / decision D2):

```powershell
appwrite project update-smtp --enabled true --sender-name "Node Learn" --sender-email noreply@<domain> `
  --host <smtp-host> --port 465 --username <user> --password <secret> --secure tls
appwrite project create-smtp-test --emails you@example.com --sender-name "Node Learn" --sender-email noreply@<domain> `
  --host <smtp-host> --port 465 --username <user> --password <secret> --secure tls
npm run appwrite:email-templates
```
