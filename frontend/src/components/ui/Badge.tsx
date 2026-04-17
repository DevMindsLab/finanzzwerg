import { cn } from "@/lib/utils";

type Variant = "default" | "success" | "warning" | "danger" | "info";

interface BadgeProps {
  children: React.ReactNode;
  variant?: Variant;
  className?: string;
  /** Render a coloured dot swatch instead of text */
  dot?: boolean;
  dotColor?: string;
}

const variantClasses: Record<Variant, string> = {
  default: "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
  success: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  warning: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  danger:  "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-400",
  info:    "bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-400",
};

export default function Badge({ children, variant = "default", className, dot, dotColor }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        variantClasses[variant],
        className,
      )}
    >
      {dot && (
        <span
          className="inline-block w-2 h-2 rounded-full shrink-0"
          style={dotColor ? { backgroundColor: dotColor } : undefined}
        />
      )}
      {children}
    </span>
  );
}
