# Saves FixIt's live Stripe secrets to Supabase, without the values ever being
# written to a file, to the chat, or shown on screen.
#
# Run it yourself, in a PowerShell window, from the project folder:
#
#   powershell -ExecutionPolicy Bypass -File .\scripts\set-live-stripe-secrets.ps1
#
# It asks for three things. The two keys are hidden as you paste them:
#   1. the live secret key from Stripe  (starts with sk_live_ or rk_live_)
#   2. the webhook signing secret       (starts with whsec_)
#   3. the site address                 (press Enter to accept https://www.fixitls.com)
#
# Needs the Supabase command line signed in once:  npx.cmd --yes supabase login
# (--yes answers npx's "Ok to proceed? (y)" question; typing "ok" there cancels it.)

$ErrorActionPreference = "Stop"
$projectRef = "kghmrjphvvgfcbllbsxe"

function Read-Hidden([string]$prompt) {
    $secure = Read-Host -Prompt $prompt -AsSecureString
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr).Trim() }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}

# Fail early, before any key is pasted, if the command line is signed in to a
# Supabase account that cannot see FixIt's project.
$visible = (& npx.cmd --yes supabase projects list -o json 2>$null) -join "`n"
if ($visible -notmatch [regex]::Escape($projectRef)) {
    Write-Host ""
    Write-Host "The Supabase command line is signed in to an account that cannot see FixIt's project." -ForegroundColor Red
    Write-Host "Sign out with:  npx.cmd --yes supabase logout" -ForegroundColor Red
    Write-Host "then sign in again with the SAME account you use in the Supabase dashboard for FixIt (the one that owns 'Tilak145's Project')." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "FixIt: save the LIVE Stripe secrets to Supabase" -ForegroundColor Cyan
Write-Host "Nothing you paste is shown or stored; it goes straight to Supabase." -ForegroundColor DarkGray
Write-Host ""

$secretKey = Read-Hidden "1/3  Live secret key (sk_live_... or rk_live_...)"
if ($secretKey -notmatch '^(sk|rk)_live_[A-Za-z0-9_]{20,}$') {
    if ($secretKey -match '^(sk|rk)_test_') {
        Write-Host "That is a TEST key. Create the key in Stripe's live mode and try again." -ForegroundColor Red
    } else {
        Write-Host "That does not look like a live Stripe secret key (sk_live_... or rk_live_...). Nothing was saved." -ForegroundColor Red
    }
    exit 1
}

$webhookSecret = Read-Hidden "2/3  Webhook signing secret (whsec_...)"
if ($webhookSecret -notmatch '^whsec_[A-Za-z0-9]{20,}$') {
    Write-Host "That does not look like a webhook signing secret (whsec_...). Nothing was saved." -ForegroundColor Red
    exit 1
}

$appUrl = Read-Host -Prompt "3/3  Site address [https://www.fixitls.com]"
if ([string]::IsNullOrWhiteSpace($appUrl)) { $appUrl = "https://www.fixitls.com" }
$appUrl = $appUrl.Trim().TrimEnd("/")
if ($appUrl -notmatch '^https://[A-Za-z0-9.-]+$') {
    Write-Host "The site address must start with https:// and have no path. Nothing was saved." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Saving to Supabase project $projectRef ..." -ForegroundColor Cyan
& npx.cmd --yes supabase secrets set "STRIPE_SECRET_KEY=$secretKey" "STRIPE_WEBHOOK_SECRET=$webhookSecret" "APP_URL=$appUrl" --project-ref $projectRef
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "Supabase refused. If it says you are not logged in, run:  npx.cmd --yes supabase login   and try again." -ForegroundColor Red
    exit 1
}

# Do not leave the keys in this window's memory any longer than needed.
$secretKey = $null
$webhookSecret = $null

Write-Host ""
Write-Host "Saved. Supabase now holds these secrets (names and last-updated time only):" -ForegroundColor Green
& npx.cmd --yes supabase secrets list --project-ref $projectRef
Write-Host ""
Write-Host "Done. Go back to Claude and say it is saved." -ForegroundColor Green
