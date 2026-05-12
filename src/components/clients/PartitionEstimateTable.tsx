import React, { useState } from 'react';
import { PartitionEstimateItem } from '../../types/estimate';
import { EstimateTooltip } from './estimate/EstimateTooltip';

interface PartitionEstimateTableProps {
  items: PartitionEstimateItem[];
  totalMaterialsCost: number;
  installationCost: number;
  deliveryCost: number;
  totalCost: number;
  onUpdateItem: (index: number, field: keyof PartitionEstimateItem, value: number) => void;
  onUpdateCosts: (field: 'installationCost' | 'deliveryCost', value: number) => void;
  isEditing: boolean;
}

const getTooltipContent = (item: PartitionEstimateItem): string => {
  switch (item.name) {
    case 'Гипсокартон 12,5мм влагостойкий стеновой (Для межком перег) пр-ва Knauf':
      return `Количество влагостойкого ГКЛ рассчитывается по формуле:
──────────────────────────────────
⌈((длина стен 1эт × высота 1эт) + (длина стен 2эт × высота 2эт)) ÷ 3⌉
──────────────────────────────────
Где:
- 3 м² - площадь одного листа ГКЛ
- Длина считается отдельно для каждого этажа`;

    case 'Гипсокартон 12,5мм стеновой (Для межкомнатных перегородок) пр-ва Knauf':
      return `Количество обычного ГКЛ рассчитывается по формуле:
──────────────────────────────────
⌈((площадь ГКЛ-стен × 2) ÷ 3) + 2⌉ − количество влагостойкого
──────────────────────────────────
Где:
- × 2 - обшивка с двух сторон перегородки
- 3 м² - площадь одного листа ГКЛ
- +2 листа - запас на подрезку
- Из общего количества вычитается влагостойкий ГКЛ`;

    case 'Профиль для перегородок 75x50x3000 пр-ва Stynergy':
      return `Количество стоечных профилей берётся из параметра «партишн профиль»
──────────────────────────────────
Значение вводится в характеристиках дома
──────────────────────────────────
Зависит от количества и длины перегородок`;

    case 'Направляющие для перегородочного проф. 75x40x3000 пр-ва Stynergy':
      return `Количество направляющих рассчитывается по формуле:
──────────────────────────────────
⌈((длина ГКЛ-стен × 2) ÷ 3) + 2⌉
──────────────────────────────────
Где:
- × 2 - направляющая идёт сверху и снизу
- 3 м - длина одной направляющей
- +2 - запас`;

    case 'Мин вата Экотерм (Для заполнения меж-комнатных перегородок) (1рул-12м2)':
      return `Количество минваты рассчитывается по формуле:
──────────────────────────────────
⌈площадь ГКЛ-стен ÷ 9⌉
──────────────────────────────────
Где:
- 9 м² - полезная площадь одного рулона (с учётом нахлёстов и подрезки из 12 м²)`;

    case 'Шурупы 3 мелкая резьба (Для монтажа гипсокартона к профилям) 1п на 5 лис':
      return `Количество шурупов рассчитывается по формуле:
──────────────────────────────────
⌈количество обычного ГКЛ ÷ 5⌉
──────────────────────────────────
1 пачка хватает на 5 листов гипсокартона`;

    default:
      return '';
  }
};

export const PartitionEstimateTable: React.FC<PartitionEstimateTableProps> = ({
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
            <td colSpan={4} className="px-4 py-2 text-right">Стоимость работ по монтажу перегородок из гипсокартона</td>
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
            <td colSpan={4} className="px-4 py-2 text-right">Доставка перегородок</td>
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
            <td colSpan={4} className="px-4 py-2 text-right">Итого, стоимость материалов + стоимость работ по монтажу перегородок</td>
            <td className="px-4 py-2 text-right">{totalCost.toLocaleString()} ₸</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
};
