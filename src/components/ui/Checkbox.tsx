import React from 'react';
import { Check } from 'lucide-react';

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  size?: 'sm' | 'md';
  className?: string;
}

const sizeMap = {
  sm: { box: 'w-3.5 h-3.5', icon: 9, radius: 'rounded-[3px]' },
  md: { box: 'w-4 h-4', icon: 11, radius: 'rounded-[4px]' },
};

export const Checkbox: React.FC<CheckboxProps> = ({
  checked,
  onChange,
  size = 'md',
  className = '',
}) => {
  const { box, icon, radius } = sizeMap[size];

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
        flex items-center justify-center shrink-0 border transition-[background,border-color] duration-100
        ${box} ${radius}
        ${checked
          ? 'bg-[#4a9eff] border-[#4a9eff]'
          : 'bg-transparent border-[#555] hover:border-[#888]'
        }
        ${className}
      `}
    >
      {checked && <Check size={icon} className="text-white" strokeWidth={3} />}
    </button>
  );
};
