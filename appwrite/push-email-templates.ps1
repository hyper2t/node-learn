param([switch]$CheckOnly)

# Push branded email templates to Appwrite (Console -> Auth -> Templates).
# Usage: npm run appwrite:email-templates   (requires `appwrite login` + appwrite.config.json project)
# Local-only validation: npm run appwrite:email-templates:check
$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$repo = Split-Path -Parent $here

& node (Join-Path $repo "scripts/check-email-templates.mjs")
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
if ($CheckOnly) { exit 0 }

$templates = @(
  @{ id = "verification"; subject = "Confirm your email for Node Learn" },
  @{ id = "recovery";     subject = "Reset your Node Learn password" }
)
foreach ($t in $templates) {
  $file = Join-Path $here ("email-templates/" + $t["id"] + ".en.html")
  $body = Get-Content -Raw -Encoding UTF8 -Path $file
  $out = & appwrite project update-email-template --template-id $t["id"] --locale en --subject $t["subject"] --message $body --json 2>&1 | Out-String
  if ($out -match '"templateId"') { Write-Host ("OK   " + $t["id"]); continue }
  if ($out -match 'SMTP must be enabled') {
    Write-Host ("FAIL " + $t["id"] + " :: custom SMTP must be enabled before Appwrite Cloud accepts custom email templates.")
    Write-Host "See appwrite/email-templates/README.md for the required order of operations."
    exit 1
  }
  Write-Host ("FAIL " + $t["id"] + " :: " + $out.Trim())
  exit 1
}
$list = & appwrite project list-email-templates --json 2>&1 | Out-String | ConvertFrom-Json
Write-Host ("templates on cloud: " + $list.total)
$list.templates | ForEach-Object { Write-Host ("  " + $_.templateId + " [" + $_.locale + "] " + $_.subject) }
