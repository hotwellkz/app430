import { describe, expect, it, vi, beforeEach } from 'vitest';
import { COLLECTIONS } from '../config/collections.js';
import { ForbiddenError, NotFoundError } from '../errors/httpErrors.js';

const store = new Map<string, Record<string, unknown>>();
const deletedStoragePaths: string[] = [];

function docPath(col: string, id: string): string {
  return `${col}/${id}`;
}

function makeRef(col: string, id: string) {
  const path = docPath(col, id);
  return {
    path,
    delete: async () => {
      store.delete(path);
    },
  };
}

function buildDb() {
  return {
    collection: (name: string) => ({
      doc: (id: string) => ({
        get: async () => {
          const data = store.get(docPath(name, id));
          return data !== undefined
            ? { exists: true, id, data: () => data }
            : { exists: false, id, data: () => ({}) };
        },
        delete: async () => {
          store.delete(docPath(name, id));
        },
      }),
      where: (_field: string, _op: string, value: string) => ({
        limit: (n: number) => ({
          get: async () => {
            const docs = [...store.entries()]
              .filter(([k, v]) => k.startsWith(`${name}/`) && (v as { projectId?: string }).projectId === value)
              .slice(0, n)
              .map(([k]) => {
                const id = k.slice(name.length + 1);
                return {
                  id,
                  ref: makeRef(name, id),
                  data: () => store.get(k)!,
                };
              });
            return { docs, get empty() {
              return docs.length === 0;
            } };
          },
        }),
      }),
    }),
    batch: () => {
      const paths: string[] = [];
      return {
        delete: (ref: { path: string }) => {
          paths.push(ref.path);
        },
        commit: async () => {
          for (const p of paths) {
            store.delete(p);
          }
        },
      };
    },
  };
}

vi.mock('../firestore/admin.js', () => ({
  getDb: () => buildDb(),
  getStorageBucket: () => ({
    file: (path: string) => ({
      delete: async () => {
        deletedStoragePaths.push(path);
      },
    }),
  }),
}));

import { deleteProject } from './sipProjectService.js';

function seedProjectP1(): void {
  store.set(docPath(COLLECTIONS.PROJECTS, 'p1'), {
    title: 'Demo',
    dealId: 'deal-1',
    status: 'draft',
    currentVersionId: 'v1',
    currentVersionNumber: 1,
    versionCounter: 1,
    schemaVersion: 2,
    createdAt: new Date('2026-01-01').toISOString(),
    updatedAt: new Date('2026-01-02').toISOString(),
    createdBy: 'u1',
    updatedBy: 'u1',
  });
  store.set(docPath(COLLECTIONS.PROJECT_VERSIONS, 'v1'), {
    projectId: 'p1',
    versionNumber: 1,
    schemaVersion: 2,
    buildingModel: { meta: {} },
    createdAt: new Date().toISOString(),
    createdBy: 'u1',
    basedOnVersionId: null,
    isSnapshot: false,
  });
  store.set(docPath(COLLECTIONS.IMPORT_JOBS, 'ij1'), {
    projectId: 'p1',
    status: 'needs_review',
    createdBy: 'u1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    importSchemaVersion: 1,
    sourceImages: [],
    snapshot: null,
    errorMessage: null,
  });
  store.set(docPath(COLLECTIONS.PROJECT_EXPORTS, 'e1'), {
    projectId: 'p1',
    versionId: 'v1',
    format: 'pdf',
    presentationMode: 'technical',
    title: 'x',
    createdAt: new Date().toISOString(),
    createdBy: 'u1',
    status: 'ready',
    fileName: 'x.pdf',
    storagePath: 'sip-exports/p1/v1/e1/x.pdf',
    errorMessage: null,
  });
}

describe('deleteProject', () => {
  beforeEach(() => {
    store.clear();
    deletedStoragePaths.length = 0;
  });

  it('удаляет проект, версии, import jobs, экспорты и вызывает удаление файла в storage', async () => {
    seedProjectP1();
    await deleteProject('p1', 'u1');

    expect(store.has(docPath(COLLECTIONS.PROJECTS, 'p1'))).toBe(false);
    expect(store.has(docPath(COLLECTIONS.PROJECT_VERSIONS, 'v1'))).toBe(false);
    expect(store.has(docPath(COLLECTIONS.IMPORT_JOBS, 'ij1'))).toBe(false);
    expect(store.has(docPath(COLLECTIONS.PROJECT_EXPORTS, 'e1'))).toBe(false);
    expect(deletedStoragePaths).toContain('sip-exports/p1/v1/e1/x.pdf');
  });

  it('404 если проекта нет', async () => {
    await expect(deleteProject('missing', 'u1')).rejects.toThrow(NotFoundError);
  });

  it('403 если нет доступа к проекту', async () => {
    store.set(docPath(COLLECTIONS.PROJECTS, 'p2'), {
      title: 'Other',
      dealId: null,
      status: 'draft',
      currentVersionId: 'v2',
      currentVersionNumber: 1,
      versionCounter: 1,
      schemaVersion: 2,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'u2',
      updatedBy: 'u2',
    });
    store.set(docPath(COLLECTIONS.PROJECT_VERSIONS, 'v2'), {
      projectId: 'p2',
      versionNumber: 1,
      schemaVersion: 2,
      buildingModel: {},
      createdAt: new Date().toISOString(),
      createdBy: 'u2',
      basedOnVersionId: null,
      isSnapshot: false,
    });

    await expect(deleteProject('p2', 'u1')).rejects.toThrow(ForbiddenError);
    expect(store.has(docPath(COLLECTIONS.PROJECTS, 'p2'))).toBe(true);
  });
});
