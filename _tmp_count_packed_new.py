import csv
from datetime import datetime
from pathlib import Path

path = Path(r"C:\Users\j.ploegaerts\Desktop\coding stuff\prodwilrijk v2\prodwilrijk nieuw\database packed items\packed_items_rows nieuwe website.sql")
text = path.read_text(encoding="utf-8", errors="ignore")

start = datetime(2025,1,1)
end = datetime(2026,1,27,23,59,59)

prefix = 'VALUES '
idx = text.find(prefix)
if idx == -1:
    print('No VALUES found')
    raise SystemExit
values = text[idx + len(prefix):].strip()
if values.endswith(';'):
    values = values[:-1]
if values.startswith('(') and values.endswith(')'):
    values = values[1:-1]

rows = values.split('), (')
count_rows = 0
sum_amount = 0

for row in rows:
    reader = csv.reader([row], delimiter=',', quotechar="'", skipinitialspace=True)
    fields = next(reader)
    if len(fields) < 6:
        continue
    amount = fields[3] or 0
    date_packed = fields[5]
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
    if start <= dt <= end:
        count_rows += 1
        try:
            sum_amount += int(amount)
        except Exception:
            try:
                sum_amount += float(amount)
            except Exception:
                pass

print(f"Rows in range: {count_rows}")
print(f"Sum(amount) in range: {sum_amount}")
