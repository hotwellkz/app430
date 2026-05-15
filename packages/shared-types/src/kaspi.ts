/**
 * Доменная модель модуля «Демпинг цен Kaspi» (kaspi-repricer).
 *
 * Архитектура хранения в Firestore:
 *   kaspiSettings/{companyId}
 *   kaspiProducts/{productId}
 *     ├── competitors/{snapshotId}        // subcollection
 *     └── priceHistory/{entryId}          // subcollection
 *   kaspiExcludedMerchants/{id}
 *   kaspiParseJobs/{jobId}
 *
 * Все документы привязаны к companyId (мультитенант). Запись — только из
 * Admin SDK (apps/api), фронт читает через REST.
 */

export type ISODateString = string;

/** Стратегия пересчёта цены (см. шаг 5). */
export type KaspiPricingStrategy =
  | 'undercut_by_step' // ниже минимума конкурента на step_tenge
  | 'match_lowest' // равно минимуму конкурента
  | 'hold_position_n' // встать на N-е место
  | 'rrc_match'; // фикс. РРЦ, конкуренты игнорируются

/** Параметры стратегии (jsonb). Поля используются в зависимости от strategy. */
export interface KaspiStrategyParam {
  /** Для hold_position_n: на каком месте удерживаться. */
  position?: number;
  /** Для rrc_match: рекомендованная розничная цена. */
  rrcPrice?: number;
}

/** Глобальные настройки магазина — один документ на компанию. */
export interface KaspiSettings {
  /** id документа = companyId */
  companyId: string;
  /** ID мерчанта в Kaspi (числовой, как строка). */
  kaspiMerchantId: string;
  /**
   * Зашифрованный AES-GCM JSON: { iv, tag, ciphertext } в base64.
   * Ключ шифрования — в .env (KASPI_TOKEN_ENCRYPTION_KEY, 32 байта base64).
   */
  kaspiApiTokenEncrypted: string | null;
  /** Случайная строка 32 hex — часть публичного URL XML-фида. */
  xmlEndpointSecret: string;
  /** Минимальный процент маржи (на будущее, для шага 5 как валидатор). */
  defaultMinMarginPercent: number;
  /** Интервал работы парсера в минутах. */
  parseIntervalMinutes: number;
  /** Когда Kaspi последний раз забирал XML (для алерта в шаге 7). */
  lastKaspiFetchAt: ISODateString | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

/** Товар, участвующий в автодемпинге. */
export interface KaspiProduct {
  id: string;
  companyId: string;
  /** SKU — уникален в пределах companyId. */
  sku: string;
  name: string;
  brand: string | null;
  /** Полный URL карточки на kaspi.kz/shop/p/... */
  kaspiProductUrl: string;
  /** slug из URL (часть после /shop/p/). */
  kaspiProductSlug: string;
  /** Идентификатор склада в Kaspi (TODO: вынести в отдельную сущность, если > 1). */
  kaspiStoreId: string | null;
  /** Текущая наша цена. Обновляется репрайсером (шаг 5). */
  currentPrice: number;
  minPrice: number;
  maxPrice: number;
  /** На сколько ниже конкурента ставить (для стратегии undercut_by_step). */
  stepTenge: number;
  strategy: KaspiPricingStrategy;
  strategyParam: KaspiStrategyParam;
  isActive: boolean;
  /** Наше место в списке продавцов карточки (1, 2, 3, ...). null если не определено. */
  ourPosition: number | null;
  lastParsedAt: ISODateString | null;
  lastRepricedAt: ISODateString | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

/** Снапшот цены одного конкурента в момент парсинга. */
export interface KaspiCompetitorSnapshot {
  id: string;
  /** parentId — productId, восстанавливается из пути коллекции, дублируется для query group. */
  productId: string;
  companyId: string;
  merchantName: string;
  merchantKaspiId: string;
  price: number;
  city: string | null;
  deliveryDays: number | null;
  rating: number | null;
  /** Помечается true, если merchantKaspiId есть в kaspiExcludedMerchants. */
  isExcluded: boolean;
  parsedAt: ISODateString;
}

/** Чёрный список магазинов-партнёров. */
export interface KaspiExcludedMerchant {
  id: string;
  companyId: string;
  merchantKaspiId: string;
  merchantName: string;
  reason: string | null;
  createdAt: ISODateString;
}

/** Запись об изменении нашей цены (триггерится репрайсером). */
export interface KaspiPriceHistoryEntry {
  id: string;
  productId: string;
  companyId: string;
  oldPrice: number;
  newPrice: number;
  /** Человекочитаемая причина: «Competitor X dropped to 950 → undercut to 949». */
  reason: string;
  triggeredByCompetitorId: string | null;
  createdAt: ISODateString;
}

export type KaspiParseJobStatus = 'pending' | 'running' | 'done' | 'failed';

/** Задача парсинга одной карточки товара. */
export interface KaspiParseJob {
  id: string;
  productId: string;
  companyId: string;
  status: KaspiParseJobStatus;
  attempts: number;
  lastError: string | null;
  scheduledAt: ISODateString;
  startedAt: ISODateString | null;
  finishedAt: ISODateString | null;
}

/** Имена коллекций Firestore — единое место правды. */
export const KASPI_COLLECTIONS = {
  settings: 'kaspiSettings',
  products: 'kaspiProducts',
  /** Subcollection под kaspiProducts/{id}. */
  competitors: 'competitors',
  /** Subcollection под kaspiProducts/{id}. */
  priceHistory: 'priceHistory',
  excludedMerchants: 'kaspiExcludedMerchants',
  parseJobs: 'kaspiParseJobs',
} as const;
