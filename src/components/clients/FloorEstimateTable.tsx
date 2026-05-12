import React, { useState } from 'react';
import { FloorEstimateItem } from '../../types/estimate';
import { EstimateTooltip } from './estimate/EstimateTooltip';

interface FloorEstimateTableProps {
  items: FloorEstimateItem[];
  totalMaterialsCost: number;
  installationCost: number;
  deliveryCost: number;
  totalCost: number;
  onUpdateItem: (index: number, field: keyof FloorEstimateItem, value: number) => void;
  onUpdateCosts: (field: 'installationCost' | 'deliveryCost', value: number) => void;
  isEditing: boolean;
}

const getTooltipContent = (item: FloorEstimateItem): string => {
  switch (item.name) {
    case 'Брус 40x190x6000 (Для перекрыт расстояние между балками 29см)':
      return `Количество бруса 40x190 рассчитывается по формуле:
──────────────────────────────────
⌈((пог. бруса 40x19 + балок 40x19) ÷ 6) + 2⌉
──────────────────────────────────
Где:
- 6 м - длина одного бруса
- +2 шт - запас на непредвиденные расходы
- Расстояние между балками: 29 см`;

    case 'OSB 18 (Для перекрытия (пол второго этажа))':
      return `Количество OSB рассчитывается по формуле:
──────────────────────────────────
⌈(площадь пола ÷ 3.125) + 1⌉
──────────────────────────────────
Где:
- 3.125 м² - площадь одного листа OSB 18 (1.25 × 2.5)
- +1 лист - запас на подрезку`;

    case 'Шурупы 4 крупная резьба':
      return `Количество шурупов рассчитывается по формуле:
──────────────────────────────────
⌈количество OSB ÷ 5⌉
──────────────────────────────────
1 пачка хватает на 5 листов OSB`;

    case 'Гвозди 120':
      return `Количество гвоздей рассчитывается по формуле:
──────────────────────────────────
⌈количество бруса × 0.05⌉
──────────────────────────────────
Назначение: для монтажа бруса.
0.05 кг на 1 балку`;

    default:
      return '';
  }
};

export const FloorEstimateTable: React.FC<FloorEstimateTableProps> = ({
  items,
  totalMaterialsCost,
  installationCost,
  deliveryCost,
  totalCost,
  onUpdateItem,
  onUpdateCosts,
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
          <tr className="bg-gray-100 font-bold">
            <td colSpan={4} className="px-4 py-2 text-right">Итого, стоимость материалов</td>
            <td className="px-4 py-2 text-right">{totalMaterialsCost.toLocaleString()} ₸</td>
          </tr>
          <tr>
            <td colSpan={4} className="px-4 py-2 text-right">Стоимость работы по монтажу перекрытия</td>
            <td className="px-4 py-2">
              <input
                type="number"
                value={installationCost}
                onChange={(e) => onUpdateCosts('installationCost', Number(e.target.value))}
                className="w-full px-2 py-1 text-right border rounded"
                disabled={!isEditing}
              />
            </td>
          </tr>
          <tr>
            <td colSpan={4} className="px-4 py-2 text-right">Доставка</td>
            <td className="px-4 py-2">
              <input
                type="number"
                value={deliveryCost}
                onChange={(e) => onUpdateCosts('deliveryCost', Number(e.target.value))}
                className="w-full px-2 py-1 text-right border rounded"
                disabled={!isEditing}
              />
            </td>
          </tr>
          <tr className="bg-gray-200 font-bold">
            <td colSpan={4} className="px-4 py-2 text-right">Итого, стоимость материалов + стоимость работ по монтажу перекрытия</td>
            <td className="px-4 py-2 text-right">{totalCost.toLocaleString()} ₸</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
};
