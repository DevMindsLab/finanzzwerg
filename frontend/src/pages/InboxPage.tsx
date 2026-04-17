/**
 * Inbox — uncategorized transactions with fast keyboard-driven categorization.
 */

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import { CheckSquare, Search, SlidersHorizontal, X, Zap } from "lucide-react";
import { transactionsApi } from "@/api/transactions";
import { rulesApi } from "@/api/rules";
import { categoriesApi } from "@/api/categories";
import type { Category, Transaction } from "@/types";
import { formatCurrency, formatDate, amountColor } from "@/lib/utils";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";

interface RuleSuggestion {
  transactionId: number;
  description: string;
  categoryId: number;
}

interface Filters {
  transaction_type: string;
  category_id: string;
  date_from: string;
  date_to: string;
  amount_min: string;
  amount_max: string;
}

const EMPTY_FILTERS: Filters = {
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

const fieldClass = "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100";

function CategoryDropdown({
  transaction,
  categories,
  placeholder,
  onCategorize,
}: {
  transaction: Transaction;
  categories: Category[];
  placeholder: string;
  onCategorize: (txnId: number, categoryId: number) => void;
}) {
  return (
    <select
      defaultValue=""
      onChange={(e) => {
        if (e.target.value) onCategorize(transaction.id, parseInt(e.target.value));
      }}
      className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100"
    >
      <option value="" disabled>{placeholder}</option>
      {categories.map((cat) => (
        <option key={cat.id} value={cat.id}>{cat.name}</option>
      ))}
    </select>
  );
}

export default function InboxPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [showFilters, setShowFilters] = useState(false);

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkCategory, setBulkCategory] = useState<string>("");
  const [ruleSuggestion, setRuleSuggestion] = useState<RuleSuggestion | null>(null);
  const [rulePattern, setRulePattern] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const activeCount = countActiveFilters(filters);

  const queryParams = {
    page,
    page_size: 50,
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    ...(filters.transaction_type ? { transaction_type: filters.transaction_type as "income" | "expense" } : {}),
    ...(filters.category_id ? { category_id: parseInt(filters.category_id) } : {}),
    ...(filters.date_from ? { date_from: filters.date_from } : {}),
    ...(filters.date_to ? { date_to: filters.date_to } : {}),
    ...(filters.amount_min ? { amount_min: parseFloat(filters.amount_min) } : {}),
    ...(filters.amount_max ? { amount_max: parseFloat(filters.amount_max) } : {}),
  };

  const { data, isLoading } = useQuery({
    queryKey: ["inbox", queryParams],
    queryFn: () => transactionsApi.inbox(queryParams),
    placeholderData: (prev) => prev,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: categoriesApi.list,
  });

  const categorizeMutation = useMutation({
    mutationFn: ({ id, categoryId }: { id: number; categoryId: number }) =>
      transactionsApi.categorize(id, { category_id: categoryId }),
    onSuccess: (txn, { id, categoryId }) => {
      qc.invalidateQueries({ queryKey: ["inbox"] });
      qc.invalidateQueries({ queryKey: ["inbox-count"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      toast.success(t("inbox.categorized"));
      setRulePattern(txn.description.split(" ").slice(0, 3).join(" "));
      setRuleSuggestion({ transactionId: id, description: txn.description, categoryId });
    },
  });

  const bulkMutation = useMutation({
    mutationFn: (categoryId: number) =>
      transactionsApi.bulkCategorize({
        transaction_ids: Array.from(selected),
        category_id: categoryId,
      }),
    onSuccess: ({ updated }) => {
      qc.invalidateQueries({ queryKey: ["inbox"] });
      qc.invalidateQueries({ queryKey: ["inbox-count"] });
      setSelected(new Set());
      setBulkCategory("");
      toast.success(t("inbox.bulk_categorized", { count: updated }));
    },
  });

  const createRuleMutation = useMutation({
    mutationFn: (pattern: string) =>
      rulesApi.create({
        name: `Auto: ${pattern.slice(0, 60)}`,
        pattern,
        match_type: "substring",
        category_id: ruleSuggestion!.categoryId,
        is_active: true,
        priority: 0,
      }),
    onSuccess: () => {
      toast.success(t("inbox.rule_created"));
      setRuleSuggestion(null);
    },
  });

  const applyRulesMutation = useMutation({
    mutationFn: rulesApi.applyAll,
    onSuccess: ({ categorized }) => {
      qc.invalidateQueries({ queryKey: ["inbox"] });
      qc.invalidateQueries({ queryKey: ["inbox-count"] });
      toast.success(t("inbox.rules_applied", { count: categorized }));
    },
  });

  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (!data) return;
    if (selected.size === data.items.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(data.items.map((t) => t.id)));
    }
  };

  const setFilter = (k: keyof Filters) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFilters((f) => ({ ...f, [k]: e.target.value }));
    setPage(1);
  };

  const clearFilters = () => {
    setFilters(EMPTY_FILTERS);
    setPage(1);
  };

  const transactions: Transaction[] = data?.items ?? [];
  const total = data?.total ?? 0;
  const pages = data?.pages ?? 1;

  const typeOptions = [
    { value: "income",  label: t("filters.income") },
    { value: "expense", label: t("filters.expense") },
  ];

  const categoryOptions = categories.map((c) => ({ value: c.id, label: c.name }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t("inbox.title")}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {t("inbox.subtitle", { count: total })}
          </p>
        </div>
        <div className="relative w-full sm:w-auto sm:flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="search"
            placeholder={t("inbox.search_placeholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 bg-white text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100 dark:placeholder:text-slate-500"
          />
        </div>
        <button
          onClick={() => setShowFilters((v) => !v)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
            showFilters || activeCount > 0
              ? "border-brand-400 bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300 dark:border-brand-700"
              : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
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
        <Button
          variant="secondary"
          icon={<Zap className="w-4 h-4" />}
          loading={applyRulesMutation.isPending}
          onClick={() => applyRulesMutation.mutate()}
        >
          {t("inbox.apply_rules")}
        </Button>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="card p-4 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t("filters.type")}</label>
              <Select options={typeOptions} placeholder={t("filters.all_types")} value={filters.transaction_type} onChange={setFilter("transaction_type")} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t("filters.category")}</label>
              <Select options={categoryOptions} placeholder={t("filters.all_categories")} value={filters.category_id} onChange={setFilter("category_id")} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t("filters.date_from")}</label>
              <input type="date" value={filters.date_from} onChange={setFilter("date_from")} className={fieldClass} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t("filters.date_to")}</label>
              <input type="date" value={filters.date_to} onChange={setFilter("date_to")} className={fieldClass} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t("filters.amount_min")}</label>
              <input type="number" step="0.01" placeholder="−" value={filters.amount_min} onChange={setFilter("amount_min")} className={fieldClass} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t("filters.amount_max")}</label>
              <input type="number" step="0.01" placeholder="+" value={filters.amount_max} onChange={setFilter("amount_max")} className={fieldClass} />
            </div>
          </div>
          {activeCount > 0 && (
            <div className="flex justify-end">
              <button onClick={clearFilters} className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors">
                <X className="w-3.5 h-3.5" />
                {t("filters.clear")}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Bulk toolbar */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 p-4 bg-brand-50 dark:bg-brand-950 border border-brand-200 dark:border-brand-800 rounded-xl">
          <CheckSquare className="w-5 h-5 text-brand-600 shrink-0" />
          <span className="text-sm font-medium text-brand-800 dark:text-brand-300">
            {t("inbox.selected", { count: selected.size })}
          </span>
          <div className="flex-1" />
          <Select
            options={categoryOptions}
            placeholder={t("inbox.choose_category")}
            value={bulkCategory}
            onChange={(e) => setBulkCategory(e.target.value)}
            className="w-48"
          />
          <Button size="sm" disabled={!bulkCategory} loading={bulkMutation.isPending} onClick={() => bulkMutation.mutate(parseInt(bulkCategory))}>
            {t("inbox.categorize")}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
            {t("inbox.cancel")}
          </Button>
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
            <CheckSquare className="w-10 h-10 opacity-40" />
            <p className="text-sm font-medium">
              {debouncedSearch || activeCount > 0
                ? t("inbox.no_results", { search: debouncedSearch })
                : t("inbox.empty")}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                <tr>
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.size === transactions.length && transactions.length > 0}
                      onChange={toggleAll}
                      className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 dark:border-slate-600"
                    />
                  </th>
                  <th className="text-left px-3 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t("inbox.col_date")}</th>
                  <th className="text-left px-3 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t("inbox.col_description")}</th>
                  <th className="text-right px-3 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t("inbox.col_amount")}</th>
                  <th className="text-left px-3 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide w-56">{t("inbox.col_category")}</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((txn) => (
                  <tr
                    key={txn.id}
                    className={`border-b border-slate-50 dark:border-slate-700/50 last:border-0 transition-colors ${
                      selected.has(txn.id)
                        ? "bg-brand-50 dark:bg-brand-950"
                        : "hover:bg-slate-50 dark:hover:bg-slate-700/50"
                    }`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(txn.id)}
                        onChange={() => toggleSelect(txn.id)}
                        className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 dark:border-slate-600"
                      />
                    </td>
                    <td className="px-3 py-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">{formatDate(txn.date)}</td>
                    <td className="px-3 py-3 text-slate-800 dark:text-slate-200 max-w-sm truncate" title={txn.description}>
                      {txn.description}
                    </td>
                    <td className={`px-3 py-3 text-right font-medium tabular-nums ${amountColor(txn.amount)}`}>
                      {formatCurrency(txn.amount)}
                    </td>
                    <td className="px-3 py-3 w-56">
                      <CategoryDropdown
                        transaction={txn}
                        categories={categories}
                        placeholder={t("inbox.select_category")}
                        onCategorize={(id, catId) => categorizeMutation.mutate({ id, categoryId: catId })}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between">
          <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            {t("inbox.previous")}
          </Button>
          <span className="text-sm text-slate-600 dark:text-slate-400">{t("inbox.page_of", { page, pages })}</span>
          <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
            {t("inbox.next")}
          </Button>
        </div>
      )}

      {/* Rule suggestion modal */}
      <Modal
        isOpen={!!ruleSuggestion}
        onClose={() => setRuleSuggestion(null)}
        title={t("inbox.create_rule_title")}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRuleSuggestion(null)}>{t("inbox.skip")}</Button>
            <Button loading={createRuleMutation.isPending} onClick={() => createRuleMutation.mutate(rulePattern)}>
              {t("inbox.create_rule")}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">{t("inbox.create_rule_desc")}</p>
          <Input
            label={t("inbox.rule_pattern_label")}
            value={rulePattern}
            onChange={(e) => setRulePattern(e.target.value)}
            placeholder={t("inbox.rule_pattern_placeholder")}
          />
          <p className="text-xs text-slate-400 dark:text-slate-500">{t("inbox.rule_hint")}</p>
        </div>
      </Modal>
    </div>
  );
}
