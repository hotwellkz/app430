import React from 'react';
import { CategoryCardType } from '../types';
import { useDraggable } from '@dnd-kit/core';
import { Home } from 'lucide-react';

interface CategoryCardProps {
  category: CategoryCardType;
}

export const CategoryCard: React.FC<CategoryCardProps> = ({ category }) => {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: category.id,
    data: category
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  // Безопасный рендер иконки с fallback
  const renderIcon = () => {
    if (category.icon && React.isValidElement(category.icon)) {
      return category.icon;
    }
    // Fallback иконка, если category.icon отсутствует или невалиден
    return <Home className="w-6 h-6 sm:w-7 sm:h-7 text-white" />;
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="flex flex-col items-center space-y-1 cursor-grab active:cursor-grabbing"
    >
      <div
        className={`relative w-12 h-12 sm:w-14 sm:h-14 ${category.color || 'bg-emerald-500'} rounded-full flex items-center justify-center shadow-md transition-transform duration-200 ease-out active:scale-95 hover:scale-105`}
      >
        {/* Liquid-glass orb: блик сверху-слева */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-full"
          style={{
            background:
              'radial-gradient(circle at 30% 22%, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.15) 35%, transparent 65%)',
          }}
        />
        {/* Тень снизу-справа — глубина */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-full"
          style={{
            background:
              'radial-gradient(circle at 72% 82%, rgba(0,0,0,0.20) 0%, transparent 55%)',
          }}
        />
        {/* Стеклянный ободок */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-inset ring-white/25"
        />
        {/* drop-shadow «отрывает» иконку от фона — часть liquid-glass эффекта. */}
        <span
          className="relative z-10 flex items-center justify-center text-white"
          style={{
            filter:
              'drop-shadow(0 1px 1.5px rgba(0,0,0,0.25)) drop-shadow(0 0 0.5px rgba(255,255,255,0.3))',
          }}
        >
          {renderIcon()}
        </span>
      </div>
      <div className="text-center">
        <div className="text-xs sm:text-sm font-medium text-gray-700 truncate max-w-[70px] sm:max-w-[80px]">
          {category.title}
        </div>
        <div className={`text-xs sm:text-sm font-medium ${
          category.amount.includes('-') ? 'text-red-500' : 'text-emerald-500'
        }`}>
          {category.amount}
        </div>
      </div>
    </div>
  );
};