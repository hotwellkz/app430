import { getRoofForTopFloor } from '@2wix/domain-model';
import { useEditorStore } from '@2wix/editor-core';
import type { Roof } from '@2wix/shared-types';

type RoofPatch = Partial<Pick<Roof, 'roofType' | 'slopeDegrees' | 'ridgeDirection' | 'overhangMm' | 'baseElevationMm'>>;

export function RoofInspector() {
  const draft = useEditorStore((s) => s.document.draftModel);
  const selection = useEditorStore((s) => s.selection);
  const applyCommand = useEditorStore((s) => s.applyCommand);
  if (!draft) return null;

  const roof =
    selection.selectedObjectType === 'roof' && selection.selectedObjectId
      ? draft.roofs.find((r) => r.id === selection.selectedObjectId)
      : getRoofForTopFloor(draft);
  if (!roof) return <p className="twix-muted" style={{ fontSize: 13 }}>Крыша не создана.</p>;

  const patch = (p: RoofPatch) => applyCommand({ type: 'updateRoof', roofId: roof.id, patch: p });

  return (
    <div style={{ fontSize: 13 }}>
      <p className="twix-panelTitle">Крыша</p>
      <dl style={{ margin: 0, display: 'grid', gap: 6 }}>
        <dt className="twix-muted">id</dt>
        <dd style={{ margin: 0 }}>{roof.id}</dd>
        <dt className="twix-muted">Этаж</dt>
        <dd style={{ margin: 0 }}>{roof.floorId}</dd>
        <dt className="twix-muted">Тип</dt>
        <dd style={{ margin: 0 }}>
          <select value={roof.roofType} onChange={(e) => patch({ roofType: e.target.value as Roof['roofType'] })} style={{ width: '100%', padding: 4 }}>
            <option value="single_slope">single_slope</option>
            <option value="gable">gable</option>
          </select>
        </dd>
        <dt className="twix-muted">Уклон (°)</dt>
        <dd style={{ margin: 0 }}>
          <input type="number" min={1} max={75} step={1} value={roof.slopeDegrees} onChange={(e) => {
            const v = Number(e.target.value);
            if (!Number.isFinite(v)) return;
            patch({ slopeDegrees: v });
          }} style={{ width: '100%', padding: 4 }} />
        </dd>
        <dt className="twix-muted">Направление конька</dt>
        <dd style={{ margin: 0 }}>
          <select value={roof.ridgeDirection ?? 'x'} onChange={(e) => patch({ ridgeDirection: e.target.value as 'x' | 'y' })} style={{ width: '100%', padding: 4 }}>
            <option value="x">x</option>
            <option value="y">y</option>
          </select>
        </dd>
        <dt className="twix-muted">Свес (мм)</dt>
        <dd style={{ margin: 0 }}>
          <input type="number" min={0} step={10} value={roof.overhangMm} onChange={(e) => {
            const v = Number(e.target.value);
            if (!Number.isFinite(v)) return;
            patch({ overhangMm: v });
          }} style={{ width: '100%', padding: 4 }} />
        </dd>
        <dt className="twix-muted">Базовая отметка (мм)</dt>
        <dd style={{ margin: 0 }}>
          <input type="number" step={10} value={roof.baseElevationMm} onChange={(e) => {
            const v = Number(e.target.value);
            if (!Number.isFinite(v)) return;
            patch({ baseElevationMm: v });
          }} style={{ width: '100%', padding: 4 }} />
        </dd>
      </dl>
      <button type="button" style={{ marginTop: 8, fontSize: 12 }} onClick={() => applyCommand({ type: 'deleteRoof', roofId: roof.id })}>
        Удалить крышу
      </button>
    </div>
  );
}
