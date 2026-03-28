import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  clampEditorZoom,
  EDITOR_LAYER_FOUNDATION,
  EDITOR_LAYER_GROUND_SCREED,
  EDITOR_LAYER_ROOF,
  EDITOR_LAYER_SLABS,
  editorLayerFloorOpenings,
  editorLayerFloorWalls,
  isEditorLayerLocked,
  isEditorLayerVisible,
  isFloorOpeningsLayer,
  isWallDrawingLayer,
  parseFloorOpeningsLayer,
  parseFloorWallsLayer,
  useEditorStore,
} from '@2wix/editor-core';
import {
  baselineSegmentToCenterline,
  buildOpeningOnWallClick,
  createWall,
  findFoundationByFloor,
  findGroundScreedByFloor,
  findWallById,
  rectangleOppositeCornerFromSize,
  wallsOnFloorAfterJointMove,
  getOpeningById,
  getOpeningsByFloor,
  getRoofForTopFloor,
  getSlabsByFloor,
  getTopFloor,
  getFloorById,
  getWallsByFloor,
  wallPolygonPointsMm,
} from '@2wix/domain-model';
import type { Opening, OpeningType, Point2D, Wall, WallType } from '@2wix/shared-types';
import { GridLayer } from './GridLayer.js';
import { WallsLayer } from './WallsLayer.js';
import { WallLengthLabel } from './WallLengthLabel.js';
import { SelectionHandles } from './SelectionHandles.js';
import { OpeningsLayer } from './OpeningsLayer.js';
import {
  clientToWorld,
  endpointHandleRadiusWorldMm,
  hitToleranceWorldMm,
  panToKeepWorldUnderScreenPoint,
  snapPointToGrid,
  viewportWorldRect,
} from './viewMath.js';
import {
  drawWallCancel,
  drawWallOnPointerDown,
  drawWallOnPointerMove,
  type DrawWallGestureState,
} from './drawWallGesture.js';
import {
  findClosestWallAtPoint,
  hitWallBodyForDrag,
  hitWallEndpoint,
  type WallEndpoint,
} from './hitTest.js';
import { updateWallPatchForEndpoint, wallWithEndpointMoved } from './endpointDrag.js';
import { findClosestOpeningAtPoint } from './openingHitTest.js';
import { proposeOpeningDragAlongWall } from './openingDrag.js';
import { computeFitViewTransform, computeWallsBoundingBoxMm } from './viewFit.js';
import { snapPointToNearbyWallJoints } from './endpointJointSnap.js';
import { FoundationPlanLayer } from './FoundationPlanLayer.js';
import { SlabPlanLayer } from './SlabPlanLayer.js';
import { PanelOverlayLayer } from './PanelOverlayLayer.js';
import { RectangleDrawHud } from './RectangleDrawHud.js';
import { wallLayoutResultToGeneratedPanels } from '@2wix/panel-engine';
import type { GeneratedPanel } from '@2wix/panel-engine';
import { usePanelizationSnapshot } from '../panelization/usePanelizationSnapshot';
import {
  drawRectangleCancel,
  drawRectangleOnPointerDown,
  drawRectangleOnPointerMove,
  type DrawRectangleGestureState,
} from './drawRectangleGesture.js';
import { translateWallByDelta } from './wallTranslate.js';

const MAJOR_GRID_MM = 5000;

type PanSession = { pointerId: number; lastX: number; lastY: number };
type DragSession = { wallId: string; endpoint: WallEndpoint; pointerId: number };
type OpeningDragSession = { openingId: string; pointerId: number };
type WallBodyDragSession = {
  wallId: string;
  pointerId: number;
  startPointerWorld: Point2D;
  baseWall: Wall;
};

const MIN_RECT_EDGE_MM = 50;

function inferPanelDirection(start: Point2D, end: Point2D): 'horizontal' | 'vertical' {
  const dx = Math.abs(end.x - start.x);
  const dy = Math.abs(end.y - start.y);
  return dx >= dy ? 'horizontal' : 'vertical';
}

function newWallOptions(wt: WallType, start: Point2D, end: Point2D) {
  return {
    wallType: wt,
    structuralRole: wt === 'internal' ? ('partition' as const) : ('bearing' as const),
    panelizationEnabled: wt === 'external',
    panelDirection: inferPanelDirection(start, end),
  };
}

function openingToolFromMode(
  mode: string
): OpeningType | null {
  if (mode === 'draw-window') return 'window';
  if (mode === 'draw-door') return 'door';
  if (mode === 'draw-portal') return 'portal';
  return null;
}

export interface EditorCanvas2DProps {
  onRegisterFitView?: (fn: (() => void) | null) => void;
}

export function EditorCanvas2D({ onRegisterFitView }: EditorCanvas2DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 640, h: 480 });

  const draft = useEditorStore((s) => s.document.draftModel);
  const selection = useEditorStore((s) => s.selection);
  const view = useEditorStore((s) => s.view);
  const documentState = useEditorStore((s) => s.document);
  const applyCommand = useEditorStore((s) => s.applyCommand);
  const setPan = useEditorStore((s) => s.setPan);
  const setZoom = useEditorStore((s) => s.setZoom);
  const selectObject = useEditorStore((s) => s.selectObject);
  const clearSelection = useEditorStore((s) => s.clearSelection);

  const [drawState, setDrawState] = useState<DrawWallGestureState>({ kind: 'idle' });
  const [rectDrawState, setRectDrawState] = useState<DrawRectangleGestureState>({ kind: 'idle' });
  const wallBodyDragRef = useRef<WallBodyDragSession | null>(null);
  const [wallBodyPreview, setWallBodyPreview] = useState<Wall | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [hoveredWallId, setHoveredWallId] = useState<string | null>(null);
  const [hoveredOpeningId, setHoveredOpeningId] = useState<string | null>(null);
  const [showPanels, setShowPanels] = useState(true);
  const [showWallPanels, setShowWallPanels] = useState(true);
  const [showSlabPanels, setShowSlabPanels] = useState(true);
  const [showRoofPanels, setShowRoofPanels] = useState(true);
  const panelization = usePanelizationSnapshot();

  const panSessionRef = useRef<PanSession | null>(null);
  const dragSessionRef = useRef<DragSession | null>(null);
  const openingDragRef = useRef<OpeningDragSession | null>(null);
  const openingDragPreviewRef = useRef<{ openingId: string; positionAlongWall: number } | null>(null);
  const initialFitKeyRef = useRef<string | null>(null);

  const activeFloorId = view.activeFloorId;

  const panelOverlayPanels = useMemo((): GeneratedPanel[] => {
    if (!draft || !activeFloorId || !panelization) return [];
    const floor = getFloorById(draft, activeFloorId);
    if (!floor) return [];
    const floorWallsList = getWallsByFloor(draft, activeFloorId);
    const wallPanels: GeneratedPanel[] = [];
    for (let i = 0; i < floorWallsList.length; i += 1) {
      const w = floorWallsList[i]!;
      const stored = draft.wallPanelLayouts?.[w.id];
      if (!stored || stored.panels.length === 0) continue;
      wallPanels.push(...wallLayoutResultToGeneratedPanels(stored, w, floor.level, i + 1, draft));
    }
    const slabRoofFromSnapshot = panelization.generatedPanels.filter((p) => {
      if (p.floorId !== activeFloorId) return false;
      return p.sourceType === 'slab' || p.sourceType === 'roof';
    });
    return [...wallPanels, ...slabRoofFromSnapshot];
  }, [draft, activeFloorId, panelization]);

  const newWallWallType = view.newWallWallType ?? 'external';
  const newWallPlacement = view.newWallPlacement ?? 'on-axis';
  const activeEditorLayerId = view.activeEditorLayerId ?? null;
  const wallLayerKey = activeFloorId ? editorLayerFloorWalls(activeFloorId) : '';
  const openLayerKey = activeFloorId ? editorLayerFloorOpenings(activeFloorId) : '';
  const wallsVisible = wallLayerKey ? isEditorLayerVisible(view.layerVisibility, wallLayerKey) : true;
  const openingsVisible = openLayerKey
    ? isEditorLayerVisible(view.layerVisibility, openLayerKey)
    : true;
  const wallsLocked = wallLayerKey ? isEditorLayerLocked(view.layerLocked, wallLayerKey) : false;
  const openingsLocked = openLayerKey ? isEditorLayerLocked(view.layerLocked, openLayerKey) : false;

  const wallLayerActive =
    Boolean(activeFloorId) &&
    isWallDrawingLayer(activeEditorLayerId) &&
    parseFloorWallsLayer(activeEditorLayerId) === activeFloorId;
  const openingsLayerActive =
    Boolean(activeFloorId) &&
    isFloorOpeningsLayer(activeEditorLayerId) &&
    parseFloorOpeningsLayer(activeEditorLayerId) === activeFloorId;

  const canDrawWalls = wallLayerActive && wallsVisible && !wallsLocked;
  const canPlaceOpenings = openingsLayerActive && openingsVisible && !openingsLocked;
  const canMutateWalls = wallLayerActive && wallsVisible && !wallsLocked;
  const canMutateOpenings = openingsLayerActive && openingsVisible && !openingsLocked;

  const slabsLayerVisible = isEditorLayerVisible(view.layerVisibility, EDITOR_LAYER_SLABS);
  const slabsLayerLocked = isEditorLayerLocked(view.layerLocked, EDITOR_LAYER_SLABS);
  const roofLayerVisible = isEditorLayerVisible(view.layerVisibility, EDITOR_LAYER_ROOF);
  const roofLayerLocked = isEditorLayerLocked(view.layerLocked, EDITOR_LAYER_ROOF);
  const roofLayerActive = view.activeEditorLayerId === EDITOR_LAYER_ROOF;
  const foundationLayerVisible = isEditorLayerVisible(view.layerVisibility, EDITOR_LAYER_FOUNDATION);
  const groundScreedLayerVisible = isEditorLayerVisible(view.layerVisibility, EDITOR_LAYER_GROUND_SCREED);
  const foundationLayerLocked = isEditorLayerLocked(view.layerLocked, EDITOR_LAYER_FOUNDATION);
  const groundScreedLayerLocked = isEditorLayerLocked(view.layerLocked, EDITOR_LAYER_GROUND_SCREED);

  const gridStep = draft?.settings.gridStepMm ?? 100;

  const allFloorWallsForBounds = useMemo(() => {
    if (!draft || !activeFloorId) return [];
    return getWallsByFloor(draft, activeFloorId);
  }, [draft, activeFloorId]);

  const floorWalls = useMemo(() => {
    if (!draft || !activeFloorId || !wallsVisible) return [];
    return getWallsByFloor(draft, activeFloorId);
  }, [draft, activeFloorId, wallsVisible]);

  const drawWallPreviewPolygon = useMemo(() => {
    if (view.toolMode !== 'draw-wall' || drawState.kind !== 'drawing' || !draft || !activeFloorId) {
      return null;
    }
    const t = draft.settings.defaultWallThicknessMm;
    const center = baselineSegmentToCenterline(
      drawState.start,
      drawState.cursor,
      t,
      newWallPlacement
    );
    const pw: Wall = {
      id: '__preview__',
      floorId: activeFloorId,
      start: center.start,
      end: center.end,
      thicknessMm: t,
      wallType: newWallWallType,
    };
    return wallPolygonPointsMm(pw);
  }, [
    view.toolMode,
    drawState.kind,
    drawState.kind === 'drawing' ? drawState.start.x : 0,
    drawState.kind === 'drawing' ? drawState.start.y : 0,
    drawState.kind === 'drawing' ? drawState.cursor.x : 0,
    drawState.kind === 'drawing' ? drawState.cursor.y : 0,
    draft,
    activeFloorId,
    newWallPlacement,
    newWallWallType,
  ]);

  const floorOpenings = useMemo(() => {
    if (!draft || !activeFloorId || !openingsVisible) return [];
    return getOpeningsByFloor(draft, activeFloorId);
  }, [draft, activeFloorId, openingsVisible]);
  const floorSlabs = useMemo(() => {
    if (!draft || !activeFloorId) return [];
    return getSlabsByFloor(draft, activeFloorId);
  }, [draft, activeFloorId]);
  const topFloor = useMemo(() => (draft ? getTopFloor(draft) : null), [draft]);
  const roof = useMemo(() => (draft ? getRoofForTopFloor(draft) : null), [draft]);

  const floorFoundation = useMemo(() => {
    if (!draft || !activeFloorId) return null;
    return findFoundationByFloor(draft, activeFloorId) ?? null;
  }, [draft, activeFloorId]);

  const floorGroundScreed = useMemo(() => {
    if (!draft || !activeFloorId) return null;
    return findGroundScreedByFloor(draft, activeFloorId) ?? null;
  }, [draft, activeFloorId]);

  const wallById = useMemo(() => {
    if (!draft) return new Map<string, Wall>();
    return new Map(draft.walls.map((w) => [w.id, w]));
  }, [draft]);

  const selectedWall =
    selection.selectedObjectType === 'wall' && selection.selectedObjectId && draft
      ? findWallById(draft, selection.selectedObjectId)
      : undefined;

  const [dragPreview, setDragPreview] = useState<{
    wallId: string;
    endpoint: WallEndpoint;
    point: Point2D;
  } | null>(null);

  const wallsForDisplay = useMemo(() => {
    let base = floorWalls;
    if (wallBodyPreview) {
      base = base.map((w) => (w.id === wallBodyPreview.id ? wallBodyPreview : w));
    }
    if (dragPreview && draft && activeFloorId) {
      const w = findWallById(draft, dragPreview.wallId);
      if (w) {
        const jid = dragPreview.endpoint === 'start' ? w.startJointId : w.endJointId;
        if (jid) {
          const moved = wallsOnFloorAfterJointMove(draft, activeFloorId, jid, dragPreview.point);
          return base.map((bw) => moved.find((mw) => mw.id === bw.id) ?? bw);
        }
        return base.map((bw) =>
          bw.id === dragPreview.wallId
            ? wallWithEndpointMoved(w, dragPreview.endpoint, dragPreview.point)
            : bw
        );
      }
    }
    return base;
  }, [floorWalls, wallBodyPreview, dragPreview, draft, activeFloorId]);

  const [openingDragPreview, setOpeningDragPreview] = useState<{
    openingId: string;
    positionAlongWall: number;
  } | null>(null);

  const displayOpenings = useMemo(() => {
    if (!openingDragPreview) return floorOpenings;
    return floorOpenings.map((o) =>
      o.id === openingDragPreview.openingId
        ? { ...o, positionAlongWall: openingDragPreview.positionAlongWall }
        : o
    );
  }, [floorOpenings, openingDragPreview]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setSize({ w: Math.max(1, r.width), h: Math.max(1, r.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2200);
  }, []);

  const runFitView = useCallback(() => {
    const bb = computeWallsBoundingBoxMm(allFloorWallsForBounds);
    if (!bb) {
      setZoom(1);
      setPan(0, 0);
      return;
    }
    const t = computeFitViewTransform(bb, size.w, size.h, 1500);
    setZoom(t.zoom);
    setPan(t.panX, t.panY);
  }, [allFloorWallsForBounds, setPan, setZoom, size.h, size.w]);

  useEffect(() => {
    onRegisterFitView?.(runFitView);
    return () => onRegisterFitView?.(null);
  }, [onRegisterFitView, runFitView]);

  useEffect(() => {
    const pid = documentState.projectId ?? '';
    const vid = documentState.currentVersionId ?? '';
    const fid = activeFloorId ?? '';
    const key = `${pid}|${vid}|${fid}`;
    if (!allFloorWallsForBounds.length || !pid) return;
    if (initialFitKeyRef.current === key) return;
    initialFitKeyRef.current = key;
    const bb = computeWallsBoundingBoxMm(allFloorWallsForBounds);
    if (!bb) return;
    const t = computeFitViewTransform(bb, size.w, size.h, 1500);
    setZoom(t.zoom);
    setPan(t.panX, t.panY);
  }, [
    activeFloorId,
    documentState.currentVersionId,
    documentState.projectId,
    allFloorWallsForBounds,
    setPan,
    setZoom,
    size.h,
    size.w,
  ]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDrawState(drawWallCancel());
        setRectDrawState(drawRectangleCancel());
        setDragPreview(null);
        setWallBodyPreview(null);
        wallBodyDragRef.current = null;
        setOpeningDragPreview(null);
        openingDragPreviewRef.current = null;
        dragSessionRef.current = null;
        openingDragRef.current = null;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const t = e.target;
        if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement) {
          return;
        }
        if (selection.selectedObjectType === 'wall' && selection.selectedObjectId) {
          if (!canMutateWalls) return;
          e.preventDefault();
          applyCommand({ type: 'deleteWall', wallId: selection.selectedObjectId });
        } else if (selection.selectedObjectType === 'opening' && selection.selectedObjectId) {
          if (!canMutateOpenings) return;
          e.preventDefault();
          applyCommand({ type: 'deleteOpening', openingId: selection.selectedObjectId });
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [applyCommand, canMutateOpenings, canMutateWalls, selection.selectedObjectId, selection.selectedObjectType]);

  const worldFromEvent = useCallback(
    (e: ReactPointerEvent<Element>) => {
      const svg = svgRef.current;
      if (!svg) return { x: 0, y: 0 };
      return clientToWorld(e.clientX, e.clientY, svg, view.panX, view.panY, view.zoom);
    },
    [view.panX, view.panY, view.zoom]
  );

  const snap = useCallback(
    (p: Point2D) => snapPointToGrid(p, gridStep, view.snapEnabled),
    [gridStep, view.snapEnabled]
  );

  const vb = useMemo(
    () => viewportWorldRect(size.w, size.h, view.panX, view.panY, view.zoom),
    [size.w, size.h, view.panX, view.panY, view.zoom]
  );

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();
      const svg = svgRef.current;
      if (!svg) return;
      const z0 = view.zoom;
      const factor = e.deltaY > 0 ? 0.92 : 1.08;
      const z1 = clampEditorZoom(z0 * factor);
      const s = svg.getBoundingClientRect();
      const sx = e.clientX - s.left;
      const sy = e.clientY - s.top;
      const { panX, panY } = panToKeepWorldUnderScreenPoint(sx, sy, view.panX, view.panY, z0, z1);
      setZoom(z1);
      setPan(panX, panY);
    },
    [setPan, setZoom, view.panX, view.panY, view.zoom]
  );

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    svg.addEventListener('wheel', handleWheel, { passive: false });
    return () => svg.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  const onPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.button === 1) e.preventDefault();
    const svg = svgRef.current;
    if (!svg) return;

    if (!draft || !activeFloorId) return;

    const raw = worldFromEvent(e);
    const world = snap(raw);

    if (view.toolMode === 'draw-wall') {
      if (!canDrawWalls) {
        showToast('Выберите слой «Стены … этажа» в структуре проекта');
        return;
      }
      const worldSnapped = snap(raw);
      const jointed = snapPointToNearbyWallJoints(worldSnapped, draft, activeFloorId, '');
      const res = drawWallOnPointerDown(drawState, jointed);
      if (res.committed) {
        const { start, end } = res.committed;
        const t = draft.settings.defaultWallThicknessMm;
        const center = baselineSegmentToCenterline(start, end, t, newWallPlacement);
        const w = createWall({
          floorId: activeFloorId,
          start: center.start,
          end: center.end,
          thicknessMm: t,
          wallPlacement: newWallPlacement,
          ...newWallOptions(newWallWallType, center.start, center.end),
        });
        const r = applyCommand({ type: 'addWall', wall: w });
        if (!r.ok) {
          showToast(r.error);
        } else {
          selectObject(w.id, 'wall');
        }
        setDrawState(res.next);
        return;
      }
      setDrawState(res.next);
      svg.setPointerCapture(e.pointerId);
      return;
    }

    if (view.toolMode === 'draw-rectangle') {
      if (!canDrawWalls) {
        showToast('Выберите слой «Стены … этажа» в структуре проекта');
        return;
      }
      const res = drawRectangleOnPointerDown(rectDrawState, world);
      if (res.committed) {
        const { minX, minY, maxX, maxY } = res.committed;
        if (maxX - minX < MIN_RECT_EDGE_MM || maxY - minY < MIN_RECT_EDGE_MM) {
          showToast(`Сторона прямоугольника должна быть ≥ ${MIN_RECT_EDGE_MM} мм`);
          setRectDrawState(res.next);
          return;
        }
        const corners: [Point2D, Point2D, Point2D, Point2D] = [
          { x: minX, y: minY },
          { x: maxX, y: minY },
          { x: maxX, y: maxY },
          { x: minX, y: maxY },
        ];
        let lastId: string | null = null;
        const t = draft.settings.defaultWallThicknessMm;
        const placement = newWallPlacement;
        for (let i = 0; i < 4; i += 1) {
          const a = corners[i]!;
          const b = corners[(i + 1) % 4]!;
          const center = baselineSegmentToCenterline(a, b, t, placement);
          const w = createWall({
            floorId: activeFloorId,
            start: center.start,
            end: center.end,
            thicknessMm: t,
            wallPlacement: placement,
            ...newWallOptions(newWallWallType, center.start, center.end),
          });
          const r = applyCommand({ type: 'addWall', wall: w });
          if (!r.ok) {
            showToast(r.error);
            break;
          }
          lastId = w.id;
        }
        if (lastId) selectObject(lastId, 'wall');
        setRectDrawState(res.next);
        return;
      }
      setRectDrawState(res.next);
      svg.setPointerCapture(e.pointerId);
      return;
    }

    const openingType = openingToolFromMode(view.toolMode);
    if (openingType) {
      if (!canPlaceOpenings) {
        showToast('Активируйте слой «Проёмы» этажа слева (слой видим и не заблокирован)');
        return;
      }
      const tol = hitToleranceWorldMm(view.zoom);
      const hitWall = findClosestWallAtPoint(raw, floorWalls, tol);
      if (!hitWall) {
        showToast('Кликните по стене, чтобы поставить проём');
        return;
      }
      const built = buildOpeningOnWallClick(draft, hitWall.id, raw, openingType);
      if ('ok' in built && built.ok === false) {
        showToast(built.reason);
        return;
      }
      const op = built as Opening;
      const r = applyCommand({ type: 'addOpening', opening: op });
      if (!r.ok) showToast(r.error);
      else selectObject(op.id, 'opening');
      return;
    }

    if (view.toolMode === 'pan' || e.button === 1) {
      panSessionRef.current = { pointerId: e.pointerId, lastX: e.clientX, lastY: e.clientY };
      svg.setPointerCapture(e.pointerId);
      return;
    }

    if (view.toolMode === 'select') {
      const tol = hitToleranceWorldMm(view.zoom);
      const handleR = endpointHandleRadiusWorldMm(view.zoom);

      if (selectedWall && canMutateWalls) {
        const h = (e.target as HTMLElement).dataset?.handle as WallEndpoint | undefined;
        if (h === 'start' || h === 'end') {
          dragSessionRef.current = { wallId: selectedWall.id, endpoint: h, pointerId: e.pointerId };
          setDragPreview({ wallId: selectedWall.id, endpoint: h, point: world });
          svg.setPointerCapture(e.pointerId);
          return;
        }
        const ep = hitWallEndpoint(raw, selectedWall, handleR);
        if (ep) {
          dragSessionRef.current = { wallId: selectedWall.id, endpoint: ep, pointerId: e.pointerId };
          setDragPreview({ wallId: selectedWall.id, endpoint: ep, point: world });
          svg.setPointerCapture(e.pointerId);
          return;
        }
        if (hitWallBodyForDrag(raw, selectedWall, view.zoom)) {
          wallBodyDragRef.current = {
            wallId: selectedWall.id,
            pointerId: e.pointerId,
            startPointerWorld: world,
            baseWall: selectedWall,
          };
          setWallBodyPreview(selectedWall);
          svg.setPointerCapture(e.pointerId);
          return;
        }
      }

      const hitOp = findClosestOpeningAtPoint(floorOpenings, wallById, raw, tol);
      if (hitOp) {
        selectObject(hitOp.id, 'opening');
        if (canMutateOpenings) {
          openingDragRef.current = { openingId: hitOp.id, pointerId: e.pointerId };
          const startPreview = { openingId: hitOp.id, positionAlongWall: hitOp.positionAlongWall };
          openingDragPreviewRef.current = startPreview;
          setOpeningDragPreview(startPreview);
          svg.setPointerCapture(e.pointerId);
        }
        return;
      }

      const hit = findClosestWallAtPoint(raw, floorWalls, tol);
      if (hit) {
        selectObject(hit.id, 'wall');
      } else {
        clearSelection();
      }
    }
  };

  const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const bodyDrag = wallBodyDragRef.current;
    if (bodyDrag && bodyDrag.pointerId === e.pointerId && draft) {
      const cur = snap(worldFromEvent(e));
      let dx = cur.x - bodyDrag.startPointerWorld.x;
      let dy = cur.y - bodyDrag.startPointerWorld.y;
      if (e.shiftKey) {
        dy = 0;
      }
      if (e.altKey) {
        dx = 0;
      }
      setWallBodyPreview(translateWallByDelta(bodyDrag.baseWall, dx, dy));
      return;
    }

    const panS = panSessionRef.current;
    if (panS && panS.pointerId === e.pointerId) {
      const dx = e.clientX - panS.lastX;
      const dy = e.clientY - panS.lastY;
      panS.lastX = e.clientX;
      panS.lastY = e.clientY;
      setPan(view.panX + dx, view.panY + dy);
      return;
    }

    const openDrag = openingDragRef.current;
    if (openDrag && openDrag.pointerId === e.pointerId && draft) {
      const o = getOpeningById(draft, openDrag.openingId);
      const wall = o ? wallById.get(o.wallId) : undefined;
      if (o && wall) {
        const wpt = worldFromEvent(e);
        const next = proposeOpeningDragAlongWall(wpt, wall, o.widthMm, gridStep, view.snapEnabled);
        const pv = { openingId: o.id, positionAlongWall: next };
        openingDragPreviewRef.current = pv;
        setOpeningDragPreview(pv);
      }
      return;
    }

    const dragS = dragSessionRef.current;
    if (dragS && dragS.pointerId === e.pointerId && draft) {
      let w = snap(worldFromEvent(e));
      if (view.snapEnabled) {
        w = snapPointToNearbyWallJoints(w, draft, activeFloorId, dragS.wallId);
      }
      setDragPreview({ wallId: dragS.wallId, endpoint: dragS.endpoint, point: w });
      return;
    }

    if (view.toolMode === 'draw-wall' && drawState.kind === 'drawing') {
      const ws = snap(worldFromEvent(e));
      const j = snapPointToNearbyWallJoints(ws, draft, activeFloorId, '');
      setDrawState(drawWallOnPointerMove(drawState, j));
      return;
    }

    if (view.toolMode === 'draw-rectangle' && rectDrawState.kind === 'drawing') {
      setRectDrawState(drawRectangleOnPointerMove(rectDrawState, snap(worldFromEvent(e))));
      return;
    }

    if (
      view.toolMode === 'select' &&
      !dragSessionRef.current &&
      !openingDragRef.current &&
      !wallBodyDragRef.current
    ) {
      const raw = worldFromEvent(e);
      const tol = hitToleranceWorldMm(view.zoom);
      const op = findClosestOpeningAtPoint(floorOpenings, wallById, raw, tol);
      if (op) {
        setHoveredOpeningId(op.id);
        setHoveredWallId(null);
        return;
      }
      setHoveredOpeningId(null);
      const hit = findClosestWallAtPoint(raw, floorWalls, tol);
      setHoveredWallId(hit?.id ?? null);
    }
  };

  const onPointerUp = (e: ReactPointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;

    const bodyDrag = wallBodyDragRef.current;
    if (bodyDrag && bodyDrag.pointerId === e.pointerId && draft) {
      wallBodyDragRef.current = null;
      const cur = snap(worldFromEvent(e));
      let dx = cur.x - bodyDrag.startPointerWorld.x;
      let dy = cur.y - bodyDrag.startPointerWorld.y;
      if (e.shiftKey) {
        dy = 0;
      }
      if (e.altKey) {
        dx = 0;
      }
      setWallBodyPreview(null);
      let s = { x: bodyDrag.baseWall.start.x + dx, y: bodyDrag.baseWall.start.y + dy };
      let en = { x: bodyDrag.baseWall.end.x + dx, y: bodyDrag.baseWall.end.y + dy };
      s = snap(s);
      en = snap(en);
      if (view.snapEnabled) {
        s = snapPointToNearbyWallJoints(s, draft, activeFloorId, bodyDrag.wallId);
        en = snapPointToNearbyWallJoints(en, draft, activeFloorId, bodyDrag.wallId);
      }
      const r = applyCommand({
        type: 'updateWall',
        wallId: bodyDrag.wallId,
        patch: { start: s, end: en },
      });
      if (!r.ok) showToast(r.error);
      try {
        if (svg?.hasPointerCapture(e.pointerId)) svg.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      return;
    }

    const panS = panSessionRef.current;
    if (panS && panS.pointerId === e.pointerId) {
      panSessionRef.current = null;
    }

    const oDrag = openingDragRef.current;
    if (oDrag && oDrag.pointerId === e.pointerId && draft) {
      const prev = getOpeningById(draft, oDrag.openingId);
      const refPv = openingDragPreviewRef.current;
      openingDragPreviewRef.current = null;
      setOpeningDragPreview(null);
      openingDragRef.current = null;
      const previewPos =
        refPv && refPv.openingId === oDrag.openingId ? refPv.positionAlongWall : prev?.positionAlongWall;
      if (prev !== undefined && previewPos !== undefined && prev.positionAlongWall !== previewPos) {
        const r = applyCommand({
          type: 'updateOpening',
          openingId: oDrag.openingId,
          patch: { positionAlongWall: previewPos },
        });
        if (!r.ok) showToast(r.error);
      }
    }

    const dragS = dragSessionRef.current;
    if (dragS && dragS.pointerId === e.pointerId && draft) {
      const prev = findWallById(draft, dragS.wallId);
      let pt = snap(worldFromEvent(e));
      if (view.snapEnabled) {
        pt = snapPointToNearbyWallJoints(pt, draft, activeFloorId, dragS.wallId);
      }
      setDragPreview(null);
      dragSessionRef.current = null;
      if (prev) {
        const patch = updateWallPatchForEndpoint(dragS.endpoint, pt);
        const r = applyCommand({ type: 'updateWall', wallId: dragS.wallId, patch });
        if (!r.ok) showToast(r.error);
      }
    }

    try {
      if (svg?.hasPointerCapture(e.pointerId)) {
        svg.releasePointerCapture(e.pointerId);
      }
    } catch {
      /* ignore */
    }
  };

  const wallForDisplay = (w: typeof selectedWall) => {
    if (!w) return null;
    if (wallBodyPreview && wallBodyPreview.id === w.id) {
      return wallBodyPreview;
    }
    if (dragPreview && dragPreview.wallId === w.id && draft && activeFloorId) {
      const jid = dragPreview.endpoint === 'start' ? w.startJointId : w.endJointId;
      if (jid) {
        const moved = wallsOnFloorAfterJointMove(draft, activeFloorId, jid, dragPreview.point);
        const one = moved.find((x) => x.id === w.id);
        if (one) return one;
      }
      return wallWithEndpointMoved(w, dragPreview.endpoint, dragPreview.point);
    }
    return w;
  };

  const displaySelected = wallForDisplay(selectedWall ?? undefined);

  let cursor = 'default';
  if (view.toolMode === 'pan') cursor = 'grab';
  if (view.toolMode === 'draw-wall' || view.toolMode === 'draw-rectangle') cursor = 'crosshair';
  if (openingToolFromMode(view.toolMode)) cursor = 'crosshair';
  if (view.toolMode === 'select' && (hoveredWallId || hoveredOpeningId)) cursor = 'pointer';

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        flex: 1,
        minHeight: 0,
        background: '#e8e8ea',
        border: '1px solid #b8c0cc',
        borderRadius: 2,
        overflow: 'hidden',
      }}
    >
      {toast ? (
        <div
          style={{
            position: 'absolute',
            top: 8,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 5,
            padding: '6px 12px',
            background: '#1e293b',
            color: '#fff',
            fontSize: 12,
            borderRadius: 6,
            pointerEvents: 'none',
          }}
        >
          {toast}
        </div>
      ) : null}

      {!draft || !activeFloorId ? (
        <div style={{ padding: 24, color: '#64748b', fontSize: 14 }}>
          Выберите этаж слева или добавьте этаж — без активного этажа стены не отображаются.
        </div>
      ) : (
        <>
        <div style={{ position: 'absolute', right: 8, top: 8, zIndex: 4 }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
            <button type="button" onClick={() => setShowWallPanels((v) => !v)} style={{ fontSize: 10, padding: '2px 6px' }}>
              W {showWallPanels ? 'on' : 'off'}
            </button>
            <button type="button" onClick={() => setShowSlabPanels((v) => !v)} style={{ fontSize: 10, padding: '2px 6px' }}>
              S {showSlabPanels ? 'on' : 'off'}
            </button>
            <button type="button" onClick={() => setShowRoofPanels((v) => !v)} style={{ fontSize: 10, padding: '2px 6px' }}>
              R {showRoofPanels ? 'on' : 'off'}
            </button>
          </div>
          <button
            type="button"
            onClick={() => setShowPanels((v) => !v)}
            style={{
              fontSize: 11,
              padding: '4px 8px',
              borderRadius: 6,
              border: '1px solid #cbd5e1',
              background: '#fff',
            }}
          >
            {showPanels ? 'Скрыть панели' : 'Показать панели'}
          </button>
        </div>
        {floorWalls.length === 0 && displayOpenings.length === 0 ? (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
              zIndex: 2,
            }}
          >
            <span
              style={{
                padding: '8px 14px',
                background: 'rgba(255,255,255,0.92)',
                borderRadius: 8,
                fontSize: 13,
                color: '#64748b',
                boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
              }}
            >
              На этом этаже пока нет стен и проёмов — выберите инструмент и нарисуйте стену.
            </span>
          </div>
        ) : null}
        <svg
          ref={svgRef}
          width={size.w}
          height={size.h}
          style={{ display: 'block', cursor, touchAction: 'none' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <g transform={`translate(${view.panX} ${view.panY}) scale(${view.zoom})`}>
            <GridLayer
              visible={view.gridVisible}
              minX={vb.minX}
              maxX={vb.maxX}
              minY={vb.minY}
              maxY={vb.maxY}
              minorStepMm={gridStep}
              majorStepMm={MAJOR_GRID_MM}
            />
            <FoundationPlanLayer
              foundation={floorFoundation}
              screed={floorGroundScreed}
              zoom={view.zoom}
              foundationVisible={foundationLayerVisible}
              screedVisible={groundScreedLayerVisible}
              foundationLayerActive={view.activeEditorLayerId === EDITOR_LAYER_FOUNDATION}
              screedLayerActive={view.activeEditorLayerId === EDITOR_LAYER_GROUND_SCREED}
              selectedFoundationId={
                selection.selectedObjectType === 'foundation' ? selection.selectedObjectId : null
              }
              selectedScreedId={
                selection.selectedObjectType === 'groundScreed' ? selection.selectedObjectId : null
              }
              onSelectFoundation={
                foundationLayerLocked
                  ? undefined
                  : (id) => {
                      selectObject(id, 'foundation');
                    }
              }
              onSelectScreed={
                groundScreedLayerLocked
                  ? undefined
                  : (id) => {
                      selectObject(id, 'groundScreed');
                    }
              }
            />
            {slabsLayerVisible ? (
              <SlabPlanLayer
                slabs={floorSlabs}
                zoom={view.zoom}
                layerActive={view.activeEditorLayerId === EDITOR_LAYER_SLABS}
                selectedSlabId={selection.selectedObjectType === 'slab' ? selection.selectedObjectId : null}
                onSelectSlab={
                  slabsLayerLocked
                    ? undefined
                    : (id) => {
                        selectObject(id, 'slab');
                      }
                }
              />
            ) : null}
            <WallsLayer
              walls={wallsForDisplay}
              selectedWallId={
                selection.selectedObjectType === 'wall' ? selection.selectedObjectId : null
              }
              hoveredWallId={hoveredWallId}
            />
            {slabsLayerVisible &&
              floorSlabs
                .filter((slab) => !slab.contourMm || slab.contourMm.length < 3)
                .map((slab) => {
                  const bb = computeWallsBoundingBoxMm(allFloorWallsForBounds);
                  if (!bb) return null;
                  const cx = (bb.minX + bb.maxX) / 2;
                  const cy = (bb.minY + bb.maxY) / 2;
                  const arrow =
                    slab.direction === 'x'
                      ? { x1: bb.minX, y1: cy, x2: bb.maxX, y2: cy }
                      : { x1: cx, y1: bb.minY, x2: cx, y2: bb.maxY };
                  return (
                    <g key={slab.id}>
                      <rect
                        x={bb.minX}
                        y={bb.minY}
                        width={bb.maxX - bb.minX}
                        height={bb.maxY - bb.minY}
                        fill="rgba(2,132,199,0.08)"
                        stroke="rgba(2,132,199,0.8)"
                        strokeDasharray={`${500 / view.zoom} ${250 / view.zoom}`}
                        strokeWidth={Math.max(2, 60 / view.zoom)}
                        vectorEffect="non-scaling-stroke"
                      />
                      <line
                        x1={arrow.x1}
                        y1={arrow.y1}
                        x2={arrow.x2}
                        y2={arrow.y2}
                        stroke="rgba(2,132,199,0.95)"
                        strokeWidth={Math.max(2, 80 / view.zoom)}
                        markerEnd="url(#slabArrow)"
                        vectorEffect="non-scaling-stroke"
                      />
                      <text
                        x={cx}
                        y={cy - 200 / view.zoom}
                        textAnchor="middle"
                        fontSize={Math.max(120, 240 / view.zoom)}
                        fill="#0369a1"
                      >
                        slab: {slab.slabType}
                      </text>
                    </g>
                  );
                })}
            {roofLayerVisible && roof && topFloor?.id === activeFloorId ? (() => {
              const bb = computeWallsBoundingBoxMm(allFloorWallsForBounds);
              if (!bb) return null;
              const eaves = roof.eavesContourMm;
              const strokeRoof = roofLayerActive ? 'rgba(127,29,29,0.92)' : 'rgba(185,28,28,0.78)';
              const fillRoof = roofLayerActive ? 'rgba(185,28,28,0.14)' : 'rgba(185,28,28,0.06)';
              const horizontal = (roof.ridgeDirection ?? 'x') === 'x';
              let minPx = bb.minX - roof.overhangMm;
              let maxPx = bb.maxX + roof.overhangMm;
              let minPy = bb.minY - roof.overhangMm;
              let maxPy = bb.maxY + roof.overhangMm;
              if (eaves && eaves.length >= 3) {
                minPx = Math.min(...eaves.map((p) => p.x));
                maxPx = Math.max(...eaves.map((p) => p.x));
                minPy = Math.min(...eaves.map((p) => p.y));
                maxPy = Math.max(...eaves.map((p) => p.y));
              }
              const rcx = (minPx + maxPx) / 2;
              const rcy = (minPy + maxPy) / 2;
              const ridge =
                roof.ridgeLineMm && roof.roofType === 'gable'
                  ? { x1: roof.ridgeLineMm.a.x, y1: roof.ridgeLineMm.a.y, x2: roof.ridgeLineMm.b.x, y2: roof.ridgeLineMm.b.y }
                  : horizontal
                    ? { x1: minPx, y1: rcy, x2: maxPx, y2: rcy }
                    : { x1: rcx, y1: minPy, x2: rcx, y2: maxPy };
              const drain = roof.singleSlopeDrainToward ?? (horizontal ? '+y' : '+x');
              const al = 1800;
              let sax1 = rcx;
              let say1 = rcy;
              let sax2 = rcx;
              let say2 = rcy;
              if (roof.roofType === 'single_slope') {
                if (drain === '+y') {
                  say1 = rcy - al / 2;
                  say2 = rcy + al / 2;
                } else if (drain === '-y') {
                  say1 = rcy + al / 2;
                  say2 = rcy - al / 2;
                } else if (drain === '+x') {
                  sax1 = rcx - al / 2;
                  sax2 = rcx + al / 2;
                } else {
                  sax1 = rcx + al / 2;
                  sax2 = rcx - al / 2;
                }
              }
              const eavesPoints =
                eaves && eaves.length >= 3 ? eaves.map((p) => `${p.x},${p.y}`).join(' ') : null;
              return (
                <g pointerEvents="none" opacity={roofLayerLocked ? 0.45 : 1}>
                  {eavesPoints ? (
                    <polygon
                      points={eavesPoints}
                      fill={fillRoof}
                      stroke={strokeRoof}
                      strokeWidth={Math.max(2, 60 / view.zoom)}
                      vectorEffect="non-scaling-stroke"
                    />
                  ) : (
                    <rect
                      x={minPx}
                      y={minPy}
                      width={maxPx - minPx}
                      height={maxPy - minPy}
                      fill={fillRoof}
                      stroke={strokeRoof}
                      strokeWidth={Math.max(2, 60 / view.zoom)}
                      vectorEffect="non-scaling-stroke"
                    />
                  )}
                  <line
                    x1={ridge.x1}
                    y1={ridge.y1}
                    x2={ridge.x2}
                    y2={ridge.y2}
                    stroke="rgba(153,27,27,0.95)"
                    strokeWidth={Math.max(2, 90 / view.zoom)}
                    strokeDasharray={roof.roofType === 'gable' ? undefined : `${350 / view.zoom} ${200 / view.zoom}`}
                    vectorEffect="non-scaling-stroke"
                  />
                  {roof.roofType === 'single_slope' ? (
                    <line
                      x1={sax1}
                      y1={say1}
                      x2={sax2}
                      y2={say2}
                      stroke="rgba(220,38,38,0.95)"
                      strokeWidth={Math.max(2, 80 / view.zoom)}
                      markerEnd="url(#roofArrow)"
                      vectorEffect="non-scaling-stroke"
                    />
                  ) : null}
                  <text
                    x={rcx}
                    y={minPy - 250 / view.zoom}
                    textAnchor="middle"
                    fontSize={Math.max(120, 240 / view.zoom)}
                    fill={roofLayerActive ? '#7f1d1d' : '#991b1b'}
                  >
                    {roofLayerActive ? 'Крыша · ' : ''}
                    {roof.roofType === 'gable' ? 'двускатная' : 'односкатная'} {roof.slopeDegrees}°
                  </text>
                </g>
              );
            })() : null}
            <OpeningsLayer
              openings={displayOpenings}
              wallById={wallById}
              selectedOpeningId={
                selection.selectedObjectType === 'opening' ? selection.selectedObjectId : null
              }
              hoveredOpeningId={hoveredOpeningId}
              viewZoom={view.zoom}
            />
            {showPanels && panelization ? (
              <PanelOverlayLayer
                model={draft}
                viewZoom={view.zoom}
                panels={panelOverlayPanels.filter((p) => {
                  if (p.floorId !== activeFloorId) return false;
                  if (p.sourceType === 'wall') return showWallPanels;
                  if (p.sourceType === 'slab') return showSlabPanels;
                  if (p.sourceType === 'roof') return showRoofPanels;
                  return false;
                })}
                selectedWallId={
                  selection.selectedObjectType === 'wall' ? selection.selectedObjectId : null
                }
                selectedSlabId={
                  selection.selectedObjectType === 'slab' ? selection.selectedObjectId : null
                }
                selectedRoofId={
                  selection.selectedObjectType === 'roof' ? selection.selectedObjectId : null
                }
                showLabels
              />
            ) : null}
            {drawWallPreviewPolygon ? (
              <polygon
                points={drawWallPreviewPolygon}
                fill="rgba(37,99,235,0.12)"
                stroke="#2563eb"
                strokeWidth={Math.max(1, 40 / view.zoom)}
                strokeDasharray={`${400 / view.zoom} ${200 / view.zoom}`}
                vectorEffect="non-scaling-stroke"
              />
            ) : null}
            {view.toolMode === 'draw-rectangle' && rectDrawState.kind === 'drawing' ? (() => {
              const ax = rectDrawState.cornerA.x;
              const ay = rectDrawState.cornerA.y;
              const bx = rectDrawState.cursor.x;
              const by = rectDrawState.cursor.y;
              const minX = Math.min(ax, bx);
              const maxX = Math.max(ax, bx);
              const minY = Math.min(ay, by);
              const maxY = Math.max(ay, by);
              const rw = maxX - minX;
              const rh = maxY - minY;
              const z = Math.max(0.15, Math.min(4, view.zoom));
              const fs = Math.max(200, Math.min(800, 400 / z));
              const cx = (minX + maxX) / 2;
              const cy = (minY + maxY) / 2;
              return (
                <g pointerEvents="none">
                  <rect
                    x={minX}
                    y={minY}
                    width={rw}
                    height={rh}
                    fill="none"
                    stroke="#7c3aed"
                    strokeWidth={Math.max(2, 80 / view.zoom)}
                    strokeDasharray={`${400 / view.zoom} ${200 / view.zoom}`}
                    vectorEffect="non-scaling-stroke"
                  />
                  <text
                    x={cx}
                    y={cy}
                    fill="#5b21b6"
                    fontSize={fs}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    stroke="rgba(255,255,255,0.92)"
                    strokeWidth={Math.max(16, fs * 0.1)}
                    paintOrder="stroke fill"
                    style={{ userSelect: 'none' }}
                  >
                    {Math.round(rw)} × {Math.round(rh)} мм
                  </text>
                </g>
              );
            })() : null}
            {displaySelected && view.toolMode === 'select' ? (
              <>
                <WallLengthLabel wall={displaySelected} visible viewZoom={view.zoom} />
                {canMutateWalls ? (
                  <SelectionHandles
                    wall={displaySelected}
                    radiusMm={endpointHandleRadiusWorldMm(view.zoom)}
                  />
                ) : null}
              </>
            ) : null}
            <defs>
              <marker id="slabArrow" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="rgba(2,132,199,0.95)" />
              </marker>
              <marker id="roofArrow" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="rgba(220,38,38,0.95)" />
              </marker>
            </defs>
          </g>
        </svg>
        {view.toolMode === 'draw-rectangle' && rectDrawState.kind === 'drawing' ? (
          <RectangleDrawHud
            cornerA={rectDrawState.cornerA}
            cursor={rectDrawState.cursor}
            onApplySizeMm={(widthMm, heightMm) => {
              const nc = rectangleOppositeCornerFromSize(
                rectDrawState.cornerA,
                rectDrawState.cursor,
                widthMm,
                heightMm
              );
              if (!nc) return;
              setRectDrawState({
                kind: 'drawing',
                cornerA: rectDrawState.cornerA,
                cursor: nc,
              });
            }}
          />
        ) : null}
        </>
      )}
    </div>
  );
}
