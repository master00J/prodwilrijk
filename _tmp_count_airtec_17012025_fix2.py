import csv
import re
from datetime import datetime
from pathlib import Path

path = Path(r"C:\Users\j.ploegaerts\Desktop\coding stuff\prodwilrijk v2\prodwilrijk nieuw\database packed items\packed_items_airtec  oude website.sql")
text = path.read_text(encoding="utf-8", errors="ignore")

blocks = re.findall(r"INSERT INTO `packed_items_airtec`[^;]*;", text, flags=re.IGNORECASE | re.DOTALL)

start_day = datetime(2025, 1, 17)
end_day = datetime(2025, 1, 17, 23, 59, 59)

rows_in_recv = 0
sum_recv = 0
rows_in_packed = 0
sum_packed = 0

for block in blocks:
    m = re.search(r"VALUES\s*(.*);\s*$", block, re.DOTALL | re.IGNORECASE)
    if not m:
        continue
    values = m.group(1).strip()
    if values.startswith('(') and values.endswith(')'):
        values = values[1:-1]

    values = re.sub(r"\)\s*,\s*\(", ")|(", values)
    rows = values.split('|')
    for row in rows:
        row = row.strip()
        if not row:
            continue
        reader = csv.reader([row], delimiter=',', quotechar="'", skipinitialspace=True)
        fields = next(reader)
        if not fields:
            continue
        fields[0] = fields[0].lstrip('(')
        fields[-1] = fields[-1].rstrip(')')
        if len(fields) < 10:
            continue
        quantity = fields[9] or 0
        datum_ontvangen = fields[7]
        date_packed = fields[8]

        def parse_dt(value):
            if not value:
                return None
            date_str = value.replace('Z', '')
            try:
                dt = datetime.fromisoformat(date_str)
            except Exception:
                try:
                    dt = datetime.strptime(date_str.split('.')[0], "%Y-%m-%d %H:%M:%S")
                except Exception:
                    return None
            if dt.tzinfo:
                dt = dt.replace(tzinfo=None)
            return dt

        dt_recv = parse_dt(datum_ontvangen)
        if dt_recv and start_day <= dt_recv <= end_day:
            rows_in_recv += 1
            try:
                sum_recv += int(quantity)
            except Exception:
                try:
                    sum_recv += float(quantity)
                except Exception:
                    pass

        dt_pack = parse_dt(date_packed)
        if dt_pack and start_day <= dt_pack <= end_day:
            rows_in_packed += 1
            try:
                sum_packed += int(quantity)
            except Exception:
                try:
                    sum_packed += float(quantity)
                except Exception:
                    pass

print(f"Received rows on 2025-01-17: {rows_in_recv}")
print(f"Received sum(quantity) on 2025-01-17: {sum_recv}")
print(f"Packed rows on 2025-01-17: {rows_in_packed}")
print(f"Packed sum(quantity) on 2025-01-17: {sum_packed}")
