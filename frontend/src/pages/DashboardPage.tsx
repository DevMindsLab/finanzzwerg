import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend,
} from "recharts";
import { TrendingUp, TrendingDown, Minus, AlertCircle, ArrowRight } from "lucide-react";
import { dashboardApi } from "@/api/dashboard";
import { formatCurrency } from "@/lib/utils";

function StatCard({
  label,
  value,
  icon: Icon,
  colorClass,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  colorClass: string;
}) {
  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${colorClass}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

export default function DashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);

  const buildMonthParams = (type: "income" | "expense", categoryId: number | null) => {
    const mm = String(month).padStart(2, "0");
    const lastDay = new Date(year, month, 0).getDate();
    const params = new URLSearchParams({
      date_from: `${year}-${mm}-01`,
      date_to: `${year}-${mm}-${String(lastDay).padStart(2, "0")}`,
      transaction_type: type,
    });
    if (categoryId !== null) params.set("category_id", String(categoryId));
    return params.toString();
  };

  const handleCategoryClick = (categoryId: number | null) =>
    navigate(`/transactions?${buildMonthParams("expense", categoryId)}`);

  const handleIncomeClick = (categoryId: number | null) =>
    navigate(`/transactions?${buildMonthParams("income", categoryId)}`);

  const months: string[] = t("dashboard.months", { returnObjects: true }) as string[];

  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard", year, month],
    queryFn: () => dashboardApi.get(year, month),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center gap-3 text-rose-600 p-6 card">
        <AlertCircle className="w-5 h-5 shrink-0" />
        <p>{t("common.error")}</p>
      </div>
    );
  }

  const { current_month: cm, monthly_history, expense_breakdown, income_breakdown, uncategorized_count } = data;

  const barData = monthly_history.map((m) => ({
    name: months[m.month - 1],
    income: parseFloat(m.income),
    expenses: parseFloat(m.expenses),
  }));

  const pieData = expense_breakdown.slice(0, 8).map((c) => ({
    name: c.category_name,
    value: parseFloat(c.total),
    color: c.category_color,
  }));

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t("dashboard.title")}</h1>
          <p className="text-sm text-slate-500 mt-0.5">{t("dashboard.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            {months.map((name, i) => (
              <option key={i} value={i + 1}>{name}</option>
            ))}
          </select>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            {[today.getFullYear() - 2, today.getFullYear() - 1, today.getFullYear()].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Uncategorized alert */}
      {uncategorized_count > 0 && (
        <a
          href="/inbox"
          className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 hover:bg-amber-100 transition-colors"
        >
          <AlertCircle className="w-5 h-5 shrink-0 text-amber-500" />
          <p className="text-sm font-medium">
            {t("dashboard.uncategorized_alert", { count: uncategorized_count })}
          </p>
          <span className="ml-auto text-sm font-semibold underline">{t("dashboard.review")}</span>
        </a>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <StatCard
          label={t("dashboard.income")}
          value={formatCurrency(cm.income)}
          icon={TrendingUp}
          colorClass="bg-emerald-100 text-emerald-600"
        />
        <StatCard
          label={t("dashboard.expenses")}
          value={formatCurrency(cm.expenses)}
          icon={TrendingDown}
          colorClass="bg-rose-100 text-rose-600"
        />
        <StatCard
          label={t("dashboard.balance")}
          value={formatCurrency(cm.balance)}
          icon={Minus}
          colorClass={
            parseFloat(cm.balance) >= 0
              ? "bg-sky-100 text-sky-600"
              : "bg-orange-100 text-orange-600"
          }
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bar chart */}
        <div className="card p-6 lg:col-span-2">
          <h2 className="text-sm font-semibold text-slate-700 mb-5">{t("dashboard.monthly_overview")}</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={barData} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#94a3b8" }} />
              <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} />
              <Tooltip
                formatter={(v: number) => formatCurrency(v)}
                contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13 }}
              />
              <Bar dataKey="income" name={t("dashboard.income")} fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expenses" name={t("dashboard.expenses")} fill="#f43f5e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie chart */}
        <div className="card p-6">
          <h2 className="text-sm font-semibold text-slate-700 mb-5">{t("dashboard.expenses_by_category")}</h2>
          {pieData.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
              {t("dashboard.no_expense_data")}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="45%"
                  outerRadius={80}
                  strokeWidth={2}
                >
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Legend
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: 12 }}
                />
                <Tooltip
                  formatter={(v: number) => formatCurrency(v)}
                  contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13 }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Income breakdown table */}
      {income_breakdown.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-700">{t("dashboard.income_breakdown")}</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">{t("dashboard.col_category")}</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">{t("dashboard.col_transactions")}</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">{t("dashboard.col_total")}</th>
                <th className="px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">{t("dashboard.col_share")}</th>
              </tr>
            </thead>
            <tbody>
              {income_breakdown.map((row) => (
                <tr
                  key={row.category_id ?? "uncategorized"}
                  onClick={() => handleIncomeClick(row.category_id)}
                  title={t("dashboard.click_for_details")}
                  className="border-b border-slate-50 last:border-0 hover:bg-slate-50 cursor-pointer group"
                >
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: row.category_color }} />
                      <span className="font-medium text-slate-800 group-hover:text-brand-600">{row.category_name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-3 text-right text-slate-600">{row.transaction_count}</td>
                  <td className="px-6 py-3 text-right font-medium text-emerald-600">
                    {formatCurrency(row.total)}
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-slate-100 rounded-full h-1.5 max-w-[80px]">
                        <div
                          className="h-1.5 rounded-full"
                          style={{ width: `${Math.min(row.percentage, 100)}%`, backgroundColor: row.category_color }}
                        />
                      </div>
                      <span className="text-slate-500 text-xs w-10 text-right">{row.percentage.toFixed(1)}%</span>
                      <span className="flex items-center gap-1 text-xs text-brand-600 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                        {t("dashboard.click_for_details")}
                        <ArrowRight className="w-3 h-3" />
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Expense breakdown table */}
      {expense_breakdown.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-700">{t("dashboard.expense_breakdown")}</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">{t("dashboard.col_category")}</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">{t("dashboard.col_transactions")}</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">{t("dashboard.col_total")}</th>
                <th className="px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">{t("dashboard.col_share")}</th>
              </tr>
            </thead>
            <tbody>
              {expense_breakdown.map((row) => (
                <tr
                  key={row.category_id ?? "uncategorized"}
                  onClick={() => handleCategoryClick(row.category_id)}
                  title={t("dashboard.click_for_details")}
                  className="border-b border-slate-50 last:border-0 hover:bg-slate-50 cursor-pointer group"
                >
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: row.category_color }}
                      />
                      <span className="font-medium text-slate-800 group-hover:text-brand-600">{row.category_name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-3 text-right text-slate-600">{row.transaction_count}</td>
                  <td className="px-6 py-3 text-right font-medium text-rose-600">
                    {formatCurrency(row.total)}
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-slate-100 rounded-full h-1.5 max-w-[80px]">
                        <div
                          className="h-1.5 rounded-full"
                          style={{
                            width: `${Math.min(row.percentage, 100)}%`,
                            backgroundColor: row.category_color,
                          }}
                        />
                      </div>
                      <span className="text-slate-500 text-xs w-10 text-right">
                        {row.percentage.toFixed(1)}%
                      </span>
                      <span className="flex items-center gap-1 text-xs text-brand-600 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                        {t("dashboard.click_for_details")}
                        <ArrowRight className="w-3 h-3" />
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
