import { getSlabsByFloor } from '@2wix/domain-model';
import { useEditorStore } from '@2wix/editor-core';
import type { Slab } from '@2wix/shared-types';
import { usePanelizationSnapshot } from '../panelization/usePanelizationSnapshot';
import { useSpecSnapshot } from '../spec/useSpecSnapshot';

type SlabPatch = Partial<
  Pick<Slab, 'slabType' | 'direction' | 'thicknessMm' | 'generationMode' | 'panelizationEnabled' | 'panelTypeId'>
>;

export function SlabInspector() {
  const draft = useEditorStore((s) => s.document.draftModel);
  const selection = useEditorStore((s) => s.selection);
  const view = useEditorStore((s) => s.view);
  const applyCommand = useEditorStore((s) => s.applyCommand);
  const setActivePanel = useEditorStore((s) => s.setActivePanel);
  const panelization = usePanelizationSnapshot();
  const spec = useSpecSnapshot();

  if (!draft) return null;
  const activeFloorId = view.activeFloorId;
  const slabs = activeFloorId ? getSlabsByFloor(draft, activeFloorId) : [];
  const slab =
    selection.selectedObjectType === 'slab' && selection.selectedObjectId
      ? draft.slabs.find((s) => s.id === selection.selectedObjectId)
      : slabs[0];

  if (!slab) {
    return <p className="twix-muted" style={{ fontSize: 13 }}>Перекрытие не выбрано.</p>;
  }

  const patch = (p: SlabPatch) => applyCommand({ type: 'updateSlab', slabId: slab.id, patch: p });
  const slabSummary = panelization?.slabSummaries.find((s) => s.slabId === slab.id);
  const slabWarnings = panelization?.warnings.filter((w) => w.relatedObjectIds.includes(slab.id)) ?? [];
  const slabSpec = spec?.slabSummaries.find((s) => s.slabId === slab.id);

  return (
    <div style={{ fontSize: 13 }}>
      <p className="twix-panelTitle">Перекрытие</p>
      <dl style={{ margin: 0, display: 'grid', gap: 6 }}>
        <dt className="twix-muted">id</dt>
        <dd style={{ margin: 0 }}>{slab.id}</dd>
        <dt className="twix-muted">Этаж</dt>
        <dd style={{ margin: 0 }}>{slab.floorId}</dd>
        <dt className="twix-muted">Тип</dt>
        <dd style={{ margin: 0 }}>
          <select value={slab.slabType} onChange={(e) => patch({ slabType: e.target.value as Slab['slabType'] })} style={{ width: '100%', padding: 4 }}>
            <option value="ground">ground</option>
            <option value="interfloor">interfloor</option>
            <option value="attic">attic</option>
          </select>
        </dd>
        <dt className="twix-muted">Направление</dt>
        <dd style={{ margin: 0 }}>
          <select value={slab.direction} onChange={(e) => patch({ direction: e.target.value as Slab['direction'] })} style={{ width: '100%', padding: 4 }}>
            <option value="x">x</option>
            <option value="y">y</option>
          </select>
        </dd>
        <dt className="twix-muted">Толщина (мм)</dt>
        <dd style={{ margin: 0 }}>
          <input type="number" min={1} step={10} value={slab.thicknessMm ?? ''} onChange={(e) => {
            const raw = e.target.value;
            if (raw === '') return patch({ thicknessMm: undefined });
            const v = Number(raw);
            if (!Number.isFinite(v)) return;
            patch({ thicknessMm: v });
          }} style={{ width: '100%', padding: 4 }} />
        </dd>
        <dt className="twix-muted">Режим</dt>
        <dd style={{ margin: 0 }}>{slab.generationMode}</dd>
        <dt className="twix-muted">SIP panelization</dt>
        <dd style={{ margin: 0 }}>
          <label>
            <input
              type="checkbox"
              checked={slab.panelizationEnabled ?? true}
              onChange={(e) => patch({ panelizationEnabled: e.target.checked })}
            />{' '}
            enabled
          </label>
        </dd>
        <dt className="twix-muted">SIP panel type (override)</dt>
        <dd style={{ margin: 0 }}>
          <select
            value={slab.panelTypeId ?? ''}
            onChange={(e) => patch({ panelTypeId: e.target.value || undefined })}
            style={{ width: '100%', padding: 4 }}
          >
            <option value="">global default</option>
            {draft.panelLibrary.filter((p) => p.active).map((p) => (
              <option key={p.id} value={p.id}>{p.code}</option>
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
        <dt className="twix-muted">Контур (стены)</dt>
        <dd style={{ margin: 0 }}>{slab.contourWallIds.length} шт.</dd>
      </dl>
      <button type="button" style={{ marginTop: 8, fontSize: 12 }} onClick={() => applyCommand({ type: 'deleteSlab', slabId: slab.id })}>
        Удалить перекрытие
      </button>
    </div>
  );
}
