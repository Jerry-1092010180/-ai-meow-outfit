import { type ReactNode, type ButtonHTMLAttributes } from 'react';
import { motion } from 'framer-motion';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: ReactNode;
  fullWidth?: boolean;
  disabled?: boolean;
}

const variantClasses: Record<string, string> = {
  primary:
    'bg-gradient-to-r from-pink-500 to-orange-400 text-white shadow-lg shadow-pink-500/25 hover:shadow-pink-500/40 active:scale-[0.97]',
  secondary:
    'bg-gray-100 text-gray-800 hover:bg-gray-200 active:scale-[0.97]',
  outline:
    'border-2 border-pink-400 text-pink-500 hover:bg-pink-50 active:scale-[0.97]',
  ghost:
    'text-gray-600 hover:bg-gray-100 active:scale-[0.97]',
};

const sizeClasses: Record<string, string> = {
  sm: 'px-3 py-1.5 text-xs rounded-lg gap-1.5',
  md: 'px-5 py-2.5 text-sm rounded-xl gap-2',
  lg: 'px-7 py-3.5 text-base rounded-2xl gap-2.5',
};

const spinnerSizes: Record<string, string> = {
  sm: 'w-3.5 h-3.5',
  md: 'w-4 h-4',
  lg: 'w-5 h-5',
};

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  fullWidth = false,
  disabled,
  className = '',
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <motion.button
      whileTap={isDisabled ? undefined : { scale: 0.97 }}
      disabled={isDisabled}
      className={`
        inline-flex items-center justify-center font-semibold
        transition-all duration-200 cursor-pointer select-none
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `.trim()}
      {...(rest as any)}
    >
      {loading ? (
        <svg
          className={`animate-spin ${spinnerSizes[size]}`}
          viewBox="0 0 24 24"
          fill="none"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      ) : icon ? (
        <span className="shrink-0">{icon}</span>
      ) : null}
      {children}
    </motion.button>
  );
}
