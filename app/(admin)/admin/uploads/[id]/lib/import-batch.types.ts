export type ImportBatchStatus =
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"
  | "ROLLED_BACK";

export type ImportBatchMode = "APPEND" | "REPLACE";

export type DuplicatePolicy = "SKIP";

export type ImportBatchRow = {
  id: string;
  upload_id: string;
  campaign_name?: string | null;
  filename: string | null;
  imported_by: string | null;
  imported_by_name: string | null;
  import_mode: ImportBatchMode;
  total_rows: number;
  inserted_rows: number;
  skipped_rows: number;
  duplicate_rows: number;
  failed_rows: number;
  status: ImportBatchStatus;
  notes: string | null;
  created_at: string;
  completed_at: string | null;
};

export type AppendPreview = {
  total_rows: number;
  file_name: string;
};

export type AppendMappedRow = {
  row_no: number | null;
  import_date: string | null;
  source_status: string | null;
  external_person_id: string | null;
  company_info: string | null;
  company_name: string | null;
  given_name: string | null;
  family_name: string | null;
  job_title: string | null;
  department: string | null;
  country: string | null;
  email: string | null;
  email_second: string | null;
  telephone_number: string | null;
  mobile_country_code: string | null;
  mobile_number: string | null;
  normalized_phone: string | null;
  normalized_email: string | null;
  address_line1: string | null;
  address_line2: string | null;
  address_line3: string | null;
  city_ward: string | null;
  state: string | null;
  registered_event: string | null;
  visited_event: string | null;
  source_row_key: string | null;
};

export type AppendImportResult = {
  batch_id: string;
  total_rows: number;
  inserted_rows: number;
  duplicate_rows: number;
  failed_rows: number;
  skipped_rows: number;
};

export type PurgePreview = {
  upload_id: string;
  total_contacts: number;
  untouched_contacts: number;
  touched_contacts: number;
  contacts_with_logs: number;
  contacts_with_edits: number;
  active_leases: number;
  safe_untouched_deletable: number;
};

export type PurgeMode =
  | "UNTOUCHED_ONLY"
  | "ALL_CONTACTS"
  | "FORCE_WITH_HISTORY";

export type PurgeResult = {
  upload_id: string;
  deleted_contacts: number;
  deleted_call_logs: number;
  deleted_contact_edits: number;
  deleted_import_issues: number;
};

export type DeleteBatchResult = {
  import_batch_id: string;
  upload_id: string;
  deleted_contacts: number;
  deleted_call_logs: number;
  deleted_contact_edits: number;
  deleted_import_issues: number;
};