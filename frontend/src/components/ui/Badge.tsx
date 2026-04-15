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
  default: "bg-slate-100 text-slate-700",
  success: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-50 text-amber-700",
  danger:  "bg-rose-50 text-rose-700",
  info:    "bg-sky-50 text-sky-700",
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
