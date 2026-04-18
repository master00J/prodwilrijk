-- Voeg receiver (ontvanger linksboven op Atlas-labels) toe aan stock_count_scans
alter table stock_count_scans
  add column if not exists receiver text;
