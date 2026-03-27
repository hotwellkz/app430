import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createEmptyBuildingModel } from '@2wix/domain-model';
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

import { createProject, getCurrentVersion } from './sipProjectService.js';

describe('getCurrentVersion bootstrap', () => {
  beforeEach(() => {
    store.clear();
    idSeq = 1;
  });

  it('creates initial version when project has no currentVersionId', async () => {
    store.set(key(COLLECTIONS.PROJECTS, 'p1'), {
      title: 'Новый проект',
      dealId: null,
      status: 'draft',
      currentVersionId: null,
      currentVersionNumber: null,
      versionCounter: 0,
      schemaVersion: 2,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'u1',
      updatedBy: 'u1',
    });

    const version = await getCurrentVersion('p1', 'u1');
    expect(version).toBeTruthy();
    expect(version?.versionNumber).toBe(1);

    const updatedProject = store.get(key(COLLECTIONS.PROJECTS, 'p1')) as Record<string, unknown>;
    expect(typeof updatedProject.currentVersionId).toBe('string');
    expect(updatedProject.currentVersionNumber).toBe(1);
  });

  it('createProject writes initial current version and linkage', async () => {
    const result = await createProject(
      {
        title: 'Новый проект с версией',
        dealId: null,
        createdBy: 'u1',
      },
      'u1'
    );

    expect(result.project.id).toBeTruthy();
    expect(result.currentVersion.id).toBeTruthy();
    expect(result.project.currentVersionId).toBe(result.currentVersion.id);
    expect(result.project.currentVersionNumber).toBe(1);
    expect(result.currentVersion.versionNumber).toBe(1);

    const projectDoc = store.get(key(COLLECTIONS.PROJECTS, result.project.id)) as Record<string, unknown>;
    const versionDoc = store.get(
      key(COLLECTIONS.PROJECT_VERSIONS, result.currentVersion.id)
    ) as Record<string, unknown>;

    expect(projectDoc.currentVersionId).toBe(result.currentVersion.id);
    expect(projectDoc.currentVersionNumber).toBe(1);
    expect(versionDoc.projectId).toBe(result.project.id);
    expect(versionDoc.versionNumber).toBe(1);
  });

  it('repairs pointer to latest existing version when currentVersion doc is missing', async () => {
    const bm = createEmptyBuildingModel();
    store.set(key(COLLECTIONS.PROJECTS, 'p2'), {
      title: 'Старый проект',
      dealId: null,
      status: 'draft',
      currentVersionId: 'missing-v',
      currentVersionNumber: 5,
      versionCounter: 5,
      schemaVersion: 2,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'u1',
      updatedBy: 'u1',
    });
    store.set(key(COLLECTIONS.PROJECT_VERSIONS, 'v2'), {
      projectId: 'p2',
      versionNumber: 2,
      schemaVersion: 2,
      buildingModel: bm,
      createdAt: new Date().toISOString(),
      createdBy: 'u1',
      basedOnVersionId: null,
      isSnapshot: false,
    });
    store.set(key(COLLECTIONS.PROJECT_VERSIONS, 'v7'), {
      projectId: 'p2',
      versionNumber: 7,
      schemaVersion: 2,
      buildingModel: bm,
      createdAt: new Date().toISOString(),
      createdBy: 'u1',
      basedOnVersionId: null,
      isSnapshot: false,
    });

    const version = await getCurrentVersion('p2', 'u1');
    expect(version?.id).toBe('v7');

    const updatedProject = store.get(key(COLLECTIONS.PROJECTS, 'p2')) as Record<string, unknown>;
    expect(updatedProject.currentVersionId).toBe('v7');
    expect(updatedProject.currentVersionNumber).toBe(7);
  });
});
