import React, { useEffect, useRef } from 'react';
import {
  Scissors,
  Copy,
  ClipboardPaste,
  CopyPlus,
  Trash2,
  Lock,
  Unlock,
  ArrowUpToLine,
  ArrowDownToLine,
  StickyNote,
  Image,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { motion } from 'motion/react';

interface ContextMenuProps {
  x: number;
  y: number;
  hasSelection: boolean;
  isLocked: boolean;
  onClose: () => void;
  onCut: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onToggleLock: () => void;
  onBringToFront: () => void;
  onSendToBack: () => void;
  onAddStickyNote: () => void;
  onAddImage: () => void;
}

interface MenuItemDef {
  type: 'item' | 'separator';
  label?: string;
  icon?: LucideIcon;
  shortcut?: string;
  action?: () => void;
  disabled?: boolean;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  x,
  y,
  hasSelection,
  isLocked,
  onClose,
  onCut,
  onCopy,
  onPaste,
  onDuplicate,
  onDelete,
  onToggleLock,
  onBringToFront,
  onSendToBack,
  onAddStickyNote,
  onAddImage,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  // Adjust position so menu stays in viewport
  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const viewW = window.innerWidth;
      const viewH = window.innerHeight;
      if (rect.right > viewW) {
        menuRef.current.style.left = `${x - rect.width}px`;
      }
      if (rect.bottom > viewH) {
        menuRef.current.style.top = `${y - rect.height}px`;
      }
    }
  }, [x, y]);

  const items: MenuItemDef[] = [
    { type: 'item', label: 'Cut', icon: Scissors, shortcut: 'Ctrl+X', action: onCut, disabled: !hasSelection },
    { type: 'item', label: 'Copy', icon: Copy, shortcut: 'Ctrl+C', action: onCopy, disabled: !hasSelection },
    { type: 'item', label: 'Paste', icon: ClipboardPaste, shortcut: 'Ctrl+V', action: onPaste },
    { type: 'item', label: 'Duplicate', icon: CopyPlus, shortcut: 'Ctrl+D', action: onDuplicate, disabled: !hasSelection },
    { type: 'item', label: 'Delete', icon: Trash2, shortcut: 'Del', action: onDelete, disabled: !hasSelection },
    { type: 'separator' },
    {
      type: 'item',
      label: isLocked ? 'Unlock' : 'Lock',
      icon: isLocked ? Unlock : Lock,
      shortcut: 'Ctrl+L',
      action: onToggleLock,
      disabled: !hasSelection,
    },
    { type: 'item', label: 'Bring to Front', icon: ArrowUpToLine, action: onBringToFront, disabled: !hasSelection },
    { type: 'item', label: 'Send to Back', icon: ArrowDownToLine, action: onSendToBack, disabled: !hasSelection },
    { type: 'separator' },
    { type: 'item', label: 'Add Sticky Note', icon: StickyNote, action: onAddStickyNote },
    { type: 'item', label: 'Add Image', icon: Image, action: onAddImage },
  ];

  return (
    <motion.div
      ref={menuRef}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.1 }}
      className="fixed z-[100] bg-[#2a2a2a] border border-white/[0.1] rounded-lg shadow-2xl py-1 min-w-[180px]"
      style={{ left: x, top: y }}
    >
      {items.map((item, i) => {
        if (item.type === 'separator') {
          return (
            <div key={`sep-${i}`} className="my-1 border-t border-white/[0.06]" />
          );
        }
        const Icon = item.icon!;
        return (
          <button
            key={item.label}
            onClick={() => {
              if (!item.disabled) {
                item.action?.();
                onClose();
              }
            }}
            disabled={item.disabled}
            className={`
              flex items-center gap-2 w-full px-3 py-1.5 text-left transition-colors
              ${
                item.disabled
                  ? 'text-[#d8d8d8]/20 cursor-not-allowed'
                  : 'text-[#d8d8d8] hover:bg-white/[0.06]'
              }
            `}
          >
            <Icon size={13} className={item.disabled ? 'opacity-30' : 'opacity-60'} />
            <span className="flex-1 text-[10px]">{item.label}</span>
            {item.shortcut && (
              <span className="text-[9px] text-[#d8d8d8]/25 ml-4">{item.shortcut}</span>
            )}
          </button>
        );
      })}
    </motion.div>
  );
};
