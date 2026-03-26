import { getSlabsByFloor } from '@2wix/domain-model';
import { useEditorStore } from '@2wix/editor-core';
import type { Slab } from '@2wix/shared-types';

type SlabPatch = Partial<Pick<Slab, 'slabType' | 'direction' | 'thicknessMm' | 'generationMode'>>;

export function SlabInspector() {
  const draft = useEditorStore((s) => s.document.draftModel);
  const selection = useEditorStore((s) => s.selection);
  const view = useEditorStore((s) => s.view);
  const applyCommand = useEditorStore((s) => s.applyCommand);

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
        <dt className="twix-muted">Контур (стены)</dt>
        <dd style={{ margin: 0 }}>{slab.contourWallIds.length} шт.</dd>
      </dl>
      <button type="button" style={{ marginTop: 8, fontSize: 12 }} onClick={() => applyCommand({ type: 'deleteSlab', slabId: slab.id })}>
        Удалить перекрытие
      </button>
    </div>
  );
}
