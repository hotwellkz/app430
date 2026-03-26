import './shell.css';

export interface SidebarNavButtonProps {
  label: string;
  active?: boolean;
  onClick: () => void;
}

export function SidebarNavButton({
  label,
  active,
  onClick,
}: SidebarNavButtonProps) {
  return (
    <button
      type="button"
      className={`twix-navItem${active ? ' twix-navItem_active' : ''}`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}
