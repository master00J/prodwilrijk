$xlPath = 'C:\Users\j.ploegaerts\Desktop\Stock Genk.xlsx'
$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
$wb = $excel.Workbooks.Open($xlPath)
$ws = $wb.Sheets.Item(1)
Write-Host "=== KOLOM HEADERS (rij 1) ==="
$cols = @('A','B','C','D','E','F','G','H','I','J','K','L')
for ($c = 1; $c -le 12; $c++) {
    $val = $ws.Cells.Item(1, $c).Text
    Write-Host ("Col " + $cols[$c-1] + " (" + $c + "): [" + $val + "]")
}
Write-Host ""
Write-Host "=== RIJEN 2-5 (kolom A en B) ==="
for ($r = 2; $r -le 5; $r++) {
    $a = $ws.Cells.Item($r, 1).Text
    $b = $ws.Cells.Item($r, 2).Text
    $c = $ws.Cells.Item($r, 3).Text
    $k = $ws.Cells.Item($r, 11).Text
    Write-Host ("R" + $r + " A=[" + $a + "] B=[" + $b + "] C(Inv)=[" + $c + "] K(ProdOrder)=[" + $k + "]")
}
$wb.Close($false)
$excel.Quit()
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
