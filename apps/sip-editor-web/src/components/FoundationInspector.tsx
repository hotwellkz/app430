import { useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_FOUNDATION_HEIGHT_MM,
  DEFAULT_FOUNDATION_INNER_OFFSET_MM,
  DEFAULT_FOUNDATION_OUTER_OFFSET_MM,
  DEFAULT_FOUNDATION_WIDTH_MM,
  DEFAULT_SCREED_THICKNESS_MM,
  findFoundationByFloor,
  findGroundScreedByFloor,
} from '@2wix/domain-model';
import { useEditorStore } from '@2wix/editor-core';

export function FoundationInspector() {
  const draft = useEditorStore((s) => s.document.draftModel);
  const view = useEditorStore((s) => s.view);
  const applyCommand = useEditorStore((s) => s.applyCommand);
  const activeFloorId = view.activeFloorId;

  const foundation = useMemo(() => {
    if (!draft || !activeFloorId) return undefined;
    return findFoundationByFloor(draft, activeFloorId);
  }, [draft, activeFloorId]);

  const screed = useMemo(() => {
    if (!draft || !activeFloorId) return undefined;
    return findGroundScreedByFloor(draft, activeFloorId);
  }, [draft, activeFloorId]);

  const [widthMm, setWidthMm] = useState(String(DEFAULT_FOUNDATION_WIDTH_MM));
  const [heightMm, setHeightMm] = useState(String(DEFAULT_FOUNDATION_HEIGHT_MM));
  const [outerOff, setOuterOff] = useState(String(DEFAULT_FOUNDATION_OUTER_OFFSET_MM));
  const [innerOff, setInnerOff] = useState(String(DEFAULT_FOUNDATION_INNER_OFFSET_MM));
  const [screedTh, setScreedTh] = useState(String(DEFAULT_SCREED_THICKNESS_MM));

  useEffect(() => {
    if (foundation) {
      setWidthMm(String(foundation.widthMm));
      setHeightMm(String(foundation.heightMm));
      setOuterOff(String(foundation.outerOffsetMm));
      setInnerOff(String(foundation.innerOffsetMm));
    }
  }, [
    foundation?.id,
    foundation?.widthMm,
    foundation?.heightMm,
    foundation?.outerOffsetMm,
    foundation?.innerOffsetMm,
  ]);

  useEffect(() => {
    if (screed) {
      setScreedTh(String(screed.thicknessMm));
    }
  }, [screed?.id, screed?.thicknessMm]);

  const [msg, setMsg] = useState<string | null>(null);
  const showStale = foundation?.needsRecompute ?? false;

  const pushNumber = (
    label: string,
    raw: string
  ): { ok: true; value: number } | { ok: false; error: string } => {
    const v = Number(raw.replace(',', '.'));
    if (!Number.isFinite(v) || v <= 0) {
      return { ok: false, error: `${label}: нужно число > 0` };
    }
    return { ok: true, value: v };
  };

  const readParams = (): {
    widthMm: number;
    heightMm: number;
    outerOffsetMm: number;
    innerOffsetMm: number;
    screedThicknessMm: number;
    error?: string;
  } => {
    const w = pushNumber('Ширина', widthMm);
    const h = pushNumber('Высота', heightMm);
    const o = pushNumber('Наружный offset', outerOff);
    const i = pushNumber('Внутренний offset', innerOff);
    const st = pushNumber('Толщина стяжки', screedTh);
    if (!w.ok) return { widthMm: 0, heightMm: 0, outerOffsetMm: 0, innerOffsetMm: 0, screedThicknessMm: 0, error: w.error };
    if (!h.ok) return { widthMm: 0, heightMm: 0, outerOffsetMm: 0, innerOffsetMm: 0, screedThicknessMm: 0, error: h.error };
    if (!o.ok) return { widthMm: 0, heightMm: 0, outerOffsetMm: 0, innerOffsetMm: 0, screedThicknessMm: 0, error: o.error };
    if (!i.ok) return { widthMm: 0, heightMm: 0, outerOffsetMm: 0, innerOffsetMm: 0, screedThicknessMm: 0, error: i.error };
    if (!st.ok) return { widthMm: 0, heightMm: 0, outerOffsetMm: 0, innerOffsetMm: 0, screedThicknessMm: 0, error: st.error };
    return {
      widthMm: w.value,
      heightMm: h.value,
      outerOffsetMm: o.value,
      innerOffsetMm: i.value,
      screedThicknessMm: st.value,
    };
  };

  const onCreate = () => {
    setMsg(null);
    if (!activeFloorId) {
      setMsg('Выберите этаж');
      return;
    }
    const p = readParams();
    if (p.error) {
      setMsg(p.error);
      return;
    }
    const r = applyCommand({
      type: 'createFoundationFromContour',
      floorId: activeFloorId,
    });
    if (!r.ok) {
      setMsg(r.error);
      return;
    }
    const draftNow = useEditorStore.getState().document.draftModel;
    const f = draftNow && activeFloorId ? findFoundationByFloor(draftNow, activeFloorId) : undefined;
    if (!f) {
      setMsg('Не удалось создать фундамент');
      return;
    }
    const r2 = applyCommand({
      type: 'updateFoundation',
      foundationId: f.id,
      patch: {
        widthMm: p.widthMm,
        heightMm: p.heightMm,
        outerOffsetMm: p.outerOffsetMm,
        innerOffsetMm: p.innerOffsetMm,
        screedThicknessMm: p.screedThicknessMm,
      },
    });
    if (!r2.ok) setMsg(r2.error);
    else setMsg('Фундамент создан');
  };

  const onUpdate = () => {
    setMsg(null);
    if (!foundation) {
      setMsg('Нет фундамента на этаже');
      return;
    }
    const p = readParams();
    if (p.error) {
      setMsg(p.error);
      return;
    }
    const r = applyCommand({
      type: 'updateFoundation',
      foundationId: foundation.id,
      patch: {
        widthMm: p.widthMm,
        heightMm: p.heightMm,
        outerOffsetMm: p.outerOffsetMm,
        innerOffsetMm: p.innerOffsetMm,
        screedThicknessMm: p.screedThicknessMm,
      },
    });
    if (!r.ok) setMsg(r.error);
    else setMsg('Параметры применены');
  };

  const onRecompute = () => {
    setMsg(null);
    if (!foundation) {
      setMsg('Нет фундамента');
      return;
    }
    const r = applyCommand({ type: 'recomputeFoundation', foundationId: foundation.id });
    if (!r.ok) setMsg(r.error);
    else setMsg('Пересчитано');
  };

  const onDelete = () => {
    setMsg(null);
    if (!foundation) return;
    const r = applyCommand({ type: 'deleteFoundation', foundationId: foundation.id });
    if (!r.ok) setMsg(r.error);
  };

  return (
    <div style={{ fontSize: 13 }}>
      <p className="twix-panelTitle" style={{ marginTop: 0 }}>
        Фундамент и стяжка
      </p>
      {showStale ? (
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
          Фундамент требует пересчёта: изменился контур наружных стен. Нажмите «Пересчитать по контуру».
        </div>
      ) : null}
      <p className="twix-muted" style={{ fontSize: 12, marginBottom: 8 }}>
        Тип: ленточный по наружному контуру (наружные стены этажа).
      </p>
      <label className="twix-muted" style={{ display: 'block', fontSize: 11 }}>
        Ширина ленты, мм
      </label>
      <input
        type="text"
        value={widthMm}
        onChange={(e) => setWidthMm(e.target.value)}
        style={{ width: '100%', marginBottom: 8, padding: 6, fontSize: 13 }}
      />
      <label className="twix-muted" style={{ display: 'block', fontSize: 11 }}>
        Высота ленты, мм
      </label>
      <input
        type="text"
        value={heightMm}
        onChange={(e) => setHeightMm(e.target.value)}
        style={{ width: '100%', marginBottom: 8, padding: 6, fontSize: 13 }}
      />
      <label className="twix-muted" style={{ display: 'block', fontSize: 11 }}>
        Наружный выступ от SIP, мм
      </label>
      <input
        type="text"
        value={outerOff}
        onChange={(e) => setOuterOff(e.target.value)}
        style={{ width: '100%', marginBottom: 8, padding: 6, fontSize: 13 }}
      />
      <label className="twix-muted" style={{ display: 'block', fontSize: 11 }}>
        Внутренний offset, мм
      </label>
      <input
        type="text"
        value={innerOff}
        onChange={(e) => setInnerOff(e.target.value)}
        style={{ width: '100%', marginBottom: 8, padding: 6, fontSize: 13 }}
      />
      <label className="twix-muted" style={{ display: 'block', fontSize: 11 }}>
        Толщина стяжки, мм
      </label>
      <input
        type="text"
        value={screedTh}
        onChange={(e) => setScreedTh(e.target.value)}
        style={{ width: '100%', marginBottom: 10, padding: 6, fontSize: 13 }}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <button type="button" style={{ fontSize: 13, padding: '8px 10px' }} onClick={() => void onCreate()}>
          Создать фундамент по контуру
        </button>
        <button
          type="button"
          style={{ fontSize: 13, padding: '8px 10px' }}
          onClick={() => void onUpdate()}
          disabled={!foundation}
        >
          Применить параметры и пересчитать
        </button>
        <button
          type="button"
          style={{ fontSize: 13, padding: '8px 10px' }}
          onClick={() => void onRecompute()}
          disabled={!foundation}
        >
          Пересчитать по контуру
        </button>
        <button
          type="button"
          style={{ fontSize: 13, padding: '8px 10px', color: '#b91c1c' }}
          onClick={() => void onDelete()}
          disabled={!foundation}
        >
          Удалить фундамент
        </button>
      </div>
      {msg ? (
        <p
          style={{
            marginTop: 10,
            fontSize: 12,
            color: msg.includes('создан') || msg.includes('Пересчитано') || msg.includes('применены') ? '#15803d' : '#b45309',
          }}
        >
          {msg}
        </p>
      ) : null}
    </div>
  );
}
