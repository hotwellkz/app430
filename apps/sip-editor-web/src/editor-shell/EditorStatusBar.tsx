import { cad } from './cadTheme';

export interface EditorStatusBarProps {
  modeLabel: string;
  toolLabel: string;
  snapOn: boolean;
  gridOn: boolean;
  zoom: number;
  cursorLabel?: string;
  saveStatusShort?: string;
  /** Активный этаж (подпись). */
  floorLabel?: string | null;
  /** Кратко: активный слой без префикса «Слой:». */
  layerHintShort?: string;
}

export function EditorStatusBar({
  modeLabel,
  toolLabel,
  snapOn,
  gridOn,
  zoom,
  cursorLabel = '—',
  saveStatusShort,
  floorLabel,
  layerHintShort,
}: EditorStatusBarProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px 16px',
        minHeight: cad.statusH,
        padding: '2px 10px',
        background: cad.toolbarBg,
        borderTop: `1px solid ${cad.panelBorder}`,
        fontSize: cad.fontSizeSm,
        color: cad.muted,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      }}
    >
      <span>{modeLabel}</span>
      {floorLabel ? (
        <>
          <span style={{ color: cad.panelBorder }}>|</span>
          <span>
            этаж: <span style={{ color: cad.text }}>{floorLabel}</span>
          </span>
        </>
      ) : null}
      {layerHintShort ? (
        <>
          <span style={{ color: cad.panelBorder }}>|</span>
          <span>
            слой: <span style={{ color: cad.text }}>{layerHintShort}</span>
          </span>
        </>
      ) : null}
      <span style={{ color: cad.panelBorder }}>|</span>
      <span>
        инструмент: <span style={{ color: cad.text }}>{toolLabel}</span>
      </span>
      <span style={{ color: cad.panelBorder }}>|</span>
      <span>
        привязка: <span style={{ color: cad.text }}>{snapOn ? 'вкл' : 'выкл'}</span>
      </span>
      <span style={{ color: cad.panelBorder }}>|</span>
      <span>
        сетка: <span style={{ color: cad.text }}>{gridOn ? 'вкл' : 'выкл'}</span>
      </span>
      <span style={{ color: cad.panelBorder }}>|</span>
      <span>
        масштаб: <span style={{ color: cad.text }}>{zoom.toFixed(2)}</span>
      </span>
      <span style={{ color: cad.panelBorder }}>|</span>
      <span>
        курсор: <span style={{ color: cad.text }}>{cursorLabel}</span>
      </span>
      {saveStatusShort ? (
        <>
          <span style={{ color: cad.panelBorder }}>|</span>
          <span style={{ color: cad.text }}>{saveStatusShort}</span>
        </>
      ) : null}
    </div>
  );
}
