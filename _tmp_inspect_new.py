from pathlib import Path
import re
path = Path(r"C:\Users\j.ploegaerts\Desktop\coding stuff\prodwilrijk v2\prodwilrijk nieuw\database packed items\packed_items_rows nieuwe website.sql")
text = path.read_text(encoding="utf-8", errors="ignore")
print('len', len(text))
print('has VALUES', 'VALUES' in text)
print('endswith semicolon', text.rstrip().endswith(';'))
pattern = re.compile(r"INSERT INTO \"public\"\.\"packed_items\"", re.IGNORECASE)
print('insert count', len(pattern.findall(text)))
