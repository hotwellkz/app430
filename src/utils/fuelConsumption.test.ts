import { describe, it, expect } from 'vitest';
import {
  parseFuelScalar,
  vehicleIdentityKeyFromFuel,
  buildDerivedFuelStatsFromExpenseDocuments
} from './fuelConsumption';

describe('parseFuelScalar', () => {
  it('parses plain numbers', () => {
    expect(parseFuelScalar(125430)).toBe(125430);
    expect(parseFuelScalar(45.2)).toBe(45.2);
  });
  it('parses strings with comma decimal', () => {
    expect(parseFuelScalar('123,45')).toBeCloseTo(123.45);
  });
  it('strips units and spaces', () => {
    expect(parseFuelScalar('125 430 км')).toBe(125430);
    expect(parseFuelScalar('45,2 л')).toBeCloseTo(45.2);
  });
});

describe('vehicleIdentityKeyFromFuel', () => {
  it('prefers vehicleId', () => {
    expect(vehicleIdentityKeyFromFuel({ vehicleId: 'abc', vehicleName: 'X' })).toBe('id:abc');
  });
  it('normalizes name', () => {
    expect(vehicleIdentityKeyFromFuel({ vehicleName: '  Sprinter  2  ' })).toBe('name:sprinter 2');
  });
});

describe('buildDerivedFuelStatsFromExpenseDocuments', () => {
  const baseDoc = (id: string, odo: number, vehicleId = 'v1') => ({
    id,
    data: {
      type: 'expense',
      status: 'approved',
      fuelData: {
        vehicleId,
        vehicleName: 'Car',
        odometerKm: odo,
        liters: 40
      }
    } as Record<string, unknown>
  });

  it('finds previous by max odometer below current', () => {
    const docs = [
      baseDoc('a', 100000),
      baseDoc('b', 100250),
      baseDoc('c', 100500)
    ];
    const { stats, reason } = buildDerivedFuelStatsFromExpenseDocuments(
      { vehicleId: 'v1', vehicleName: 'Car', odometerKm: 100600, liters: 50 },
      docs.map((d) => ({ id: d.id, data: d.data })),
      new Set()
    );
    expect(reason).toBe('OK');
    expect(stats.previousFuelTransactionId).toBe('c');
    expect(stats.previousOdometerKm).toBe(100500);
    expect(stats.estimatedConsumptionLPer100).toBeCloseTo((50 / 100) * 100);
  });

  it('excludes transaction ids', () => {
    const docs = [baseDoc('self', 100400), baseDoc('prev', 100200)];
    const { stats, reason } = buildDerivedFuelStatsFromExpenseDocuments(
      { vehicleId: 'v1', vehicleName: 'Car', odometerKm: 100600, liters: 50 },
      docs.map((d) => ({ id: d.id, data: d.data })),
      new Set(['self'])
    );
    expect(reason).toBe('OK');
    expect(stats.previousFuelTransactionId).toBe('prev');
  });
});
