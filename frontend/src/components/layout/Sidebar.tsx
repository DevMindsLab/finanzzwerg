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
  const { data: inboxCount = 0 } = useQuery({
    queryKey: ["inbox-count"],
    queryFn: transactionsApi.inboxCount,
    refetchInterval: 30_000,
  });

  const navItems: NavItem[] = [
    { label: "Dashboard",    to: "/dashboard",    icon: BarChart3 },
    { label: "Inbox",        to: "/inbox",        icon: Inbox, badge: inboxCount },
    { label: "Transactions", to: "/transactions", icon: List },
    { label: "Rules",        to: "/rules",        icon: Zap },
    { label: "Categories",   to: "/categories",   icon: Tag },
    { label: "Import",       to: "/import",       icon: Upload },
  ];

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
      <div className="p-4 border-t border-slate-800">
        <p className="text-slate-600 text-xs text-center">Financeless v0.1.0</p>
      </div>
    </aside>
  );
}
