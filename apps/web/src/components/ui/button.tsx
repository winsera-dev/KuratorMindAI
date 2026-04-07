import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link' | 'forensic';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    const variantStyles = {
      default: "bg-accent-blue text-white shadow-lg shadow-accent-blue/20 hover:bg-accent-blue-hover hover:shadow-glow-blue",
      destructive: "bg-accent-rose text-white shadow-lg shadow-accent-rose/20 hover:bg-red-600 hover:shadow-glow-rose",
      outline: "border border-border-default bg-transparent hover:bg-secondary/50 hover:border-border-accent/30 text-text-primary",
      secondary: "bg-secondary text-text-primary border border-border-subtle hover:bg-tertiary/50 hover:border-border-default",
      ghost: "hover:bg-accent-blue/10 hover:text-accent-blue text-text-muted",
      link: "text-accent-blue underline-offset-4 hover:underline",
      forensic: "bg-card/80 backdrop-blur-md border border-border-accent/40 text-accent-blue shadow-glow-blue hover:bg-card hover:border-border-accent transition-all",
    };

    const sizeStyles = {
      default: "h-11 px-6 py-2.5",
      sm: "h-9 px-4 text-xs",
      lg: "h-14 px-10 text-base",
      icon: "h-11 w-11",
    };

    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue/50 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button };
