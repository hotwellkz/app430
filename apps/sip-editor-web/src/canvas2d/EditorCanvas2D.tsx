import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from 'react';
import {
  clampEditorZoom,
  useEditorStore,
} from '@2wix/editor-core';
import {
  buildOpeningOnWallClick,
  createWall,
  findWallById,
  getOpeningById,
  getOpeningsByFloor,
  getRoofForTopFloor,
  getSlabsByFloor,
  getTopFloor,
  getWallsByFloor,
} from '@2wix/domain-model';
import type { Opening, OpeningType, Point2D, Wall } from '@2wix/shared-types';
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
  hitWallEndpoint,
  type WallEndpoint,
} from './hitTest.js';
import { updateWallPatchForEndpoint, wallWithEndpointMoved } from './endpointDrag.js';
import { findClosestOpeningAtPoint } from './openingHitTest.js';
import { proposeOpeningDragAlongWall } from './openingDrag.js';
import { computeFitViewTransform, computeWallsBoundingBoxMm } from './viewFit.js';
import { snapPointToNearbyWallJoints } from './endpointJointSnap.js';

const MAJOR_GRID_MM = 5000;

type PanSession = { pointerId: number; lastX: number; lastY: number };
type DragSession = { wallId: string; endpoint: WallEndpoint; pointerId: number };
type OpeningDragSession = { openingId: string; pointerId: number };

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
  const [toast, setToast] = useState<string | null>(null);
  const [hoveredWallId, setHoveredWallId] = useState<string | null>(null);
  const [hoveredOpeningId, setHoveredOpeningId] = useState<string | null>(null);

  const panSessionRef = useRef<PanSession | null>(null);
  const dragSessionRef = useRef<DragSession | null>(null);
  const openingDragRef = useRef<OpeningDragSession | null>(null);
  const openingDragPreviewRef = useRef<{ openingId: string; positionAlongWall: number } | null>(null);
  const initialFitKeyRef = useRef<string | null>(null);

  const activeFloorId = view.activeFloorId;
  const gridStep = draft?.settings.gridStepMm ?? 100;

  const floorWalls = useMemo(() => {
    if (!draft || !activeFloorId) return [];
    return getWallsByFloor(draft, activeFloorId);
  }, [draft, activeFloorId]);

  const floorOpenings = useMemo(() => {
    if (!draft || !activeFloorId) return [];
    return getOpeningsByFloor(draft, activeFloorId);
  }, [draft, activeFloorId]);
  const floorSlabs = useMemo(() => {
    if (!draft || !activeFloorId) return [];
    return getSlabsByFloor(draft, activeFloorId);
  }, [draft, activeFloorId]);
  const topFloor = useMemo(() => (draft ? getTopFloor(draft) : null), [draft]);
  const roof = useMemo(() => (draft ? getRoofForTopFloor(draft) : null), [draft]);

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
    const bb = computeWallsBoundingBoxMm(floorWalls);
    if (!bb) {
      setZoom(1);
      setPan(0, 0);
      return;
    }
    const t = computeFitViewTransform(bb, size.w, size.h, 1500);
    setZoom(t.zoom);
    setPan(t.panX, t.panY);
  }, [floorWalls, setPan, setZoom, size.h, size.w]);

  useEffect(() => {
    onRegisterFitView?.(runFitView);
    return () => onRegisterFitView?.(null);
  }, [onRegisterFitView, runFitView]);

  useEffect(() => {
    const pid = documentState.projectId ?? '';
    const vid = documentState.currentVersionId ?? '';
    const fid = activeFloorId ?? '';
    const key = `${pid}|${vid}|${fid}`;
    if (!floorWalls.length || !pid) return;
    if (initialFitKeyRef.current === key) return;
    initialFitKeyRef.current = key;
    const bb = computeWallsBoundingBoxMm(floorWalls);
    if (!bb) return;
    const t = computeFitViewTransform(bb, size.w, size.h, 1500);
    setZoom(t.zoom);
    setPan(t.panX, t.panY);
  }, [
    activeFloorId,
    documentState.currentVersionId,
    documentState.projectId,
    floorWalls,
    setPan,
    setZoom,
    size.h,
    size.w,
  ]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDrawState(drawWallCancel());
        setDragPreview(null);
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
          e.preventDefault();
          applyCommand({ type: 'deleteWall', wallId: selection.selectedObjectId });
        } else if (selection.selectedObjectType === 'opening' && selection.selectedObjectId) {
          e.preventDefault();
          applyCommand({ type: 'deleteOpening', openingId: selection.selectedObjectId });
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [applyCommand, selection.selectedObjectId, selection.selectedObjectType]);

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
    (e: ReactWheelEvent<SVGSVGElement>) => {
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

  const onPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.button === 1) e.preventDefault();
    const svg = svgRef.current;
    if (!svg) return;

    if (!draft || !activeFloorId) return;

    const raw = worldFromEvent(e);
    const world = snap(raw);

    if (view.toolMode === 'draw-wall') {
      const res = drawWallOnPointerDown(drawState, world);
      if (res.committed) {
        const { start, end } = res.committed;
        const w = createWall({
          floorId: activeFloorId,
          start,
          end,
          thicknessMm: draft.settings.defaultWallThicknessMm,
          wallType: 'external',
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

    const openingType = openingToolFromMode(view.toolMode);
    if (openingType) {
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

      if (selectedWall) {
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
      }

      const hitOp = findClosestOpeningAtPoint(floorOpenings, wallById, raw, tol);
      if (hitOp) {
        selectObject(hitOp.id, 'opening');
        openingDragRef.current = { openingId: hitOp.id, pointerId: e.pointerId };
        const startPreview = { openingId: hitOp.id, positionAlongWall: hitOp.positionAlongWall };
        openingDragPreviewRef.current = startPreview;
        setOpeningDragPreview(startPreview);
        svg.setPointerCapture(e.pointerId);
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
      const w = snap(worldFromEvent(e));
      setDragPreview({ wallId: dragS.wallId, endpoint: dragS.endpoint, point: w });
      return;
    }

    if (view.toolMode === 'draw-wall' && drawState.kind === 'drawing') {
      setDrawState(drawWallOnPointerMove(drawState, snap(worldFromEvent(e))));
      return;
    }

    if (view.toolMode === 'select' && !dragSessionRef.current && !openingDragRef.current) {
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
      let pt =
        dragPreview && dragPreview.wallId === dragS.wallId
          ? dragPreview.point
          : snap(worldFromEvent(e));
      if (view.snapEnabled) {
        pt = snapPointToNearbyWallJoints(pt, floorWalls, dragS.wallId);
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
    if (dragPreview && dragPreview.wallId === w.id) {
      return wallWithEndpointMoved(w, dragPreview.endpoint, dragPreview.point);
    }
    return w;
  };

  const displaySelected = wallForDisplay(selectedWall ?? undefined);

  let cursor = 'default';
  if (view.toolMode === 'pan') cursor = 'grab';
  if (view.toolMode === 'draw-wall') cursor = 'crosshair';
  if (openingToolFromMode(view.toolMode)) cursor = 'crosshair';
  if (view.toolMode === 'select' && (hoveredWallId || hoveredOpeningId)) cursor = 'pointer';

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        flex: 1,
        minHeight: 0,
        background: '#f1f5f9',
        border: '1px solid var(--twix-border, #e2e8f0)',
        borderRadius: 8,
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
          onWheel={handleWheel}
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
            <WallsLayer
              walls={floorWalls}
              selectedWallId={
                selection.selectedObjectType === 'wall' ? selection.selectedObjectId : null
              }
              hoveredWallId={hoveredWallId}
            />
            {floorSlabs.map((slab) => {
              const bb = computeWallsBoundingBoxMm(floorWalls);
              if (!bb) return null;
              const cx = (bb.minX + bb.maxX) / 2;
              const cy = (bb.minY + bb.maxY) / 2;
              const arrow = slab.direction === 'x'
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
            {roof && topFloor?.id === activeFloorId ? (() => {
              const bb = computeWallsBoundingBoxMm(floorWalls);
              if (!bb) return null;
              const cx = (bb.minX + bb.maxX) / 2;
              const cy = (bb.minY + bb.maxY) / 2;
              const horizontal = (roof.ridgeDirection ?? 'x') === 'x';
              const ridge = horizontal
                ? { x1: bb.minX, y1: cy, x2: bb.maxX, y2: cy }
                : { x1: cx, y1: bb.minY, x2: cx, y2: bb.maxY };
              const slopeArrow = horizontal
                ? { x1: cx, y1: cy, x2: cx, y2: bb.maxY }
                : { x1: cx, y1: cy, x2: bb.maxX, y2: cy };
              return (
                <g>
                  <rect
                    x={bb.minX - roof.overhangMm}
                    y={bb.minY - roof.overhangMm}
                    width={bb.maxX - bb.minX + roof.overhangMm * 2}
                    height={bb.maxY - bb.minY + roof.overhangMm * 2}
                    fill="rgba(185,28,28,0.05)"
                    stroke="rgba(185,28,28,0.75)"
                    strokeWidth={Math.max(2, 60 / view.zoom)}
                    vectorEffect="non-scaling-stroke"
                  />
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
                      x1={slopeArrow.x1}
                      y1={slopeArrow.y1}
                      x2={slopeArrow.x2}
                      y2={slopeArrow.y2}
                      stroke="rgba(220,38,38,0.95)"
                      strokeWidth={Math.max(2, 80 / view.zoom)}
                      markerEnd="url(#roofArrow)"
                      vectorEffect="non-scaling-stroke"
                    />
                  ) : null}
                  <text
                    x={cx}
                    y={bb.minY - 250 / view.zoom}
                    textAnchor="middle"
                    fontSize={Math.max(120, 240 / view.zoom)}
                    fill="#991b1b"
                  >
                    roof: {roof.roofType} {roof.slopeDegrees}°
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
            />
            {view.toolMode === 'draw-wall' && drawState.kind === 'drawing' ? (
              <line
                x1={drawState.start.x}
                y1={drawState.start.y}
                x2={drawState.cursor.x}
                y2={drawState.cursor.y}
                stroke="#2563eb"
                strokeWidth={Math.max(2, 80 / view.zoom)}
                strokeDasharray={`${400 / view.zoom} ${200 / view.zoom}`}
                vectorEffect="non-scaling-stroke"
              />
            ) : null}
            {displaySelected && view.toolMode === 'select' ? (
              <>
                <WallLengthLabel wall={displaySelected} visible />
                <SelectionHandles
                  wall={displaySelected}
                  radiusMm={endpointHandleRadiusWorldMm(view.zoom)}
                />
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
        </>
      )}
    </div>
  );
}
