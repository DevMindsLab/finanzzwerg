import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, SlidersHorizontal } from "lucide-react";
import { transactionsApi } from "@/api/transactions";
import { categoriesApi } from "@/api/categories";
import type { TransactionStatus } from "@/types";
import { formatCurrency, formatDate, amountColor } from "@/lib/utils";
import Badge from "@/components/ui/Badge";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";

const STATUS_LABELS: Record<TransactionStatus, string> = {
  uncategorized: "Uncategorized",
  categorized: "Categorized",
  ignored: "Ignored",
};

const STATUS_BADGE_VARIANT: Record<TransactionStatus, "warning" | "success" | "default"> = {
  uncategorized: "warning",
  categorized: "success",
  ignored: "default",
};

export default function TransactionsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");

  // Simple debounce
  const handleSearchChange = (value: string) => {
    setSearch(value);
    clearTimeout((window as unknown as { _st: number })._st);
    (window as unknown as { _st: ReturnType<typeof setTimeout> })._st = setTimeout(() => {
      setDebouncedSearch(value);
      setPage(1);
    }, 350);
  };

  const { data, isLoading } = useQuery({
    queryKey: ["transactions", page, debouncedSearch, statusFilter, categoryFilter],
    queryFn: () =>
      transactionsApi.list({
        page,
        page_size: 50,
        search: debouncedSearch || undefined,
        status: (statusFilter as TransactionStatus) || undefined,
        category_id: categoryFilter ? parseInt(categoryFilter) : undefined,
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

  const statusOptions = [
    { value: "", label: "All statuses" },
    { value: "uncategorized", label: "Uncategorized" },
    { value: "categorized", label: "Categorized" },
    { value: "ignored", label: "Ignored" },
  ];

  const categoryOptions = [
    { value: "", label: "All categories" },
    ...categories.map((c) => ({ value: c.id, label: c.name })),
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Transactions</h1>
          <p className="text-sm text-slate-500 mt-0.5">{total} transactions total</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-48">
          <Input
            placeholder="Search descriptions…"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            prefix={<Search className="w-4 h-4" />}
          />
        </div>
        <div className="w-48">
          <Select
            options={statusOptions}
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          />
        </div>
        <div className="w-48">
          <Select
            options={categoryOptions}
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
          />
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin w-7 h-7 border-2 border-brand-600 border-t-transparent rounded-full" />
          </div>
        ) : transactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-2 text-slate-400">
            <SlidersHorizontal className="w-10 h-10 opacity-40" />
            <p className="text-sm">No transactions found</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Date</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Description</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Category</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Status</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Amount</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((txn) => (
                <tr key={txn.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-3 text-slate-600 whitespace-nowrap">
                    {formatDate(txn.date)}
                  </td>
                  <td className="px-6 py-3 text-slate-800 max-w-xs truncate" title={txn.description}>
                    {txn.description}
                  </td>
                  <td className="px-6 py-3">
                    {txn.category ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: txn.category.color }}
                        />
                        <span className="text-slate-700">{txn.category.name}</span>
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
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
            Previous
          </button>
          <span className="text-sm text-slate-600">
            Page {page} of {pages} · {total} total
          </span>
          <button
            disabled={page >= pages}
            onClick={() => setPage((p) => p + 1)}
            className="px-4 py-2 text-sm rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
