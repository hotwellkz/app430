import {
  baselineSegmentToCenterline,
  centerlineSegmentToBaseline,
  computeWallLengthMm,
  countWallsReferencingJoint,
  endPointForLengthFromStart,
  findWallById,
  getOpeningsByWall,
  getEffectiveWallHeight,
  getFloorById,
  isWallPanelLayoutOutdated,
  getWallHeightMode,
  parsePositiveMmString,
  wallDirectionDegrees,
} from '@2wix/domain-model';
import { useEditorStore } from '@2wix/editor-core';
import { batchComputeWallPanelLayoutsForFloor } from '@2wix/panel-engine';
import type { BatchWallPanelLayoutFloorSummary } from '@2wix/panel-engine';
import type { WallPlacementMode, WallType } from '@2wix/shared-types';
import { useEffect, useMemo, useState } from 'react';
import { usePanelizationSnapshot } from '../panelization/usePanelizationSnapshot';
import { useSpecSnapshot } from '../spec/useSpecSnapshot';

export function WallInspector() {
  const draft = useEditorStore((s) => s.document.draftModel);
  const selection = useEditorStore((s) => s.selection);
  const applyCommand = useEditorStore((s) => s.applyCommand);
  const setActivePanel = useEditorStore((s) => s.setActivePanel);
  const activeFloorId = useEditorStore((s) => s.view.activeFloorId);
  const panelization = usePanelizationSnapshot();
  const spec = useSpecSnapshot();

  if (!draft || selection.selectedObjectType !== 'wall' || !selection.selectedObjectId) {
    return (
      <p className="twix-muted" style={{ fontSize: 13 }}>
        Выберите стену на canvas или в списке.
      </p>
    );
  }

  const wall = findWallById(draft, selection.selectedObjectId);
  if (!wall) return null;

  const len = computeWallLengthMm(wall);
  const angleDeg = useMemo(() => Math.round(wallDirectionDegrees(wall) * 10) / 10, [wall]);
  const wallType: WallType = wall.wallType ?? 'external';
  const wallPlacement: WallPlacementMode = wall.wallPlacement ?? 'on-axis';
  const floor = getFloorById(draft, wall.floorId);
  const effectiveHeight = getEffectiveWallHeight(wall, floor);
  const heightMode = getWallHeightMode(wall);
  const summary = panelization?.wallSummaries.find((x) => x.wallId === wall.id);
  const wallSpec = spec?.wallSummaries.find((x) => x.wallId === wall.id);
  const wallWarnings = panelization?.warnings.filter((w) => w.relatedObjectIds.includes(wall.id)) ?? [];
  const structuralRole = wall.structuralRole ?? 'bearing';
  const panelDirection = wall.panelDirection ?? 'vertical';
  const enabled = wall.panelizationEnabled ?? wallType === 'external';
  const effectivePanelTypeId = wall.panelTypeId ?? draft.panelSettings.defaultPanelTypeId ?? '';

  const [lenStr, setLenStr] = useState(() => String(Math.round(len)));
  const [sxStr, setSxStr] = useState(() => String(Math.round(wall.start.x)));
  const [syStr, setSyStr] = useState(() => String(Math.round(wall.start.y)));
  const [exStr, setExStr] = useState(() => String(Math.round(wall.end.x)));
  const [eyStr, setEyStr] = useState(() => String(Math.round(wall.end.y)));
  const [shiftXStr, setShiftXStr] = useState('0');
  const [shiftYStr, setShiftYStr] = useState('0');
  const [batchSummary, setBatchSummary] = useState<BatchWallPanelLayoutFloorSummary | null>(null);

  const storedLayout = draft.wallPanelLayouts?.[wall.id];
  const openingsOnWall = getOpeningsByWall(draft, wall.id).length;
  const layoutStale = storedLayout ? isWallPanelLayoutOutdated(draft, wall.id) : false;

  useEffect(() => {
    setLenStr(String(Math.round(computeWallLengthMm(wall))));
    setSxStr(String(Math.round(wall.start.x)));
    setSyStr(String(Math.round(wall.start.y)));
    setExStr(String(Math.round(wall.end.x)));
    setEyStr(String(Math.round(wall.end.y)));
    setShiftXStr('0');
    setShiftYStr('0');
  }, [wall.id, wall.start.x, wall.start.y, wall.end.x, wall.end.y]);

  const applyLength = () => {
    const v = parsePositiveMmString(lenStr, 50);
    if (v === null) return;
    const nextEnd = endPointForLengthFromStart(wall, v);
    if (!nextEnd) return;
    const len0 = computeWallLengthMm(wall);
    if (len0 < 1e-6) return;
    const ux = (wall.end.x - wall.start.x) / len0;
    const uy = (wall.end.y - wall.start.y) / len0;
    const pd = Math.abs(ux) >= Math.abs(uy) ? ('horizontal' as const) : ('vertical' as const);
    applyCommand({
      type: 'updateWall',
      wallId: wall.id,
      patch: { end: nextEnd, panelDirection: pd },
    });
  };

  const applyCoords = () => {
    const sx = Number(sxStr.replace(',', '.'));
    const sy = Number(syStr.replace(',', '.'));
    const ex = Number(exStr.replace(',', '.'));
    const ey = Number(eyStr.replace(',', '.'));
    if (![sx, sy, ex, ey].every((n) => Number.isFinite(n))) return;
    const segLen = Math.hypot(ex - sx, ey - sy);
    if (segLen < 1) return;
    const pd = Math.abs(ex - sx) >= Math.abs(ey - sy) ? ('horizontal' as const) : ('vertical' as const);
    applyCommand({
      type: 'updateWall',
      wallId: wall.id,
      patch: {
        start: { x: sx, y: sy },
        end: { x: ex, y: ey },
        panelDirection: pd,
      },
    });
  };

  const parseShift = (raw: string): number | null => {
    const t = raw.trim().replace(',', '.');
    if (t === '' || t === '-') return null;
    const v = Number(t);
    return Number.isFinite(v) ? v : null;
  };

  const applyShift = (axis: 'both' | 'x' | 'y') => {
    const dx = parseShift(shiftXStr);
    const dy = parseShift(shiftYStr);
    if (dx === null || dy === null) return;
    if (axis === 'x') {
      applyCommand({ type: 'translateWall', wallId: wall.id, dxMm: dx, dyMm: 0, axis: 'x' });
    } else if (axis === 'y') {
      applyCommand({ type: 'translateWall', wallId: wall.id, dxMm: 0, dyMm: dy, axis: 'y' });
    } else {
      applyCommand({ type: 'translateWall', wallId: wall.id, dxMm: dx, dyMm: dy, axis: 'both' });
    }
    setShiftXStr('0');
    setShiftYStr('0');
  };

  return (
    <div style={{ fontSize: 13 }}>
      <p className="twix-panelTitle">Стена</p>
      <dl style={{ margin: 0, display: 'grid', gap: 6 }}>
        <dt className="twix-muted">id</dt>
        <dd style={{ margin: 0, wordBreak: 'break-all' }}>{wall.id}</dd>
        <dt className="twix-muted">floorId</dt>
        <dd style={{ margin: 0 }}>{wall.floorId}</dd>
        <dt className="twix-muted">Тип</dt>
        <dd style={{ margin: 0 }}>
          <select
            value={wallType}
            onChange={(e) => {
              const v = e.target.value as WallType;
              applyCommand({
                type: 'updateWall',
                wallId: wall.id,
                patch: { wallType: v },
              });
            }}
            style={{ width: '100%', padding: 4 }}
          >
            <option value="external">Наружная</option>
            <option value="internal">Внутренняя</option>
          </select>
        </dd>
        <dt className="twix-muted">Привязка линии</dt>
        <dd style={{ margin: 0 }}>
          <select
            value={wallPlacement}
            onChange={(e) => {
              const v = e.target.value as WallPlacementMode;
              const oldP = wall.wallPlacement ?? 'on-axis';
              const base = centerlineSegmentToBaseline(
                wall.start,
                wall.end,
                wall.thicknessMm,
                oldP
              );
              const next = baselineSegmentToCenterline(
                base.start,
                base.end,
                wall.thicknessMm,
                v
              );
              applyCommand({
                type: 'updateWall',
                wallId: wall.id,
                patch: {
                  wallPlacement: v,
                  start: next.start,
                  end: next.end,
                  panelDirection:
                    Math.abs(next.end.x - next.start.x) >= Math.abs(next.end.y - next.start.y)
                      ? 'horizontal'
                      : 'vertical',
                },
              });
            }}
            style={{ width: '100%', padding: 4 }}
          >
            <option value="on-axis">По оси (центр)</option>
            <option value="inside">Внутрь</option>
            <option value="outside">Наружу</option>
          </select>
        </dd>
        <dt className="twix-muted">Угол (°)</dt>
        <dd style={{ margin: 0 }}>{angleDeg}° (от +X против часовой)</dd>
        <dt className="twix-muted">start X / Y (мм)</dt>
        <dd style={{ margin: 0, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            aria-label="start X мм"
            type="text"
            inputMode="decimal"
            value={sxStr}
            onChange={(e) => setSxStr(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') applyCoords();
              if (e.key === 'Escape') setSxStr(String(Math.round(wall.start.x)));
            }}
            style={{ width: 88, padding: 4 }}
          />
          <input
            aria-label="start Y мм"
            type="text"
            inputMode="decimal"
            value={syStr}
            onChange={(e) => setSyStr(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') applyCoords();
              if (e.key === 'Escape') setSyStr(String(Math.round(wall.start.y)));
            }}
            style={{ width: 88, padding: 4 }}
          />
        </dd>
        <dt className="twix-muted">end X / Y (мм)</dt>
        <dd style={{ margin: 0, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            aria-label="end X мм"
            type="text"
            inputMode="decimal"
            value={exStr}
            onChange={(e) => setExStr(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') applyCoords();
              if (e.key === 'Escape') setExStr(String(Math.round(wall.end.x)));
            }}
            style={{ width: 88, padding: 4 }}
          />
          <input
            aria-label="end Y мм"
            type="text"
            inputMode="decimal"
            value={eyStr}
            onChange={(e) => setEyStr(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') applyCoords();
              if (e.key === 'Escape') setEyStr(String(Math.round(wall.end.y)));
            }}
            style={{ width: 88, padding: 4 }}
          />
          <button type="button" style={{ fontSize: 11, padding: '2px 8px' }} onClick={applyCoords}>
            Применить координаты
          </button>
        </dd>
        <dt className="twix-muted">Узел start / стыков</dt>
        <dd style={{ margin: 0 }}>
          {wall.startJointId ? (
            <>
              id: {wall.startJointId.slice(0, 8)}… · стен:{' '}
              {countWallsReferencingJoint(draft, wall.startJointId)}
              <button
                type="button"
                style={{ marginLeft: 8, fontSize: 11 }}
                onClick={() =>
                  applyCommand({ type: 'detachWallEndpoint', wallId: wall.id, endpoint: 'start' })
                }
              >
                Отвязать
              </button>
            </>
          ) : (
            'нет'
          )}
        </dd>
        <dt className="twix-muted">Узел end / стыков</dt>
        <dd style={{ margin: 0 }}>
          {wall.endJointId ? (
            <>
              id: {wall.endJointId.slice(0, 8)}… · стен:{' '}
              {countWallsReferencingJoint(draft, wall.endJointId)}
              <button
                type="button"
                style={{ marginLeft: 8, fontSize: 11 }}
                onClick={() =>
                  applyCommand({ type: 'detachWallEndpoint', wallId: wall.id, endpoint: 'end' })
                }
              >
                Отвязать
              </button>
            </>
          ) : (
            'нет'
          )}
        </dd>
        <dt className="twix-muted">Длина (мм)</dt>
        <dd style={{ margin: 0, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="text"
            inputMode="decimal"
            value={lenStr}
            onChange={(e) => setLenStr(e.target.value)}
            onBlur={applyLength}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.currentTarget.blur();
                applyLength();
              }
              if (e.key === 'Escape') {
                setLenStr(String(Math.round(len)));
              }
            }}
            style={{ width: 120, padding: 4 }}
          />
          <span className="twix-muted" style={{ fontSize: 11 }}>
            от start к end · Enter / уход с поля
          </span>
        </dd>
        <dt className="twix-muted">Сдвиг стены (мм)</dt>
        <dd style={{ margin: 0 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <span className="twix-muted">ΔX</span>
            <input
              type="text"
              inputMode="decimal"
              value={shiftXStr}
              onChange={(e) => setShiftXStr(e.target.value)}
              style={{ width: 72, padding: 4 }}
            />
            <span className="twix-muted">ΔY</span>
            <input
              type="text"
              inputMode="decimal"
              value={shiftYStr}
              onChange={(e) => setShiftYStr(e.target.value)}
              style={{ width: 72, padding: 4 }}
            />
          </div>
          <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button type="button" style={{ fontSize: 11, padding: '2px 8px' }} onClick={() => applyShift('both')}>
              Сдвинуть обе оси
            </button>
            <button type="button" style={{ fontSize: 11, padding: '2px 8px' }} onClick={() => applyShift('x')}>
              Только X
            </button>
            <button type="button" style={{ fontSize: 11, padding: '2px 8px' }} onClick={() => applyShift('y')}>
              Только Y
            </button>
          </div>
          <p className="twix-muted" style={{ fontSize: 10, margin: '6px 0 0' }}>
            На canvas: перетаскивание тела стены + Shift — только по X, Alt — только по Y.
          </p>
        </dd>
        <dt className="twix-muted">Толщина (мм)</dt>
        <dd style={{ margin: 0 }}>
          <input
            type="number"
            min={50}
            step={10}
            value={wall.thicknessMm}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (!Number.isFinite(v)) return;
              applyCommand({
                type: 'updateWall',
                wallId: wall.id,
                patch: { thicknessMm: v },
              });
            }}
            style={{ width: '100%', padding: 4 }}
          />
        </dd>
        <dt className="twix-muted">Высота (мм)</dt>
        <dd style={{ margin: 0 }}>
          <input
            type="number"
            min={1000}
            step={100}
            placeholder="не задано"
            value={wall.heightMm === undefined ? '' : wall.heightMm}
            onChange={(e) => {
              const raw = e.target.value;
              if (raw === '') {
                applyCommand({
                  type: 'updateWall',
                  wallId: wall.id,
                  patch: { heightMm: undefined },
                });
                return;
              }
              const v = Number(raw);
              if (!Number.isFinite(v)) return;
              applyCommand({
                type: 'updateWall',
                wallId: wall.id,
                patch: { heightMm: v },
              });
            }}
            style={{ width: '100%', padding: 4 }}
          />
        </dd>
        <dt className="twix-muted">Режим высоты</dt>
        <dd style={{ margin: 0 }}>{heightMode === 'inherited' ? 'inherited (из этажа)' : 'overridden (у стены)'}</dd>
        <dt className="twix-muted">Effective height (мм)</dt>
        <dd style={{ margin: 0 }}>{effectiveHeight}</dd>
        <dt className="twix-muted" style={{ marginTop: 8 }}>SIP: structural role</dt>
        <dd style={{ margin: 0 }}>
          <select
            value={structuralRole}
            onChange={(e) =>
              applyCommand({
                type: 'updateWall',
                wallId: wall.id,
                patch: { structuralRole: e.target.value as 'bearing' | 'partition' },
              })
            }
            style={{ width: '100%', padding: 4 }}
          >
            <option value="bearing">bearing</option>
            <option value="partition">partition</option>
          </select>
        </dd>
        <dt className="twix-muted">SIP: panelization enabled</dt>
        <dd style={{ margin: 0 }}>
          <label>
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) =>
                applyCommand({
                  type: 'updateWall',
                  wallId: wall.id,
                  patch: { panelizationEnabled: e.target.checked },
                })
              }
            />{' '}
            enabled
          </label>
        </dd>
        <dt className="twix-muted">SIP: direction</dt>
        <dd style={{ margin: 0 }}>
          <select
            value={panelDirection}
            onChange={(e) =>
              applyCommand({
                type: 'updateWall',
                wallId: wall.id,
                patch: { panelDirection: e.target.value as 'vertical' | 'horizontal' },
              })
            }
            style={{ width: '100%', padding: 4 }}
          >
            <option value="vertical">vertical</option>
            <option value="horizontal">horizontal</option>
          </select>
        </dd>
        <dt className="twix-muted">SIP: panel type (override)</dt>
        <dd style={{ margin: 0 }}>
          <select
            value={wall.panelTypeId ?? ''}
            onChange={(e) =>
              applyCommand({
                type: 'updateWall',
                wallId: wall.id,
                patch: { panelTypeId: e.target.value || undefined },
              })
            }
            style={{ width: '100%', padding: 4 }}
          >
            <option value="">global default ({draft.panelSettings.defaultPanelTypeId ?? '—'})</option>
            {draft.panelLibrary.filter((p) => p.active).map((p) => (
              <option key={p.id} value={p.id}>
                {p.code}
              </option>
            ))}
          </select>
        </dd>
        <dt className="twix-muted">SIP: effective panel type</dt>
        <dd style={{ margin: 0 }}>{effectivePanelTypeId || '—'}</dd>
        <dt className="twix-muted">SIP eligibility</dt>
        <dd style={{ margin: 0 }}>{summary?.eligible ? 'eligible' : `skipped (${summary?.reason ?? '—'})`}</dd>
        <dt className="twix-muted" style={{ marginTop: 10 }}>SIP: сохранённая раскладка</dt>
        <dd style={{ margin: 0 }}>
          {storedLayout ? (
            <>
              <div>
                UX: <strong>{storedLayout.summary.panelizationStatus}</strong> · engine:{' '}
                <strong>{storedLayout.status}</strong> · панелей: {storedLayout.summary.panelCount} (trim:{' '}
                {storedLayout.summary.trimPanelCount}) · проёмов (сейчас / в расчёте): {openingsOnWall} /{' '}
                {storedLayout.summary.openingsCount ?? 0} · предупр.: {storedLayout.warnings.length}
              </div>
              <div className="twix-muted" style={{ fontSize: 11, marginTop: 4 }}>
                остаток: {Math.round(storedLayout.summary.remainderMm)} мм · использование модулей:{' '}
                {(storedLayout.summary.utilizationRatio * 100).toFixed(0)}% · доля «глухих» панелей:{' '}
                {((storedLayout.summary.fullLayoutFraction ?? 0) * 100).toFixed(0)}%
              </div>
              {layoutStale ? (
                <div style={{ marginTop: 6, color: '#b45309', fontSize: 12 }}>
                  Раскладка устарела относительно геометрии — нажмите «Рассчитать панели».
                </div>
              ) : null}
            </>
          ) : (
            <span className="twix-muted">нет (нажмите «Рассчитать панели»)</span>
          )}
        </dd>
        <dt className="twix-muted">Действия раскладки</dt>
        <dd style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button
            type="button"
            style={{ fontSize: 12, padding: '6px 8px' }}
            onClick={() => applyCommand({ type: 'calculateWallPanelLayout', wallId: wall.id })}
          >
            Рассчитать панели (эта стена)
          </button>
          <button
            type="button"
            style={{ fontSize: 12, padding: '6px 8px' }}
            onClick={() => applyCommand({ type: 'clearWallPanelLayout', wallId: wall.id })}
          >
            Очистить раскладку стены
          </button>
          {activeFloorId === wall.floorId ? (
            <>
              <button
                type="button"
                style={{ fontSize: 12, padding: '6px 8px' }}
                onClick={() => {
                  const { summary: s } = batchComputeWallPanelLayoutsForFloor(draft, activeFloorId);
                  setBatchSummary(s);
                  applyCommand({ type: 'batchCalculateWallPanelLayoutsForFloor', floorId: activeFloorId });
                }}
              >
                Рассчитать для всех eligible стен этажа
              </button>
              <button
                type="button"
                style={{ fontSize: 12, padding: '6px 8px' }}
                onClick={() => {
                  if (!activeFloorId) return;
                  setBatchSummary(null);
                  applyCommand({ type: 'clearWallPanelLayoutsForFloor', floorId: activeFloorId });
                }}
              >
                Очистить раскладки этажа
              </button>
            </>
          ) : null}
        </dd>
        {batchSummary && activeFloorId === wall.floorId ? (
          <>
            <dt className="twix-muted">Batch (последний запуск)</dt>
            <dd style={{ margin: 0, fontSize: 12 }}>
              eligible: {batchSummary.eligibleWalls} · ok: {batchSummary.layoutOk} · partial:{' '}
              {batchSummary.layoutPartial} · failed: {batchSummary.layoutFailed}
            </dd>
          </>
        ) : null}
        {storedLayout && storedLayout.warnings.length > 0 ? (
          <>
            <dt className="twix-muted">Раскладка: предупреждения</dt>
            <dd style={{ margin: 0 }}>
              <ul style={{ margin: 0, paddingLeft: 16 }}>
                {storedLayout.warnings.slice(0, 8).map((w, idx) => (
                  <li key={`${w.code}-${idx}`}>
                    [{w.code}] {w.message}
                  </li>
                ))}
              </ul>
            </dd>
          </>
        ) : null}
        <dt className="twix-muted">SIP panels (live snapshot) / warnings</dt>
        <dd style={{ margin: 0 }}>
          {summary?.panelCount ?? 0} / {wallWarnings.length}
        </dd>
        <dt className="twix-muted">SPEC panels / trimmed / area</dt>
        <dd style={{ margin: 0 }}>
          {wallSpec?.panelCount ?? 0} / {wallSpec?.trimmedCount ?? 0} / {wallSpec?.totalAreaM2 ?? 0} m2
          <div style={{ marginTop: 4 }}>
            <button type="button" style={{ fontSize: 11 }} onClick={() => setActivePanel('spec')}>
              Показать в спецификации
            </button>
          </div>
        </dd>
        {wallWarnings.length > 0 ? (
          <>
            <dt className="twix-muted">SIP warning list</dt>
            <dd style={{ margin: 0 }}>
              <ul style={{ margin: 0, paddingLeft: 16 }}>
                {wallWarnings.slice(0, 4).map((w) => (
                  <li key={w.id}>[{w.code}] {w.message}</li>
                ))}
              </ul>
            </dd>
          </>
        ) : null}
      </dl>
    </div>
  );
}
