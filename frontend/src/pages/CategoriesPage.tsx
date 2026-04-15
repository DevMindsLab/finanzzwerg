import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { categoriesApi } from "@/api/categories";
import type { Category, CategoryCreate } from "@/types";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Badge from "@/components/ui/Badge";

const PRESET_COLORS = [
  "#10b981", "#3b82f6", "#f97316", "#eab308", "#ef4444",
  "#a855f7", "#6366f1", "#f59e0b", "#06b6d4", "#ec4899",
  "#6b7280", "#14b8a6",
];

interface FormData {
  name: string;
  color: string;
  is_income: boolean;
}

function CategoryForm({
  initial,
  onSubmit,
  loading,
}: {
  initial: FormData;
  onSubmit: (data: FormData) => void;
  loading: boolean;
}) {
  const [form, setForm] = useState(initial);

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }} className="space-y-4">
      <Input
        label="Name"
        value={form.name}
        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        required
      />

      {/* Color picker */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-slate-700">Color</label>
        <div className="flex flex-wrap gap-2">
          {PRESET_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => setForm((f) => ({ ...f, color }))}
              className="w-7 h-7 rounded-full border-2 transition-all"
              style={{
                backgroundColor: color,
                borderColor: form.color === color ? "#0f172a" : "transparent",
                transform: form.color === color ? "scale(1.2)" : "scale(1)",
              }}
            />
          ))}
        </div>
        <Input
          value={form.color}
          onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
          placeholder="#6b7280"
          hint="Hex color code"
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          id="is_income"
          type="checkbox"
          checked={form.is_income}
          onChange={(e) => setForm((f) => ({ ...f, is_income: e.target.checked }))}
          className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
        />
        <label htmlFor="is_income" className="text-sm font-medium text-slate-700">
          This is an income category
        </label>
      </div>

      <div className="flex justify-end pt-2">
        <Button type="submit" loading={loading}>
          Save Category
        </Button>
      </div>
    </form>
  );
}

export default function CategoriesPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editCat, setEditCat] = useState<Category | null>(null);

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["categories"],
    queryFn: categoriesApi.list,
  });

  const createMutation = useMutation({
    mutationFn: (data: FormData) =>
      categoriesApi.create(data as unknown as CategoryCreate),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categories"] });
      toast.success("Category created");
      setShowCreate(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: FormData }) =>
      categoriesApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categories"] });
      toast.success("Category updated");
      setEditCat(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: categoriesApi.delete,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categories"] });
      toast.success("Category deleted");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const income = categories.filter((c) => c.is_income);
  const expense = categories.filter((c) => !c.is_income);

  function CategoryCard({ cat }: { cat: Category }) {
    return (
      <div className="flex items-center gap-4 p-4 border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
        <div
          className="w-9 h-9 rounded-lg shrink-0 flex items-center justify-center"
          style={{ backgroundColor: `${cat.color}20` }}
        >
          <div className="w-4 h-4 rounded-full" style={{ backgroundColor: cat.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-slate-900">{cat.name}</p>
          <p className="text-xs text-slate-500">
            {cat.transaction_count} transaction{cat.transaction_count !== 1 ? "s" : ""}
            {cat.is_default && " · Default"}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setEditCat(cat)}
            className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded transition-colors"
          >
            <Pencil className="w-4 h-4" />
          </button>
          {!cat.is_default && (
            <button
              onClick={() => {
                if (confirm(`Delete "${cat.name}"? Linked transactions will be uncategorized.`)) {
                  deleteMutation.mutate(cat.id);
                }
              }}
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Categories</h1>
          <p className="text-sm text-slate-500 mt-0.5">{categories.length} categories total</p>
        </div>
        <Button icon={<Plus className="w-4 h-4" />} onClick={() => setShowCreate(true)}>
          New Category
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin w-7 h-7 border-2 border-brand-600 border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Income */}
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
              <Badge variant="success">Income</Badge>
              <span className="text-xs text-slate-500">{income.length} categories</span>
            </div>
            {income.length === 0 ? (
              <div className="flex items-center justify-center h-20 text-slate-400 text-sm">
                No income categories
              </div>
            ) : (
              income.map((cat) => <CategoryCard key={cat.id} cat={cat} />)
            )}
          </div>

          {/* Expense */}
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
              <Badge variant="danger">Expense</Badge>
              <span className="text-xs text-slate-500">{expense.length} categories</span>
            </div>
            {expense.map((cat) => <CategoryCard key={cat.id} cat={cat} />)}
          </div>
        </div>
      )}

      {/* Modals */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="New Category">
        <CategoryForm
          initial={{ name: "", color: "#6366f1", is_income: false }}
          onSubmit={(data) => createMutation.mutate(data)}
          loading={createMutation.isPending}
        />
      </Modal>

      <Modal isOpen={!!editCat} onClose={() => setEditCat(null)} title="Edit Category">
        {editCat && (
          <CategoryForm
            initial={{ name: editCat.name, color: editCat.color, is_income: editCat.is_income }}
            onSubmit={(data) => updateMutation.mutate({ id: editCat.id, data })}
            loading={updateMutation.isPending}
          />
        )}
      </Modal>
    </div>
  );
}
