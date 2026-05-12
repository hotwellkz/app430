import React, { useState } from 'react';
import { ConsumablesEstimateItem } from '../../types/estimate';
import { EstimateTooltip } from './estimate/EstimateTooltip';

interface ConsumablesEstimateTableProps {
  items: ConsumablesEstimateItem[];
  totalMaterialsCost: number;
  onUpdateItem: (index: number, field: keyof ConsumablesEstimateItem, value: number) => void;
  isEditing: boolean;
}

const getTooltipContent = (item: ConsumablesEstimateItem): string => {
  switch (item.name) {
    case 'Анкера 12x150 (Для крепления обвязки к фундаменту)':
      return `Количество анкеров рассчитывается по формуле:
──────────────────────────────────
⌈(периметр фундамента ÷ 2) + 20⌉
──────────────────────────────────
- Периметр делится на 2 - анкер примерно через каждые 2 м
- +20 шт - запас на углы и непредвиденные расходы`;

    default:
      return '';
  }
};

export const ConsumablesEstimateTable: React.FC<ConsumablesEstimateTableProps> = ({
  items,
  totalMaterialsCost,
  onUpdateItem,
  isEditing
}) => {
  const [showTooltip, setShowTooltip] = useState<number | null>(null);

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full">
        <thead>
          <tr className="bg-gray-100">
            <th className="px-4 py-2 text-left">Наименование</th>
            <th className="px-4 py-2 text-center">Ед.изм</th>
            <th className="px-4 py-2 text-center">Кол-во</th>
            <th className="px-4 py-2 text-center">Цена ₸</th>
            <th className="px-4 py-2 text-center">Сумма ₸</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => {
            const tooltipContent = getTooltipContent(item);
            const hasTooltip = tooltipContent.length > 0;
            return (
              <tr key={index} className="border-t">
                <td className="px-4 py-2">
                  {hasTooltip ? (
                    <div
                      className="relative inline-block cursor-help"
                      onMouseEnter={() => setShowTooltip(index)}
                      onMouseLeave={() => setShowTooltip(null)}
                      onClick={() => setShowTooltip(showTooltip === index ? null : index)}
                    >
                      <span className="border-b border-dotted border-gray-400">{item.name}</span>
                      <EstimateTooltip content={tooltipContent} show={showTooltip === index} />
                    </div>
                  ) : (
                    item.name
                  )}
                </td>
                <td className="px-4 py-2 text-center">{item.unit}</td>
                <td className="px-4 py-2 text-center">
                  <input
                    type="number"
                    value={item.quantity}
                    onChange={(e) => onUpdateItem(index, 'quantity', Number(e.target.value))}
                    className="w-24 px-2 py-1 text-right border rounded"
                    disabled={!isEditing}
                    step="0.1"
                  />
                </td>
                <td className="px-4 py-2 text-center">
                  <input
                    type="number"
                    value={item.price}
                    onChange={(e) => onUpdateItem(index, 'price', Number(e.target.value))}
                    className="w-24 px-2 py-1 text-right border rounded"
                    disabled={!isEditing}
                  />
                </td>
                <td className="px-4 py-2 text-right">{item.total.toLocaleString()} ₸</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="bg-gray-200 font-bold">
            <td colSpan={4} className="px-4 py-2 text-right">Итого, стоимость расходных материалов</td>
            <td className="px-4 py-2 text-right">{totalMaterialsCost.toLocaleString()} ₸</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
};
