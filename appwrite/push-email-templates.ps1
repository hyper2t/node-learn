# Push branded email templates to Appwrite (Console → Auth → Templates).
# Usage: npm run appwrite:email-templates   (requires `appwrite login` + appwrite.config.json project)
$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$templates = @(
  @{ id = "verification"; subject = "Confirm your email for Node Learn" },
  @{ id = "recovery";     subject = "Reset your Node Learn password" }
)
foreach ($t in $templates) {
  $file = Join-Path $here ("email-templates/" + $t.id + ".en.html")
  $body = Get-Content -Raw -Encoding UTF8 -Path $file
  $out = & appwrite project update-email-template --template-id $t.id --locale en --subject $t.subject --message $body --json 2>&1 | Out-String
  if ($out -match '"templateId"') { Write-Host ("OK   " + $t.id) } else { Write-Host ("FAIL " + $t.id + " :: " + $out.Trim()); exit 1 }
}
$list = & appwrite project list-email-templates --json 2>&1 | Out-String | ConvertFrom-Json
Write-Host ("templates on cloud: " + $list.total)
$list.templates | ForEach-Object { Write-Host ("  " + $_.templateId + " [" + $_.locale + "] " + $_.subject) }
