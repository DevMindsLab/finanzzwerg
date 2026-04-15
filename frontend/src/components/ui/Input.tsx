import { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
  label?: string;
  error?: string;
  hint?: string;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, prefix, suffix, className, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-slate-700">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {prefix && (
            <span className="absolute left-3 text-slate-400 pointer-events-none">{prefix}</span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900",
              "placeholder:text-slate-400",
              "focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500",
              "disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed",
              error && "border-rose-400 focus:border-rose-400 focus:ring-rose-400",
              prefix ? "pl-9" : undefined,
              suffix ? "pr-9" : undefined,
              className,
            )}
            {...props}
          />
          {suffix && (
            <span className="absolute right-3 text-slate-400 pointer-events-none">{suffix}</span>
          )}
        </div>
        {error && <p className="text-xs text-rose-600">{error}</p>}
        {hint && !error && <p className="text-xs text-slate-500">{hint}</p>}
      </div>
    );
  },
);

Input.displayName = "Input";
export default Input;
