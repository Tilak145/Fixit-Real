export interface AdminResource {
  /** Table name, exactly as it exists in the database. */
  table: string;
  /** What the person running this product calls it. */
  label: string;
  /**
   * Columns shown in the list. Defaults to the columns of the first row, or,
   * while the table is still empty, to the ones the database reports.
   */
  columns?: string[];
  /** Primary key column, when it is not `id`. */
  primaryKey?: string;
  /**
   * An explicit column list to read, instead of `*`. Needed where a column is
   * not readable through the API: the customer's contact details on a quote
   * request are granted per column, and `*` would fail for every reader.
   */
  select?: string;
}

/**
 * The tables the management dashboard manages. Approving a professional is an
 * edit of its `status` to "approved" here; the site only lists approved pros.
 */
export const adminResources: AdminResource[] = [
  {
    table: "providers",
    label: "Professionals",
    select:
      "id,business_name,pro_number,status,plan,license_number,license_status,business_registration_number,business_registration_status,accepts_emergency,rating,review_count,email,phone,created_at",
    columns: ["business_name", "pro_number", "status", "plan", "license_number", "license_status", "business_registration_number", "business_registration_status", "accepts_emergency", "rating", "review_count", "email", "phone"],
  },
  {
    table: "quote_requests",
    label: "Quote requests",
    // customer_email and customer_phone are intentionally absent: they are
    // readable only where the rules allow, in "Lead contacts" below.
    select:
      "id,category_slug,description,customer_name,city,status,is_emergency,budget_min_cents,budget_max_cents,claimed_by,customer_user_id,created_at",
    columns: ["category_slug", "customer_name", "customer_number", "city", "is_emergency", "budget_min_cents", "budget_max_cents", "status", "claimed_by", "created_at"],
  },
  {
    table: "quote_request_contacts",
    label: "Lead contacts",
    select: "quote_request_id,customer_email,customer_phone,updated_at",
    columns: ["quote_request_id", "customer_email", "customer_phone", "updated_at"],
  },
  {
    table: "provider_availability",
    label: "Provider hours",
    select: "provider_id,weekday,start_minute,end_minute",
    columns: ["provider_id", "weekday", "start_minute", "end_minute"],
  },
  {
    table: "quotes",
    label: "Quotes",
    // What each professional offered and whether the customer answered, so a
    // disputed price can be checked against what both sides saw.
    select:
      "quote_request_id,provider_id,amount_cents,labour_cents,materials_cents,service_call_cents,emergency_fee_cents,other_cents,status,earliest_start,warranty,valid_until,created_at,responded_at",
    columns: [
      "quote_request_id",
      "provider_id",
      "amount_cents",
      "labour_cents",
      "materials_cents",
      "service_call_cents",
      "emergency_fee_cents",
      "status",
      "earliest_start",
      "created_at",
    ],
  },
  {
    table: "appointments",
    label: "Appointments",
    columns: ["title", "customer_name", "city", "scheduled_for", "status"],
  },
  {
    table: "provider_documents",
    label: "Provider documents",
    columns: ["kind", "file_name", "mime_type", "uploaded_at", "auth_user_id"],
  },
  {
    table: "reviews",
    label: "Reviews",
    columns: ["provider_id", "author_name", "rating", "comment", "created_at"],
  },
  {
    table: "messages",
    label: "Messages",
    columns: ["quote_request_id", "sender_role", "body", "created_at"],
  },
  {
    table: "service_categories",
    label: "Services",
    primaryKey: "slug",
    columns: ["name", "slug", "icon", "sort_order"],
  },
  {
    table: "service_cities",
    label: "Cities",
    // The label is the identity: it is what a request and a service area store,
    // and matching is an exact compare, so a new city is entered once here and
    // picked everywhere rather than typed on both sides.
    primaryKey: "label",
    columns: ["label", "state", "sort_order", "is_active"],
  },
];

/**
 * A column that reads as a state, not a value: the dashboard renders it as a
 * coloured pill so a status is scannable at a glance. Keys are column names.
 */
export const statusColumns = new Set(["status", "plan", "sender_role"]);

/** Columns whose value is too long to show: the cell truncates and shows it in full on hover. */
export const longColumns = new Set(["description", "body", "comment", "address", "notes"]);

/**
 * Whether the dashboard also manages the accounts that sign in to this product:
 * who signed up, sending a password reset, blocking someone. Turn this on after
 * deploying `supabase/functions/admin-accounts`, which is what reaches the
 * hosted Auth admin API; no migration beyond `0000_admin_roles.sql` is needed.
 */
export const adminAccounts = false;
