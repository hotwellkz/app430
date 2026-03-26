import { useCallback, useEffect, useState } from 'react';
import { getOpeningById } from '@2wix/domain-model';
import { useEditorStore } from '@2wix/editor-core';
import type { Opening, OpeningType } from '@2wix/shared-types';

type OpeningFieldPatch = Partial<
  Pick<Opening, 'openingType' | 'widthMm' | 'heightMm' | 'bottomOffsetMm' | 'positionAlongWall'>
>;

export function OpeningInspector() {
  const draft = useEditorStore((s) => s.document.draftModel);
  const selection = useEditorStore((s) => s.selection);
  const applyCommand = useEditorStore((s) => s.applyCommand);
  const [lastError, setLastError] = useState<string | null>(null);

  useEffect(() => {
    setLastError(null);
  }, [selection.selectedObjectId, selection.selectedObjectType]);

  const applyOpeningPatch = useCallback(
    (patch: OpeningFieldPatch) => {
      if (!selection.selectedObjectId) return;
      const r = applyCommand({
        type: 'updateOpening',
        openingId: selection.selectedObjectId,
        patch,
      });
      if (!r.ok) setLastError(r.error);
      else setLastError(null);
    },
    [applyCommand, selection.selectedObjectId]
  );

  if (!draft || selection.selectedObjectType !== 'opening' || !selection.selectedObjectId) {
    return (
      <p className="twix-muted" style={{ fontSize: 13 }}>
        Выберите проём на canvas или в списке проёмов.
      </p>
    );
  }

  const op = getOpeningById(draft, selection.selectedObjectId);
  if (!op) return null;

  return (
    <div style={{ fontSize: 13 }}>
      <p className="twix-panelTitle">Проём</p>
      {lastError ? (
        <p style={{ color: '#b91c1c', fontSize: 12, marginBottom: 8 }} role="alert">
          {lastError}
        </p>
      ) : null}
      <dl style={{ margin: 0, display: 'grid', gap: 6 }}>
        <dt className="twix-muted">id</dt>
        <dd style={{ margin: 0, wordBreak: 'break-all' }}>{op.id}</dd>
        <dt className="twix-muted">Тип</dt>
        <dd style={{ margin: 0 }}>
          <select
            value={op.openingType}
            onChange={(e) => {
              const openingType = e.target.value as OpeningType;
              if (openingType === 'door') {
                applyOpeningPatch({ openingType, bottomOffsetMm: 0 });
              } else {
                applyOpeningPatch({ openingType });
              }
            }}
            style={{ width: '100%', padding: 4 }}
          >
            <option value="window">Окно</option>
            <option value="door">Дверь</option>
            <option value="portal">Портал</option>
          </select>
        </dd>
        <dt className="twix-muted">wallId</dt>
        <dd style={{ margin: 0, wordBreak: 'break-all' }}>{op.wallId}</dd>
        <dt className="twix-muted">floorId</dt>
        <dd style={{ margin: 0 }}>{op.floorId}</dd>
        <dt className="twix-muted">Ширина (мм)</dt>
        <dd style={{ margin: 0 }}>
          <input
            type="number"
            min={100}
            step={10}
            value={op.widthMm}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (!Number.isFinite(v)) return;
              applyOpeningPatch({ widthMm: v });
            }}
            style={{ width: '100%', padding: 4 }}
          />
        </dd>
        <dt className="twix-muted">Высота (мм)</dt>
        <dd style={{ margin: 0 }}>
          <input
            type="number"
            min={100}
            step={10}
            value={op.heightMm}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (!Number.isFinite(v)) return;
              applyOpeningPatch({ heightMm: v });
            }}
            style={{ width: '100%', padding: 4 }}
          />
        </dd>
        <dt className="twix-muted">bottomOffset (мм)</dt>
        <dd style={{ margin: 0 }}>
          <input
            type="number"
            min={0}
            step={10}
            value={op.bottomOffsetMm}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (!Number.isFinite(v)) return;
              applyOpeningPatch({ bottomOffsetMm: v });
            }}
            style={{ width: '100%', padding: 4 }}
          />
        </dd>
        <dt className="twix-muted">positionAlongWall (мм)</dt>
        <dd style={{ margin: 0 }}>
          <input
            type="number"
            min={0}
            step={10}
            value={Math.round(op.positionAlongWall)}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (!Number.isFinite(v)) return;
              applyOpeningPatch({ positionAlongWall: v });
            }}
            style={{ width: '100%', padding: 4 }}
          />
        </dd>
      </dl>
    </div>
  );
}
