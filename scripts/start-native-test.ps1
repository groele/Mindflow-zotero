param([string]$PackageName, [string]$PreviewMap)
$ErrorActionPreference = 'Stop'
$workspace = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$testRoot = Join-Path $workspace ('tests\native-test-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
$profile = Join-Path $testRoot 'profile'
$dataDir = Join-Path $testRoot 'data'
$addon = Join-Path $profile 'extensions\mindflow@groele.org'
New-Item -ItemType Directory -Path $addon,$dataDir -Force | Out-Null
$version = (Get-Content -LiteralPath (Join-Path $workspace 'manifest.json') -Raw | ConvertFrom-Json).version
$packagePath = Join-Path $workspace $(if ($PackageName) { $PackageName } else { "mindflow-zotero-$version.xpi" })
if (!(Test-Path -LiteralPath $packagePath)) { throw 'Build and package the XPI before native tests.' }
Add-Type -AssemblyName System.IO.Compression.FileSystem
[IO.Compression.ZipFile]::ExtractToDirectory($packagePath, $addon)
if (!$PreviewMap) {
  # Probe cold-start file imports before React mounts. This instrumentation
  # exists only in the extracted temporary profile, never in the output XPI.
  $testIndexPath = Join-Path $addon 'chrome\content\index.html'
  $testIndex = [IO.File]::ReadAllText($testIndexPath)
  $importProbe = @'
<script>
if (window._mindflowInitialAction?.mode === 'import_file') {
  window._mindflowNativeImportRequests = [];
  const originalClick = HTMLInputElement.prototype.click;
  HTMLInputElement.prototype.click = function () {
    if (this.hasAttribute('data-mindflow-workspace-import')) {
      window._mindflowNativeImportRequests.push({ mounted: this.isConnected });
      return;
    }
    return originalClick.call(this);
  };
}
</script>
'@
  [IO.File]::WriteAllText($testIndexPath, $testIndex.Replace('</head>', $importProbe + '</head>'))
}
Copy-Item -LiteralPath (Join-Path $PSScriptRoot $(if ($PreviewMap) { 'native-preview-map.js' } else { 'native-regression.js' })) -Destination (Join-Path $addon 'native-regression.js')
if ($PreviewMap) { Copy-Item -LiteralPath (Resolve-Path -LiteralPath $PreviewMap).Path -Destination (Join-Path $dataDir 'preview-input.mindflow') }
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
user_pref("extensions.zoteroWinWordIntegration.skipInstallation", true);
user_pref("extensions.zoteroOpenOfficeIntegration.skipInstallation", true);
user_pref("extensions.mindflow.showWelcomeOnStartup", false);
user_pref("extensions.mindflow.windowMode", "tab");
user_pref("extensions.zotero.panes.mindflow\\@groele\\.org-mindflow-item-pane.open", false);
user_pref("app.update.auto", false);
"@
[IO.File]::WriteAllText((Join-Path $profile 'user.js'), $prefs)
$arguments = '-no-remote -profile "' + $profile + '" -ZoteroDebugText'
$process = Start-Process -FilePath 'C:\Program Files\Zotero\zotero.exe' -ArgumentList $arguments -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $testRoot 'stdout.log') -RedirectStandardError (Join-Path $testRoot 'stderr.log')
[PSCustomObject]@{ TestRoot=$testRoot; ProcessId=$process.Id } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $workspace 'tests\current-native-test.json')
[PSCustomObject]@{ TestRoot=$testRoot; ProcessId=$process.Id }
