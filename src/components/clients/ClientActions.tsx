import React, { useCallback, useRef, useState } from 'react';
import { Building2, History, Download, MessageSquare, BarChart2, Loader2 } from 'lucide-react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { Client } from '../../types/client';
import { CommentTooltip } from '../comments/CommentTooltip';
import { CommentModal } from '../modals/CommentModal';
import { useClientComments } from '../../hooks/useClientComments';
import { exportToExcel } from '../../services/excelExportService';
import { showErrorNotification } from '../../utils/notifications';
import { db } from '../../lib/firebase';
import { useCompanyContext } from '../../contexts/CompanyContext';
import { doc, getDoc } from 'firebase/firestore';
import {
  formatTransactionHistoryErrorForUser,
  getTransactionHistory
} from '../../services/transactionHistoryCategoryLookup';
import clsx from 'clsx';
import {
  FoundationEstimateData,
  ConsumablesEstimateData
} from '../../types/estimate';
import { exportTransactionsReport } from '../../utils/exportTransactionsReport';

interface EstimateItemData {
  name: string;
  unit?: string;
  quantity?: number;
  price?: number;
  total?: number;
}

interface EstimateSectionData {
  items?: EstimateItemData[];
  totalMaterialsCost?: number;
  totalCost?: number;
  [key: string]: unknown;
}

type FloorEstimateData = EstimateSectionData;
type PartitionEstimateData = EstimateSectionData;
type RoofEstimateData = EstimateSectionData;
type SipWallsEstimateData = EstimateSectionData;

interface ClientActionsProps {
  client: Client;
  size?: 'sm' | 'md';
  className?: string;
  stopPropagation?: boolean;
  allowWrap?: boolean;
}

const iconSizes = {
  sm: {
    button: 'p-0.5',
    icon: 'w-3.5 h-3.5'
  },
  md: {
    button: 'p-1.5',
    icon: 'w-4 h-4'
  }
} as const;

export const ClientActions: React.FC<ClientActionsProps> = ({
  client,
  size = 'md',
  className,
  stopPropagation = false,
  allowWrap = false
}) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const { companyId, loading: companyLoading } = useCompanyContext();
  const { comments, loading: commentsLoading } = useClientComments(client.id);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const sizing = iconSizes[size];

  /**
   * Какое из тяжёлых действий сейчас выполняется. Кнопка в этом состоянии
   * показывает спиннер вместо иконки и отключена — юзер сразу понимает,
   * что клик зарегистрирован, и не тапает по второму разу.
   */
  type LoadingAction =
    | 'project-history'
    | 'client-history'
    | 'export-estimate'
    | 'download-report'
    | null;
  const [loadingAction, setLoadingAction] = useState<LoadingAction>(null);

  /**
   * Pre-fetch: пока юзер ведёт курсор/палец к кнопке, в фоне запускаем
   * lookup categoryId. К моменту клика результат уже в localStorage-кеше
   * (см. PR #39), и navigate срабатывает мгновенно.
   * Защита от повторных запусков — Set по «scope».
   */
  const prefetchedScopesRef = useRef<Set<string>>(new Set());
  const prefetch = useCallback(
    (scope: 'client' | 'project') => {
      if (!client?.id || !companyId || companyLoading) return;
      const key = `${scope}:${client.id}`;
      if (prefetchedScopesRef.current.has(key)) return;
      prefetchedScopesRef.current.add(key);
      // Fire-and-forget — результат сохранится в localStorage внутри lookup.
      getTransactionHistory({ scope, companyId, client }).catch(() => {
        // Тихо — если упало, при настоящем клике увидим ошибку.
        prefetchedScopesRef.current.delete(key);
      });
    },
    [client, companyId, companyLoading],
  );

  const handleEvent = (event: React.MouseEvent) => {
    if (stopPropagation) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  const openTransactionHistory = async (scope: 'client' | 'project') => {
    if (!client?.id) {
      showErrorNotification('Не указан клиент');
      return;
    }
    if (companyLoading) {
      return;
    }
    if (!companyId) {
      showErrorNotification('Компания не загружена. Обновите страницу или войдите снова.');
      return;
    }

    if (import.meta.env.DEV) {
      console.info('[ClientActions] transaction history', {
        scope,
        route: { pathname: location.pathname, search: location.search },
        queryClientId: searchParams.get('clientId'),
        clientDocId: client.id,
        clientNumber: client.clientNumber,
        objectName: client.objectName,
        companyId
      });
    }

    try {
      const categoryId = await getTransactionHistory({
        scope,
        companyId,
        client
      });

      if (import.meta.env.DEV) {
        console.info('[ClientActions] transaction history result', {
          scope,
          categoryId,
          navigateTo: categoryId ? `/transactions/history/${categoryId}` : null
        });
      }

      if (!categoryId) {
        showErrorNotification(
          scope === 'project'
            ? 'История операций проекта недоступна'
            : 'История операций недоступна'
        );
        return;
      }

      navigate(`/transactions/history/${categoryId}`);
    } catch (error) {
      console.error('[ClientActions] transaction history failed', { scope, error });
      if (import.meta.env.DEV) {
        const code = error && typeof error === 'object' && 'code' in error ? String((error as { code: unknown }).code) : undefined;
        console.info('[ClientActions] transaction history error detail', {
          scope,
          code,
          message: error instanceof Error ? error.message : String(error)
        });
      }
      const prefix =
        scope === 'project'
          ? 'Не удалось открыть историю проекта'
          : 'Не удалось открыть историю клиента';
      const detail = formatTransactionHistoryErrorForUser(error, import.meta.env.DEV);
      showErrorNotification(import.meta.env.DEV ? `${prefix}: ${detail}` : `${prefix}. ${detail}`);
    }
  };

  const handleProjectHistoryClick = async () => {
    setLoadingAction('project-history');
    try {
      await openTransactionHistory('project');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleClientHistoryClick = async () => {
    setLoadingAction('client-history');
    try {
      await openTransactionHistory('client');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleExportEstimateClick = async () => {
    setLoadingAction('export-estimate');
    try {
      const [
        foundationDoc,
        sipWallsDoc,
        roofDoc,
        partitionDoc,
        consumablesDoc,
        floorDoc
      ] = await Promise.all([
        getDoc(doc(db, 'foundationEstimates', client.id)),
        getDoc(doc(db, 'sipWallsEstimates', client.id)),
        getDoc(doc(db, 'roofEstimates', client.id)),
        getDoc(doc(db, 'partitionEstimates', client.id)),
        getDoc(doc(db, 'consumablesEstimates', client.id)),
        getDoc(doc(db, 'floorEstimates', client.id))
      ]);

      exportToExcel({
        floor: floorDoc.exists() ? (floorDoc.data() as FloorEstimateData) : undefined,
        foundation: foundationDoc.exists() ? (foundationDoc.data() as FoundationEstimateData) : undefined,
        sipWalls: sipWallsDoc.exists() ? (sipWallsDoc.data() as SipWallsEstimateData) : undefined,
        roof: roofDoc.exists() ? (roofDoc.data() as RoofEstimateData) : undefined,
        partition: partitionDoc.exists() ? (partitionDoc.data() as PartitionEstimateData) : undefined,
        consumables: consumablesDoc.exists() ? (consumablesDoc.data() as ConsumablesEstimateData) : undefined
      }, client.objectName || 'Смета');
    } catch (error) {
      console.error('Error exporting estimate:', error);
      showErrorNotification('Не удалось экспортировать смету');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleDownloadReport = async () => {
    setLoadingAction('download-report');
    try {
      if (companyLoading || !companyId) {
        showErrorNotification('Компания не загружена. Обновите страницу.');
        return;
      }
      const categoryId = await getTransactionHistory({
        scope: 'client',
        companyId,
        client
      });
      if (!categoryId) {
        showErrorNotification('Нет данных для отчёта');
        return;
      }

      await exportTransactionsReport({
        categoryId,
        categoryTitle: client.objectName || `${client.lastName || ''} ${client.firstName || ''}`.trim(),
        client
      });
    } catch (error) {
      console.error('Error downloading report:', error);
      showErrorNotification('Не удалось скачать отчёт');
    } finally {
      setLoadingAction(null);
    }
  };

  /**
   * Обёртка для иконки-кнопки: показывает кастомный tooltip над кнопкой при
   * hover (мышь, S-Pen) и focus-within (клавиатура / стилус с фокусом).
   * Touch (обычный палец) НЕ триггерит — :hover не срабатывает на тач,
   * поэтому тап работает как обычно.
   */
  const IconTooltipWrap: React.FC<{ label: string; children: React.ReactNode }> = ({
    label,
    children,
  }) => (
    <span className="relative inline-block group">
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-50 whitespace-nowrap rounded-md bg-gray-900/95 px-2 py-1 text-[11px] font-medium text-white opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-150 shadow-lg"
      >
        {label}
      </span>
    </span>
  );

  return (
    <>
      <div
        className={clsx(
          'flex items-center gap-1',
          allowWrap ? 'flex-wrap' : 'flex-nowrap',
          className
        )}
      >
        <CommentTooltip comments={comments} loading={commentsLoading}>
          <button
            onClick={(event) => {
              handleEvent(event);
              setShowCommentModal(true);
            }}
            className={clsx(
              'relative rounded hover:bg-gray-100 transition-colors text-gray-500',
              sizing.button
            )}
            title="Комментарии"
          >
            <MessageSquare
              className={clsx(
                sizing.icon,
                comments.length > 0 ? 'comment-icon-active' : 'text-gray-500 hover:text-gray-700'
              )}
            />
          </button>
        </CommentTooltip>

        <IconTooltipWrap label="История транзакций проекта">
          <button
            onClick={(event) => {
              if (loadingAction) return;
              handleEvent(event);
              handleProjectHistoryClick();
            }}
            onMouseEnter={() => prefetch('project')}
            onTouchStart={() => prefetch('project')}
            disabled={loadingAction === 'project-history'}
            className={clsx(
              'text-gray-400 hover:text-gray-600 rounded transition-colors disabled:opacity-60',
              sizing.button
            )}
            title="История транзакций проекта"
          >
            {loadingAction === 'project-history' ? (
              <Loader2 className={clsx(sizing.icon, 'animate-spin text-emerald-600')} />
            ) : (
              <Building2 className={sizing.icon} />
            )}
          </button>
        </IconTooltipWrap>

        <IconTooltipWrap label="История транзакций клиента">
          <button
            onClick={(event) => {
              if (loadingAction) return;
              handleEvent(event);
              handleClientHistoryClick();
            }}
            onMouseEnter={() => prefetch('client')}
            onTouchStart={() => prefetch('client')}
            disabled={loadingAction === 'client-history'}
            className={clsx(
              'text-gray-400 hover:text-gray-600 rounded transition-colors disabled:opacity-60',
              sizing.button
            )}
            title="История транзакций клиента"
          >
            {loadingAction === 'client-history' ? (
              <Loader2 className={clsx(sizing.icon, 'animate-spin text-emerald-600')} />
            ) : (
              <History className={sizing.icon} />
            )}
          </button>
        </IconTooltipWrap>

        <IconTooltipWrap label="Экспорт смет в Excel">
          <button
            onClick={(event) => {
              if (loadingAction) return;
              handleEvent(event);
              handleExportEstimateClick();
            }}
            disabled={loadingAction === 'export-estimate'}
            className={clsx(
              'text-gray-400 hover:text-gray-600 rounded transition-colors disabled:opacity-60',
              sizing.button
            )}
            title="Экспорт смет в Excel"
          >
            {loadingAction === 'export-estimate' ? (
              <Loader2 className={clsx(sizing.icon, 'animate-spin text-emerald-600')} />
            ) : (
              <Download className={sizing.icon} />
            )}
          </button>
        </IconTooltipWrap>

        <IconTooltipWrap label="Скачать отчёт по транзакциям">
          <button
            onClick={(event) => {
              if (loadingAction) return;
              handleEvent(event);
              handleDownloadReport();
            }}
            onMouseEnter={() => prefetch('client')}
            onTouchStart={() => prefetch('client')}
            disabled={loadingAction === 'download-report'}
            className={clsx(
              'text-gray-400 hover:text-gray-600 rounded transition-colors disabled:opacity-60',
              sizing.button
            )}
            title="Скачать отчёт по транзакциям"
          >
            {loadingAction === 'download-report' ? (
              <Loader2 className={clsx(sizing.icon, 'animate-spin text-emerald-600')} />
            ) : (
              <BarChart2 className={sizing.icon} />
            )}
          </button>
        </IconTooltipWrap>
      </div>

      {showCommentModal && (
        <CommentModal
          isOpen={showCommentModal}
          onClose={() => setShowCommentModal(false)}
          clientId={client.id}
        />
      )}
    </>
  );
};


