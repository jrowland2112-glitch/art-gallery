param(
  [Parameter(Mandatory = $true)]
  [ValidateNotNullOrEmpty()]
  [string]$ThemeName
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$settingsPath = Join-Path $projectRoot 'config\settings_data.json'
$settings = Get-Content -LiteralPath $settingsPath -Raw

if ($settings -notmatch 'shopify://apps/forms/' -or $settings -notmatch 'shopify://apps/judge-me-reviews/') {
  throw 'Required Shopify Forms or Judge.me app embed is missing from config/settings_data.json.'
}

Push-Location $projectRoot
try {
  npm run check
  if ($LASTEXITCODE -ne 0) { throw 'Local checks failed; preview was not uploaded.' }

  shopify theme push --unpublished --theme $ThemeName
  if ($LASTEXITCODE -ne 0) { throw 'Shopify preview upload failed.' }
} finally {
  Pop-Location
}
