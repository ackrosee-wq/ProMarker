import React from 'react';
import { ListChecks, Paintbrush, Settings, RefreshCw } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { useAppStore } from '../store/app-store';
import { useMarkerStore } from '../store/marker-store';
import { Tooltip } from './ui/Tooltip';
import type { NavView } from '../types';

interface NavItem {
  view: NavView;
  label: string;
  icon: LucideIcon;
}

const navItems: NavItem[] = [
  { view: 'markers', label: 'Markers', icon: ListChecks },
  { view: 'ideaboard', label: 'Idea Board', icon: Paintbrush },
  { view: 'settings', label: 'Settings', icon: Settings },
];

export const NavBar: React.FC = () => {
  const currentView = useAppStore((s) => s.currentView);
  const setView = useAppStore((s) => s.setView);
  const forceReload = useMarkerStore((s) => s.forceReload);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#1e1e1e] border-t border-white/[0.08]">
      <div className="flex items-center justify-between px-2 py-1.5">
        <div className="flex items-center gap-1 flex-1 justify-center">
          {navItems.map((item) => {
            const isActive = currentView === item.view;
            const Icon = item.icon;
            return (
              <button
                key={item.view}
                onClick={() => setView(item.view)}
                className={`
                  relative flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-xl transition-colors duration-150
                  ${isActive ? 'text-[#5b9fd6]' : 'text-[#d8d8d8]/60 hover:text-[#d8d8d8]/80'}
                `}
              >
                <Icon size={18} />
                <span className="text-[9px] font-medium leading-none">{item.label}</span>
                {isActive && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-5 h-[2px] rounded-full bg-[#5b9fd6]"
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}
              </button>
            );
          })}
        </div>
        <Tooltip content="Force Reload">
          <button
            onClick={forceReload}
            className="flex items-center justify-center w-7 h-7 rounded-lg text-[#d8d8d8]/50 hover:text-[#d8d8d8] hover:bg-white/[0.06] transition-colors duration-150 mr-1"
          >
            <RefreshCw size={14} />
          </button>
        </Tooltip>
      </div>
    </div>
  );
};
