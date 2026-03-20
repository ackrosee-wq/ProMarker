import React, { useState, useRef, useCallback } from 'react';
import {
  Plus,
  Image,
  Video,
  Link,
  FileText,
  Box,
  Trash2,
  ChevronDown,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Badge } from '../ui/Badge';
import { URLPreview } from './URLPreview';
import { ModelViewer } from './ModelViewer';
import type { Attachment } from '../../types';
import { v4 as uuid } from 'uuid';
import { useMarkerStore } from '../../store/marker-store';

interface AttachmentPanelProps {
  markerId: string;
  attachments: Attachment[];
}

const typeIcons: Record<Attachment['type'], LucideIcon> = {
  image: Image,
  video: Video,
  url: Link,
  file: FileText,
  '3d-model': Box,
};

const typeBadgeVariant: Record<Attachment['type'], 'default' | 'accent' | 'success' | 'warning'> = {
  image: 'accent',
  video: 'warning',
  url: 'success',
  file: 'default',
  '3d-model': 'accent',
};

const typeLabels: Record<Attachment['type'], string> = {
  image: 'Image',
  video: 'Video',
  url: 'URL',
  file: 'File',
  '3d-model': '3D Model',
};

interface AddMenuOption {
  type: Attachment['type'];
  label: string;
  icon: LucideIcon;
}

const addMenuOptions: AddMenuOption[] = [
  { type: 'image', label: 'Image', icon: Image },
  { type: 'video', label: 'Video', icon: Video },
  { type: 'url', label: 'URL', icon: Link },
  { type: 'file', label: 'File', icon: FileText },
  { type: '3d-model', label: '3D Model', icon: Box },
];

export const AttachmentPanel: React.FC<AttachmentPanelProps> = ({
  markerId,
  attachments,
}) => {
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingTypeRef = useRef<Attachment['type']>('file');
  const updateMarker = useMarkerStore((s) => s.updateMarker);

  const addAttachment = useCallback(
    (type: Attachment['type'], name: string, path: string) => {
      const newAttachment: Attachment = {
        id: uuid(),
        type,
        name,
        path,
        thumbnail: type === 'image' ? path : undefined,
      };
      const marker = useMarkerStore.getState().markers.find((m) => m.id === markerId);
      if (marker) {
        updateMarker(markerId, {
          attachments: [...marker.attachments, newAttachment],
        });
      }
    },
    [markerId, updateMarker]
  );

  const removeAttachment = useCallback(
    (attachmentId: string) => {
      const marker = useMarkerStore.getState().markers.find((m) => m.id === markerId);
      if (marker) {
        updateMarker(markerId, {
          attachments: marker.attachments.filter((a) => a.id !== attachmentId),
        });
      }
    },
    [markerId, updateMarker]
  );

  const handleAddClick = (type: Attachment['type']) => {
    setShowAddMenu(false);
    if (type === 'url') {
      const url = prompt('Enter URL:');
      if (url) {
        addAttachment('url', url, url);
      }
    } else {
      pendingTypeRef.current = type;
      fileInputRef.current?.click();
    }
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      addAttachment(pendingTypeRef.current, file.name, (file as unknown as { path?: string }).path || file.name);
    }
    e.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);

    const files = e.dataTransfer.files;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      let type: Attachment['type'] = 'file';
      if (file.type.startsWith('image/')) type = 'image';
      else if (file.type.startsWith('video/')) type = 'video';
      addAttachment(type, file.name, (file as unknown as { path?: string }).path || file.name);
    }
  };

  const handleAttachmentClick = (att: Attachment) => {
    if (att.type === 'url' || att.type === 'image' || att.type === '3d-model') {
      setPreviewId(previewId === att.id ? null : att.id);
    }
  };

  return (
    <div
      className={`mt-2 ${dragOver ? 'ring-1 ring-[#5b9fd6]/40 rounded-lg' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileSelected}
        className="hidden"
      />

      {/* Header */}
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[9px] font-semibold text-[#d8d8d8]/50 uppercase tracking-wider">
          Attachments ({attachments.length})
        </span>
        <div className="relative">
          <button
            onClick={() => setShowAddMenu(!showAddMenu)}
            className="flex items-center gap-0.5 text-[10px] text-[#5b9fd6] hover:text-[#5b9fd6]/80 transition-colors"
          >
            <Plus size={12} />
            Add
            <ChevronDown size={10} className={`transition-transform ${showAddMenu ? 'rotate-180' : ''}`} />
          </button>

          <AnimatePresence>
            {showAddMenu && (
              <motion.div
                initial={{ opacity: 0, y: -4, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.95 }}
                transition={{ duration: 0.12 }}
                className="absolute right-0 top-full mt-1 bg-[#2a2a2a] rounded-lg border border-white/[0.08] shadow-xl z-20 py-1 min-w-[120px]"
              >
                {addMenuOptions.map((opt) => {
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.type}
                      onClick={() => handleAddClick(opt.type)}
                      className="flex items-center gap-2 w-full px-2.5 py-1.5 text-[10px] text-[#d8d8d8] hover:bg-white/[0.06] transition-colors"
                    >
                      <Icon size={12} className="text-[#d8d8d8]/50" />
                      {opt.label}
                    </button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Attachment Grid */}
      {attachments.length === 0 ? (
        <div className="text-center py-4 text-[10px] text-[#d8d8d8]/30">
          {dragOver ? 'Drop files here' : 'No attachments yet. Drag files here or click Add.'}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-1.5">
          <AnimatePresence>
            {attachments.map((att) => {
              const Icon = typeIcons[att.type];
              const isHovered = hoveredId === att.id;
              const isPreview = previewId === att.id;

              return (
                <motion.div
                  key={att.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.15 }}
                  className="col-span-1"
                >
                  <div
                    className={`relative bg-[#1e1e1e] rounded-lg overflow-hidden cursor-pointer hover:ring-1 hover:ring-white/10 transition-all ${
                      isPreview ? 'col-span-2' : ''
                    }`}
                    onMouseEnter={() => setHoveredId(att.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    onClick={() => handleAttachmentClick(att)}
                  >
                    {/* Thumbnail / Icon area */}
                    {att.type === 'image' && att.thumbnail ? (
                      <div className="w-full h-16 bg-black/20">
                        <img
                          src={att.thumbnail}
                          alt={att.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-full h-14 flex items-center justify-center bg-white/[0.03]">
                        <Icon size={20} className="text-[#d8d8d8]/20" />
                      </div>
                    )}

                    {/* Info */}
                    <div className="p-1.5">
                      <p className="text-[9px] text-[#d8d8d8] truncate leading-tight">{att.name}</p>
                      <Badge variant={typeBadgeVariant[att.type]} className="mt-0.5">
                        {typeLabels[att.type]}
                      </Badge>
                    </div>

                    {/* Delete button on hover */}
                    <AnimatePresence>
                      {isHovered && (
                        <motion.button
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.1 }}
                          className="absolute top-1 right-1 w-5 h-5 rounded-md bg-black/60 flex items-center justify-center hover:bg-red-500/80 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeAttachment(att.id);
                          }}
                        >
                          <Trash2 size={10} className="text-white" />
                        </motion.button>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Inline preview */}
                  <AnimatePresence>
                    {isPreview && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden mt-1"
                      >
                        {att.type === 'url' && <URLPreview url={att.path} />}
                        {att.type === '3d-model' && <ModelViewer src={att.path} />}
                        {att.type === 'image' && (
                          <img
                            src={att.path}
                            alt={att.name}
                            className="w-full rounded-lg"
                          />
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};
