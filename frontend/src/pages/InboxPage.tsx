/**
 * Inbox — uncategorized transactions with fast keyboard-driven categorization.
 *
 * UX details:
 * - Each row has an inline category dropdown.
 * - Saving a category triggers the "Create rule?" suggestion banner.
 * - Bulk select + categorize via header checkbox.
 * - Keyboard: Tab to next row, Enter to confirm.
 */

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { CheckSquare, Search, Zap } from "lucide-react";
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

function CategoryDropdown({
  transaction,
  categories,
  onCategorize,
}: {
  transaction: Transaction;
  categories: Category[];
  onCategorize: (txnId: number, categoryId: number) => void;
}) {
  return (
    <select
      defaultValue=""
      onChange={(e) => {
        if (e.target.value) onCategorize(transaction.id, parseInt(e.target.value));
      }}
      className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"
    >
      <option value="" disabled>
        Select category…
      </option>
      {categories.map((cat) => (
        <option key={cat.id} value={cat.id}>
          {cat.name}
        </option>
      ))}
    </select>
  );
}

export default function InboxPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkCategory, setBulkCategory] = useState<string>("");
  const [ruleSuggestion, setRuleSuggestion] = useState<RuleSuggestion | null>(null);
  const [rulePattern, setRulePattern] = useState("");

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading } = useQuery({
    queryKey: ["inbox", page, debouncedSearch],
    queryFn: () => transactionsApi.inbox(page, 50, debouncedSearch || undefined),
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
      toast.success("Transaction categorized");
      // Suggest rule creation
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
      toast.success(`${updated} transactions categorized`);
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
      toast.success("Rule created — future imports will auto-categorize matching transactions");
      setRuleSuggestion(null);
    },
  });

  const applyRulesMutation = useMutation({
    mutationFn: rulesApi.applyAll,
    onSuccess: ({ categorized }) => {
      qc.invalidateQueries({ queryKey: ["inbox"] });
      qc.invalidateQueries({ queryKey: ["inbox-count"] });
      toast.success(`Rules applied — ${categorized} transaction${categorized !== 1 ? "s" : ""} categorized`);
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

  const transactions: Transaction[] = data?.items ?? [];
  const total = data?.total ?? 0;
  const pages = data?.pages ?? 1;

  const categoryOptions = categories.map((c) => ({ value: c.id, label: c.name }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="shrink-0">
          <h1 className="text-2xl font-bold text-slate-900">Inbox</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {total} uncategorized transaction{total !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="search"
            placeholder="Search transactions…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 bg-white text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          />
        </div>
        <Button
          variant="secondary"
          icon={<Zap className="w-4 h-4" />}
          loading={applyRulesMutation.isPending}
          onClick={() => applyRulesMutation.mutate()}
        >
          Apply Rules
        </Button>
      </div>

      {/* Bulk toolbar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 p-4 bg-brand-50 border border-brand-200 rounded-xl">
          <CheckSquare className="w-5 h-5 text-brand-600 shrink-0" />
          <span className="text-sm font-medium text-brand-800">
            {selected.size} selected
          </span>
          <div className="flex-1" />
          <Select
            options={categoryOptions}
            placeholder="Choose category…"
            value={bulkCategory}
            onChange={(e) => setBulkCategory(e.target.value)}
            className="w-48"
          />
          <Button
            size="sm"
            disabled={!bulkCategory}
            loading={bulkMutation.isPending}
            onClick={() => bulkMutation.mutate(parseInt(bulkCategory))}
          >
            Categorize
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
            Cancel
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
              {debouncedSearch ? `No results for "${debouncedSearch}"` : "Inbox is empty"}
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50">
              <tr>
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selected.size === transactions.length && transactions.length > 0}
                    onChange={toggleAll}
                    className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  />
                </th>
                <th className="text-left px-3 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Date</th>
                <th className="text-left px-3 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Description</th>
                <th className="text-right px-3 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Amount</th>
                <th className="text-left px-3 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide w-56">Category</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((txn) => (
                <tr
                  key={txn.id}
                  className={`border-b border-slate-50 last:border-0 transition-colors ${
                    selected.has(txn.id) ? "bg-brand-50" : "hover:bg-slate-50"
                  }`}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(txn.id)}
                      onChange={() => toggleSelect(txn.id)}
                      className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                    />
                  </td>
                  <td className="px-3 py-3 text-slate-600 whitespace-nowrap">
                    {formatDate(txn.date)}
                  </td>
                  <td className="px-3 py-3 text-slate-800 max-w-sm truncate" title={txn.description}>
                    {txn.description}
                  </td>
                  <td className={`px-3 py-3 text-right font-medium tabular-nums ${amountColor(txn.amount)}`}>
                    {formatCurrency(txn.amount)}
                  </td>
                  <td className="px-3 py-3 w-56">
                    <CategoryDropdown
                      transaction={txn}
                      categories={categories}
                      onCategorize={(id, catId) => categorizeMutation.mutate({ id, categoryId: catId })}
                    />
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
          <Button
            variant="secondary"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <span className="text-sm text-slate-600">
            Page {page} of {pages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={page >= pages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}

      {/* Rule suggestion modal */}
      <Modal
        isOpen={!!ruleSuggestion}
        onClose={() => setRuleSuggestion(null)}
        title="Create categorization rule?"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRuleSuggestion(null)}>
              Skip
            </Button>
            <Button
              loading={createRuleMutation.isPending}
              onClick={() => createRuleMutation.mutate(rulePattern)}
            >
              Create Rule
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Automatically categorize future transactions that match this pattern:
          </p>
          <Input
            label="Pattern (substring match)"
            value={rulePattern}
            onChange={(e) => setRulePattern(e.target.value)}
            placeholder="e.g. REWE, Amazon, Spotify"
          />
          <p className="text-xs text-slate-400">
            Case-insensitive. Any transaction description containing this text will be
            categorized automatically on import.
          </p>
        </div>
      </Modal>
    </div>
  );
}
