import type {
  BuildingModel,
  BuildingModelCandidate,
  CandidateTrace,
  CandidateWarning,
  ReviewedArchitecturalSnapshot,
  Roof,
  Wall,
} from '@2wix/shared-types';

export const IMPORT_CANDIDATE_MAPPER_VERSION = 'import-candidate-v1';

interface BuildCandidateOptions {
  importJobId: string;
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function createEmptyCandidateModel(name: string): BuildingModel {
  return {
    meta: {
      id: `candidate-${Date.now()}`,
      name: name || 'Imported candidate',
    },
    settings: {
      units: 'mm',
      defaultWallThicknessMm: 163,
      gridStepMm: 100,
    },
    floors: [],
    walls: [],
    openings: [],
    slabs: [],
    roofs: [],
    panelLibrary: [],
    panelSettings: {
      defaultPanelTypeId: null,
      allowTrimmedPanels: true,
      minTrimWidthMm: 250,
      preferFullPanels: true,
      labelPrefixWall: 'W',
      labelPrefixRoof: 'R',
      labelPrefixSlab: 'S',
    },
  };
}

export function buildBuildingModelCandidateFromReviewedSnapshot(
  reviewed: ReviewedArchitecturalSnapshot,
  options: BuildCandidateOptions
): BuildingModelCandidate {
  const source = reviewed.transformedSnapshot;
  const warnings: CandidateWarning[] = [];
  const trace: CandidateTrace[] = [];
  const model = createEmptyCandidateModel(source.projectMeta.name ?? 'Imported candidate');
  const floorIdMap = new Map<string, string>();

  // Floors mapping
  for (let i = 0; i < source.floors.length; i += 1) {
    const sf = source.floors[i]!;
    const floorId = `f-${i + 1}`;
    floorIdMap.set(sf.id, floorId);
    model.floors.push({
      id: floorId,
      label: sf.label ?? `Floor ${i + 1}`,
      level: i + 1,
      elevationMm: sf.elevationHintMm ?? i * 3000,
      heightMm: 2800,
      floorType: 'full',
      sortIndex: i,
    });
    trace.push({
      sourceType: 'floor',
      sourceId: sf.id,
      targetType: 'floor',
      targetId: floorId,
      rule: 'floor-basic-mapping',
    });
  }
  if (model.floors.length === 0) {
    model.floors.push({
      id: 'f-1',
      label: 'Floor 1',
      level: 1,
      elevationMm: 0,
      heightMm: 2800,
      floorType: 'full',
      sortIndex: 0,
    });
    warnings.push({
      code: 'FLOORS_EMPTY_FALLBACK',
      severity: 'warning',
      message: 'Floors not found in reviewed snapshot, fallback floor created',
      sourceType: 'floor',
      sourceId: null,
    });
  }

  // Walls mapping from reviewed walls
  const wallBySourceId = new Map<string, string[]>();
  let wallIdx = 1;
  for (const sw of source.walls) {
    const floorId = floorIdMap.get(sw.floorId) ?? model.floors[0]!.id;
    const mappedIds: string[] = [];
    if (!Array.isArray(sw.points) || sw.points.length < 2) {
      warnings.push({
        code: 'WALL_POINTS_INVALID',
        severity: 'warning',
        message: 'Wall skipped: not enough points',
        sourceType: 'wall',
        sourceId: sw.id,
      });
      continue;
    }
    for (let i = 1; i < sw.points.length; i += 1) {
      const p1 = sw.points[i - 1]!;
      const p2 = sw.points[i]!;
      if (distance(p1, p2) < 1) {
        warnings.push({
          code: 'WALL_SEGMENT_TOO_SHORT',
          severity: 'warning',
          message: 'Wall segment skipped: too short',
          sourceType: 'wall',
          sourceId: sw.id,
        });
        continue;
      }
      const wallId = `w-${wallIdx++}`;
      const wall: Wall = {
        id: wallId,
        floorId,
        start: { x: p1.x, y: p1.y },
        end: { x: p2.x, y: p2.y },
        thicknessMm: sw.thicknessHintMm ?? 163,
        wallType: sw.typeHint ?? 'external',
        structuralRole: sw.typeHint === 'internal' ? 'partition' : 'bearing',
      };
      model.walls.push(wall);
      mappedIds.push(wallId);
      trace.push({
        sourceType: 'wall',
        sourceId: sw.id,
        targetType: 'wall',
        targetId: wallId,
        rule: 'wall-polyline-segment-mapping',
      });
    }
    wallBySourceId.set(sw.id, mappedIds);
  }

  // Fallback from outer contour when no walls
  if (model.walls.length === 0 && source.outerContour?.points?.length) {
    const pts = source.outerContour.points;
    const closeLoop = source.outerContour.kind === 'polygon' ? 1 : 0;
    for (let i = 1; i < pts.length + closeLoop; i += 1) {
      const p1 = pts[i - 1]!;
      const p2 = pts[i % pts.length]!;
      if (distance(p1, p2) < 1) continue;
      const wallId = `w-${wallIdx++}`;
      model.walls.push({
        id: wallId,
        floorId: model.floors[0]!.id,
        start: { x: p1.x, y: p1.y },
        end: { x: p2.x, y: p2.y },
        thicknessMm: 163,
        wallType: 'external',
        structuralRole: 'bearing',
      });
      trace.push({
        sourceType: 'outer_contour',
        sourceId: 'outer-contour',
        targetType: 'wall',
        targetId: wallId,
        rule: 'outer-contour-fallback-mapping',
      });
    }
  }

  // Openings mapping
  let openingIdx = 1;
  for (const so of source.openings) {
    const floorId = floorIdMap.get(so.floorId) ?? model.floors[0]!.id;
    let targetWallId: string | null = null;
    if (so.wallId) {
      const mappedWallIds = wallBySourceId.get(so.wallId);
      targetWallId = mappedWallIds?.[0] ?? null;
    }
    if (!targetWallId) {
      const fallback = model.walls.find((w) => w.floorId === floorId) ?? model.walls[0];
      targetWallId = fallback?.id ?? null;
      warnings.push({
        code: 'OPENING_WALL_LINK_FALLBACK',
        severity: 'warning',
        message: 'Opening wall link fallback was applied',
        sourceType: 'opening',
        sourceId: so.id,
      });
    }
    if (!targetWallId) {
      warnings.push({
        code: 'OPENING_SKIPPED_NO_WALLS',
        severity: 'warning',
        message: 'Opening skipped: no candidate walls available',
        sourceType: 'opening',
        sourceId: so.id,
      });
      continue;
    }
    const openingId = `o-${openingIdx++}`;
    model.openings.push({
      id: openingId,
      floorId,
      wallId: targetWallId,
      openingType: so.type === 'door' ? 'door' : so.type === 'window' ? 'window' : 'portal',
      positionAlongWall: so.positionAlongWallMm ?? 500,
      widthMm: so.widthMm ?? 900,
      heightMm: so.heightMm ?? 2100,
      bottomOffsetMm: 0,
    });
    trace.push({
      sourceType: 'opening',
      sourceId: so.id,
      targetType: 'opening',
      targetId: openingId,
      rule: 'opening-basic-mapping',
    });
  }

  // Roof hints mapping (metadata-level MVP)
  if (source.roofHints?.likelyType === 'gabled' || source.roofHints?.likelyType === 'single-slope') {
    const roof: Roof = {
      id: 'r-1',
      floorId: model.floors[model.floors.length - 1]!.id,
      roofType: source.roofHints.likelyType === 'gabled' ? 'gable' : 'single_slope',
      slopeDegrees: 25,
      ridgeDirection: 'x',
      overhangMm: 300,
      baseElevationMm: model.floors[model.floors.length - 1]!.elevationMm + 2800,
      generationMode: 'auto',
    };
    model.roofs.push(roof);
    trace.push({
      sourceType: 'roof',
      sourceId: 'roof-hints',
      targetType: 'roof',
      targetId: roof.id,
      rule: 'roof-hints-to-parametric-roof-mapping',
    });
  } else if (source.roofHints) {
    warnings.push({
      code: 'ROOF_HINT_NOT_MAPPED',
      severity: 'warning',
      message: 'Roof hint exists but is not mappable to candidate roof geometry yet',
      sourceType: 'roof',
      sourceId: 'roof-hints',
    });
  }

  // Unsupported entities for this MVP
  for (const s of source.stairs) {
    warnings.push({
      code: 'STAIR_NOT_MAPPED_YET',
      severity: 'warning',
      message: 'Stairs are not mapped to candidate model yet',
      sourceType: 'stair',
      sourceId: s.id,
    });
  }
  for (const issue of source.unresolved) {
    warnings.push({
      code: 'UNRESOLVED_IMPORT_ISSUE',
      severity: issue.severity === 'blocking' ? 'error' : 'warning',
      message: issue.message,
      sourceType: 'issue',
      sourceId: issue.id,
      details: { issueCode: issue.code },
    });
  }

  return {
    model,
    warnings,
    trace,
    mapperVersion: IMPORT_CANDIDATE_MAPPER_VERSION,
    generatedAt: new Date().toISOString(),
    basedOnImportJobId: options.importJobId,
    basedOnReviewedSnapshotVersion: reviewed.generatedAt,
    status: warnings.some((w) => w.severity === 'error') ? 'partial' : 'ready',
  };
}
