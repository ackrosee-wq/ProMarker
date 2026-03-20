import React from 'react';
import { Check } from 'lucide-react';

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  size?: 'sm' | 'md';
  className?: string;
}

const sizeMap = {
  sm: { box: 'w-3.5 h-3.5', icon: 10 },
  md: { box: 'w-4.5 h-4.5', icon: 13 },
};

export const Checkbox: React.FC<CheckboxProps> = ({
  checked,
  onChange,
  size = 'md',
  className = '',
}) => {
  const { box, icon } = sizeMap[size];

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
      className={`
        flex items-center justify-center shrink-0 rounded-[4px] border transition-all duration-150
        ${box}
        ${
          checked
            ? 'bg-[#5b9fd6] border-[#5b9fd6]'
            : 'bg-transparent border-white/25 hover:border-white/40'
        }
        ${className}
      `}
    >
      {checked && <Check size={icon} className="text-white" strokeWidth={3} />}
    </button>
  );
};
