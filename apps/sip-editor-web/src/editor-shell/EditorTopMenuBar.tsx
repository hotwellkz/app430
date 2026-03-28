import { cad } from './cadTheme';

const MENU_ITEMS = [
  'Файл',
  'Инструменты',
  'Проект',
  'Редактор',
  'Фундамент',
  'План этажа',
  'Стена',
  'Перекрытие',
  'Крыша',
  'Отчёты',
  'Визуализация',
  'Справка',
] as const;

export interface EditorTopMenuBarProps {
  projectTitle?: string;
  versionHint?: string;
  /** Проект помечен как шаблон (библиотека). */
  isTemplate?: boolean;
}

export function EditorTopMenuBar({ projectTitle, versionHint, isTemplate }: EditorTopMenuBarProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        minHeight: 26,
        padding: '0 6px',
        background: cad.menuBg,
        gap: 2,
        fontSize: cad.fontSize,
      }}
    >
      <nav style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, flex: 1, minWidth: 0 }}>
        {MENU_ITEMS.map((label) => (
          <button
            key={label}
            type="button"
            title="Меню (скоро)"
            style={{
              fontFamily: 'inherit',
              fontSize: cad.fontSize,
              padding: '3px 8px',
              border: `1px solid transparent`,
              borderRadius: cad.btnRadius,
              background: 'transparent',
              color: cad.text,
              cursor: 'default',
            }}
            onClick={(e) => e.preventDefault()}
          >
            {label}
          </button>
        ))}
      </nav>
      {(projectTitle || versionHint) && (
        <div
          style={{
            flex: 'none',
            textAlign: 'right',
            color: cad.muted,
            fontSize: cad.fontSize,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: '42%',
          }}
        >
          {projectTitle ? <span style={{ color: cad.text }}>{projectTitle}</span> : null}
          {isTemplate ? (
            <span style={{ marginLeft: 6, color: '#4338ca', fontWeight: 600 }}> (шаблон)</span>
          ) : null}
          {versionHint ? <span> {versionHint}</span> : null}
        </div>
      )}
    </div>
  );
}
