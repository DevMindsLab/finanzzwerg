import { useRef, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import {
  Upload,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  ChevronDown,
  ChevronRight,
  Trash2,
  Plus,
  Pencil,
  HelpCircle,
  X,
  BookOpen,
} from "lucide-react";
import { importsApi, type UploadOptions } from "@/api/imports";
import { presetsApi, type ResolvedPreset } from "@/api/presets";
import type { ImportJob } from "@/types";
import { formatDate } from "@/lib/utils";
import Input from "@/components/ui/Input";
import Badge from "@/components/ui/Badge";

// ── Status display helpers ─────────────────────────────────────────────────────

const STATUS_ICON: Record<string, React.ElementType> = {
  pending:    Clock,
  processing: Loader2,
  completed:  CheckCircle2,
  failed:     XCircle,
};

const STATUS_COLOR: Record<string, string> = {
  pending:    "text-amber-500",
  processing: "text-blue-500 animate-spin",
  completed:  "text-emerald-500",
  failed:     "text-rose-500",
};

const STATUS_BADGE: Record<string, "warning" | "info" | "success" | "danger"> = {
  pending:    "warning",
  processing: "info",
  completed:  "success",
  failed:     "danger",
};

// ── JobRow ─────────────────────────────────────────────────────────────────────

function JobRow({ job }: { job: ImportJob }) {
  const { t } = useTranslation();
  const Icon = STATUS_ICON[job.status] ?? Clock;
  return (
    <div className="flex items-center gap-4 px-6 py-4 border-b border-slate-50 last:border-0">
      <Icon className={`w-5 h-5 shrink-0 ${STATUS_COLOR[job.status]}`} />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-slate-800 truncate">{job.filename}</p>
        <p className="text-xs text-slate-500 mt-0.5">
          {formatDate(job.created_at)}
          {job.total_rows !== null &&
            ` · ${t("import.imported", { processed: job.processed_rows, duplicates: job.duplicate_rows })}`}
        </p>
        {job.error_message && (
          <p className="text-xs text-rose-600 mt-1 truncate" title={job.error_message}>
            {job.error_message}
          </p>
        )}
      </div>
      <Badge variant={STATUS_BADGE[job.status]} className="capitalize">
        {job.status}
      </Badge>
    </div>
  );
}

// ── HelpDialog ─────────────────────────────────────────────────────────────────

function HelpDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();

  const steps = [1, 2, 3, 4] as const;
  const fields: { key: string; label: string; desc: string }[] = [
    { key: "delimiter",    label: t("import.label_csv_delimiter"),        desc: t("import.help_field_delimiter") },
    { key: "encoding",     label: t("import.label_encoding"),             desc: t("import.help_field_encoding") },
    { key: "skip_rows",    label: t("import.label_skip_rows"),            desc: t("import.help_field_skip_rows") },
    { key: "date_col",     label: t("import.label_date_column"),          desc: t("import.help_field_date_column") },
    { key: "date_fmt",     label: t("import.label_date_format"),          desc: t("import.help_field_date_format") },
    { key: "amount_col",   label: t("import.label_amount_column"),        desc: t("import.help_field_amount_column") },
    { key: "desc_cols",    label: t("import.label_description_columns"),  desc: t("import.help_field_description") },
    { key: "decimal",      label: t("import.label_decimal_separator"),    desc: t("import.help_field_decimal") },
    { key: "negate",       label: t("import.negate_amounts"),             desc: t("import.help_field_negate") },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-brand-500" />
            <h2 className="font-semibold text-slate-800">{t("import.help_title")}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-6 py-5 space-y-6">
          <p className="text-sm text-slate-500">{t("import.help_intro")}</p>

          {/* Step-by-step */}
          <ol className="space-y-4">
            {steps.map((n) => (
              <li key={n} className="flex gap-3">
                <span className="flex-none w-6 h-6 rounded-full bg-brand-100 text-brand-700 text-xs flex items-center justify-center font-bold">
                  {n}
                </span>
                <div>
                  <p className="font-medium text-slate-800 text-sm">
                    {t(`import.help_step${n}_title`)}
                  </p>
                  <p className="text-sm text-slate-500 mt-0.5">
                    {t(`import.help_step${n}_body`)}
                  </p>
                </div>
              </li>
            ))}
          </ol>

          {/* Field reference */}
          <div>
            <p className="font-semibold text-slate-700 text-sm mb-3">
              {t("import.help_fields_title")}
            </p>
            <div className="space-y-3">
              {fields.map((f) => (
                <div key={f.key}>
                  <p className="text-xs font-semibold text-slate-700">{f.label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 flex justify-end px-6 py-4 border-t border-slate-100">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-brand-600 text-white hover:bg-brand-700 transition-colors"
          >
            {t("common.close")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── PresetModal ────────────────────────────────────────────────────────────────

interface PresetModalProps {
  mode: "create" | "edit";
  preset?: ResolvedPreset;
  currentOpts: UploadOptions;
  isPending: boolean;
  onSave: (name: string, profile: UploadOptions) => void;
  onClose: () => void;
}

function PresetModal({ mode, preset, currentOpts, isPending, onSave, onClose }: PresetModalProps) {
  const { t } = useTranslation();
  const [name, setName] = useState(preset?.name ?? "");
  const [localOpts, setLocalOpts] = useState<UploadOptions>(
    preset?.profile ?? currentOpts,
  );

  const setOpt =
    (k: keyof UploadOptions) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setLocalOpts((o) => ({ ...o, [k]: e.target.value }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <h2 className="font-semibold text-slate-800">
            {mode === "create" ? t("import.preset_new") : t("import.preset_edit")}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-6 py-5 space-y-5">
          <Input
            label={t("import.preset_name_label")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("import.preset_name_placeholder")}
          />

          <div>
            <p className="text-sm font-semibold text-slate-700 mb-3">{t("import.csv_profile")}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Input label={t("import.label_date_column")} value={localOpts.date_column ?? ""} onChange={setOpt("date_column")} />
              <Input label={t("import.label_date_format")} value={localOpts.date_format ?? ""} onChange={setOpt("date_format")} hint={t("import.date_format_hint")} />
              <Input label={t("import.label_amount_column")} value={localOpts.amount_column ?? ""} onChange={setOpt("amount_column")} />
              <Input label={t("import.label_description_columns")} value={localOpts.description_columns ?? ""} onChange={setOpt("description_columns")} hint={t("import.description_columns_hint")} />
              <Input label={t("import.label_decimal_separator")} value={localOpts.decimal_separator ?? ""} onChange={setOpt("decimal_separator")} hint={t("import.decimal_separator_hint")} />
              <Input label={t("import.label_thousands_separator")} value={localOpts.thousands_separator ?? ""} onChange={setOpt("thousands_separator")} hint={t("import.thousands_separator_hint")} />
              <Input label={t("import.label_csv_delimiter")} value={localOpts.delimiter ?? ""} onChange={setOpt("delimiter")} />
              <Input label={t("import.label_encoding")} value={localOpts.encoding ?? ""} onChange={setOpt("encoding")} hint={t("import.encoding_hint")} />
              <Input label={t("import.label_skip_rows")} type="number" value={localOpts.skip_rows ?? 0} onChange={setOpt("skip_rows")} hint={t("import.skip_rows_hint")} />
              <Input label={t("import.label_debit_column")} value={localOpts.debit_column ?? ""} onChange={setOpt("debit_column")} hint={t("import.debit_column_hint")} />
              <Input label={t("import.label_credit_column")} value={localOpts.credit_column ?? ""} onChange={setOpt("credit_column")} />
              <div className="flex items-center gap-2 pt-5">
                <input
                  id="modal-negate"
                  type="checkbox"
                  checked={!!localOpts.negate_amount}
                  onChange={(e) => setLocalOpts((o) => ({ ...o, negate_amount: e.target.checked }))}
                  className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                <label htmlFor="modal-negate" className="text-sm text-slate-700">
                  {t("import.negate_amounts")}
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 flex justify-end gap-3 px-6 py-4 border-t border-slate-100">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 bg-white hover:bg-slate-50 transition-colors"
          >
            {t("common.cancel")}
          </button>
          <button
            onClick={() => onSave(name, localOpts)}
            disabled={!name.trim() || isPending}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-brand-600 text-white hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            {mode === "create" ? t("common.save") : t("common.update")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── ImportPage ─────────────────────────────────────────────────────────────────

export default function ImportPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [pendingJobId, setPendingJobId] = useState<number | null>(null);

  // Preset modal state: null = closed; "create" | edit preset
  const [presetModal, setPresetModal] = useState<
    null | { mode: "create" } | { mode: "edit"; preset: ResolvedPreset }
  >(null);
  const [helpOpen, setHelpOpen] = useState(false);

  const [opts, setOpts] = useState<UploadOptions>({
    delimiter: ",",
    encoding: "utf-8",
    skip_rows: 0,
    date_column: "date",
    date_format: "%Y-%m-%d",
    amount_column: "amount",
    decimal_separator: ".",
    thousands_separator: "",
    description_columns: "description",
    description_join: " | ",
    negate_amount: false,
  });

  const set = (k: keyof UploadOptions) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setOpts((o) => ({ ...o, [k]: e.target.value }));

  // ── Queries ─────────────────────────────────────────────────────────────────

  const { data: jobs = [] } = useQuery({
    queryKey: ["import-jobs"],
    queryFn: importsApi.list,
    refetchInterval: pendingJobId ? 1500 : false,
  });

  const { data: presets = [] } = useQuery({
    queryKey: ["presets"],
    queryFn: presetsApi.list,
  });

  // ── Effects ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!pendingJobId) return;
    const job = jobs.find((j) => j.id === pendingJobId);
    if (job && (job.status === "completed" || job.status === "failed")) {
      setPendingJobId(null);
      qc.invalidateQueries({ queryKey: ["inbox"] });
      qc.invalidateQueries({ queryKey: ["inbox-count"] });
      if (job.status === "completed") {
        toast.success(
          t("import.import_complete", {
            processed: job.processed_rows,
            duplicates: job.duplicate_rows,
          }),
        );
      } else {
        toast.error(t("import.import_failed", { error: job.error_message }));
      }
    }
  }, [jobs, pendingJobId, qc, t]);

  // ── Mutations ────────────────────────────────────────────────────────────────

  const clearHistoryMutation = useMutation({
    mutationFn: importsApi.clearHistory,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["import-jobs"] });
      toast.success(t("import.clear_history"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => importsApi.upload(file, opts),
    onSuccess: (job) => {
      qc.invalidateQueries({ queryKey: ["import-jobs"] });
      setPendingJobId(job.id);
      toast(t("import.processing"), { icon: "⏳" });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const createPresetMutation = useMutation({
    mutationFn: ({ name, profile }: { name: string; profile: UploadOptions }) =>
      presetsApi.create(name, profile),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["presets"] });
      setPresetModal(null);
      toast.success(t("import.preset_created"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updatePresetMutation = useMutation({
    mutationFn: ({ id, name, profile }: { id: number; name: string; profile: UploadOptions }) =>
      presetsApi.update(id, name, profile),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["presets"] });
      setPresetModal(null);
      toast.success(t("import.preset_updated"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deletePresetMutation = useMutation({
    mutationFn: (id: number) => presetsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["presets"] });
      toast.success(t("import.preset_deleted"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleFile = (file: File | null) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      toast.error(t("import.only_csv"));
      return;
    }
    uploadMutation.mutate(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files[0] ?? null);
  };

  const applyPreset = (preset: ResolvedPreset) => {
    setOpts((o) => ({ ...o, ...preset.profile }));
    setShowAdvanced(true);
    toast.success(t("import.preset_applied", { name: preset.name }));
  };

  const handlePresetSave = (name: string, profile: UploadOptions) => {
    if (presetModal?.mode === "edit") {
      updatePresetMutation.mutate({ id: presetModal.preset.id, name, profile });
    } else {
      createPresetMutation.mutate({ name, profile });
    }
  };

  const handleDeletePreset = (preset: ResolvedPreset) => {
    if (confirm(t("import.preset_delete_confirm", { name: preset.name }))) {
      deletePresetMutation.mutate(preset.id);
    }
  };

  const isModalPending =
    createPresetMutation.isPending || updatePresetMutation.isPending;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{t("import.title")}</h1>
        <p className="text-sm text-slate-500 mt-0.5">{t("import.subtitle")}</p>
      </div>

      {/* Upload zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        className={`
          card flex flex-col items-center justify-center gap-4 p-12 cursor-pointer
          border-2 border-dashed transition-colors
          ${dragOver
            ? "border-brand-400 bg-brand-50"
            : "border-slate-200 hover:border-brand-300 hover:bg-slate-50"
          }
        `}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        />
        {uploadMutation.isPending ? (
          <Loader2 className="w-12 h-12 text-brand-500 animate-spin" />
        ) : (
          <Upload className="w-12 h-12 text-slate-300" />
        )}
        <div className="text-center">
          <p className="font-semibold text-slate-700">
            {uploadMutation.isPending ? t("import.uploading") : t("import.drop_csv")}
          </p>
          <p className="text-sm text-slate-400 mt-1">{t("import.browse_hint")}</p>
        </div>
      </div>

      {/* CSV Profile */}
      <div className="card overflow-hidden">
        <button
          className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-slate-50 transition-colors"
          onClick={() => setShowAdvanced((v) => !v)}
        >
          <div>
            <p className="font-semibold text-slate-800">{t("import.csv_profile")}</p>
            <p className="text-xs text-slate-500 mt-0.5">{t("import.csv_profile_hint")}</p>
          </div>
          {showAdvanced ? (
            <ChevronDown className="w-5 h-5 text-slate-400" />
          ) : (
            <ChevronRight className="w-5 h-5 text-slate-400" />
          )}
        </button>

        {showAdvanced && (
          <div className="border-t border-slate-100 px-6 py-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Input label={t("import.label_date_column")} value={opts.date_column} onChange={set("date_column")} />
            <Input label={t("import.label_date_format")} value={opts.date_format} onChange={set("date_format")} hint={t("import.date_format_hint")} />
            <Input label={t("import.label_amount_column")} value={opts.amount_column} onChange={set("amount_column")} />
            <Input label={t("import.label_description_columns")} value={opts.description_columns} onChange={set("description_columns")} hint={t("import.description_columns_hint")} />
            <Input label={t("import.label_decimal_separator")} value={opts.decimal_separator} onChange={set("decimal_separator")} hint={t("import.decimal_separator_hint")} />
            <Input label={t("import.label_thousands_separator")} value={opts.thousands_separator} onChange={set("thousands_separator")} hint={t("import.thousands_separator_hint")} />
            <Input label={t("import.label_csv_delimiter")} value={opts.delimiter} onChange={set("delimiter")} />
            <Input label={t("import.label_encoding")} value={opts.encoding} onChange={set("encoding")} hint={t("import.encoding_hint")} />
            <Input label={t("import.label_skip_rows")} type="number" value={opts.skip_rows} onChange={set("skip_rows")} hint={t("import.skip_rows_hint")} />
            <Input label={t("import.label_debit_column")} value={opts.debit_column ?? ""} onChange={set("debit_column")} hint={t("import.debit_column_hint")} />
            <Input label={t("import.label_credit_column")} value={opts.credit_column ?? ""} onChange={set("credit_column")} />
            <div className="flex items-center gap-2 pt-5">
              <input
                id="negate"
                type="checkbox"
                checked={opts.negate_amount}
                onChange={(e) => setOpts((o) => ({ ...o, negate_amount: e.target.checked }))}
                className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              />
              <label htmlFor="negate" className="text-sm text-slate-700">
                {t("import.negate_amounts")}
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Presets */}
      <div className="card p-5">
        {/* Section header */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold text-slate-700">{t("import.presets")}</p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setHelpOpen(true)}
              title={t("import.help_title")}
              className="p-1.5 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPresetModal({ mode: "create" })}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-brand-600 text-white hover:bg-brand-700 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              {t("import.preset_save")}
            </button>
          </div>
        </div>

        {/* Empty state */}
        {presets.length === 0 && (
          <div className="rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center">
            <p className="text-sm font-medium text-slate-500">{t("import.no_presets")}</p>
            <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
              {t("import.no_presets_hint")}
            </p>
          </div>
        )}

        {/* Preset chips */}
        {presets.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {presets.map((preset) => (
              <div
                key={preset.id}
                className="group flex items-center gap-0.5 rounded-lg border border-slate-200 bg-white overflow-hidden"
              >
                {/* Apply button */}
                <button
                  onClick={() => applyPreset(preset)}
                  className="px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  {preset.name}
                </button>

                {/* Edit */}
                <button
                  onClick={() => setPresetModal({ mode: "edit", preset })}
                  className="px-1.5 py-1.5 text-slate-300 hover:text-brand-600 hover:bg-brand-50 opacity-0 group-hover:opacity-100 transition-all"
                  title={t("import.preset_edit")}
                >
                  <Pencil className="w-3 h-3" />
                </button>

                {/* Delete */}
                <button
                  onClick={() => handleDeletePreset(preset)}
                  disabled={deletePresetMutation.isPending}
                  className="px-1.5 py-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 opacity-0 group-hover:opacity-100 transition-all disabled:opacity-30"
                  title={t("common.delete")}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Import history */}
      {jobs.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">{t("import.import_history")}</h2>
            <button
              onClick={() => {
                if (confirm(t("import.clear_history_confirm"))) {
                  clearHistoryMutation.mutate();
                }
              }}
              disabled={clearHistoryMutation.isPending}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-rose-600 transition-colors disabled:opacity-40"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {t("import.clear_history")}
            </button>
          </div>
          {jobs.map((job) => (
            <JobRow key={job.id} job={job} />
          ))}
        </div>
      )}

      {/* Preset modal */}
      {presetModal && (
        <PresetModal
          mode={presetModal.mode}
          preset={"preset" in presetModal ? presetModal.preset : undefined}
          currentOpts={opts}
          isPending={isModalPending}
          onSave={handlePresetSave}
          onClose={() => setPresetModal(null)}
        />
      )}

      {/* Help dialog */}
      {helpOpen && <HelpDialog onClose={() => setHelpOpen(false)} />}
    </div>
  );
}
