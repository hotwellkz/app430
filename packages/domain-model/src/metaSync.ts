import type { BuildingModel } from '@2wix/shared-types';

/** Выравнивает meta здания с project/version (единый источник правды на сервере). */
export function syncBuildingModelMeta(
  model: BuildingModel,
  ctx: {
    projectId: string;
    versionId: string;
    versionNumber: number;
    projectTitle?: string;
  }
): BuildingModel {
  return {
    ...model,
    meta: {
      ...model.meta,
      projectId: ctx.projectId,
      versionId: ctx.versionId,
      versionNumber: ctx.versionNumber,
      name: ctx.projectTitle ?? model.meta.name,
    },
  };
}
