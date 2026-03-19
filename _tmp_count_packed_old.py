import re
from datetime import datetime
from pathlib import Path

path = Path(r"C:\Users\j.ploegaerts\Desktop\coding stuff\prodwilrijk v2\prodwilrijk nieuw\database packed items\packed_items oude website.sql")
text = path.read_text(encoding="utf-8", errors="ignore")

start = datetime(2025,1,1)
end = datetime(2026,1,27,23,59,59)

pattern = re.compile(r"INSERT INTO `packed_items`[^;]*;", re.IGNORECASE | re.DOTALL)
blocks = pattern.findall(text)

count_rows = 0
sum_amount = 0

for block in blocks:
    m = re.search(r"VALUES\s*(.*);\s*$", block, re.DOTALL | re.IGNORECASE)
    if not m:
        continue
    values = m.group(1).strip()
    rows = []
    current = []
    cur = ""
    in_str = False
    escape = False
    in_row = False

    i = 0
    while i < len(values):
        ch = values[i]
        if in_str:
            if escape:
                cur += ch
                escape = False
            elif ch == "\\":
                escape = True
            elif ch == "'":
                in_str = False
            else:
                cur += ch
            i += 1
            continue

        if ch == "'":
            in_str = True
            cur += ch
            i += 1
            continue
        if ch == '(':
            in_row = True
            current = []
            cur = ""
            i += 1
            continue
        if ch == ')' and in_row:
            raw = cur.strip()
            if raw:
                if raw.upper() == "NULL":
                    val = None
                elif raw.startswith("'") and raw.endswith("'"):
                    val = raw[1:-1]
                else:
                    try:
                        val = int(raw) if raw.isdigit() else float(raw)
                    except Exception:
                        val = raw
                current.append(val)
            rows.append(current)
            in_row = False
            cur = ""
            i += 1
            continue
        if ch == ',' and in_row:
            raw = cur.strip()
            if raw.upper() == "NULL" or raw == "":
                val = None
            elif raw.startswith("'") and raw.endswith("'"):
                val = raw[1:-1]
            else:
                try:
                    val = int(raw) if raw.isdigit() else float(raw)
                except Exception:
                    val = raw
            current.append(val)
            cur = ""
            i += 1
            continue
        if in_row:
            cur += ch
        i += 1

    for row in rows:
        if len(row) < 6:
            continue
        amount = row[3] or 0
        date_packed = row[5]
        if not date_packed:
            continue
        try:
            dt = datetime.strptime(str(date_packed), "%Y-%m-%d %H:%M:%S")
        except Exception:
            try:
                dt = datetime.fromisoformat(str(date_packed).replace("Z", ""))
            except Exception:
                continue
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
