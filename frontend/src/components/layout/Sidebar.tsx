import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import BrandIcon from "@/components/ui/BrandIcon";
import {
  BarChart3,
  Inbox,
  List,
  PiggyBank,
  Zap,
  Tag,
  Upload,
  LogOut,
  Settings,
  Sun,
  Moon,
  X,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { transactionsApi } from "@/api/transactions";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import AccountModal from "@/components/AccountModal";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  to: string;
  icon: React.ElementType;
  badge?: number;
}

function SidebarLink({ item, onClick }: { item: NavItem; onClick?: () => void }) {
  return (
    <NavLink
      to={item.to}
      onClick={onClick}
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

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [accountOpen, setAccountOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const { data: inboxCount = 0 } = useQuery({
    queryKey: ["inbox-count"],
    queryFn: transactionsApi.inboxCount,
    refetchInterval: 30_000,
  });

  const navItems: NavItem[] = [
    { label: t("nav.dashboard"),    to: "/dashboard",    icon: BarChart3 },
    { label: t("nav.inbox"),        to: "/inbox",        icon: Inbox, badge: inboxCount },
    { label: t("nav.transactions"), to: "/transactions", icon: List },
    { label: t("nav.budget"),       to: "/budget",       icon: PiggyBank },
    { label: t("nav.rules"),        to: "/rules",        icon: Zap },
    { label: t("nav.categories"),   to: "/categories",   icon: Tag },
    { label: t("nav.import"),       to: "/import",       icon: Upload },
  ];

  const currentLang = i18n.resolvedLanguage ?? i18n.language;

  const toggleLanguage = () => {
    i18n.changeLanguage(currentLang.startsWith("de") ? "en" : "de");
  };

  return (
    <aside
      className={cn(
        // Base styles
        "w-60 shrink-0 flex flex-col bg-slate-900 border-r border-slate-800 dark:bg-slate-950 dark:border-slate-800",
        // Mobile: fixed drawer with slide transition
        "fixed inset-y-0 left-0 z-40 transition-transform duration-300 ease-in-out",
        isOpen ? "translate-x-0" : "-translate-x-full",
        // Desktop: static in normal flow (overrides fixed)
        "lg:static lg:translate-x-0 lg:h-full",
      )}
    >
      {/* Logo + mobile close button */}
      <div className="px-4 py-5 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <BrandIcon className="w-8 h-8" />
          <span className="text-white font-semibold text-lg tracking-tight">
            Finanzzwerg
          </span>
        </div>
        {/* Close button — mobile only */}
        <button
          onClick={onClose}
          className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          aria-label="Close navigation"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto scrollbar-thin">
        {navItems.map((item) => (
          <SidebarLink key={item.to} item={item} onClick={onClose} />
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-slate-800 space-y-3">
        {/* User row */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setAccountOpen(true)}
            title={t("auth.profile_title")}
            className="flex-1 min-w-0 flex items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-slate-800 transition-colors group"
          >
            <Settings className="w-3.5 h-3.5 text-slate-500 shrink-0 group-hover:text-slate-300" />
            <span className="text-slate-400 text-xs truncate group-hover:text-slate-200">{user?.email}</span>
          </button>
          <button
            onClick={handleLogout}
            title={t("auth.logout")}
            className="shrink-0 flex items-center rounded-md border border-slate-700 px-2 py-1.5 text-slate-400 hover:border-rose-600 hover:text-rose-400 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>

        <AccountModal open={accountOpen} onClose={() => setAccountOpen(false)} />

        {/* Version + language + theme toggle */}
        <div className="flex items-center justify-between">
          <p className="text-slate-600 text-xs">Finanzzwerg v0.3.0</p>
          <div className="flex items-center gap-1.5">
            {/* Dark/light toggle */}
            <button
              onClick={toggleTheme}
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              className="flex items-center rounded-md border border-slate-700 px-2 py-1 text-slate-400 hover:border-slate-500 hover:text-white transition-colors"
            >
              {theme === "dark" ? (
                <Sun className="w-3.5 h-3.5" />
              ) : (
                <Moon className="w-3.5 h-3.5" />
              )}
            </button>
            {/* Language toggle */}
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
        </div>
      </div>
    </aside>
  );
}
