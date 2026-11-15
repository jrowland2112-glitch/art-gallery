param(
  [string]$NpmScript = 'finerworks:doctor',
  [switch]$ReplaceAppKey
)

$ErrorActionPreference = 'Stop'

function Convert-SessionSecret([Security.SecureString]$Secure) {
  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Secure)
  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
  }
  finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
  }
}

function Get-SavedSecret([string]$Path, [string]$Prompt) {
  if (Test-Path -LiteralPath $Path) {
    $encrypted = (Get-Content -LiteralPath $Path -Raw).Trim()
    return $encrypted | ConvertTo-SecureString
  }
  $secure = Read-Host $Prompt -AsSecureString
  $secure | ConvertFrom-SecureString | Set-Content -LiteralPath $Path -Encoding utf8
  return $secure
}

function Set-SessionSecret([string]$Name, [Security.SecureString]$Secure) {
  $plain = Convert-SessionSecret $Secure
  try {
    [Environment]::SetEnvironmentVariable($Name, $plain, 'Process')
  }
  finally {
    $plain = $null
  }
}

Write-Host 'FinerWorks LIVE credential check (read-only)' -ForegroundColor Cyan
$secretDirectory = Join-Path $env:LOCALAPPDATA 'RowlandPhotography\Secrets'
New-Item -ItemType Directory -Path $secretDirectory -Force | Out-Null
$webKeyPath = Join-Path $secretDirectory 'finerworks-web-api-key.dpapi'
$appKeyPath = Join-Path $secretDirectory 'finerworks-live-app-key.dpapi'

if ($ReplaceAppKey -and (Test-Path -LiteralPath $appKeyPath)) {
  Remove-Item -LiteralPath $appKeyPath -Force
}

Write-Host 'Credentials are encrypted with Windows DPAPI for this Windows account.'
Write-Host "Encrypted files: $secretDirectory"
Write-Host 'This check cannot submit an order.' -ForegroundColor Yellow

try {
  $webKey = Get-SavedSecret $webKeyPath 'Paste the FinerWorks web_api_key (saved encrypted after this entry)'
  $appKey = Get-SavedSecret $appKeyPath 'Paste the FinerWorks LIVE app_key (saved encrypted after this entry)'
  Set-SessionSecret 'FINERWORKS_WEB_API_KEY' $webKey
  Set-SessionSecret 'FINERWORKS_APP_KEY' $appKey
  [Environment]::SetEnvironmentVariable('FINERWORKS_CREDENTIAL_ENVIRONMENT', 'live', 'Process')
  npm run $NpmScript
}
finally {
  Remove-Item Env:FINERWORKS_WEB_API_KEY -ErrorAction SilentlyContinue
  Remove-Item Env:FINERWORKS_APP_KEY -ErrorAction SilentlyContinue
  Remove-Item Env:FINERWORKS_CREDENTIAL_ENVIRONMENT -ErrorAction SilentlyContinue
  $webKey = $null
  $appKey = $null
  Write-Host ''
  Write-Host 'Plain-text credentials have been cleared from this PowerShell session.' -ForegroundColor Green
  Read-Host 'Press Enter to close this window'
}
