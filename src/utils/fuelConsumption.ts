/**
 * Расчёт расхода топлива (л/100 км) для заправок в ленте / переводах.
 * Предыдущая заправка — транзакция той же машины с наибольшим пробегом строго меньше текущего.
 */

export const FuelDerivationReason = {
  OK: 'OK',
  INVALID_CURRENT_ODOMETER: 'INVALID_ODOMETER',
  INVALID_CURRENT_LITERS: 'INVALID_LITERS',
  EMPTY_VEHICLE_KEY: 'VEHICLE_KEY_MISMATCH',
  NO_PREVIOUS: 'NO_PREVIOUS_FUEL_RECORD',
  NON_POSITIVE_DISTANCE: 'NON_POSITIVE_DISTANCE'
} as const;

export type FuelDerivationReasonCode = (typeof FuelDerivationReason)[keyof typeof FuelDerivationReason];

export interface FuelDataLike {
  vehicleId?: string;
  vehicleName?: string;
  odometerKm?: unknown;
  liters?: unknown;
}

export interface DerivedFuelStatsShape {
  previousFuelTransactionId?: string | null;
  previousOdometerKm?: number | null;
  distanceSincePrevFuelingKm?: number | null;
  estimatedConsumptionLPer100?: number | null;
  status: 'normal' | 'warning' | 'critical' | 'insufficient_data';
  note?: string | null;
}

const FUEL_CONSUMPTION_NORMAL_MAX = 14.5;
const FUEL_CONSUMPTION_WARNING_MAX = 15.5;

/** Стабильный ключ машины: приоритет vehicleId, иначе нормализованное имя. */
export function vehicleIdentityKeyFromFuel(f: FuelDataLike): string | null {
  const id = typeof f.vehicleId === 'string' ? f.vehicleId.trim() : '';
  if (id) return `id:${id}`;
  const name = typeof f.vehicleName === 'string' ? f.vehicleName.trim().toLowerCase().replace(/\s+/g, ' ') : '';
  if (name) return `name:${name}`;
  return null;
}

export function sameVehicleFuel(a: FuelDataLike, b: FuelDataLike): boolean {
  const ka = vehicleIdentityKeyFromFuel(a);
  const kb = vehicleIdentityKeyFromFuel(b);
  return ka != null && ka === kb;
}

/**
 * Парсит число для пробега/литров/цены из числа или строки (пробелы, км, л, ₸, запятая).
 */
export function parseFuelScalar(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== 'string') return null;
  let s = raw.replace(/\u00a0/g, ' ').trim();
  s = s.replace(/км|л\/100|л\.?|₸|₽|руб/gi, '');
  s = s.replace(/\s/g, '');
  if (s.includes(',') && s.includes('.')) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (s.includes(',')) {
    const parts = s.split(',');
    if (parts.length === 2 && parts[1].length <= 3 && /^\d+$/.test(parts[0].replace(/\./g, ''))) {
      s = parts[0].replace(/\./g, '') + '.' + parts[1];
    } else {
      s = s.replace(/,/g, '');
    }
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

function isFuelExpenseDoc(data: Record<string, unknown>): boolean {
  if (data.type !== 'expense') return false;
  if (data.status === 'cancelled') return false;
  if (data.editType === 'reversal') return false;
  if (data.fuelData == null || typeof data.fuelData !== 'object') return false;
  return true;
}

function isAcceptableStatusForPrevious(data: Record<string, unknown>): boolean {
  const st = data.status as string | undefined;
  if (st === 'rejected') return false;
  return st === 'approved' || st === 'pending' || st === undefined;
}

/**
 * По уже загруженным документам транзакций ищет предыдущую заправку и считает л/100 км.
 */
export function buildDerivedFuelStatsFromExpenseDocuments(
  currentFuel: FuelDataLike,
  documents: Array<{ id: string; data: Record<string, unknown> }>,
  excludeIds: Set<string>
): { stats: DerivedFuelStatsShape; reason: FuelDerivationReasonCode; debug?: Record<string, unknown> } {
  const currentOdo = parseFuelScalar(currentFuel.odometerKm);
  const liters = parseFuelScalar(currentFuel.liters);

  if (currentOdo == null) {
    return {
      stats: {
        previousFuelTransactionId: null,
        previousOdometerKm: null,
        distanceSincePrevFuelingKm: null,
        estimatedConsumptionLPer100: null,
        status: 'insufficient_data',
        note: 'Не удалось определить пробег для расчёта'
      },
      reason: FuelDerivationReason.INVALID_CURRENT_ODOMETER
    };
  }

  if (liters == null || liters <= 0) {
    return {
      stats: {
        previousFuelTransactionId: null,
        previousOdometerKm: null,
        distanceSincePrevFuelingKm: null,
        estimatedConsumptionLPer100: null,
        status: 'insufficient_data',
        note: 'Не указаны литры для расчёта расхода'
      },
      reason: FuelDerivationReason.INVALID_CURRENT_LITERS
    };
  }

  const vehicleKey = vehicleIdentityKeyFromFuel(currentFuel);
  if (!vehicleKey) {
    return {
      stats: {
        previousFuelTransactionId: null,
        previousOdometerKm: null,
        distanceSincePrevFuelingKm: null,
        estimatedConsumptionLPer100: null,
        status: 'insufficient_data',
        note: 'Не указана машина (id или название)'
      },
      reason: FuelDerivationReason.EMPTY_VEHICLE_KEY
    };
  }

  let best: { id: string; odo: number } | null = null;
  const skipped: Array<{ id: string; why: string }> = [];

  for (const { id, data } of documents) {
    if (excludeIds.has(id)) continue;
    if (!isFuelExpenseDoc(data)) continue;
    if (!isAcceptableStatusForPrevious(data)) {
      skipped.push({ id, why: 'status' });
      continue;
    }
    const fd = data.fuelData as FuelDataLike;
    if (!sameVehicleFuel(fd, currentFuel)) {
      continue;
    }
    const prevOdo = parseFuelScalar(fd.odometerKm);
    if (prevOdo == null) {
      skipped.push({ id, why: 'no_odometer' });
      continue;
    }
    if (prevOdo >= currentOdo) {
      skipped.push({ id, why: 'odometer_not_before' });
      continue;
    }
    if (!best || prevOdo > best.odo) {
      best = { id, odo: prevOdo };
    }
  }

  if (!best) {
    return {
      stats: {
        previousFuelTransactionId: null,
        previousOdometerKm: null,
        distanceSincePrevFuelingKm: null,
        estimatedConsumptionLPer100: null,
        status: 'insufficient_data',
        note: 'Нет предыдущей заправки с меньшим пробегом по этой машине'
      },
      reason: FuelDerivationReason.NO_PREVIOUS,
      debug: { skippedSample: skipped.slice(0, 8), scanned: documents.length }
    };
  }

  const distance = currentOdo - best.odo;
  if (!Number.isFinite(distance) || distance <= 0) {
    return {
      stats: {
        previousFuelTransactionId: best.id,
        previousOdometerKm: best.odo,
        distanceSincePrevFuelingKm: null,
        estimatedConsumptionLPer100: null,
        status: 'insufficient_data',
        note: 'Пробег не увеличился относительно предыдущей заправки'
      },
      reason: FuelDerivationReason.NON_POSITIVE_DISTANCE
    };
  }

  const distanceRounded = Math.round(distance * 10) / 10;
  const consumptionRaw = (liters / distance) * 100;
  const consumption = Math.round(consumptionRaw * 10) / 10;

  let status: 'normal' | 'warning' | 'critical';
  if (consumption <= FUEL_CONSUMPTION_NORMAL_MAX) status = 'normal';
  else if (consumption <= FUEL_CONSUMPTION_WARNING_MAX) status = 'warning';
  else status = 'critical';

  return {
    stats: {
      previousFuelTransactionId: best.id,
      previousOdometerKm: best.odo,
      distanceSincePrevFuelingKm: distanceRounded,
      estimatedConsumptionLPer100: consumption,
      status,
      note: null
    },
    reason: FuelDerivationReason.OK,
    debug: { previousId: best.id, skippedCount: skipped.length }
  };
}
