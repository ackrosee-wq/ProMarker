import React, { useState, useEffect } from 'react';
import { ExternalLink, Globe, Download, Play } from 'lucide-react';
import { cepBridge } from '../../bridge/cep-bridge';

interface URLPreviewProps {
  url: string;
  className?: string;
}

interface PreviewData {
  title: string;
  description: string;
  favicon: string;
  thumbnail: string;
  type: 'page' | 'video' | 'image' | 'download';
}

const isVideoUrl = (url: string): boolean => {
  return /\.(mp4|webm|mov)$/i.test(url) ||
    /youtube\.com|vimeo\.com|youtu\.be/.test(url);
};

const isImageUrl = (url: string): boolean => {
  return /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(url);
};

const isDownloadUrl = (url: string): boolean => {
  return /\.(zip|rar|7z|tar|gz|dmg|exe|msi|pkg|pdf|doc|docx|xls|xlsx)$/i.test(url);
};

const getDomain = (url: string): string => {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return url;
  }
};

export const URLPreview: React.FC<URLPreviewProps> = ({ url, className = '' }) => {
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);

    const timer = setTimeout(() => {
      let type: PreviewData['type'] = 'page';
      if (isVideoUrl(url)) type = 'video';
      else if (isImageUrl(url)) type = 'image';
      else if (isDownloadUrl(url)) type = 'download';

      const domain = getDomain(url);

      setPreview({
        title: domain,
        description: url,
        favicon: `https://www.google.com/s2/favicons?domain=${domain}&sz=32`,
        thumbnail: '',
        type,
      });
      setLoading(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [url]);

  const openInBrowser = () => {
    cepBridge.openURL(url);
  };

  if (loading) {
    return (
      <div className={`bg-[#252525] rounded-lg p-2.5 animate-pulse ${className}`}>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-white/10" />
          <div className="flex-1">
            <div className="h-2.5 w-24 bg-white/10 rounded mb-1" />
            <div className="h-2 w-40 bg-white/[0.06] rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !preview) {
    return (
      <div className={`bg-[#252525] rounded-lg p-2.5 ${className}`}>
        <span className="text-[10px] text-[#d8d8d8]/40">Failed to load preview</span>
      </div>
    );
  }

  if (preview.type === 'image') {
    return (
      <div
        className={`bg-[#252525] rounded-lg overflow-hidden cursor-pointer hover:ring-1 hover:ring-[#5b9fd6]/30 transition-all ${className}`}
        onClick={openInBrowser}
      >
        <img
          src={url}
          alt="Preview"
          className="w-full h-24 object-cover"
          onError={() => setError(true)}
        />
        <div className="p-2 flex items-center justify-between">
          <span className="text-[10px] text-[#d8d8d8]/60 truncate">{getDomain(url)}</span>
          <ExternalLink size={10} className="text-[#d8d8d8]/40 shrink-0" />
        </div>
      </div>
    );
  }

  if (preview.type === 'video') {
    return (
      <div
        className={`bg-[#252525] rounded-lg overflow-hidden cursor-pointer hover:ring-1 hover:ring-[#5b9fd6]/30 transition-all ${className}`}
        onClick={openInBrowser}
      >
        <div className="relative w-full h-20 bg-black/30 flex items-center justify-center">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
            <Play size={14} className="text-white ml-0.5" />
          </div>
        </div>
        <div className="p-2 flex items-center gap-2">
          <img src={preview.favicon} alt="" className="w-3.5 h-3.5 rounded" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          <span className="text-[10px] text-[#d8d8d8] truncate flex-1">{preview.title}</span>
          <ExternalLink size={10} className="text-[#d8d8d8]/40 shrink-0" />
        </div>
      </div>
    );
  }

  if (preview.type === 'download') {
    return (
      <div
        className={`bg-[#252525] rounded-lg p-2.5 cursor-pointer hover:ring-1 hover:ring-[#5b9fd6]/30 transition-all ${className}`}
        onClick={openInBrowser}
      >
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-[#5b9fd6]/15 flex items-center justify-center shrink-0">
            <Download size={13} className="text-[#5b9fd6]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-[#d8d8d8] truncate">{url.split('/').pop()}</p>
            <p className="text-[9px] text-[#d8d8d8]/40 truncate">{getDomain(url)}</p>
          </div>
        </div>
      </div>
    );
  }

  // Default: page link
  return (
    <div
      className={`bg-[#252525] rounded-lg p-2.5 cursor-pointer hover:ring-1 hover:ring-[#5b9fd6]/30 transition-all ${className}`}
      onClick={openInBrowser}
    >
      <div className="flex items-center gap-2">
        <img
          src={preview.favicon}
          alt=""
          className="w-4 h-4 rounded shrink-0"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
            const parent = target.parentElement;
            if (parent) {
              const fallback = document.createElement('div');
              fallback.className = 'w-4 h-4 rounded bg-white/10 flex items-center justify-center shrink-0';
              parent.insertBefore(fallback, target);
            }
          }}
        />
        {/* Fallback icon when favicon fails */}
        <Globe size={14} className="text-[#d8d8d8]/30 shrink-0 hidden" />
        <div className="flex-1 min-w-0">
          <p className="text-[10px] text-[#d8d8d8] truncate">{preview.title}</p>
          <p className="text-[9px] text-[#d8d8d8]/40 truncate">{preview.description}</p>
        </div>
        <ExternalLink size={10} className="text-[#d8d8d8]/40 shrink-0" />
      </div>
    </div>
  );
};
