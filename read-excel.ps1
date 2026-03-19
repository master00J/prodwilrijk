$xlPath = 'C:\Users\j.ploegaerts\Desktop\Stock Genk.xlsx'
$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
$wb = $excel.Workbooks.Open($xlPath)
$ws = $wb.Sheets.Item(1)
Write-Host "=== HEADERS (rij 1) ==="
for ($c = 1; $c -le 15; $c++) {
    $val = $ws.Cells.Item(1, $c).Text
    Write-Host "Kolom $c ($(([char](64+$c)))): [$val]"
}
Write-Host ""
Write-Host "=== DATARIJ 2 ==="
for ($c = 1; $c -le 15; $c++) {
    $val = $ws.Cells.Item(2, $c).Text
    Write-Host "Kolom $c ($(([char](64+$c)))): [$val]"
}
Write-Host ""
Write-Host "=== DATARIJ 3 ==="
for ($c = 1; $c -le 15; $c++) {
    $val = $ws.Cells.Item(3, $c).Text
    Write-Host "Kolom $c ($(([char](64+$c)))): [$val]"
}
$wb.Close($false)
$excel.Quit()
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
