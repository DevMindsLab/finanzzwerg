import { NavLink } from "react-router-dom";
import {
  BarChart3,
  Inbox,
  List,
  Zap,
  Tag,
  Upload,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { transactionsApi } from "@/api/transactions";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  to: string;
  icon: React.ElementType;
  badge?: number;
}

function SidebarLink({ item }: { item: NavItem }) {
  return (
    <NavLink
      to={item.to}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
          isActive
            ? "bg-brand-600 text-white"
            : "text-slate-400 hover:bg-slate-800 hover:text-white",
        )
      }
    >
      <item.icon className="w-5 h-5 shrink-0" />
      <span className="flex-1">{item.label}</span>
      {item.badge !== undefined && item.badge > 0 && (
        <span className="bg-rose-500 text-white text-xs font-semibold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1">
          {item.badge > 99 ? "99+" : item.badge}
        </span>
      )}
    </NavLink>
  );
}

export default function Sidebar() {
  const { t, i18n } = useTranslation();

  const { data: inboxCount = 0 } = useQuery({
    queryKey: ["inbox-count"],
    queryFn: transactionsApi.inboxCount,
    refetchInterval: 30_000,
  });

  const navItems: NavItem[] = [
    { label: t("nav.dashboard"),    to: "/dashboard",    icon: BarChart3 },
    { label: t("nav.inbox"),        to: "/inbox",        icon: Inbox, badge: inboxCount },
    { label: t("nav.transactions"), to: "/transactions", icon: List },
    { label: t("nav.rules"),        to: "/rules",        icon: Zap },
    { label: t("nav.categories"),   to: "/categories",   icon: Tag },
    { label: t("nav.import"),       to: "/import",       icon: Upload },
  ];

  const currentLang = i18n.resolvedLanguage ?? i18n.language;

  const toggleLanguage = () => {
    i18n.changeLanguage(currentLang.startsWith("de") ? "en" : "de");
  };

  return (
    <aside className="w-60 shrink-0 flex flex-col bg-slate-900 border-r border-slate-800 h-full">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
            <BarChart3 className="w-4 h-4 text-white" />
          </div>
          <span className="text-white font-semibold text-lg tracking-tight">
            Financeless
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto scrollbar-thin">
        {navItems.map((item) => (
          <SidebarLink key={item.to} item={item} />
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-slate-800 flex items-center justify-between">
        <p className="text-slate-600 text-xs">Financeless v0.1.0</p>
        <button
          onClick={toggleLanguage}
          className="flex items-center gap-1 rounded-md border border-slate-700 px-2 py-1 text-xs font-medium text-slate-400 hover:border-slate-500 hover:text-white transition-colors"
          title={currentLang.startsWith("de") ? "Switch to English" : "Zu Deutsch wechseln"}
        >
          <span className={currentLang.startsWith("de") ? "text-white" : "text-slate-500"}>DE</span>
          <span className="text-slate-600">/</span>
          <span className={!currentLang.startsWith("de") ? "text-white" : "text-slate-500"}>EN</span>
        </button>
      </div>
    </aside>
  );
}
