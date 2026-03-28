import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createEmptyBuildingModel,
  createFloor,
  createWall,
  syncBuildingModelMeta,
} from '@2wix/domain-model';
import { COLLECTIONS } from '../config/collections.js';

const store = new Map<string, Record<string, unknown>>();
let idSeq = 1;

function key(col: string, id: string): string {
  return `${col}/${id}`;
}

function docRef(col: string, id: string) {
  return {
    id,
    path: key(col, id),
    get: async () => {
      const data = store.get(key(col, id));
      return data
        ? { exists: true, id, data: () => data }
        : { exists: false, id, data: () => ({}) };
    },
  };
}

function dbMock() {
  return {
    collection: (name: string) => ({
      doc: (id?: string) => {
        const finalId = id ?? `auto-${idSeq++}`;
        const ref = docRef(name, finalId);
        return {
          ...ref,
          update: async (patch: Record<string, unknown>) => {
            const prev = store.get(ref.path) ?? {};
            store.set(ref.path, { ...prev, ...patch });
          },
        };
      },
      where: (_field: string, _op: string, value: string) => ({
        get: async () => {
          const docs = [...store.entries()]
            .filter(([k, v]) => k.startsWith(`${name}/`) && (v as { projectId?: string }).projectId === value)
            .map(([k, v]) => {
              const id = k.slice(name.length + 1);
              return { id, data: () => v };
            });
          return { docs };
        },
      }),
    }),
    batch: () => {
      const ops: Array<() => void> = [];
      return {
        set: (ref: { path: string }, data: Record<string, unknown>) => {
          ops.push(() => {
            store.set(ref.path, data);
          });
        },
        update: (ref: { path: string }, patch: Record<string, unknown>) => {
          ops.push(() => {
            const prev = store.get(ref.path) ?? {};
            store.set(ref.path, { ...prev, ...patch });
          });
        },
        commit: async () => {
          for (const op of ops) op();
        },
      };
    },
  };
}

vi.mock('../firestore/admin.js', () => ({
  getDb: () => dbMock(),
  getStorageBucket: () => ({
    file: () => ({ delete: async () => {} }),
  }),
}));

import { duplicateProject, patchProject } from './sipProjectService.js';

function seedSourceProject(): { srcProjectId: string; srcVersionId: string; wallId: string } {
  const floor = createFloor({
    label: '1',
    level: 1,
    elevationMm: 0,
    heightMm: 2800,
    floorType: 'full',
    sortIndex: 0,
  });
  let m = createEmptyBuildingModel();
  m.floors.push(floor);
  const w = createWall({
    floorId: floor.id,
    start: { x: 0, y: 0 },
    end: { x: 5000, y: 0 },
    thicknessMm: 200,
    wallType: 'external',
  });
  m.walls.push(w);
  m = syncBuildingModelMeta(m, {
    projectId: 'p-src',
    versionId: 'v-src',
    versionNumber: 1,
    projectTitle: 'Исходный',
  });

  const srcProjectId = 'p-src';
  const srcVersionId = 'v-src';
  store.set(key(COLLECTIONS.PROJECTS, srcProjectId), {
    title: 'Исходный',
    dealId: null,
    status: 'draft',
    currentVersionId: srcVersionId,
    currentVersionNumber: 1,
    versionCounter: 1,
    schemaVersion: 2,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'u1',
    updatedBy: 'u1',
    isTemplate: true,
  });
  store.set(key(COLLECTIONS.PROJECT_VERSIONS, srcVersionId), {
    projectId: srcProjectId,
    versionNumber: 1,
    schemaVersion: 2,
    buildingModel: m,
    createdAt: new Date().toISOString(),
    createdBy: 'u1',
    basedOnVersionId: null,
    isSnapshot: false,
  });
  return { srcProjectId, srcVersionId, wallId: w.id };
}

describe('duplicateProject', () => {
  beforeEach(() => {
    store.clear();
    idSeq = 1;
  });

  it('creates independent project with cloned model; source unchanged', async () => {
    const { srcProjectId, srcVersionId, wallId } = seedSourceProject();

    const result = await duplicateProject(
      srcProjectId,
      { title: 'Копия клиента', createdBy: 'u1' },
      'u1'
    );

    expect(result.project.id).not.toBe(srcProjectId);
    expect(result.currentVersion.projectId).toBe(result.project.id);
    const bm = result.currentVersion.buildingModel;
    expect(bm.walls).toHaveLength(1);
    expect(bm.walls[0]?.id).toBe(wallId);
    expect(bm.meta.projectId).toBe(result.project.id);
    expect(bm.meta.versionId).toBe(result.currentVersion.id);
    expect(result.project.isTemplate).not.toBe(true);

    const srcVer = store.get(key(COLLECTIONS.PROJECT_VERSIONS, srcVersionId)) as {
      buildingModel: { meta: { projectId?: string } };
    };
    expect(srcVer.buildingModel.meta.projectId).toBe(srcProjectId);
  });

  it('patchProject toggles isTemplate', async () => {
    seedSourceProject();
    const p = await patchProject('p-src', { updatedBy: 'u1', isTemplate: false }, 'u1');
    expect(p.isTemplate).toBe(false);
    const p2 = await patchProject('p-src', { updatedBy: 'u1', isTemplate: true }, 'u1');
    expect(p2.isTemplate).toBe(true);
  });
});
