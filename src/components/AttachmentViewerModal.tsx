import React, { useCallback, useEffect, useState } from 'react';
import { X, Download, ExternalLink } from 'lucide-react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { isEditableTarget } from '../utils/isEditableTarget';

const IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];

function isImageType(type: string): boolean {
  if (!type) return false;
  const t = type.toLowerCase();
  return IMAGE_TYPES.some((m) => t.includes(m)) || /\.(jpe?g|png|webp|gif)$/i.test(t);
}

function isPdfType(type: string): boolean {
  if (!type) return false;
  const t = type.toLowerCase();
  return t.includes('pdf') || t.endsWith('.pdf');
}

export interface AttachmentViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  url: string;
  type?: string;
  name?: string;
}

async function downloadFile(url: string, fileName: string): Promise<void> {
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) throw new Error('Fetch failed');
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = fileName || 'receipt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  } catch {
    window.open(url, '_blank');
  }
}

/**
 * Полноэкранный просмотр прикреплённого чека: zoom/pan/pinch, скачать, открыть в новой вкладке.
 */
export const AttachmentViewerModal: React.FC<AttachmentViewerModalProps> = ({
  isOpen,
  onClose,
  url,
  type = '',
  name
}) => {
  const [downloadLoading, setDownloadLoading] = useState(false);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose]
  );

  const handleDownload = useCallback(async () => {
    if (!url) return;
    setDownloadLoading(true);
    try {
      const ext = name?.match(/\.[a-z0-9]+$/i)?.[0] || '.jpg';
      const fileName = name && /[.][a-z0-9]+$/i.test(name) ? name : `receipt-${Date.now()}${ext}`;
      await downloadFile(url, fileName);
    } finally {
      setDownloadLoading(false);
    }
  }, [url, name]);

  const handleOpenInNewTab = useCallback(() => {
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  }, [url]);

  useEffect(() => {
    if (!isOpen) return;
    document.body.classList.add('attachment-preview-open');
    window.dispatchEvent(new CustomEvent('attachment-preview-visibility-change'));
    const onKey = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.classList.remove('attachment-preview-open');
      window.dispatchEvent(new CustomEvent('attachment-preview-visibility-change'));
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isImage = isImageType(type) || (!type && /\.(jpe?g|png|webp|gif)$/i.test(url));
  const isPdf = isPdfType(type) || (!type && url.toLowerCase().endsWith('.pdf'));

  return (
    <div
      className="fixed inset-0 z-[2100] flex flex-col bg-black/85 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Просмотр чека"
    >
      {/* Верхняя панель: закрыть, скачать, открыть в новой вкладке */}
      <div
        className="fixed left-0 right-0 z-[2110] flex-shrink-0 flex items-center justify-between bg-black/50 text-white"
        style={{
          paddingTop: 'max(12px, env(safe-area-inset-top, 0px))',
          paddingLeft: 'max(12px, env(safe-area-inset-left, 0px))',
          paddingRight: 'max(12px, env(safe-area-inset-right, 0px))',
          paddingBottom: 10,
        }}
      >
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-full hover:bg-white/20 transition-colors"
          aria-label="Закрыть"
          data-testid="attachment-preview-close"
        >
          <X className="w-6 h-6" />
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloadLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/20 hover:bg-white/30 transition-colors text-sm font-medium disabled:opacity-50"
          >
            <Download className="w-5 h-5" />
            Скачать
          </button>
          <button
            type="button"
            onClick={handleOpenInNewTab}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/20 hover:bg-white/30 transition-colors text-sm font-medium"
          >
            <ExternalLink className="w-5 h-5" />
            Открыть полностью
          </button>
        </div>
      </div>

      {/* Контент: клик по затемнённой области закрывает */}
      <div
        className="flex-1 min-h-0 overflow-hidden flex items-center justify-center p-2 cursor-default"
        style={{
          paddingTop: 'calc(max(12px, env(safe-area-inset-top, 0px)) + 68px)',
          paddingBottom: 'max(12px, env(safe-area-inset-bottom, 0px))',
          paddingLeft: 'max(8px, env(safe-area-inset-left, 0px))',
          paddingRight: 'max(8px, env(safe-area-inset-right, 0px))',
        }}
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        {isImage && (
          <div className="w-full h-full flex items-center justify-center">
            <TransformWrapper
              initialScale={1}
              minScale={0.5}
              maxScale={5}
              centerOnInit
              doubleClick={{ mode: 'toggle', step: 1.5 }}
              wheel={{ step: 0.1 }}
              panning={{ velocityDisabled: false }}
            >
              <TransformComponent
                wrapperClass="!w-full !h-full flex items-center justify-center"
                contentClass="!max-w-full !max-h-[90vh] flex items-center justify-center"
              >
                <img
                  src={url}
                  alt={name || 'Чек'}
                  className="max-w-full max-h-[90vh] w-auto h-auto object-contain select-none"
                  draggable={false}
                  style={{ touchAction: 'none', pointerEvents: 'none' }}
                />
              </TransformComponent>
            </TransformWrapper>
          </div>
        )}
        {isPdf && !isImage && (
          <div className="w-full h-full flex flex-col">
            <iframe
              src={url}
              title={name || 'PDF'}
              className="flex-1 w-full min-h-0 border-0 rounded bg-white"
            />
          </div>
        )}
        {!isImage && !isPdf && (
          <div className="text-center py-12 text-white">
            <p className="mb-4">Предпросмотр недоступен</p>
            <button
              type="button"
              onClick={handleOpenInNewTab}
              className="px-4 py-2 rounded-lg bg-white/20 hover:bg-white/30 text-sm font-medium"
            >
              Открыть в новой вкладке
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
