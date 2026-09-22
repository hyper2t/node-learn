npx eslint src -f json -o .expo/eslint-out.json 2>$null
$j = Get-Content .expo/eslint-out.json -Raw | ConvertFrom-Json
foreach ($f in $j) { foreach ($m in $f.messages) { if ($m.severity -eq 2) { Write-Output ("{0}:{1} {2} {3}" -f $f.filePath.Replace('E:\node-learn-en\',''), $m.line, $m.ruleId, $m.message) } } }
