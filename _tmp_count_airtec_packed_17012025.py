import csv
import re
from datetime import datetime
from pathlib import Path

path = Path(r"C:\Users\j.ploegaerts\Desktop\coding stuff\prodwilrijk v2\prodwilrijk nieuw\database packed items\packed_items_airtec  oude website.sql")
text = path.read_text(encoding="utf-8", errors="ignore")

blocks = re.findall(r"INSERT INTO `packed_items_airtec`[^;]*;", text, flags=re.IGNORECASE | re.DOTALL)

start_day = datetime(2025, 1, 17)
end_day = datetime(2025, 1, 17, 23, 59, 59)

rows_in = 0
sum_qty = 0

for block in blocks:
    m = re.search(r"VALUES\s*(.*);\s*$", block, re.DOTALL | re.IGNORECASE)
    if not m:
        continue
    values = m.group(1).strip()
    if values.startswith('(') and values.endswith(')'):
        values = values[1:-1]

    rows = values.split('), (')
    for row in rows:
        row = row.replace('\n', ' ').replace('\r', ' ')
        reader = csv.reader([row], delimiter=',', quotechar="'", skipinitialspace=True)
        fields = next(reader)
        if len(fields) < 10:
            continue
        quantity = fields[9] or 0
        date_packed = fields[8]
        if not date_packed:
            continue
        date_str = date_packed.replace('Z', '')
        try:
            dt = datetime.fromisoformat(date_str)
        except Exception:
            try:
                dt = datetime.strptime(date_str.split('.')[0], "%Y-%m-%d %H:%M:%S")
            except Exception:
                continue
        if dt.tzinfo:
            dt = dt.replace(tzinfo=None)
        if start_day <= dt <= end_day:
            rows_in += 1
            try:
                sum_qty += int(quantity)
            except Exception:
                try:
                    sum_qty += float(quantity)
                except Exception:
                    pass

print(f"Packed rows on 2025-01-17: {rows_in}")
print(f"Packed sum(quantity) on 2025-01-17: {sum_qty}")
