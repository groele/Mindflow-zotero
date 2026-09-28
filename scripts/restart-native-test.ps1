$ErrorActionPreference = 'Stop'
$workspace = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$record = Get-Content -LiteralPath (Join-Path $workspace 'tests\current-native-test.json') -Raw | ConvertFrom-Json
$testRoot = (Resolve-Path -LiteralPath $record.TestRoot).Path
if (!$testRoot.StartsWith((Join-Path $workspace 'tests\native-test-'), [StringComparison]::OrdinalIgnoreCase)) { throw 'Invalid isolated test profile.' }
if (!(Test-Path -LiteralPath (Join-Path $testRoot 'data\native-regression-done.txt'))) { throw 'Initial native test has not finished.' }
if (Get-CimInstance Win32_Process -Filter "Name = 'zotero.exe'" | Where-Object { $_.CommandLine -like ('*' + $testRoot + '*') }) { throw 'Wait for the isolated test process to exit.' }
$profile = Join-Path $testRoot 'profile'
$arguments = '-no-remote -profile "' + $profile + '" -ZoteroDebugText'
$process = Start-Process -FilePath 'C:\Program Files\Zotero\zotero.exe' -ArgumentList $arguments -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $testRoot 'restart-stdout.log') -RedirectStandardError (Join-Path $testRoot 'restart-stderr.log')
[PSCustomObject]@{ TestRoot=$testRoot; ProcessId=$process.Id; Phase='restart' }
