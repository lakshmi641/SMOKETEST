#!/usr/bin/env pwsh
<#
.SYNOPSIS
Firebase .env File Update Helper for julley-pms-production

.DESCRIPTION
Helper script to update .env.local and agents/ceo-visibility/.env with
Firebase credentials for julley-pms-production project.

.EXAMPLE
.\update-firebase-env.ps1

.NOTES
Run from the project root directory
#>

param(
    [Switch]$Interactive = $true,
    [String]$FirebaseConfigJsonPath,
    [String]$ServiceAccountJsonPath
)

$ErrorActionPreference = "Stop"

Write-Host "`n╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  Firebase .env Update Helper - julley-pms-production       ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

# ============================================================================
# Function: Update Frontend .env.local
# ============================================================================
function Update-FrontendEnv {
    Write-Host "`n📝 FRONTEND CONFIGURATION (.env.local)" -ForegroundColor Yellow
    Write-Host "═" * 60
    
    $envLocalPath = ".\.env.local"
    
    if (-not (Test-Path $envLocalPath)) {
        Write-Host "❌ .env.local not found at $envLocalPath" -ForegroundColor Red
        Write-Host "   Make sure you're in the project root directory" -ForegroundColor Red
        return $false
    }

    Write-Host "`nYou'll need these 7 values from Firebase Console:" -ForegroundColor Green
    Write-Host "→ Go to: https://console.firebase.google.com/" -ForegroundColor Cyan
    Write-Host "→ Select project: julley-pms-production" -ForegroundColor Cyan
    Write-Host "→ Settings ⚙️ → General → Your Apps → Web app → copy firebaseConfig" -ForegroundColor Cyan
    
    $config = @{}
    
    Write-Host "`n📋 Enter Firebase Config values:" -ForegroundColor Blue
    
    $config["NEXT_PUBLIC_FIREBASE_API_KEY"] = Read-Host "API Key"
    $config["NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"] = Read-Host "Auth Domain"
    $config["NEXT_PUBLIC_FIREBASE_PROJECT_ID"] = "julley-pms-production"
    $config["NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"] = Read-Host "Storage Bucket"
    $config["NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"] = Read-Host "Messaging Sender ID"
    $config["NEXT_PUBLIC_FIREBASE_APP_ID"] = Read-Host "App ID"
    $config["NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID"] = Read-Host "Measurement ID"
    
    Write-Host "`n✏️  Updating .env.local..." -ForegroundColor Yellow
    
    $envContent = Get-Content $envLocalPath -Raw
    
    foreach ($key in $config.Keys) {
        $value = $config[$key]
        $envContent = $envContent -replace "(?m)^#?\s*$key\s*=.*$", "$key=$value"
        
        # If the line doesn't exist, append it
        if (-not ($envContent -match "^$key\s*=")) {
            $envContent += "`n$key=$value"
        }
    }
    
    Set-Content $envLocalPath -Value $envContent
    
    Write-Host "✅ .env.local updated successfully!" -ForegroundColor Green
    return $true
}

# ============================================================================
# Function: Update Backend .env
# ============================================================================
function Update-BackendEnv {
    Write-Host "`n📝 BACKEND CONFIGURATION (agents/ceo-visibility/.env)" -ForegroundColor Yellow
    Write-Host "═" * 60
    
    $envPath = ".\agents\ceo-visibility\.env"
    
    if (-not (Test-Path $envPath)) {
        Write-Host "❌ Backend .env not found at $envPath" -ForegroundColor Red
        return $false
    }

    Write-Host "`nYou'll need the service account JSON from GCP:" -ForegroundColor Green
    Write-Host "→ Go to: https://console.cloud.google.com/" -ForegroundColor Cyan
    Write-Host "→ Project: julley-pms-production" -ForegroundColor Cyan
    Write-Host "→ IAM & Admin → Service Accounts → firebase-admin-sa → Keys" -ForegroundColor Cyan
    Write-Host "→ Create new key → JSON format → Download" -ForegroundColor Cyan
    
    if (-not $ServiceAccountJsonPath) {
        $ServiceAccountJsonPath = Read-Host "`nPath to service account JSON file"
    }
    
    if (-not (Test-Path $ServiceAccountJsonPath)) {
        Write-Host "❌ Service account JSON not found at: $ServiceAccountJsonPath" -ForegroundColor Red
        return $false
    }

    Write-Host "📂 Reading service account from: $ServiceAccountJsonPath" -ForegroundColor Cyan
    
    try {
        $json = Get-Content $ServiceAccountJsonPath | ConvertFrom-Json
    } catch {
        Write-Host "❌ Failed to parse JSON file: $_" -ForegroundColor Red
        return $false
    }

    Write-Host "✅ Parsed service account: $($json.client_email)" -ForegroundColor Green
    
    Write-Host "`n✏️  Updating backend .env..." -ForegroundColor Yellow
    
    $envContent = Get-Content $envPath -Raw
    
    # Update Firebase section
    $firebaseSection = @"
# ============================================================================
# Firebase Configuration — julley-pms-production
# ============================================================================
FIREBASE_PROJECT_ID=julley-pms-production
FIREBASE_PRIVATE_KEY_ID=$($json.private_key_id)
FIREBASE_PRIVATE_KEY="$($json.private_key)"
FIREBASE_CLIENT_EMAIL=$($json.client_email)
FIREBASE_CLIENT_ID=$($json.client_id)
FIREBASE_AUTH_URI=$($json.auth_uri)
FIREBASE_TOKEN_URI=$($json.token_uri)
FIREBASE_AUTH_PROVIDER_CERT_URL=$($json.auth_provider_x509_cert_url)
FIREBASE_CLIENT_CERT_URL=$($json.client_x509_cert_url)
"@
    
    # Replace the Firebase section (between markers)
    $envContent = $envContent -replace `
        "(?s)(# ============================================================================\s*# Firebase Configuration.*?# ============================================================================\s*FIREBASE_.*?)(?=\n\s*#|$)", `
        $firebaseSection
    
    Set-Content $envPath -Value $envContent
    
    Write-Host "✅ Backend .env updated successfully!" -ForegroundColor Green
    return $true
}

# ============================================================================
# Function: Verify Updates
# ============================================================================
function Verify-Updates {
    Write-Host "`n🔍 VERIFICATION" -ForegroundColor Yellow
    Write-Host "═" * 60
    
    Write-Host "`nFrontend (.env.local):" -ForegroundColor Blue
    $frontendVars = @(
        "NEXT_PUBLIC_FIREBASE_API_KEY",
        "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
        "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"
    )
    
    foreach ($var in $frontendVars) {
        $value = (Get-Content .\.env.local | Select-String "^$var=" | Select-Object -First 1)
        if ($value) {
            $displayValue = $value -replace "^.*=", "" | Select-Object -First 40
            if ($displayValue.Length -gt 40) {
                $displayValue = $displayValue + "..."
            }
            Write-Host "  ✅ $var = $displayValue" -ForegroundColor Green
        } else {
            Write-Host "  ❌ $var = NOT FOUND" -ForegroundColor Red
        }
    }
    
    Write-Host "`nBackend (agents/ceo-visibility/.env):" -ForegroundColor Blue
    $backendVars = @(
        "FIREBASE_PROJECT_ID",
        "FIREBASE_CLIENT_EMAIL",
        "FIREBASE_PRIVATE_KEY"
    )
    
    foreach ($var in $backendVars) {
        $value = (Get-Content .\agents\ceo-visibility\.env | Select-String "^$var=" | Select-Object -First 1)
        if ($value) {
            $displayValue = $value -replace "^.*=", "" | Select-Object -First 40
            if ($displayValue.Length -gt 40) {
                $displayValue = $displayValue + "..."
            }
            Write-Host "  ✅ $var = $displayValue" -ForegroundColor Green
        } else {
            Write-Host "  ❌ $var = NOT FOUND" -ForegroundColor Red
        }
    }
    
    Write-Host "`n"
}

# ============================================================================
# Main Execution
# ============================================================================
function Main {
    try {
        $continueSetup = $true
        
        # Update frontend
        if ($Interactive) {
            Write-Host "`nStart with frontend (.env.local)? (Y/n): " -ForegroundColor Cyan -NoNewline
            $response = Read-Host
            if ($response -ne "n" -and $response -ne "N") {
                $continueSetup = Update-FrontendEnv
            }
        } else {
            $continueSetup = Update-FrontendEnv
        }
        
        if (-not $continueSetup) {
            Write-Host "`n⚠️  Frontend setup incomplete. Exiting." -ForegroundColor Yellow
            return
        }
        
        # Update backend
        if ($Interactive) {
            Write-Host "`nContinue with backend (agents/ceo-visibility/.env)? (Y/n): " -ForegroundColor Cyan -NoNewline
            $response = Read-Host
            if ($response -ne "n" -and $response -ne "N") {
                $continueSetup = Update-BackendEnv
            }
        } else {
            $continueSetup = Update-BackendEnv
        }
        
        if (-not $continueSetup) {
            Write-Host "`n⚠️  Backend setup incomplete." -ForegroundColor Yellow
        }
        
        # Verification
        Write-Host "`nVerify updates? (Y/n): " -ForegroundColor Cyan -NoNewline
        $response = Read-Host
        if ($response -ne "n" -and $response -ne "N") {
            Verify-Updates
        }
        
        Write-Host "═" * 60 -ForegroundColor Cyan
        Write-Host "`n✅ Firebase .env setup complete!" -ForegroundColor Green
        Write-Host "`n📋 Next steps:" -ForegroundColor Cyan
        Write-Host "   1. Run: npm run setup:storage-cors" -ForegroundColor White
        Write-Host "   2. Restart dev server: npm run dev" -ForegroundColor White
        Write-Host "   3. Test login and storage access" -ForegroundColor White
        Write-Host "`n"
        
    } catch {
        Write-Host "`n❌ Error: $_" -ForegroundColor Red
        exit 1
    }
}

Main
