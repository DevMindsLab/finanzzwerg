import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import { Search, SlidersHorizontal, X, Pencil } from "lucide-react";
import { transactionsApi } from "@/api/transactions";
import { categoriesApi } from "@/api/categories";
import type { TransactionStatus } from "@/types";
import { formatCurrency, formatDate, amountColor } from "@/lib/utils";
import Badge from "@/components/ui/Badge";
import Select from "@/components/ui/Select";

interface Filters {
  status: string;
  transaction_type: string;
  category_id: string;
  date_from: string;
  date_to: string;
  amount_min: string;
  amount_max: string;
}

const EMPTY_FILTERS: Filters = {
  status: "",
  transaction_type: "",
  category_id: "",
  date_from: "",
  date_to: "",
  amount_min: "",
  amount_max: "",
};

function countActiveFilters(f: Filters) {
  return Object.values(f).filter(Boolean).length;
}

export default function TransactionsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filters, setFilters] = useState<Filters>(() => ({
    status:           searchParams.get("status")           ?? "",
    transaction_type: searchParams.get("transaction_type") ?? "",
    category_id:      searchParams.get("category_id")      ?? "",
    date_from:        searchParams.get("date_from")         ?? "",
    date_to:          searchParams.get("date_to")           ?? "",
    amount_min:       searchParams.get("amount_min")        ?? "",
    amount_max:       searchParams.get("amount_max")        ?? "",
  }));
  const [showFilters, setShowFilters] = useState(
    () => [...searchParams.keys()].some((k) => k in EMPTY_FILTERS),
  );

  const handleSearchChange = (value: string) => {
    setSearch(value);
    clearTimeout((window as unknown as { _st: number })._st);
    (window as unknown as { _st: ReturnType<typeof setTimeout> })._st = setTimeout(() => {
      setDebouncedSearch(value);
      setPage(1);
    }, 350);
  };

  const activeCount = countActiveFilters(filters);

  const { data, isLoading } = useQuery({
    queryKey: ["transactions", page, debouncedSearch, filters],
    queryFn: () =>
      transactionsApi.list({
        page,
        page_size: 50,
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
        ...(filters.status ? { status: filters.status as TransactionStatus } : {}),
        ...(filters.transaction_type ? { transaction_type: filters.transaction_type as "income" | "expense" } : {}),
        ...(filters.category_id ? { category_id: parseInt(filters.category_id) } : {}),
        ...(filters.date_from ? { date_from: filters.date_from } : {}),
        ...(filters.date_to ? { date_to: filters.date_to } : {}),
        ...(filters.amount_min ? { amount_min: parseFloat(filters.amount_min) } : {}),
        ...(filters.amount_max ? { amount_max: parseFloat(filters.amount_max) } : {}),
      }),
    placeholderData: (prev) => prev,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: categoriesApi.list,
  });

  const transactions = data?.items ?? [];
  const total = data?.total ?? 0;
  const pages = data?.pages ?? 1;

  const categorizeMutation = useMutation({
    mutationFn: ({ txnId, categoryId }: { txnId: number; categoryId: number }) =>
      transactionsApi.categorize(txnId, { category_id: categoryId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["budgets"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const setFilter = (k: keyof Filters) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFilters((f) => ({ ...f, [k]: e.target.value }));
    setPage(1);
  };

  const clearFilters = () => {
    setFilters(EMPTY_FILTERS);
    setPage(1);
  };

  const STATUS_LABELS: Record<TransactionStatus, string> = {
    uncategorized: t("transactions.status_uncategorized"),
    categorized:   t("transactions.status_categorized"),
    ignored:       t("transactions.status_ignored"),
  };

  const STATUS_BADGE_VARIANT: Record<TransactionStatus, "warning" | "success" | "default"> = {
    uncategorized: "warning",
    categorized:   "success",
    ignored:       "default",
  };

  const statusOptions = [
    { value: "uncategorized", label: t("transactions.status_uncategorized") },
    { value: "categorized",   label: t("transactions.status_categorized") },
    { value: "ignored",       label: t("transactions.status_ignored") },
  ];

  const typeOptions = [
    { value: "income",  label: t("filters.income") },
    { value: "expense", label: t("filters.expense") },
  ];

  const categoryOptions = categories.map((c) => ({ value: c.id, label: c.name }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="shrink-0">
          <h1 className="text-2xl font-bold text-slate-900">{t("transactions.title")}</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {t("transactions.subtitle", { count: total })}
          </p>
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="search"
            placeholder={t("transactions.search_placeholder")}
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 bg-white text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          />
        </div>

        {/* Filter toggle */}
        <button
          onClick={() => setShowFilters((v) => !v)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
            showFilters || activeCount > 0
              ? "border-brand-400 bg-brand-50 text-brand-700"
              : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" />
          {t("filters.title")}
          {activeCount > 0 && (
            <span className="bg-brand-600 text-white text-xs font-semibold rounded-full w-5 h-5 flex items-center justify-center">
              {activeCount}
            </span>
          )}
        </button>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="card p-4 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
            {/* Type */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                {t("filters.type")}
              </label>
              <Select
                options={typeOptions}
                placeholder={t("filters.all_types")}
                value={filters.transaction_type}
                onChange={setFilter("transaction_type")}
              />
            </div>

            {/* Status */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                {t("transactions.col_status")}
              </label>
              <Select
                options={statusOptions}
                placeholder={t("transactions.all_statuses")}
                value={filters.status}
                onChange={setFilter("status")}
              />
            </div>

            {/* Category */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                {t("filters.category")}
              </label>
              <Select
                options={categoryOptions}
                placeholder={t("filters.all_categories")}
                value={filters.category_id}
                onChange={setFilter("category_id")}
              />
            </div>

            {/* Date from */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                {t("filters.date_from")}
              </label>
              <input
                type="date"
                value={filters.date_from}
                onChange={setFilter("date_from")}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>

            {/* Date to */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                {t("filters.date_to")}
              </label>
              <input
                type="date"
                value={filters.date_to}
                onChange={setFilter("date_to")}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>

            {/* Amount min */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                {t("filters.amount_min")}
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="−"
                value={filters.amount_min}
                onChange={setFilter("amount_min")}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>

            {/* Amount max */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                {t("filters.amount_max")}
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="+"
                value={filters.amount_max}
                onChange={setFilter("amount_max")}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
          </div>

          {activeCount > 0 && (
            <div className="flex justify-end">
              <button
                onClick={clearFilters}
                className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-rose-600 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                {t("filters.clear")}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin w-7 h-7 border-2 border-brand-600 border-t-transparent rounded-full" />
          </div>
        ) : transactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-2 text-slate-400">
            <SlidersHorizontal className="w-10 h-10 opacity-40" />
            <p className="text-sm">{t("transactions.no_transactions")}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">{t("transactions.col_date")}</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">{t("transactions.col_description")}</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">{t("transactions.col_category")}</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">{t("transactions.col_status")}</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">{t("transactions.col_amount")}</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((txn) => (
                <tr key={txn.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-3 text-slate-600 whitespace-nowrap">{formatDate(txn.date)}</td>
                  <td className="px-6 py-3 text-slate-800 max-w-xs truncate" title={txn.description}>
                    {txn.description}
                  </td>
                  <td className="px-6 py-3">
                    {editingCategoryId === txn.id ? (
                      <Select
                        options={categoryOptions}
                        value={String(txn.category_id ?? "")}
                        placeholder={t("inbox.select_category")}
                        autoFocus
                        onChange={(e) => {
                          if (e.target.value) {
                            categorizeMutation.mutate({ txnId: txn.id, categoryId: parseInt(e.target.value) });
                          }
                          setEditingCategoryId(null);
                        }}
                        onBlur={() => setEditingCategoryId(null)}
                        className="py-1 text-xs"
                      />
                    ) : (
                      <button
                        onClick={() => setEditingCategoryId(txn.id)}
                        className="inline-flex items-center gap-1.5 group/cat text-left"
                        title={t("transactions.change_category")}
                      >
                        {txn.category ? (
                          <>
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: txn.category.color }} />
                            <span className="text-slate-700 group-hover/cat:text-brand-600 transition-colors">{txn.category.name}</span>
                          </>
                        ) : (
                          <span className="text-slate-400 group-hover/cat:text-brand-600 transition-colors">—</span>
                        )}
                        <Pencil className="w-3 h-3 opacity-0 group-hover/cat:opacity-100 text-brand-400 transition-opacity shrink-0" />
                      </button>
                    )}
                  </td>
                  <td className="px-6 py-3">
                    <Badge variant={STATUS_BADGE_VARIANT[txn.status]}>
                      {STATUS_LABELS[txn.status]}
                    </Badge>
                  </td>
                  <td className={`px-6 py-3 text-right font-medium tabular-nums ${amountColor(txn.amount)}`}>
                    {formatCurrency(txn.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="px-4 py-2 text-sm rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {t("transactions.previous")}
          </button>
          <span className="text-sm text-slate-600">
            {t("transactions.page_info", { page, pages, total })}
          </span>
          <button
            disabled={page >= pages}
            onClick={() => setPage((p) => p + 1)}
            className="px-4 py-2 text-sm rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {t("transactions.next")}
          </button>
        </div>
      )}
    </div>
  );
}
