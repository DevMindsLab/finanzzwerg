import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Plus, Pencil, Trash2, Zap, ToggleLeft, ToggleRight } from "lucide-react";
import { rulesApi } from "@/api/rules";
import { categoriesApi } from "@/api/categories";
import type { Rule, RuleCreate, RuleUpdate, MatchType } from "@/types";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";

const MATCH_TYPE_OPTIONS = [
  { value: "substring", label: "Substring (contains)" },
  { value: "exact",     label: "Exact match" },
  { value: "regex",     label: "Regular expression" },
];

interface RuleFormData {
  name: string;
  pattern: string;
  match_type: MatchType;
  category_id: string;
  priority: string;
  is_active: boolean;
}

const EMPTY_FORM: RuleFormData = {
  name: "",
  pattern: "",
  match_type: "substring",
  category_id: "",
  priority: "0",
  is_active: true,
};

function RuleForm({
  initial,
  categoryOptions,
  onSubmit,
  loading,
}: {
  initial: RuleFormData;
  categoryOptions: { value: number; label: string }[];
  onSubmit: (data: RuleFormData) => void;
  loading: boolean;
}) {
  const [form, setForm] = useState(initial);
  const set = (k: keyof RuleFormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSubmit(form); }}
      className="space-y-4"
    >
      <Input label="Rule name" value={form.name} onChange={set("name")} required />
      <Input
        label="Pattern"
        value={form.pattern}
        onChange={set("pattern")}
        hint="Case-insensitive. For substring: 'amazon' matches 'AMAZON PRIME', etc."
        required
      />
      <Select
        label="Match type"
        options={MATCH_TYPE_OPTIONS}
        value={form.match_type}
        onChange={set("match_type")}
      />
      <Select
        label="Category"
        options={categoryOptions.map((c) => ({ value: c.value, label: c.label }))}
        value={form.category_id}
        onChange={set("category_id")}
        placeholder="Choose category…"
      />
      <Input
        label="Priority"
        type="number"
        min={0}
        value={form.priority}
        onChange={set("priority")}
        hint="Higher number = applied first when multiple rules match"
      />
      <div className="flex items-center gap-2">
        <input
          id="is_active"
          type="checkbox"
          checked={form.is_active}
          onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
          className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
        />
        <label htmlFor="is_active" className="text-sm font-medium text-slate-700">
          Active
        </label>
      </div>
      <div className="flex justify-end pt-2">
        <Button type="submit" loading={loading}>
          Save Rule
        </Button>
      </div>
    </form>
  );
}

export default function RulesPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editRule, setEditRule] = useState<Rule | null>(null);

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ["rules"],
    queryFn: () => rulesApi.list(),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: categoriesApi.list,
  });

  const categoryOptions = categories.map((c) => ({ value: c.id, label: c.name }));

  const createMutation = useMutation({
    mutationFn: (data: RuleFormData) =>
      rulesApi.create({
        name: data.name,
        pattern: data.pattern,
        match_type: data.match_type,
        category_id: parseInt(data.category_id),
        is_active: data.is_active,
        priority: parseInt(data.priority),
      } as RuleCreate),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rules"] });
      toast.success("Rule created");
      setShowCreate(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: RuleFormData }) =>
      rulesApi.update(id, {
        name: data.name,
        pattern: data.pattern,
        match_type: data.match_type,
        category_id: parseInt(data.category_id),
        is_active: data.is_active,
        priority: parseInt(data.priority),
      } as RuleUpdate),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rules"] });
      toast.success("Rule updated");
      setEditRule(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: number; is_active: boolean }) =>
      rulesApi.update(id, { is_active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rules"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: rulesApi.delete,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rules"] });
      toast.success("Rule deleted");
    },
  });

  const applyMutation = useMutation({
    mutationFn: rulesApi.applyAll,
    onSuccess: ({ categorized }) => {
      qc.invalidateQueries({ queryKey: ["inbox"] });
      qc.invalidateQueries({ queryKey: ["inbox-count"] });
      toast.success(`${categorized} transaction${categorized !== 1 ? "s" : ""} categorized`);
    },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Rules</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {rules.length} rule{rules.length !== 1 ? "s" : ""} · Applied on import
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            icon={<Zap className="w-4 h-4" />}
            loading={applyMutation.isPending}
            onClick={() => applyMutation.mutate()}
          >
            Apply All
          </Button>
          <Button icon={<Plus className="w-4 h-4" />} onClick={() => setShowCreate(true)}>
            New Rule
          </Button>
        </div>
      </div>

      {/* Rules table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin w-7 h-7 border-2 border-brand-600 border-t-transparent rounded-full" />
          </div>
        ) : rules.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2 text-slate-400">
            <Zap className="w-10 h-10 opacity-40" />
            <p className="text-sm">No rules yet — create one to auto-categorize transactions</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Rule</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Pattern</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Type</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Category</th>
                <th className="text-center px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Priority</th>
                <th className="text-center px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Active</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                  <td className="px-6 py-3 font-medium text-slate-800">{rule.name}</td>
                  <td className="px-6 py-3">
                    <code className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-xs">
                      {rule.pattern}
                    </code>
                  </td>
                  <td className="px-6 py-3 text-slate-600 capitalize">{rule.match_type}</td>
                  <td className="px-6 py-3">
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: rule.category.color }}
                      />
                      {rule.category.name}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-center text-slate-600">{rule.priority}</td>
                  <td className="px-6 py-3 text-center">
                    <button
                      onClick={() => toggleMutation.mutate({ id: rule.id, is_active: !rule.is_active })}
                      className="text-slate-400 hover:text-brand-600 transition-colors"
                      title={rule.is_active ? "Deactivate" : "Activate"}
                    >
                      {rule.is_active ? (
                        <ToggleRight className="w-5 h-5 text-brand-600" />
                      ) : (
                        <ToggleLeft className="w-5 h-5" />
                      )}
                    </button>
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button
                        onClick={() => setEditRule(rule)}
                        className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded transition-colors"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Delete rule "${rule.name}"?`)) {
                            deleteMutation.mutate(rule.id);
                          }
                        }}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create modal */}
      <Modal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        title="New Rule"
      >
        <RuleForm
          initial={EMPTY_FORM}
          categoryOptions={categoryOptions}
          onSubmit={(data) => createMutation.mutate(data)}
          loading={createMutation.isPending}
        />
      </Modal>

      {/* Edit modal */}
      <Modal
        isOpen={!!editRule}
        onClose={() => setEditRule(null)}
        title="Edit Rule"
      >
        {editRule && (
          <RuleForm
            initial={{
              name: editRule.name,
              pattern: editRule.pattern,
              match_type: editRule.match_type,
              category_id: String(editRule.category_id),
              priority: String(editRule.priority),
              is_active: editRule.is_active,
            }}
            categoryOptions={categoryOptions}
            onSubmit={(data) => updateMutation.mutate({ id: editRule.id, data })}
            loading={updateMutation.isPending}
          />
        )}
      </Modal>
    </div>
  );
}
