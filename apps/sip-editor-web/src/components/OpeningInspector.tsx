import { useCallback, useEffect, useState } from 'react';
import { getOpeningById, getWallById, openingCenterWorldMm } from '@2wix/domain-model';
import { useEditorStore } from '@2wix/editor-core';
import type { Opening, OpeningType } from '@2wix/shared-types';

type OpeningFieldPatch = Partial<
  Pick<Opening, 'openingType' | 'widthMm' | 'heightMm' | 'bottomOffsetMm' | 'positionAlongWall' | 'label'>
>;

function openingTypeLabel(t: OpeningType): string {
  switch (t) {
    case 'window':
      return 'Окно';
    case 'door':
      return 'Дверь';
    case 'portal':
      return 'Проём';
    default:
      return t;
  }
}

export function OpeningInspector() {
  const draft = useEditorStore((s) => s.document.draftModel);
  const selection = useEditorStore((s) => s.selection);
  const applyCommand = useEditorStore((s) => s.applyCommand);
  const [lastError, setLastError] = useState<string | null>(null);

  const [widthStr, setWidthStr] = useState('');
  const [heightStr, setHeightStr] = useState('');
  const [sillStr, setSillStr] = useState('');
  const [alongStr, setAlongStr] = useState('');
  const [labelStr, setLabelStr] = useState('');

  const op = draft && selection.selectedObjectType === 'opening' && selection.selectedObjectId
    ? getOpeningById(draft, selection.selectedObjectId)
    : undefined;

  useEffect(() => {
    setLastError(null);
  }, [selection.selectedObjectId, selection.selectedObjectType]);

  useEffect(() => {
    if (!op) return;
    setWidthStr(String(Math.round(op.widthMm)));
    setHeightStr(String(Math.round(op.heightMm)));
    setSillStr(String(Math.round(op.bottomOffsetMm)));
    setAlongStr(String(Math.round(op.positionAlongWall * 10) / 10));
    setLabelStr(op.label ?? '');
  }, [op?.id, op?.widthMm, op?.heightMm, op?.bottomOffsetMm, op?.positionAlongWall, op?.label, op?.openingType]);

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

  const parseMm = (raw: string): number | null => {
    const t = raw.trim().replace(',', '.');
    if (t === '' || t === '-') return null;
    const v = Number(t);
    return Number.isFinite(v) ? v : null;
  };

  const applyNumericFields = () => {
    if (!op) return;
    const w = parseMm(widthStr);
    const h = parseMm(heightStr);
    const sill = parseMm(sillStr);
    const along = parseMm(alongStr);
    if (w === null || h === null || sill === null || along === null) {
      setLastError('Введите числа');
      return;
    }
    applyOpeningPatch({
      widthMm: w,
      heightMm: h,
      bottomOffsetMm: sill,
      positionAlongWall: along,
    });
  };

  if (!draft || selection.selectedObjectType !== 'opening' || !selection.selectedObjectId) {
    return (
      <p className="twix-muted" style={{ fontSize: 13 }}>
        Выберите проём на canvas или укажите инструмент «Окно» / «Дверь» / «Проём» и кликните по стене.
      </p>
    );
  }

  if (!op) return null;

  const wall = getWallById(draft, op.wallId);
  const centerWorld = wall ? openingCenterWorldMm(op, wall) : null;

  return (
    <div style={{ fontSize: 13 }}>
      <p className="twix-panelTitle">Проём · {openingTypeLabel(op.openingType)}</p>
      {lastError ? (
        <p style={{ color: '#b91c1c', fontSize: 12, marginBottom: 8 }} role="alert">
          {lastError}
        </p>
      ) : null}
      <dl style={{ margin: 0, display: 'grid', gap: 6 }}>
        <dt className="twix-muted">Тип</dt>
        <dd style={{ margin: 0 }}>
          <select
            value={op.openingType}
            onChange={(e) => {
              const openingType = e.target.value as OpeningType;
              if (openingType === 'door') {
                applyOpeningPatch({ openingType, bottomOffsetMm: 0 });
                setSillStr('0');
              } else {
                applyOpeningPatch({ openingType });
              }
            }}
            style={{ width: '100%', padding: 4 }}
          >
            <option value="window">Окно</option>
            <option value="door">Дверь</option>
            <option value="portal">Проём (портал)</option>
          </select>
        </dd>
        <dt className="twix-muted">wallId</dt>
        <dd style={{ margin: 0, wordBreak: 'break-all', fontSize: 11 }}>{op.wallId}</dd>
        <dt className="twix-muted">floorId</dt>
        <dd style={{ margin: 0 }}>{op.floorId}</dd>
        {centerWorld ? (
          <>
            <dt className="twix-muted">Центр (мир X/Y, мм)</dt>
            <dd style={{ margin: 0 }}>
              {Math.round(centerWorld.x)}, {Math.round(centerWorld.y)}
            </dd>
          </>
        ) : null}
        <dt className="twix-muted">Ширина (мм)</dt>
        <dd style={{ margin: 0 }}>
          <input
            type="text"
            inputMode="decimal"
            value={widthStr}
            onChange={(e) => setWidthStr(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') applyNumericFields();
              if (e.key === 'Escape') setWidthStr(String(Math.round(op.widthMm)));
            }}
            style={{ width: '100%', padding: 4 }}
          />
        </dd>
        <dt className="twix-muted">Высота (мм)</dt>
        <dd style={{ margin: 0 }}>
          <input
            type="text"
            inputMode="decimal"
            value={heightStr}
            onChange={(e) => setHeightStr(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') applyNumericFields();
              if (e.key === 'Escape') setHeightStr(String(Math.round(op.heightMm)));
            }}
            style={{ width: '100%', padding: 4 }}
          />
        </dd>
        <dt className="twix-muted">Подоконник / низ проёма (мм от пола)</dt>
        <dd style={{ margin: 0 }}>
          <input
            type="text"
            inputMode="decimal"
            value={sillStr}
            onChange={(e) => setSillStr(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') applyNumericFields();
              if (e.key === 'Escape') setSillStr(String(Math.round(op.bottomOffsetMm)));
            }}
            style={{ width: '100%', padding: 4 }}
            disabled={op.openingType === 'door'}
            title={op.openingType === 'door' ? 'У двери низ на уровне пола (0)' : undefined}
          />
        </dd>
        <dt className="twix-muted">Смещение центра вдоль стены (мм от start)</dt>
        <dd style={{ margin: 0 }}>
          <input
            type="text"
            inputMode="decimal"
            value={alongStr}
            onChange={(e) => setAlongStr(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') applyNumericFields();
              if (e.key === 'Escape') setAlongStr(String(Math.round(op.positionAlongWall * 10) / 10));
            }}
            style={{ width: '100%', padding: 4 }}
          />
        </dd>
        <dt className="twix-muted">Заметка</dt>
        <dd style={{ margin: 0 }}>
          <input
            type="text"
            value={labelStr}
            onChange={(e) => setLabelStr(e.target.value)}
            onBlur={() => applyOpeningPatch({ label: labelStr.trim() || undefined })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                applyOpeningPatch({ label: labelStr.trim() || undefined });
              }
              if (e.key === 'Escape') setLabelStr(op.label ?? '');
            }}
            placeholder="опционально"
            style={{ width: '100%', padding: 4 }}
          />
        </dd>
      </dl>
      <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" style={{ padding: '4px 10px', fontSize: 12 }} onClick={applyNumericFields}>
          Применить размеры и положение
        </button>
        <button
          type="button"
          style={{ padding: '4px 10px', fontSize: 12 }}
          onClick={() => {
            if (selection.selectedObjectId) {
              applyCommand({ type: 'deleteOpening', openingId: selection.selectedObjectId });
            }
          }}
        >
          Удалить проём
        </button>
      </div>
      <p className="twix-muted" style={{ fontSize: 10, marginTop: 8 }}>
        Enter — применить поля размера/смещения · Esc — сбросить текущее поле · Перетаскивание на canvas — вдоль
        стены.
      </p>
    </div>
  );
}
