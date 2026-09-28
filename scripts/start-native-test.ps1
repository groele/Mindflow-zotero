$ErrorActionPreference = 'Stop'
$workspace = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$testRoot = Join-Path $workspace ('tests\native-test-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
$profile = Join-Path $testRoot 'profile'
$dataDir = Join-Path $testRoot 'data'
$addon = Join-Path $profile 'extensions\mindflow@groele.org'
New-Item -ItemType Directory -Path $addon,$dataDir -Force | Out-Null
$version = (Get-Content -LiteralPath (Join-Path $workspace 'manifest.json') -Raw | ConvertFrom-Json).version
$packagePath = Join-Path $workspace "mindflow-zotero-$version.xpi"
if (!(Test-Path -LiteralPath $packagePath)) { throw 'Build and package the XPI before native tests.' }
Add-Type -AssemblyName System.IO.Compression.FileSystem
[IO.Compression.ZipFile]::ExtractToDirectory($packagePath, $addon)
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'native-regression.js') -Destination $addon
$bootstrapPath = Join-Path $addon 'bootstrap.js'
$bootstrap = [IO.File]::ReadAllText($bootstrapPath)
$bootstrap = $bootstrap.Replace('Services.scriptloader.loadSubScript(`${rootURI}chrome/content/scripts/index.js`, ctx);', 'Services.scriptloader.loadSubScript(`${rootURI}chrome/content/scripts/index.js`, ctx); Services.scriptloader.loadSubScript(`${rootURI}native-regression.js`, ctx);')
[IO.File]::WriteAllText($bootstrapPath, $bootstrap)
$dataJson = ConvertTo-Json $dataDir -Compress
$prefs = @"
user_pref("extensions.zotero.useDataDir", true);
user_pref("extensions.zotero.dataDir", $dataJson);
user_pref("extensions.zotero.firstRun2", false);
user_pref("extensions.zotero.firstRunGuidance", false);
user_pref("extensions.zotero.warnOnUnsafeDataDir", false);
user_pref("extensions.zotero.automaticScraperUpdates", false);
user_pref("extensions.zotero.httpServer.enabled", false);
user_pref("extensions.zotero.showPostUpgradeBanner", false);
user_pref("extensions.autoDisableScopes", 0);
user_pref("extensions.enabledScopes", 1);
user_pref("extensions.mindflow.showWelcomeOnStartup", false);
user_pref("extensions.mindflow.windowMode", "tab");
user_pref("app.update.auto", false);
"@
[IO.File]::WriteAllText((Join-Path $profile 'user.js'), $prefs)
$arguments = '-no-remote -profile "' + $profile + '" -ZoteroDebugText'
$process = Start-Process -FilePath 'C:\Program Files\Zotero\zotero.exe' -ArgumentList $arguments -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $testRoot 'stdout.log') -RedirectStandardError (Join-Path $testRoot 'stderr.log')
[PSCustomObject]@{ TestRoot=$testRoot; ProcessId=$process.Id } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $workspace 'tests\current-native-test.json')
[PSCustomObject]@{ TestRoot=$testRoot; ProcessId=$process.Id }
