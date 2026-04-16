import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  X,
  PiggyBank,
} from "lucide-react";
import { budgetsApi } from "@/api/budgets";
import { categoriesApi } from "@/api/categories";
import type { Budget, Category } from "@/types";
import { formatCurrency } from "@/lib/utils";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";

// ── helpers ────────────────────────────────────────────────────────────────────

function progressColor(pct: number) {
  if (pct >= 100) return "bg-rose-500";
  if (pct >= 75)  return "bg-amber-400";
  return "bg-emerald-500";
}

function progressBg(pct: number) {
  if (pct >= 100) return "bg-rose-100";
  if (pct >= 75)  return "bg-amber-100";
  return "bg-emerald-100";
}

function textColor(pct: number) {
  if (pct >= 100) return "text-rose-600";
  if (pct >= 75)  return "text-amber-600";
  return "text-emerald-600";
}

// ── BudgetModal ────────────────────────────────────────────────────────────────

interface BudgetModalProps {
  budget?: Budget;
  categories: Category[];
  usedCategoryIds: Set<number>;
  isPending: boolean;
  onSave: (categoryId: number, amount: number) => void;
  onClose: () => void;
}

function BudgetModal({ budget, categories, usedCategoryIds, isPending, onSave, onClose }: BudgetModalProps) {
  const { t } = useTranslation();
  const isEdit = !!budget;

  const [categoryId, setCategoryId] = useState<number>(budget?.category_id ?? 0);
  const [amount, setAmount] = useState(budget ? parseFloat(budget.amount) : 0);

  // Only expense categories for budgets; filter out already-budgeted ones (except current)
  const available = categories.filter(
    (c) => !c.is_income && (!usedCategoryIds.has(c.id) || c.id === budget?.category_id),
  );

  const categoryOptions = [
    { value: "", label: `— ${t("budget.category_label")} —` },
    ...available.map((c) => ({ value: String(c.id), label: c.name })),
  ];

  const canSave = categoryId > 0 && amount > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">
            {isEdit ? t("budget.edit") : t("budget.add")}
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {!isEdit && (
            <Select
              label={t("budget.category_label")}
              value={String(categoryId || "")}
              onChange={(e) => setCategoryId(Number(e.target.value))}
              options={categoryOptions}
            />
          )}
          {isEdit && (
            <div>
              <p className="text-xs font-medium text-slate-500 mb-1">{t("budget.category_label")}</p>
              <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg border border-slate-200">
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ background: budget.category.color }}
                />
                <span className="text-sm font-medium text-slate-700">{budget.category.name}</span>
              </div>
            </div>
          )}
          <Input
            label={t("budget.amount_label")}
            type="number"
            min={1}
            step={1}
            value={amount || ""}
            onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
            placeholder={t("budget.amount_placeholder")}
            hint="€"
          />
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 bg-white hover:bg-slate-50 transition-colors"
          >
            {t("common.cancel")}
          </button>
          <button
            onClick={() => onSave(categoryId, amount)}
            disabled={!canSave || isPending}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-brand-600 text-white hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            {isEdit ? t("common.update") : t("common.save")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── BudgetCard ─────────────────────────────────────────────────────────────────

function BudgetCard({
  budget,
  onEdit,
  onDelete,
  onClick,
}: {
  budget: Budget;
  onEdit: () => void;
  onDelete: () => void;
  onClick: () => void;
}) {
  const { t } = useTranslation();
  const pct = Math.min(budget.percentage, 100);
  const isOver = budget.percentage >= 100;
  const remaining = parseFloat(budget.remaining);

  return (
    <div className="card p-5 group cursor-pointer hover:shadow-md transition-shadow" onClick={onClick}>
      <div className="flex items-start justify-between gap-3 mb-3">
        {/* Category name + color dot */}
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="w-3 h-3 rounded-full shrink-0"
            style={{ background: budget.category.color }}
          />
          <p className="font-semibold text-slate-800 truncate">{budget.category.name}</p>
        </div>

        {/* Actions (show on hover) */}
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
            title={t("budget.edit")}
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
            title={t("common.delete")}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Amounts */}
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-lg font-bold text-slate-800">
          {formatCurrency(budget.spent)}
        </span>
        <span className="text-sm text-slate-400">
          {t("budget.of")} {formatCurrency(budget.amount)}
        </span>
      </div>

      {/* Progress bar */}
      <div className={`w-full h-2 rounded-full ${progressBg(budget.percentage)}`}>
        <div
          className={`h-2 rounded-full transition-all ${progressColor(budget.percentage)}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Remaining / over */}
      <p className={`text-xs mt-1.5 ${textColor(budget.percentage)}`}>
        {isOver
          ? `${formatCurrency(Math.abs(remaining))} ${t("budget.over_budget")}`
          : `${formatCurrency(Math.abs(remaining))} ${t("budget.remaining")}`}
      </p>
    </div>
  );
}

// ── BudgetPage ─────────────────────────────────────────────────────────────────

export default function BudgetPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const today = new Date();
  const [year, setYear]   = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1); // 1-based

  const buildMonthParams = (categoryId: number) => {
    const mm = String(month).padStart(2, "0");
    const lastDay = new Date(year, month, 0).getDate();
    return new URLSearchParams({
      date_from: `${year}-${mm}-01`,
      date_to: `${year}-${mm}-${String(lastDay).padStart(2, "0")}`,
      transaction_type: "expense",
      category_id: String(categoryId),
    }).toString();
  };

  const [modal, setModal] = useState<null | { budget?: Budget }>(null);

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: budgets = [], isLoading } = useQuery({
    queryKey: ["budgets", year, month],
    queryFn: () => budgetsApi.list(year, month),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: categoriesApi.list,
  });

  // ── Mutations ──────────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: ({ categoryId, amount }: { categoryId: number; amount: number }) =>
      budgetsApi.create({ category_id: categoryId, amount }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["budgets"] });
      setModal(null);
      toast.success(t("budget.created"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, amount }: { id: number; amount: number }) =>
      budgetsApi.update(id, { amount }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["budgets"] });
      setModal(null);
      toast.success(t("budget.updated"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => budgetsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["budgets"] });
      toast.success(t("budget.deleted"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleSave = (categoryId: number, amount: number) => {
    if (modal?.budget) {
      updateMutation.mutate({ id: modal.budget.id, amount });
    } else {
      createMutation.mutate({ categoryId, amount });
    }
  };

  const handleDelete = (budget: Budget) => {
    if (confirm(t("budget.delete_confirm", { name: budget.category.name }))) {
      deleteMutation.mutate(budget.id);
    }
  };

  const prevMonth = () => {
    if (month === 1) { setYear((y) => y - 1); setMonth(12); }
    else setMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setYear((y) => y + 1); setMonth(1); }
    else setMonth((m) => m + 1);
  };

  const monthNames = t("budget.months", { returnObjects: true }) as string[];
  const usedCategoryIds = new Set(budgets.map((b) => b.category_id));
  const isPending = createMutation.isPending || updateMutation.isPending;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t("budget.title")}</h1>
          <p className="text-sm text-slate-500 mt-0.5">{t("budget.subtitle")}</p>
        </div>
        <button
          onClick={() => setModal({})}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-brand-600 text-white hover:bg-brand-700 transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          {t("budget.add")}
        </button>
      </div>

      {/* Month navigator */}
      <div className="flex items-center gap-3">
        <button
          onClick={prevMonth}
          className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
        >
          <ChevronLeft className="w-4 h-4 text-slate-500" />
        </button>
        <span className="text-sm font-semibold text-slate-700 w-40 text-center">
          {monthNames[month - 1]} {year}
        </span>
        <button
          onClick={nextMonth}
          className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
        >
          <ChevronRight className="w-4 h-4 text-slate-500" />
        </button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
        </div>
      ) : budgets.length === 0 ? (
        <div className="card flex flex-col items-center justify-center gap-3 py-20 text-center">
          <PiggyBank className="w-12 h-12 text-slate-200" />
          <div>
            <p className="font-semibold text-slate-700">{t("budget.no_budgets")}</p>
            <p className="text-sm text-slate-400 mt-1 max-w-xs">{t("budget.no_budgets_hint")}</p>
          </div>
          <button
            onClick={() => setModal({})}
            className="mt-2 flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-brand-600 text-white hover:bg-brand-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            {t("budget.add")}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {budgets.map((budget) => (
            <BudgetCard
              key={budget.id}
              budget={budget}
              onEdit={() => setModal({ budget })}
              onDelete={() => handleDelete(budget)}
              onClick={() => navigate(`/transactions?${buildMonthParams(budget.category_id)}`)}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <BudgetModal
          budget={modal.budget}
          categories={categories}
          usedCategoryIds={usedCategoryIds}
          isPending={isPending}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
