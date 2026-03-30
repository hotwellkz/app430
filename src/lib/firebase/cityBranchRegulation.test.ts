import { describe, expect, it } from 'vitest';
import {
  buildConsistentCityBranch,
  findBranchByRegulatedName,
  normalizeCityToCanonical,
  resolveBranchNameByCity,
  stripFilialPrefixFromBranchLabel
} from './cityBranchRegulation';

describe('cityBranchRegulation', () => {
  it('maps cities to regulated branch names', () => {
    expect(normalizeCityToCanonical('алматы')).toBe('Алматы');
    expect(resolveBranchNameByCity('Алматы')).toBe('Алматы');
    expect(resolveBranchNameByCity('Караганда')).toBe('Астана');
    expect(resolveBranchNameByCity('Шымкент')).toBe('Алматы');
    expect(resolveBranchNameByCity('Конаев')).toBe('Алматы');
  });

  it('matches branch records by regulated name or «Филиал …» label', () => {
    const branches = [
      { id: 'a1', name: 'Филиал Алматы' },
      { id: 'a2', name: 'Астана' }
    ];
    expect(findBranchByRegulatedName(branches, 'Алматы')?.id).toBe('a1');
    expect(findBranchByRegulatedName(branches, 'астана')?.id).toBe('a2');
    expect(stripFilialPrefixFromBranchLabel('Филиал Алматы')).toBe('Алматы');
  });

  it('buildConsistentCityBranch resolves branch id for «Филиал Алматы»', () => {
    const branches = [
      { id: 'bid1', name: 'Филиал Алматы' },
      { id: 'bid2', name: 'Филиал Астана' }
    ];
    expect(buildConsistentCityBranch('Алматы', branches).branchId).toBe('bid1');
    expect(buildConsistentCityBranch('Астана', branches).branchId).toBe('bid2');
    expect(buildConsistentCityBranch('Караганда', branches).branchId).toBe('bid2');
    expect(buildConsistentCityBranch(null, branches).branchId).toBeNull();
  });
});
