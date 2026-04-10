import React, { useState } from 'react';
import { Building2, History, Download, MessageSquare, BarChart2 } from 'lucide-react';
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
    await openTransactionHistory('project');
  };

  const handleClientHistoryClick = async () => {
    await openTransactionHistory('client');
  };

  const handleExportEstimateClick = async () => {
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
    }
  };

  const handleDownloadReport = async () => {
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
    }
  };

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

        <button
          onClick={(event) => {
            handleEvent(event);
            handleProjectHistoryClick();
          }}
          className={clsx(
            'text-gray-400 hover:text-gray-600 rounded transition-colors',
            sizing.button
          )}
          title="История транзакций проекта"
        >
          <Building2 className={sizing.icon} />
        </button>

        <button
          onClick={(event) => {
            handleEvent(event);
            handleClientHistoryClick();
          }}
          className={clsx(
            'text-gray-400 hover:text-gray-600 rounded transition-colors',
            sizing.button
          )}
          title="История транзакций клиента"
        >
          <History className={sizing.icon} />
        </button>

        <button
          onClick={(event) => {
            handleEvent(event);
            handleExportEstimateClick();
          }}
          className={clsx(
            'text-gray-400 hover:text-gray-600 rounded transition-colors',
            sizing.button
          )}
          title="Экспорт смет в Excel"
        >
          <Download className={sizing.icon} />
        </button>

        <button
          onClick={(event) => {
            handleEvent(event);
            handleDownloadReport();
          }}
          className={clsx(
            'text-gray-400 hover:text-gray-600 rounded transition-colors',
            sizing.button
          )}
          title="Скачать отчёт по транзакциям"
        >
          <BarChart2 className={sizing.icon} />
        </button>
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


