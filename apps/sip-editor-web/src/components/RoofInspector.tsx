import { useEffect, useState } from 'react';
import {
  defaultSingleSlopeDrain,
  getRoofForTopFloor,
  getTopFloor,
  suggestRoofBaseElevation,
} from '@2wix/domain-model';
import { useEditorStore } from '@2wix/editor-core';
import type { Roof, RoofDrainDirection } from '@2wix/shared-types';
import { usePanelizationSnapshot } from '../panelization/usePanelizationSnapshot';
import { useSpecSnapshot } from '../spec/useSpecSnapshot';

type RoofPatch = Partial<
  Pick<
    Roof,
    | 'roofType'
    | 'slopeDegrees'
    | 'ridgeDirection'
    | 'singleSlopeDrainToward'
    | 'overhangMm'
    | 'baseElevationMm'
    | 'panelizationEnabled'
    | 'panelTypeId'
  >
>;

export function RoofInspector() {
  const draft = useEditorStore((s) => s.document.draftModel);
  const selection = useEditorStore((s) => s.selection);
  const view = useEditorStore((s) => s.view);
  const applyCommand = useEditorStore((s) => s.applyCommand);
  const selectObject = useEditorStore((s) => s.selectObject);
  const setActivePanel = useEditorStore((s) => s.setActivePanel);
  const panelization = usePanelizationSnapshot();
  const spec = useSpecSnapshot();

  const topFloor = draft ? getTopFloor(draft) : null;
  const activeFloorId = view.activeFloorId;

  const roof = (() => {
    if (!draft || !topFloor) return undefined;
    if (selection.selectedObjectType === 'roof' && selection.selectedObjectId) {
      return draft.roofs.find((r) => r.id === selection.selectedObjectId);
    }
    return getRoofForTopFloor(draft);
  })();

  const [slopeStr, setSlopeStr] = useState('25');
  const [overhangStr, setOverhangStr] = useState('450');
  const [baseElStr, setBaseElStr] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (roof) {
      setSlopeStr(String(roof.slopeDegrees));
      setOverhangStr(String(roof.overhangMm));
      setBaseElStr(
        roof.baseElevationMm !== undefined && Number.isFinite(roof.baseElevationMm)
          ? String(roof.baseElevationMm)
          : ''
      );
    }
  }, [roof?.id, roof?.slopeDegrees, roof?.overhangMm, roof?.baseElevationMm]);

  if (!draft) return null;

  const onCreateFromContour = () => {
    setMsg(null);
    if (!topFloor) {
      setMsg('Нет этажа');
      return;
    }
    if (activeFloorId && activeFloorId !== topFloor.id) {
      setMsg('Переключитесь на верхний этаж в плане');
      return;
    }
    const r = applyCommand({ type: 'createRoofFromContour', floorId: topFloor.id });
    if (!r.ok) setMsg(r.error);
    else {
      setMsg('Крыша создана по контуру');
      const created = getRoofForTopFloor(useEditorStore.getState().document.draftModel!);
      if (created) selectObject(created.id, 'roof');
    }
  };

  const onRecompute = () => {
    setMsg(null);
    if (!roof) {
      setMsg('Нет крыши');
      return;
    }
    const r = applyCommand({ type: 'recomputeRoof', roofId: roof.id });
    if (!r.ok) setMsg(r.error);
    else setMsg('Пересчитано');
  };

  const applyParamsAndRecompute = () => {
    setMsg(null);
    if (!roof || !topFloor) return;
    const slope = Number(slopeStr.replace(',', '.'));
    const oh = Number(overhangStr.replace(',', '.'));
    if (!Number.isFinite(slope) || slope <= 0 || slope > 75) {
      setMsg('Уклон должен быть в (0; 75]°');
      return;
    }
    if (!Number.isFinite(oh) || oh < 0) {
      setMsg('Свес ≥ 0');
      return;
    }
    let baseEl = roof.baseElevationMm;
    if (baseElStr.trim() !== '') {
      const b = Number(baseElStr.replace(',', '.'));
      if (!Number.isFinite(b)) {
        setMsg('Некорректная отметка');
        return;
      }
      baseEl = b;
    } else {
      baseEl = suggestRoofBaseElevation(draft, topFloor.id);
    }
    const rd = roof.ridgeDirection ?? 'x';
    let drain: RoofDrainDirection | undefined = roof.singleSlopeDrainToward;
    if (roof.roofType === 'single_slope') {
      drain = drain ?? defaultSingleSlopeDrain(rd);
    }
    const r1 = applyCommand({
      type: 'updateRoof',
      roofId: roof.id,
      patch: {
        slopeDegrees: slope,
        overhangMm: oh,
        baseElevationMm: baseEl,
        ...(roof.roofType === 'single_slope' && drain ? { singleSlopeDrainToward: drain } : {}),
      },
    });
    if (!r1.ok) {
      setMsg(r1.error);
      return;
    }
    const r2 = applyCommand({ type: 'recomputeRoof', roofId: roof.id });
    if (!r2.ok) setMsg(r2.error);
    else setMsg('Параметры применены');
  };

  const patch = (p: RoofPatch) => {
    if (!roof) return;
    const r = applyCommand({ type: 'updateRoof', roofId: roof.id, patch: p });
    if (!r.ok) setMsg(r.error);
  };

  if (!topFloor) {
    return <p className="twix-muted" style={{ fontSize: 13 }}>Добавьте этаж.</p>;
  }

  if (!roof) {
    return (
      <div style={{ fontSize: 13 }}>
        <p className="twix-panelTitle">Крыша</p>
        <p className="twix-muted" style={{ fontSize: 13 }}>
          Соберите прямоугольный наружный контур стен на верхнем этаже и нажмите «Создать крышу по контуру». На этом
          шаге поддерживается только прямоугольная коробка.
        </p>
        <button type="button" style={{ marginTop: 8, fontSize: 13, padding: '8px 10px' }} onClick={() => void onCreateFromContour()}>
          Создать крышу по контуру
        </button>
        {msg ? <p style={{ marginTop: 8, fontSize: 12, color: '#b45309' }}>{msg}</p> : null}
      </div>
    );
  }

  const stale = roof.needsRecompute ?? false;
  const roofSummary = panelization?.roofSummaries.find((r) => r.roofId === roof.id);
  const roofWarnings = panelization?.warnings.filter((w) => w.relatedObjectIds.includes(roof.id)) ?? [];
  const roofSpec = spec?.roofSummaries.find((r) => r.roofId === roof.id);
  const ridgeDir = roof.ridgeDirection ?? 'x';

  return (
    <div style={{ fontSize: 13 }}>
      <p className="twix-panelTitle">Крыша</p>
      {stale ? (
        <div
          role="alert"
          style={{
            marginBottom: 10,
            padding: 8,
            borderRadius: 6,
            background: 'rgba(180, 83, 9, 0.12)',
            border: '1px solid rgba(180, 83, 9, 0.45)',
            fontSize: 12,
          }}
        >
          Крыша требует пересчёта: изменился контур стен или параметры.
          <button type="button" style={{ marginLeft: 8, fontSize: 11 }} onClick={() => void onRecompute()}>
            Пересчитать
          </button>
        </div>
      ) : null}

      <button type="button" style={{ marginBottom: 8, fontSize: 12 }} onClick={() => void onCreateFromContour()}>
        Пересоздать по контуру
      </button>
      <button type="button" style={{ marginLeft: 8, marginBottom: 8, fontSize: 12 }} onClick={() => void onRecompute()}>
        Пересчитать
      </button>

      <dl style={{ margin: 0, display: 'grid', gap: 6 }}>
        <dt className="twix-muted">Тип</dt>
        <dd style={{ margin: 0 }}>
          <select
            value={roof.roofType}
            onChange={(e) => {
              const v = e.target.value as Roof['roofType'];
              patch({ roofType: v });
              if (v === 'single_slope') {
                patch({ singleSlopeDrainToward: defaultSingleSlopeDrain(ridgeDir) });
              }
            }}
            style={{ width: '100%', padding: 4 }}
          >
            <option value="gable">Двускатная</option>
            <option value="single_slope">Односкатная</option>
          </select>
        </dd>
        <dt className="twix-muted">Уклон (°)</dt>
        <dd style={{ margin: 0 }}>
          <input
            type="number"
            min={1}
            max={75}
            step={1}
            value={slopeStr}
            onChange={(e) => setSlopeStr(e.target.value)}
            style={{ width: '100%', padding: 4 }}
          />
        </dd>
        <dt className="twix-muted">Свес карниза (мм)</dt>
        <dd style={{ margin: 0 }}>
          <input
            type="number"
            min={0}
            step={10}
            value={overhangStr}
            onChange={(e) => setOverhangStr(e.target.value)}
            style={{ width: '100%', padding: 4 }}
          />
        </dd>
        <dt className="twix-muted">Ось конька / верхнего свеса</dt>
        <dd style={{ margin: 0 }}>
          <select
            value={ridgeDir}
            onChange={(e) => {
              const v = e.target.value as 'x' | 'y';
              patch({
                ridgeDirection: v,
                ...(roof.roofType === 'single_slope' ? { singleSlopeDrainToward: defaultSingleSlopeDrain(v) } : {}),
              });
            }}
            style={{ width: '100%', padding: 4 }}
          >
            <option value="x">Вдоль X (горизонталь в плане)</option>
            <option value="y">Вдоль Y (вертикаль в плане)</option>
          </select>
        </dd>
        {roof.roofType === 'single_slope' ? (
          <>
            <dt className="twix-muted">Направление слива</dt>
            <dd style={{ margin: 0 }}>
              <select
                value={roof.singleSlopeDrainToward ?? defaultSingleSlopeDrain(ridgeDir)}
                onChange={(e) => patch({ singleSlopeDrainToward: e.target.value as RoofDrainDirection })}
                style={{ width: '100%', padding: 4 }}
              >
                {ridgeDir === 'x' ? (
                  <>
                    <option value="+y">К +Y</option>
                    <option value="-y">К −Y</option>
                  </>
                ) : (
                  <>
                    <option value="+x">К +X</option>
                    <option value="-x">К −X</option>
                  </>
                )}
              </select>
            </dd>
          </>
        ) : null}
        <dt className="twix-muted">Отметка нижней кромки (мм)</dt>
        <dd style={{ margin: 0 }}>
          <input
            type="number"
            step={10}
            value={baseElStr}
            onChange={(e) => setBaseElStr(e.target.value)}
            placeholder={String(suggestRoofBaseElevation(draft, roof.floorId))}
            style={{ width: '100%', padding: 4 }}
          />
          <span className="twix-muted" style={{ fontSize: 11 }}>
            {' '}
            пусто = авто (верх перекрытия)
          </span>
        </dd>
        <dt className="twix-muted">Этаж</dt>
        <dd style={{ margin: 0 }}>{roof.floorId}</dd>
        <dt className="twix-muted">SIP panelization</dt>
        <dd style={{ margin: 0 }}>
          <label>
            <input
              type="checkbox"
              checked={roof.panelizationEnabled ?? true}
              onChange={(e) => patch({ panelizationEnabled: e.target.checked })}
            />{' '}
            enabled
          </label>
        </dd>
        <dt className="twix-muted">SIP panel type</dt>
        <dd style={{ margin: 0 }}>
          <select
            value={roof.panelTypeId ?? ''}
            onChange={(e) => patch({ panelTypeId: e.target.value || undefined })}
            style={{ width: '100%', padding: 4 }}
          >
            <option value="">по умолчанию</option>
            {draft.panelLibrary.filter((p) => p.active).map((p) => (
              <option key={p.id} value={p.id}>
                {p.code}
              </option>
            ))}
          </select>
        </dd>
        <dt className="twix-muted">SIP panels / trimmed / area</dt>
        <dd style={{ margin: 0 }}>
          {roofSummary?.panelCount ?? 0} / {roofSummary?.trimmedCount ?? 0} / {roofSummary?.totalAreaM2 ?? 0} m²
        </dd>
        <dt className="twix-muted">SIP warnings</dt>
        <dd style={{ margin: 0 }}>{roofWarnings.length}</dd>
        <dt className="twix-muted">SPEC</dt>
        <dd style={{ margin: 0 }}>
          {roofSpec?.panelCount ?? 0} / {roofSpec?.trimmedCount ?? 0} / {roofSpec?.totalAreaM2 ?? 0} m²
          <div style={{ marginTop: 4 }}>
            <button type="button" style={{ fontSize: 11 }} onClick={() => setActivePanel('spec')}>
              Спецификация
            </button>
          </div>
        </dd>
      </dl>
      <button type="button" style={{ marginTop: 10, fontSize: 13 }} onClick={() => void applyParamsAndRecompute()}>
        Применить и пересчитать
      </button>
      <button type="button" style={{ marginTop: 8, marginLeft: 8, fontSize: 12 }} onClick={() => applyCommand({ type: 'deleteRoof', roofId: roof.id })}>
        Удалить крышу
      </button>
      {msg ? <p style={{ marginTop: 8, fontSize: 12, color: '#b45309' }}>{msg}</p> : null}
    </div>
  );
}
