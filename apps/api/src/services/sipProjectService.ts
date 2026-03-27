import { FieldValue, type DocumentSnapshot } from 'firebase-admin/firestore';
import type { Project, ProjectVersion } from '@2wix/shared-types';
import { BUILDING_MODEL_SCHEMA_VERSION } from '@2wix/shared-types';
import {
  createEmptyBuildingModel,
  createEmptyProject,
  normalizeBuildingModel,
  syncBuildingModelMeta,
} from '@2wix/domain-model';
import {
  assertActorMatchesHeader,
  assertCanAccessProject,
  canAccessProject,
} from '../access/projectAccess.js';
import { COLLECTIONS } from '../config/collections.js';
import {
  InternalError,
  NotFoundError,
  ValidationAppError,
  VersionConflictError,
} from '../errors/httpErrors.js';
import { getDb, getStorageBucket } from '../firestore/admin.js';
import { mapProjectDoc, mapVersionDoc } from '../mappers/firestoreMappers.js';
import { evaluateVersionConcurrency } from '../versioning/concurrency.js';
import {
  formatZodError,
  zCreateProjectBody,
  zCreateVersionBody,
  zPatchCurrentBody,
} from '../validation/schemas.js';

function cloneModel(model: ProjectVersion['buildingModel']): ProjectVersion['buildingModel'] {
  return structuredClone(model);
}

function readVersionCounter(raw: Record<string, unknown>, project: Project): number {
  const c = raw.versionCounter;
  if (typeof c === 'number' && Number.isFinite(c)) return c;
  return project.currentVersionNumber ?? 1;
}

export async function createProject(
  body: unknown,
  actorId: string
): Promise<{ project: Project; currentVersion: ProjectVersion }> {
  const parsed = zCreateProjectBody.safeParse(body);
  if (!parsed.success) {
    throw new ValidationAppError('Невалидное тело запроса', formatZodError(parsed.error));
  }
  assertActorMatchesHeader(parsed.data.createdBy, actorId);

  const db = getDb();
  const projectRef = db.collection(COLLECTIONS.PROJECTS).doc();
  const versionRef = db.collection(COLLECTIONS.PROJECT_VERSIONS).doc();
  const now = FieldValue.serverTimestamp();

  let allowedEditorIds = parsed.data.allowedEditorIds;
  if (allowedEditorIds && allowedEditorIds.length > 0) {
    if (!allowedEditorIds.includes(parsed.data.createdBy)) {
      allowedEditorIds = [...allowedEditorIds, parsed.data.createdBy];
    }
  }

  const base = createEmptyProject({
    title: parsed.data.title,
    dealId: parsed.data.dealId ?? null,
    createdBy: parsed.data.createdBy,
  });

  let buildingModel = createEmptyBuildingModel();
  buildingModel = syncBuildingModelMeta(buildingModel, {
    projectId: projectRef.id,
    versionId: versionRef.id,
    versionNumber: 1,
    projectTitle: base.title,
  });

  const batch = db.batch();
  batch.set(projectRef, {
    dealId: base.dealId,
    title: base.title,
    status: base.status,
    currentVersionId: versionRef.id,
    currentVersionNumber: 1,
    versionCounter: 1,
    schemaVersion: BUILDING_MODEL_SCHEMA_VERSION,
    createdAt: now,
    updatedAt: now,
    createdBy: base.createdBy,
    updatedBy: base.updatedBy,
    ...(allowedEditorIds && allowedEditorIds.length > 0 ? { allowedEditorIds } : {}),
  });
  batch.set(versionRef, {
    projectId: projectRef.id,
    versionNumber: 1,
    schemaVersion: BUILDING_MODEL_SCHEMA_VERSION,
    buildingModel,
    createdAt: now,
    createdBy: base.createdBy,
    basedOnVersionId: null,
    isSnapshot: false,
  });
  await batch.commit();

  const projectSnap = await projectRef.get();
  const versionSnap = await versionRef.get();
  const p = mapProjectDoc(projectRef.id, projectSnap.data() ?? {});
  const v = mapVersionDoc(
    versionRef.id,
    versionSnap.data() ?? {},
    normalizeBuildingModel(
      (versionSnap.data() as { buildingModel?: unknown })?.buildingModel
    )
  );
  return { project: p, currentVersion: v };
}

/** Список проектов, доступных пользователю (создатель или allowedEditorIds). */
export async function listProjectsForUser(
  actorId: string,
  limitCount = 80
): Promise<Project[]> {
  const db = getDb();
  const col = db.collection(COLLECTIONS.PROJECTS);
  const [snapCreated, snapAllowed] = await Promise.all([
    col.where('createdBy', '==', actorId).limit(200).get(),
    col.where('allowedEditorIds', 'array-contains', actorId).limit(200).get(),
  ]);
  const map = new Map<string, Project>();
  for (const doc of snapCreated.docs) {
    const p = mapProjectDoc(doc.id, doc.data() ?? {});
    if (canAccessProject(p, actorId)) map.set(doc.id, p);
  }
  for (const doc of snapAllowed.docs) {
    const p = mapProjectDoc(doc.id, doc.data() ?? {});
    if (canAccessProject(p, actorId)) map.set(doc.id, p);
  }
  const list = [...map.values()];
  list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  return list.slice(0, limitCount);
}

export async function getProject(projectId: string, actorId: string): Promise<Project> {
  const db = getDb();
  const snap = await db.collection(COLLECTIONS.PROJECTS).doc(projectId).get();
  if (!snap.exists) {
    throw new NotFoundError(`Проект не найден: ${projectId}`);
  }
  const project = mapProjectDoc(snap.id, snap.data() ?? {});
  assertCanAccessProject(project, actorId);
  return project;
}

export async function getCurrentVersion(
  projectId: string,
  actorId: string
): Promise<ProjectVersion | null> {
  const project = await getProject(projectId, actorId);
  if (!project.currentVersionId) {
    return bootstrapCurrentVersion(project, actorId);
  }
  const db = getDb();
  const snap = await db
    .collection(COLLECTIONS.PROJECT_VERSIONS)
    .doc(project.currentVersionId)
    .get();
  if (!snap.exists) {
    return bootstrapCurrentVersion(project, actorId);
  }
  const raw = snap.data() as { buildingModel?: unknown };
  const model = normalizeBuildingModel(raw.buildingModel);
  return mapVersionDoc(snap.id, snap.data() ?? {}, model);
}

async function bootstrapCurrentVersion(project: Project, actorId: string): Promise<ProjectVersion> {
  const db = getDb();
  const pRef = db.collection(COLLECTIONS.PROJECTS).doc(project.id);
  const now = FieldValue.serverTimestamp();
  const versions = await listVersions(project.id, actorId);
  const existing = versions[0] ?? null;

  if (existing) {
    await pRef.update({
      currentVersionId: existing.id,
      currentVersionNumber: existing.versionNumber,
      versionCounter: Math.max(project.currentVersionNumber ?? 0, existing.versionNumber),
      schemaVersion: existing.schemaVersion,
      updatedAt: now,
      updatedBy: actorId,
    });
    return existing;
  }

  const versionRef = db.collection(COLLECTIONS.PROJECT_VERSIONS).doc();
  const versionNumber = Math.max(1, project.currentVersionNumber ?? 0, 1);
  const model = syncBuildingModelMeta(createEmptyBuildingModel(), {
    projectId: project.id,
    versionId: versionRef.id,
    versionNumber,
    projectTitle: project.title,
  });

  const batch = db.batch();
  batch.set(versionRef, {
    projectId: project.id,
    versionNumber,
    schemaVersion: BUILDING_MODEL_SCHEMA_VERSION,
    buildingModel: model,
    createdAt: now,
    createdBy: actorId,
    basedOnVersionId: null,
    isSnapshot: false,
  });
  batch.update(pRef, {
    currentVersionId: versionRef.id,
    currentVersionNumber: versionNumber,
    versionCounter: Math.max(project.currentVersionNumber ?? 0, versionNumber),
    schemaVersion: BUILDING_MODEL_SCHEMA_VERSION,
    updatedAt: now,
    updatedBy: actorId,
  });
  await batch.commit();

  const createdSnap = await versionRef.get();
  const raw = createdSnap.data() as { buildingModel?: unknown };
  return mapVersionDoc(createdSnap.id, createdSnap.data() ?? {}, normalizeBuildingModel(raw?.buildingModel));
}

export async function listVersions(
  projectId: string,
  actorId: string
): Promise<ProjectVersion[]> {
  await getProject(projectId, actorId);
  const db = getDb();
  const qs = await db
    .collection(COLLECTIONS.PROJECT_VERSIONS)
    .where('projectId', '==', projectId)
    .get();
  const list: ProjectVersion[] = [];
  for (const doc of qs.docs) {
    const raw = doc.data() as { buildingModel?: unknown };
    list.push(
      mapVersionDoc(
        doc.id,
        doc.data(),
        normalizeBuildingModel(raw.buildingModel)
      )
    );
  }
  list.sort((a, b) => b.versionNumber - a.versionNumber);
  return list;
}

export async function createVersion(
  projectId: string,
  body: unknown,
  actorId: string
): Promise<ProjectVersion> {
  const parsed = zCreateVersionBody.safeParse(body);
  if (!parsed.success) {
    throw new ValidationAppError('Невалидное тело запроса', formatZodError(parsed.error));
  }
  assertActorMatchesHeader(parsed.data.createdBy, actorId);

  const db = getDb();
  const pRef = db.collection(COLLECTIONS.PROJECTS).doc(projectId);
  const versionRef = db.collection(COLLECTIONS.PROJECT_VERSIONS).doc();

  await db.runTransaction(async (tx) => {
    const pSnap = await tx.get(pRef);
    if (!pSnap.exists) {
      throw new NotFoundError(`Проект не найден: ${projectId}`);
    }
    const project = mapProjectDoc(pSnap.id, pSnap.data() ?? {});
    assertCanAccessProject(project, actorId);
    const rawProj = pSnap.data() ?? {};

    const mode = parsed.data.mode ?? 'clone-current';
    let sourceSnap: DocumentSnapshot | null = null;
    if (mode === 'clone-current') {
      const cid = project.currentVersionId;
      if (!cid) {
        throw new ValidationAppError('Нет текущей версии для клонирования');
      }
      const s = await tx.get(
        db.collection(COLLECTIONS.PROJECT_VERSIONS).doc(cid)
      );
      if (!s.exists) {
        throw new InternalError('Текущая версия отсутствует в хранилище');
      }
      sourceSnap = s;
    } else {
      const bid = parsed.data.basedOnVersionId;
      if (!bid) {
        throw new ValidationAppError('Укажите basedOnVersionId для mode=from-version');
      }
      const s = await tx.get(db.collection(COLLECTIONS.PROJECT_VERSIONS).doc(bid));
      if (!s.exists) {
        throw new NotFoundError('Базовая версия не найдена');
      }
      const d = s.data() ?? {};
      if (d.projectId !== projectId) {
        throw new ValidationAppError('Версия принадлежит другому проекту');
      }
      sourceSnap = s;
    }

    if (!sourceSnap) {
      throw new InternalError('Не удалось определить базовую версию');
    }
    const sourceData = sourceSnap.data() ?? {};
    const sourceModel = normalizeBuildingModel(
      (sourceData as { buildingModel?: unknown }).buildingModel
    );

    const nextNum = readVersionCounter(rawProj, project) + 1;
    const now = FieldValue.serverTimestamp();

    const buildingModel = syncBuildingModelMeta(cloneModel(sourceModel), {
      projectId,
      versionId: versionRef.id,
      versionNumber: nextNum,
      projectTitle: project.title,
    });

    tx.set(versionRef, {
      projectId,
      versionNumber: nextNum,
      schemaVersion: BUILDING_MODEL_SCHEMA_VERSION,
      buildingModel,
      createdAt: now,
      createdBy: actorId,
      basedOnVersionId: sourceSnap.id,
      isSnapshot: false,
    });

    tx.update(pRef, {
      currentVersionId: versionRef.id,
      currentVersionNumber: nextNum,
      versionCounter: nextNum,
      schemaVersion: BUILDING_MODEL_SCHEMA_VERSION,
      updatedAt: now,
      updatedBy: actorId,
    });
  });

  const vd = (await versionRef.get()).data() ?? {};
  return mapVersionDoc(
    versionRef.id,
    vd,
    normalizeBuildingModel((vd as { buildingModel?: unknown }).buildingModel)
  );
}

async function deleteFirestoreDocsByProjectId(
  collectionName: string,
  projectId: string
): Promise<void> {
  const db = getDb();
  const col = db.collection(collectionName);
  while (true) {
    const snap = await col.where('projectId', '==', projectId).limit(500).get();
    if (snap.empty) break;
    const batch = db.batch();
    for (const d of snap.docs) {
      batch.delete(d.ref);
    }
    await batch.commit();
  }
}

/**
 * Полное удаление SIP-проекта: документ проекта, все версии, import jobs, экспорты и файлы экспортов в GCS.
 * Не трогает данные CRM (сделки и т.д.) — только коллекции sipEditor_*.
 */
export async function deleteProject(
  projectId: string,
  actorId: string
): Promise<{ deleted: true; projectId: string }> {
  const trimmed = projectId.trim();
  if (!trimmed) {
    throw new ValidationAppError('Невалидный projectId');
  }

  await getProject(trimmed, actorId);

  const db = getDb();
  const bucket = getStorageBucket();

  const exportCol = db.collection(COLLECTIONS.PROJECT_EXPORTS);
  while (true) {
    const snap = await exportCol.where('projectId', '==', trimmed).limit(500).get();
    if (snap.empty) break;
    for (const d of snap.docs) {
      const sp = d.data()?.storagePath;
      if (typeof sp === 'string' && sp.length > 0) {
        try {
          await bucket.file(sp).delete({ ignoreNotFound: true });
        } catch {
          /* ignore storage errors — документ всё равно удалим */
        }
      }
    }
    const batch = db.batch();
    for (const d of snap.docs) {
      batch.delete(d.ref);
    }
    await batch.commit();
  }

  await deleteFirestoreDocsByProjectId(COLLECTIONS.IMPORT_JOBS, trimmed);
  await deleteFirestoreDocsByProjectId(COLLECTIONS.PROJECT_VERSIONS, trimmed);

  await db.collection(COLLECTIONS.PROJECTS).doc(trimmed).delete();

  return { deleted: true, projectId: trimmed };
}

export async function patchCurrentVersion(
  projectId: string,
  body: unknown,
  actorId: string
): Promise<ProjectVersion> {
  const parsed = zPatchCurrentBody.safeParse(body);
  if (!parsed.success) {
    throw new ValidationAppError('Невалидное тело запроса', formatZodError(parsed.error));
  }
  assertActorMatchesHeader(parsed.data.updatedBy, actorId);

  const db = getDb();
  const pRef = db.collection(COLLECTIONS.PROJECTS).doc(projectId);

  await db.runTransaction(async (tx) => {
    const pSnap = await tx.get(pRef);
    if (!pSnap.exists) {
      throw new NotFoundError(`Проект не найден: ${projectId}`);
    }
    const project = mapProjectDoc(pSnap.id, pSnap.data() ?? {});
    assertCanAccessProject(project, actorId);

    const vId = project.currentVersionId;
    if (!vId) {
      throw new NotFoundError('Текущая версия не назначена');
    }
    const vRef = db.collection(COLLECTIONS.PROJECT_VERSIONS).doc(vId);
    const vSnap = await tx.get(vRef);
    if (!vSnap.exists) {
      throw new NotFoundError('Документ текущей версии не найден');
    }
    const vData = vSnap.data() ?? {};
    const serverModel = normalizeBuildingModel(
      (vData as { buildingModel?: unknown }).buildingModel
    );
    const serverVersion = mapVersionDoc(vSnap.id, vData, serverModel);

    const conflict = evaluateVersionConcurrency({
      expectedCurrentVersionId: parsed.data.expectedCurrentVersionId,
      expectedVersionNumber: parsed.data.expectedVersionNumber,
      expectedSchemaVersion: parsed.data.expectedSchemaVersion,
      serverCurrentVersionId: project.currentVersionId,
      serverVersionNumber: serverVersion.versionNumber,
      serverSchemaVersion: serverVersion.schemaVersion,
      serverUpdatedAtIso: project.updatedAt,
    });
    if (conflict !== null) {
      throw new VersionConflictError(conflict);
    }

    let nextModel = normalizeBuildingModel(parsed.data.buildingModel);
    nextModel = syncBuildingModelMeta(nextModel, {
      projectId,
      versionId: vId,
      versionNumber: serverVersion.versionNumber,
      projectTitle: project.title,
    });

    const now = FieldValue.serverTimestamp();
    tx.update(vRef, {
      buildingModel: nextModel,
      schemaVersion: BUILDING_MODEL_SCHEMA_VERSION,
    });
    tx.update(pRef, {
      updatedAt: now,
      updatedBy: actorId,
      schemaVersion: BUILDING_MODEL_SCHEMA_VERSION,
    });
  });

  const fresh = await getCurrentVersion(projectId, actorId);
  if (!fresh) {
    throw new InternalError('Не удалось прочитать версию после сохранения');
  }
  return fresh;
}
