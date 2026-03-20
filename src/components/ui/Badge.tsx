import React from 'react';

type BadgeVariant = 'default' | 'accent' | 'success' | 'warning';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-white/10 text-[#d8d8d8]',
  accent: 'bg-[#5b9fd6]/20 text-[#5b9fd6]',
  success: 'bg-green-500/20 text-green-400',
  warning: 'bg-yellow-500/20 text-yellow-400',
};

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  className = '',
}) => {
  return (
    <span
      className={`inline-flex items-center text-[9px] font-medium px-1.5 py-0.5 rounded-full leading-none ${variantStyles[variant]} ${className}`}
    >
      {children}
    </span>
  );
};
