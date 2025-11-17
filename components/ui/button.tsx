import { cn } from "../utils/cn";
import { cva } from "class-variance-authority";

const styles = cva(
  "inline-flex items-center justify-center rounded-md text-sm font-medium transition disabled:opacity-50 disabled:pointer-events-none",
  {
    variants: {
      variant: {
        default: "bg-slate-900 text-white hover:bg-black",
        outline: "border border-slate-300 bg-white hover:bg-slate-50"
      },
      size: {
        default: "h-9 px-4",
        sm: "h-8 px-3",
        lg: "h-10 px-6"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);

export function Button({ className, variant, size, ...props }: any) {
  return (
    <button className={cn(styles({ variant, size }), className)} {...props} />
  );
}
