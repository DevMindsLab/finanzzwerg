// ── Categories ────────────────────────────────────────────────────────────────

export interface Category {
  id: number;
  name: string;
  color: string;
  icon: string | null;
  is_income: boolean;
  is_default: boolean;
  created_at: string;
  transaction_count: number;
}

export interface CategoryCreate {
  name: string;
  color: string;
  icon?: string;
  is_income: boolean;
}

export interface CategoryUpdate {
  name?: string;
  color?: string;
  icon?: string;
  is_income?: boolean;
}

// ── Transactions ──────────────────────────────────────────────────────────────

export type TransactionStatus = "uncategorized" | "categorized" | "ignored";

export interface Transaction {
  id: number;
  date: string;
  amount: string; // Decimal serialised as string
  description: string;
  category_id: number | null;
  category: Category | null;
  import_job_id: number | null;
  status: TransactionStatus;
  created_at: string;
  updated_at: string;
}

export interface TransactionListResponse {
  items: Transaction[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface TransactionCategorize {
  category_id: number;
  create_rule?: boolean;
  rule_pattern?: string;
}

export interface BulkCategorize {
  transaction_ids: number[];
  category_id: number;
}

export interface TransactionFilters {
  page?: number;
  page_size?: number;
  status?: TransactionStatus;
  category_id?: number;
  search?: string;
  date_from?: string;
  date_to?: string;
  amount_min?: number;
  amount_max?: number;
  transaction_type?: "income" | "expense";
}

// ── Rules ─────────────────────────────────────────────────────────────────────

export type MatchType = "substring" | "exact" | "regex";

export interface Rule {
  id: number;
  name: string;
  pattern: string;
  match_type: MatchType;
  category_id: number;
  category: Category;
  is_active: boolean;
  priority: number;
  created_at: string;
  updated_at: string;
}

export interface RuleCreate {
  name: string;
  pattern: string;
  match_type: MatchType;
  category_id: number;
  is_active: boolean;
  priority: number;
}

export interface RuleUpdate {
  name?: string;
  pattern?: string;
  match_type?: MatchType;
  category_id?: number;
  is_active?: boolean;
  priority?: number;
}

// ── Budgets ───────────────────────────────────────────────────────────────────

export interface Budget {
  id: number;
  category_id: number;
  category: Category;
  amount: string;       // Decimal serialised as string
  spent: string;
  remaining: string;
  percentage: number;
  created_at: string;
  updated_at: string;
}

export interface BudgetCreate {
  category_id: number;
  amount: number;
}

export interface BudgetUpdate {
  amount: number;
}

// ── CSV Presets ───────────────────────────────────────────────────────────────

export interface ImportPreset {
  id: number;
  name: string;
  /** Profile with description_columns already joined to a comma-separated string */
  profile: Record<string, unknown>;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

// ── Import Jobs ───────────────────────────────────────────────────────────────

export type ImportJobStatus = "pending" | "processing" | "completed" | "failed";

export interface ImportJob {
  id: number;
  filename: string;
  status: ImportJobStatus;
  total_rows: number | null;
  processed_rows: number;
  duplicate_rows: number;
  error_message: string | null;
  csv_profile: Record<string, unknown> | null;
  created_at: string;
  completed_at: string | null;
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export interface MonthlyStats {
  year: number;
  month: number;
  income: string;
  expenses: string;
  balance: string;
  transaction_count: number;
}

export interface CategoryBreakdown {
  category_id: number | null;
  category_name: string;
  category_color: string;
  total: string;
  transaction_count: number;
  percentage: number;
}

export interface DashboardResponse {
  current_month: MonthlyStats;
  monthly_history: MonthlyStats[];
  expense_breakdown: CategoryBreakdown[];
  income_breakdown: CategoryBreakdown[];
  uncategorized_count: number;
}
