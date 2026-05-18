CREATE TABLE IF NOT EXISTS orderflow_incoming_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL DEFAULT 'upload' CHECK (source IN ('upload', 'email', 'api')),
  customer_label text,
  file_path text NOT NULL,
  mime_type text NOT NULL,
  original_filename text NOT NULL,
  file_size_bytes bigint,
  raw_text text,
  raw_email_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'uploaded', 'extracted', 'reviewed', 'staged', 'rejected', 'error')),
  error text,
  uploaded_by uuid,
  received_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orderflow_extractions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incoming_document_id uuid NOT NULL REFERENCES orderflow_incoming_documents(id) ON DELETE CASCADE,
  model text NOT NULL,
  prompt_version text NOT NULL,
  raw_response jsonb NOT NULL DEFAULT '{}'::jsonb,
  parsed_order jsonb NOT NULL DEFAULT '{}'::jsonb,
  confidence numeric,
  cost_usd numeric,
  latency_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orderflow_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incoming_document_id uuid NOT NULL REFERENCES orderflow_incoming_documents(id) ON DELETE RESTRICT,
  extraction_id uuid REFERENCES orderflow_extractions(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'staged', 'rejected')),
  final_order jsonb NOT NULL DEFAULT '{}'::jsonb,
  diff jsonb NOT NULL DEFAULT '{}'::jsonb,
  staged_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  reviewed_by uuid,
  reviewed_at timestamptz,
  staged_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orderflow_eval_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  eval_set_name text NOT NULL,
  prompt_version text NOT NULL,
  model text NOT NULL,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  run_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

CREATE TABLE IF NOT EXISTS orderflow_eval_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  eval_run_id uuid NOT NULL REFERENCES orderflow_eval_runs(id) ON DELETE CASCADE,
  document_label text NOT NULL,
  predicted_order jsonb NOT NULL DEFAULT '{}'::jsonb,
  ground_truth_order jsonb NOT NULL DEFAULT '{}'::jsonb,
  diff jsonb NOT NULL DEFAULT '{}'::jsonb,
  passed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orderflow_incoming_documents_created_at
  ON orderflow_incoming_documents (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orderflow_incoming_documents_status
  ON orderflow_incoming_documents (status);

CREATE INDEX IF NOT EXISTS idx_orderflow_extractions_document
  ON orderflow_extractions (incoming_document_id);

CREATE INDEX IF NOT EXISTS idx_orderflow_orders_document
  ON orderflow_orders (incoming_document_id);

CREATE INDEX IF NOT EXISTS idx_orderflow_eval_results_run
  ON orderflow_eval_results (eval_run_id);

DROP TRIGGER IF EXISTS update_orderflow_incoming_documents_updated_at ON orderflow_incoming_documents;
CREATE TRIGGER update_orderflow_incoming_documents_updated_at
  BEFORE UPDATE ON orderflow_incoming_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_orderflow_orders_updated_at ON orderflow_orders;
CREATE TRIGGER update_orderflow_orders_updated_at
  BEFORE UPDATE ON orderflow_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE orderflow_incoming_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE orderflow_extractions ENABLE ROW LEVEL SECURITY;
ALTER TABLE orderflow_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE orderflow_eval_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE orderflow_eval_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for authenticated users" ON orderflow_incoming_documents;
CREATE POLICY "Allow all for authenticated users" ON orderflow_incoming_documents
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for authenticated users" ON orderflow_extractions;
CREATE POLICY "Allow all for authenticated users" ON orderflow_extractions
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for authenticated users" ON orderflow_orders;
CREATE POLICY "Allow all for authenticated users" ON orderflow_orders
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for authenticated users" ON orderflow_eval_runs;
CREATE POLICY "Allow all for authenticated users" ON orderflow_eval_runs
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for authenticated users" ON orderflow_eval_results;
CREATE POLICY "Allow all for authenticated users" ON orderflow_eval_results
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'orderflow-documents',
  'orderflow-documents',
  false,
  52428800,
  ARRAY[
    'application/pdf',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
    'text/plain',
    'message/rfc822',
    'application/octet-stream'
  ]
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "orderflow documents authenticated insert" ON storage.objects;
CREATE POLICY "orderflow documents authenticated insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'orderflow-documents');

DROP POLICY IF EXISTS "orderflow documents authenticated select" ON storage.objects;
CREATE POLICY "orderflow documents authenticated select"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'orderflow-documents');

DROP POLICY IF EXISTS "orderflow documents authenticated delete" ON storage.objects;
CREATE POLICY "orderflow documents authenticated delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'orderflow-documents');
