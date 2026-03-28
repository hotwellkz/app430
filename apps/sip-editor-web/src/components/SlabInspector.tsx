import { useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_SLAB_THICKNESS_MM,
  getFloorById,
  getSlabsByFloor,
} from '@2wix/domain-model';
import { useEditorStore } from '@2wix/editor-core';
import type { Slab, SlabAssemblyKind } from '@2wix/shared-types';
import { usePanelizationSnapshot } from '../panelization/usePanelizationSnapshot';
import { useSpecSnapshot } from '../spec/useSpecSnapshot';

export function SlabInspector() {
  const draft = useEditorStore((s) => s.document.draftModel);
  const selection = useEditorStore((s) => s.selection);
  const view = useEditorStore((s) => s.view);
  const applyCommand = useEditorStore((s) => s.applyCommand);
  const setActivePanel = useEditorStore((s) => s.setActivePanel);
  const panelization = usePanelizationSnapshot();
  const spec = useSpecSnapshot();

  const activeFloorId = view.activeFloorId;

  const slab = useMemo(() => {
    if (!draft || !activeFloorId) return undefined;
    const list = getSlabsByFloor(draft, activeFloorId);
    if (selection.selectedObjectType === 'slab' && selection.selectedObjectId) {
      return draft.slabs.find((s) => s.id === selection.selectedObjectId);
    }
    return list[0];
  }, [draft, activeFloorId, selection.selectedObjectId, selection.selectedObjectType]);

  const [thicknessStr, setThicknessStr] = useState(String(DEFAULT_SLAB_THICKNESS_MM));
  const [elevationStr, setElevationStr] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (slab) {
      setThicknessStr(String(slab.thicknessMm ?? DEFAULT_SLAB_THICKNESS_MM));
      setElevationStr(
        slab.elevationMm !== undefined && Number.isFinite(slab.elevationMm) ? String(slab.elevationMm) : ''
      );
    }
  }, [slab?.id, slab?.thicknessMm, slab?.elevationMm]);

  if (!draft) return null;

  const floor = activeFloorId ? getFloorById(draft, activeFloorId) : undefined;

  const onCreateFromContour = () => {
    setMsg(null);
    if (!activeFloorId) {
      setMsg('Выберите этаж');
      return;
    }
    const r = applyCommand({ type: 'createSlabFromContour', floorId: activeFloorId });
    if (!r.ok) setMsg(r.error);
    else setMsg('Перекрытие создано по контуру');
  };

  const onRecompute = () => {
    setMsg(null);
    if (!slab) {
      setMsg('Нет перекрытия');
      return;
    }
    const r = applyCommand({ type: 'recomputeSlab', slabId: slab.id });
    if (!r.ok) setMsg(r.error);
    else setMsg('Пересчитано');
  };

  const applyPatch = (patch: Partial<Slab>) => {
    if (!slab) return;
    const r = applyCommand({ type: 'updateSlab', slabId: slab.id, patch });
    if (!r.ok) setMsg(r.error);
  };

  const onApplyParams = () => {
    setMsg(null);
    if (!slab) return;
    const t = Number(thicknessStr.replace(',', '.'));
    if (!Number.isFinite(t) || t <= 0) {
      setMsg('Толщина должна быть > 0');
      return;
    }
    let elevation: number | undefined;
    if (elevationStr.trim() !== '') {
      const e = Number(elevationStr.replace(',', '.'));
      if (!Number.isFinite(e)) {
        setMsg('Некорректная отметка');
        return;
      }
      elevation = e;
    }
    applyPatch({
      thicknessMm: t,
      ...(elevation !== undefined ? { elevationMm: elevation } : { elevationMm: undefined }),
    });
    const r2 = applyCommand({ type: 'recomputeSlab', slabId: slab.id });
    if (!r2.ok) setMsg(r2.error);
    else setMsg('Параметры применены');
  };

  if (!slab) {
    return (
      <div style={{ fontSize: 13 }}>
        <p className="twix-panelTitle">Перекрытие</p>
        <p className="twix-muted" style={{ fontSize: 13 }}>
          На этаже ещё нет перекрытия. Соберите наружный контур стен и нажмите «Создать перекрытие по контуру».
        </p>
        <button type="button" style={{ marginTop: 8, fontSize: 13, padding: '8px 10px' }} onClick={() => void onCreateFromContour()}>
          Создать перекрытие по контуру
        </button>
        {msg ? <p style={{ marginTop: 8, fontSize: 12, color: '#b45309' }}>{msg}</p> : null}
      </div>
    );
  }

  const slabSummary = panelization?.slabSummaries.find((s) => s.slabId === slab.id);
  const slabWarnings = panelization?.warnings.filter((w) => w.relatedObjectIds.includes(slab.id)) ?? [];
  const slabSpec = spec?.slabSummaries.find((s) => s.slabId === slab.id);
  const stale = slab.needsRecompute ?? false;

  const assemblyKind: SlabAssemblyKind = slab.assemblyKind ?? 'floor_slab';

  return (
    <div style={{ fontSize: 13 }}>
      <p className="twix-panelTitle">Перекрытие</p>
      {stale ? (
        <div
          role="alert"
          style={{
            marginBottom: 10,
            padding: 8,
            borderRadius: 6,
            background: '#fffbeb',
            border: '1px solid #f59e0b',
            color: '#92400e',
            fontSize: 12,
          }}
        >
          Перекрытие требует пересчёта: изменился контур наружных стен. Нажмите «Пересчитать по контуру».
        </div>
      ) : null}

      <label className="twix-muted" style={{ display: 'block', fontSize: 11 }}>
        Конструктив (MVP)
      </label>
      <select
        value={assemblyKind}
        onChange={(e) => applyPatch({ assemblyKind: e.target.value as SlabAssemblyKind })}
        style={{ width: '100%', padding: 6, marginBottom: 8 }}
      >
        <option value="floor_slab">Плита / настил</option>
        <option value="beam_floor">Балочное перекрытие</option>
        <option value="attic_floor">Чердачное перекрытие</option>
      </select>

      <label className="twix-muted" style={{ display: 'block', fontSize: 11 }}>
        Тип по этажу (вертикальная логика)
      </label>
      <select
        value={slab.slabType}
        onChange={(e) => applyPatch({ slabType: e.target.value as Slab['slabType'] })}
        style={{ width: '100%', padding: 6, marginBottom: 8 }}
      >
        <option value="ground">Нулевой / пол</option>
        <option value="interfloor">Межэтажное</option>
        <option value="attic">Чердак</option>
      </select>

      <label className="twix-muted" style={{ display: 'block', fontSize: 11 }}>
        Толщина, мм
      </label>
      <input
        type="text"
        value={thicknessStr}
        onChange={(e) => setThicknessStr(e.target.value)}
        style={{ width: '100%', padding: 6, marginBottom: 8 }}
      />

      <label className="twix-muted" style={{ display: 'block', fontSize: 11 }}>
        Отметка низа плиты, мм (абсолютная; пусто = авто)
      </label>
      <input
        type="text"
        value={elevationStr}
        onChange={(e) => setElevationStr(e.target.value)}
        placeholder={floor ? `авто от этажа ${floor.elevationMm}…` : ''}
        style={{ width: '100%', padding: 6, marginBottom: 8 }}
      />

      <p className="twix-muted" style={{ fontSize: 11, marginBottom: 6 }}>
        Этаж: {slab.floorId.slice(0, 8)}…
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
        <button type="button" style={{ fontSize: 13, padding: '8px 10px' }} onClick={() => void onCreateFromContour()}>
          Создать / заменить по контуру
        </button>
        <button type="button" style={{ fontSize: 13, padding: '8px 10px' }} onClick={() => void onRecompute()}>
          Пересчитать по контуру
        </button>
        <button type="button" style={{ fontSize: 13, padding: '8px 10px' }} onClick={() => void onApplyParams()}>
          Применить толщину и отметку
        </button>
      </div>

      <label className="twix-muted" style={{ display: 'block', fontSize: 11 }}>
        Направление (будущие балки)
      </label>
      <select
        value={slab.direction}
        onChange={(e) => applyPatch({ direction: e.target.value as Slab['direction'] })}
        style={{ width: '100%', padding: 4, marginBottom: 8 }}
      >
        <option value="x">x</option>
        <option value="y">y</option>
      </select>

      <dl style={{ margin: 0, display: 'grid', gap: 6 }}>
        <dt className="twix-muted">Режим</dt>
        <dd style={{ margin: 0 }}>{slab.generationMode}</dd>
        <dt className="twix-muted">Контур (стены)</dt>
        <dd style={{ margin: 0 }}>{slab.contourWallIds.length} шт.</dd>
        <dt className="twix-muted">SIP panelization</dt>
        <dd style={{ margin: 0 }}>
          <label>
            <input
              type="checkbox"
              checked={slab.panelizationEnabled ?? true}
              onChange={(e) => applyPatch({ panelizationEnabled: e.target.checked })}
            />{' '}
            enabled
          </label>
        </dd>
        <dt className="twix-muted">SIP panel type</dt>
        <dd style={{ margin: 0 }}>
          <select
            value={slab.panelTypeId ?? ''}
            onChange={(e) => applyPatch({ panelTypeId: e.target.value || undefined })}
            style={{ width: '100%', padding: 4 }}
          >
            <option value="">global default</option>
            {draft.panelLibrary.filter((p) => p.active).map((p) => (
              <option key={p.id} value={p.id}>
                {p.code}
              </option>
            ))}
          </select>
        </dd>
        <dt className="twix-muted">SIP panels / trimmed / area</dt>
        <dd style={{ margin: 0 }}>
          {slabSummary?.panelCount ?? 0} / {slabSummary?.trimmedCount ?? 0} / {slabSummary?.totalAreaM2 ?? 0} m2
        </dd>
        <dt className="twix-muted">SIP warnings</dt>
        <dd style={{ margin: 0 }}>{slabWarnings.length}</dd>
        <dt className="twix-muted">SPEC panels / trimmed / area</dt>
        <dd style={{ margin: 0 }}>
          {slabSpec?.panelCount ?? 0} / {slabSpec?.trimmedCount ?? 0} / {slabSpec?.totalAreaM2 ?? 0} m2
          <div style={{ marginTop: 4 }}>
            <button type="button" style={{ fontSize: 11 }} onClick={() => setActivePanel('spec')}>
              Показать в спецификации
            </button>
          </div>
        </dd>
      </dl>

      <button
        type="button"
        style={{ marginTop: 8, fontSize: 12, color: '#b91c1c' }}
        onClick={() => applyCommand({ type: 'deleteSlab', slabId: slab.id })}
      >
        Удалить перекрытие
      </button>

      {msg ? (
        <p style={{ marginTop: 10, fontSize: 12, color: msg.includes('создан') || msg.includes('Пересчитано') || msg.includes('применены') ? '#15803d' : '#b45309' }}>
          {msg}
        </p>
      ) : null}
    </div>
  );
}
