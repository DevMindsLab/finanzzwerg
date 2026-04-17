import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import { Plus, Pencil, Trash2, Zap, ToggleLeft, ToggleRight } from "lucide-react";
import { rulesApi } from "@/api/rules";
import { categoriesApi } from "@/api/categories";
import type { Rule, RuleCreate, RuleUpdate, MatchType } from "@/types";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";

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
  const { t } = useTranslation();
  const [form, setForm] = useState(initial);
  const set = (k: keyof RuleFormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const matchTypeOptions = [
    { value: "substring", label: t("rules.match_substring") },
    { value: "exact",     label: t("rules.match_exact") },
    { value: "regex",     label: t("rules.match_regex") },
  ];

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }} className="space-y-4">
      <Input label={t("rules.label_name")} value={form.name} onChange={set("name")} required />
      <Input label={t("rules.label_pattern")} value={form.pattern} onChange={set("pattern")} hint={t("rules.pattern_hint")} required />
      <Select label={t("rules.label_match_type")} options={matchTypeOptions} value={form.match_type} onChange={set("match_type")} />
      <Select
        label={t("rules.label_category")}
        options={categoryOptions.map((c) => ({ value: c.value, label: c.label }))}
        value={form.category_id}
        onChange={set("category_id")}
        placeholder={t("rules.choose_category")}
      />
      <Input label={t("rules.label_priority")} type="number" min={0} value={form.priority} onChange={set("priority")} hint={t("rules.priority_hint")} />
      <div className="flex items-center gap-2">
        <input
          id="is_active"
          type="checkbox"
          checked={form.is_active}
          onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
          className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 dark:border-slate-600"
        />
        <label htmlFor="is_active" className="text-sm font-medium text-slate-700 dark:text-slate-300">
          {t("rules.label_active")}
        </label>
      </div>
      <div className="flex justify-end pt-2">
        <Button type="submit" loading={loading}>{t("rules.save")}</Button>
      </div>
    </form>
  );
}

export default function RulesPage() {
  const { t } = useTranslation();
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
        name: data.name, pattern: data.pattern, match_type: data.match_type,
        category_id: parseInt(data.category_id), is_active: data.is_active, priority: parseInt(data.priority),
      } as RuleCreate),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["rules"] }); toast.success(t("rules.created")); setShowCreate(false); },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: RuleFormData }) =>
      rulesApi.update(id, {
        name: data.name, pattern: data.pattern, match_type: data.match_type,
        category_id: parseInt(data.category_id), is_active: data.is_active, priority: parseInt(data.priority),
      } as RuleUpdate),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["rules"] }); toast.success(t("rules.updated")); setEditRule(null); },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: number; is_active: boolean }) => rulesApi.update(id, { is_active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rules"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: rulesApi.delete,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["rules"] }); toast.success(t("rules.deleted")); },
  });

  const applyMutation = useMutation({
    mutationFn: rulesApi.applyAll,
    onSuccess: ({ categorized }) => {
      qc.invalidateQueries({ queryKey: ["inbox"] });
      qc.invalidateQueries({ queryKey: ["inbox-count"] });
      toast.success(t("rules.applied", { count: categorized }));
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t("rules.title")}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {t("rules.subtitle", { count: rules.length })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" icon={<Zap className="w-4 h-4" />} loading={applyMutation.isPending} onClick={() => applyMutation.mutate()}>
            {t("rules.apply_all")}
          </Button>
          <Button icon={<Plus className="w-4 h-4" />} onClick={() => setShowCreate(true)}>
            {t("rules.new_rule")}
          </Button>
        </div>
      </div>

      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin w-7 h-7 border-2 border-brand-600 border-t-transparent rounded-full" />
          </div>
        ) : rules.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2 text-slate-400">
            <Zap className="w-10 h-10 opacity-40" />
            <p className="text-sm">{t("rules.no_rules")}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                <tr>
                  <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t("rules.col_rule")}</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t("rules.col_pattern")}</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t("rules.col_type")}</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t("rules.col_category")}</th>
                  <th className="text-center px-6 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t("rules.col_priority")}</th>
                  <th className="text-center px-6 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t("rules.col_active")}</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody>
                {rules.map((rule) => (
                  <tr key={rule.id} className="border-b border-slate-50 dark:border-slate-700/50 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                    <td className="px-6 py-3 font-medium text-slate-800 dark:text-slate-200">{rule.name}</td>
                    <td className="px-6 py-3">
                      <code className="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded text-xs">
                        {rule.pattern}
                      </code>
                    </td>
                    <td className="px-6 py-3 text-slate-600 dark:text-slate-400 capitalize">{rule.match_type}</td>
                    <td className="px-6 py-3">
                      <span className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: rule.category.color }} />
                        {rule.category.name}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-center text-slate-600 dark:text-slate-400">{rule.priority}</td>
                    <td className="px-6 py-3 text-center">
                      <button
                        onClick={() => toggleMutation.mutate({ id: rule.id, is_active: !rule.is_active })}
                        className="text-slate-400 hover:text-brand-600 transition-colors"
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
                          className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-950 rounded transition-colors"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(t("rules.delete_confirm", { name: rule.name }))) {
                              deleteMutation.mutate(rule.id);
                            }
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950 rounded transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title={t("rules.new_title")}>
        <RuleForm initial={EMPTY_FORM} categoryOptions={categoryOptions} onSubmit={(data) => createMutation.mutate(data)} loading={createMutation.isPending} />
      </Modal>

      <Modal isOpen={!!editRule} onClose={() => setEditRule(null)} title={t("rules.edit_title")}>
        {editRule && (
          <RuleForm
            initial={{
              name: editRule.name, pattern: editRule.pattern, match_type: editRule.match_type,
              category_id: String(editRule.category_id), priority: String(editRule.priority), is_active: editRule.is_active,
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
