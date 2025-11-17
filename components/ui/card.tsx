import { cn } from "../utils/cn";

export function Card({ className, ...props }: any) {
  return (
    <div
      className={cn("bg-white border border-slate-200 rounded-xl shadow-card p-5", className)}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: any) {
  return (
    <div className={cn("mb-3 flex items-center justify-between", className)} {...props} />
  );
}

export function CardTitle({ className, ...props }: any) {
  return (
    <h2 className={cn("text-sm font-semibold text-slate-900 uppercase tracking-wide", className)} {...props} />
  );
}

export function CardContent({ className, ...props }: any) {
  return (
    <div className={cn("space-y-3", className)} {...props} />
  );
}
