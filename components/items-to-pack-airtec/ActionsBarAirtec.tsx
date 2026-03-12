'use client'

interface ActionsBarAirtecProps {
  selectedCount: number
  totalCount: number
  onMarkAsPacked: () => void
  onSetPriority: () => void
  onDeleteSelected: () => void
  onShowTimer: () => void
  activeTimerCount?: number
}

function printList() {
  const printArea = document.getElementById('airtec-print-area')
  if (!printArea) return

  // Kloon de tabel en verwijder verborgen kolommen
  const table = printArea.querySelector('table')
  if (!table) return
  const clone = table.cloneNode(true) as HTMLTableElement
  clone.querySelectorAll('.print-col-hide').forEach(el => el.remove())

  const totalRows = clone.querySelectorAll('tbody tr').length
  const today = new Date().toLocaleDateString('nl-NL', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })

  const win = window.open('', '_blank', 'width=1100,height=750')
  if (!win) return

  win.document.write(`<!DOCTYPE html><html><head>
<meta charset="UTF-8">
<title>Items to Pack — Airtec</title>
<style>
  @page { size: A4 landscape; margin: 10mm 8mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 8pt; color: #111; }
  .print-header {
    display: flex; justify-content: space-between; align-items: baseline;
    font-size: 10pt; font-weight: bold;
    border-bottom: 1.5pt solid #333;
    padding-bottom: 4px; margin-bottom: 8px;
  }
  .print-header span { font-size: 8pt; font-weight: normal; color: #555; }
  table {
    width: 100%; border-collapse: collapse;
    table-layout: fixed;
  }
  thead { display: table-header-group; }
  tfoot { display: table-footer-group; }
  th {
    background: #e0e0e0 !important;
    font-size: 7.5pt; font-weight: bold;
    padding: 3px 5px;
    border: 0.5pt solid #999;
    text-align: left;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  td {
    padding: 2px 5px;
    border: 0.5pt solid #ccc;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    vertical-align: middle;
  }
  tr:nth-child(even) td { background: #f9f9f9; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  tr.priority-row td { background: #fef9c3 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .print-col-id   { width: 4%;  }
  .print-col-desc { width: 27%; }
  .print-col-item { width: 13%; }
  .print-col-lot  { width: 15%; }
  .print-col-date { width: 9%;  }
  .print-col-box  { width: 11%; }
  .print-col-div  { width: 8%;  }
  .print-col-qty  { width: 5%;  }
  .print-col-prio { width: 8%;  }
  .prio-badge {
    background: #f59e0b; color: #fff;
    padding: 1px 4px; border-radius: 2px;
    font-size: 6.5pt; font-weight: bold;
  }
</style>
</head><body>
<div class="print-header">
  Items to Pack — Airtec
  <span>${totalRows} items &nbsp;·&nbsp; Afgedrukt op ${today}</span>
</div>
${clone.outerHTML}
</body></html>`)

  win.document.close()
  win.focus()
  // Klein vertraging zodat browser de stijlen laadt
  setTimeout(() => {
    win.print()
    win.close()
  }, 400)
}

export default function ActionsBarAirtec({
  selectedCount,
  totalCount,
  onMarkAsPacked,
  onSetPriority,
  onDeleteSelected,
  onShowTimer,
  activeTimerCount = 0,
}: ActionsBarAirtecProps) {
  return (
    <div className="bg-gray-50 rounded-lg p-4 mb-6 flex flex-wrap justify-between items-center gap-4">
      <div className="flex items-center gap-4">
        <div className="text-lg font-medium">
          Open Items: <span className="font-bold">{totalCount}</span>
        </div>
        {selectedCount > 0 && (
          <div className="text-lg text-blue-600 font-medium">
            Selected: {selectedCount}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={onMarkAsPacked}
          disabled={selectedCount === 0}
          className="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium text-lg"
        >
          ✓ Mark as Packed
        </button>
        <button
          onClick={onShowTimer}
          className={`px-6 py-3 rounded-lg font-medium text-lg ${
            activeTimerCount > 0
              ? 'bg-orange-500 hover:bg-orange-600 text-white'
              : 'bg-gray-500 hover:bg-gray-600 text-white'
          }`}
        >
          ⏱️ {activeTimerCount > 0 ? `Active Timers (${activeTimerCount})` : 'Start Timer'}
        </button>
        <button
          onClick={onSetPriority}
          disabled={selectedCount === 0}
          className="px-6 py-3 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium text-lg"
        >
          ⭐ Set Priority
        </button>
        <button
          onClick={onDeleteSelected}
          disabled={selectedCount === 0}
          className="px-6 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium text-lg"
        >
          🗑️ Delete Selected
        </button>
        <button
          onClick={printList}
          className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium text-lg"
          title="Druk de lijst af"
        >
          🖨️ Print lijst
        </button>
      </div>
    </div>
  )
}

