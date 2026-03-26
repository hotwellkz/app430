import { computeWallLengthMm, findWallById } from '@2wix/domain-model';
import { useEditorStore } from '@2wix/editor-core';
import type { WallType } from '@2wix/shared-types';

export function WallInspector() {
  const draft = useEditorStore((s) => s.document.draftModel);
  const selection = useEditorStore((s) => s.selection);
  const applyCommand = useEditorStore((s) => s.applyCommand);

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
      </dl>
    </div>
  );
}
