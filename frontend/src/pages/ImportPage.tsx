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
} from "lucide-react";
import { importsApi, type UploadOptions } from "@/api/imports";
import type { ImportJob } from "@/types";
import { formatDate } from "@/lib/utils";
import Input from "@/components/ui/Input";
import Badge from "@/components/ui/Badge";

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

export default function ImportPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [pendingJobId, setPendingJobId] = useState<number | null>(null);

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

  const { data: jobs = [] } = useQuery({
    queryKey: ["import-jobs"],
    queryFn: importsApi.list,
    refetchInterval: pendingJobId ? 1500 : false,
  });

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

  const uploadMutation = useMutation({
    mutationFn: (file: File) => importsApi.upload(file, opts),
    onSuccess: (job) => {
      qc.invalidateQueries({ queryKey: ["import-jobs"] });
      setPendingJobId(job.id);
      toast(t("import.processing"), { icon: "⏳" });
    },
    onError: (err: Error) => toast.error(err.message),
  });

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

  const presets = [
    {
      label: "HASPA (DE)",
      opts: { delimiter: ";", date_column: "Buchungstag", date_format: "%d.%m.%y", amount_column: "Betrag", decimal_separator: ",", thousands_separator: ".", description_columns: "Beguenstigter/Zahlungspflichtiger,Verwendungszweck", description_join: " | ", skip_rows: 0, encoding: "latin-1" },
    },
    {
      label: "Deutsche Bank (DE)",
      opts: { delimiter: ";", date_column: "Buchungstag", date_format: "%d.%m.%Y", amount_column: "Betrag (EUR)", decimal_separator: ",", thousands_separator: ".", description_columns: "Auftraggeber / Beguenstigter,Verwendungszweck", skip_rows: 4 },
    },
    {
      label: "ING (DE)",
      opts: { delimiter: ";", date_column: "Buchung", date_format: "%d.%m.%Y", amount_column: "Betrag", decimal_separator: ",", thousands_separator: ".", description_columns: "Auftraggeber/Empfänger,Verwendungszweck", skip_rows: 13 },
    },
    {
      label: "Generic CSV",
      opts: { delimiter: ",", date_column: "date", date_format: "%Y-%m-%d", amount_column: "amount", decimal_separator: ".", thousands_separator: "", description_columns: "description" },
    },
  ];

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

      {/* Quick presets */}
      <div className="card p-5">
        <p className="text-sm font-semibold text-slate-700 mb-3">{t("import.quick_presets")}</p>
        <div className="flex flex-wrap gap-2">
          {presets.map((preset) => (
            <button
              key={preset.label}
              onClick={() => {
                setOpts((o) => ({ ...o, ...preset.opts }));
                setShowAdvanced(true);
                toast.success(t("import.preset_applied", { name: preset.label }));
              }}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 bg-white hover:bg-slate-50 transition-colors"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Import history */}
      {jobs.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-700">{t("import.import_history")}</h2>
          </div>
          {jobs.map((job) => (
            <JobRow key={job.id} job={job} />
          ))}
        </div>
      )}
    </div>
  );
}
