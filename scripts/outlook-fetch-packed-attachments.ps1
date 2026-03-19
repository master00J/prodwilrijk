# Outlook: ophalen PACKED_Y.XLS en PACKED_N.XLS uit mailbox aii@foresco.eu
# Vereisten: Outlook geïnstalleerd, mailbox aii@foresco.eu toegevoegd in Outlook

param(
    [string]$OutputFolder = ".\packed-attachments",
    [int]$YearsBack = 1
)

$ErrorActionPreference = "Stop"
$targetMailbox = "aii@foresco.eu"
$subjectPatterns = @(
    @{ Subject = "Packed units Foresco - PACKED_Y"; FileName = "PACKED_Y.XLS" },
    @{ Subject = "Packed units Foresco - PACKED_N"; FileName = "PACKED_N.XLS" }
)

$since = (Get-Date).AddYears(-$YearsBack)

# Uitvoermap aanmaken
if (-not (Test-Path $OutputFolder)) {
    New-Item -ItemType Directory -Path $OutputFolder -Force | Out-Null
}
$OutputFolder = (Resolve-Path $OutputFolder).Path
Write-Host "Bijlagen worden opgeslagen in: $OutputFolder" -ForegroundColor Cyan

try {
    $outlook = New-Object -ComObject Outlook.Application
    $ns = $outlook.GetNamespace("MAPI")
}
catch {
    Write-Error "Outlook kon niet gestart worden. Zorg dat Outlook geïnstalleerd is en (eenmalig) gestart. Fout: $_"
    exit 1
}

# olFolderInbox = 6
$olFolderInbox = 6
# Mailbox zoeken (alle stores = alle accounts/shared mailboxes)
$targetInbox = $null
foreach ($store in $ns.Stores) {
    $match = $store.DisplayName -like "*$targetMailbox*" -or $store.DisplayName -like "*AII*"
    if (-not $match -and $store.ExchangeEmailAddress) {
        try { $match = $store.ExchangeEmailAddress.SmtpAddress -like "*$targetMailbox*" } catch {}
    }
    if ($match) {
        try {
            $targetInbox = $store.GetDefaultFolder($olFolderInbox)
            if ($targetInbox) {
                Write-Host "Gevonden mailbox: $($store.DisplayName) -> Inbox" -ForegroundColor Green
                break
            }
        } catch {
            Write-Warning "Store '$($store.DisplayName)' geen toegang tot Inbox: $_"
        }
    }
}

if (-not $targetInbox) {
    Write-Host "Mailbox '$targetMailbox' niet gevonden in Outlook." -ForegroundColor Yellow
    Write-Host "Beschikbare stores:" -ForegroundColor Yellow
    foreach ($store in $ns.Stores) {
        Write-Host "  - $($store.DisplayName)" -ForegroundColor Gray
    }
    Write-Host ""
    Write-Host "Tip: Voeg de mailbox toe als extra account of als gedeelde mailbox in Outlook." -ForegroundColor Yellow
    exit 1
}

$totalSaved = 0
# Alleen mails van het afgelopen jaar doorzoeken (Outlook filter)
$filter = "[ReceivedTime] >= '" + $since.ToString("yyyy-MM-dd HH:mm") + "'"
$items = $null
try {
    $items = $targetInbox.Items.Restrict($filter)
} catch {
    $items = $targetInbox.Items
}
$itemCount = $items.Count
Write-Host "Te doorzoeken mails (vanaf $($since.ToString('yyyy-MM-dd'))): $itemCount" -ForegroundColor Cyan

for ($i = 1; $i -le $itemCount; $i++) {
    try {
        $item = $items.Item($i)
        if ($null -eq $item) { continue }

        $subj = $item.Subject
        foreach ($pattern in $subjectPatterns) {
            if ($subj -notlike "*$($pattern.Subject)*") { continue }

            foreach ($att in $item.Attachments) {
                $name = $att.FileName
                if ($name -eq $pattern.FileName) {
                    $path = Join-Path $OutputFolder $name
                    # Meerdere mails kunnen dezelfde bestandsnaam hebben: unieke naam maken
                    $base = [System.IO.Path]::GetFileNameWithoutExtension($name)
                    $ext = [System.IO.Path]::GetExtension($name)
                    $counter = 0
                    while (Test-Path $path) {
                        $counter++
                        $path = Join-Path $OutputFolder "${base}_$counter$ext"
                    }
                    $att.SaveAsFile($path)
                    $rec = ""; try { $rec = $item.ReceivedTime } catch {}
                    Write-Host "Opgeslagen: $path (van mail: $subj, ontvangen: $rec)" -ForegroundColor Green
                    $totalSaved++
                }
            }
        }
    }
    catch {
        Write-Warning "Fout bij verwerken item $i : $_"
    }
}

Write-Host ""
Write-Host "Klaar. Totaal $totalSaved bijlage(s) opgeslagen in: $OutputFolder" -ForegroundColor Cyan

# COM object vrijgeven
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($outlook) | Out-Null
