import { computeWallLengthMm, findWallById, getEffectiveWallHeight, getFloorById, getWallHeightMode } from '@2wix/domain-model';
import { useEditorStore } from '@2wix/editor-core';
import type { WallType } from '@2wix/shared-types';
import { usePanelizationSnapshot } from '../panelization/usePanelizationSnapshot';
import { useSpecSnapshot } from '../spec/useSpecSnapshot';

export function WallInspector() {
  const draft = useEditorStore((s) => s.document.draftModel);
  const selection = useEditorStore((s) => s.selection);
  const applyCommand = useEditorStore((s) => s.applyCommand);
  const setActivePanel = useEditorStore((s) => s.setActivePanel);
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
  const wallType: WallType = wall.wallType ?? 'external';
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
        <dt className="twix-muted">start</dt>
        <dd style={{ margin: 0 }}>
          {Math.round(wall.start.x)}, {Math.round(wall.start.y)} мм
        </dd>
        <dt className="twix-muted">end</dt>
        <dd style={{ margin: 0 }}>
          {Math.round(wall.end.x)}, {Math.round(wall.end.y)} мм
        </dd>
        <dt className="twix-muted">Длина</dt>
        <dd style={{ margin: 0 }}>{Math.round(len)} мм</dd>
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
        <dt className="twix-muted">SIP panels / warnings</dt>
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
