import React, { useState } from 'react';
import { SipWallsEstimateItem } from '../../types/estimate';
import { EstimateTooltip } from './estimate/EstimateTooltip';

interface SipWallsEstimateTableProps {
  items: SipWallsEstimateItem[];
  totalMaterialsCost: number;
  installationCost: number;
  deliveryCost: number;
  totalCost: number;
  onUpdateItem: (index: number, field: keyof SipWallsEstimateItem, value: number) => void;
  onUpdateCosts: (field: 'installationCost' | 'deliveryCost', value: number) => void;
  isEditing: boolean;
}

const getTooltipContent = (item: SipWallsEstimateItem): string => {
  switch (item.name) {
    case 'СИП панели 163 мм высота 2,8м нарощенные пр-ва HotWell.kz':
      return `Количество СИП панелей 2,8м рассчитывается по формуле:
──────────────────────────────────
⌈(площадь стен 2,8м ÷ 3.5) + 3⌉
──────────────────────────────────
Где:
- 3.5 м² - площадь одной СИП панели 2,8м
- +3 - запас на непредвиденные расходы
- ⌈⌉ - округление вверх`;

    case 'СИП панели 163 мм высота 2,5м пр-ва HotWell.kz':
      return `Количество СИП панелей 2,5м рассчитывается по формуле:
──────────────────────────────────
⌈(площадь стен 2,5м ÷ 3.125) + 3⌉
──────────────────────────────────
Где:
- 3.125 м² - площадь одной СИП панели 2,5м
- +3 - запас на непредвиденные расходы`;

    case 'Брус 40x140x6000':
      return `Количество бруса рассчитывается по формуле:
──────────────────────────────────
⌈(погонаж бруса 40x14 ÷ 6) + 15⌉
──────────────────────────────────
Где:
- 6 м - длина одного бруса
- +15 шт - запас на непредвиденные расходы`;

    case 'Шурупы 4 крупная резьба':
      return `Количество шурупов 4 рассчитывается по формуле:
──────────────────────────────────
⌈(СИП панели 2,8м + СИП панели 2,5м) ÷ 2⌉
──────────────────────────────────
Назначение: для монтажа СИП панелей.
1 пачка хватает на 2,5 СИП панели`;

    case 'Шурупы 10 крупная резьба':
      return `Количество шурупов 10 рассчитывается по формуле:
──────────────────────────────────
⌈(СИП панели 2,8м + СИП панели 2,5м) × 0.04⌉
──────────────────────────────────
Назначение: для соединения углов дома`;

    case 'Пена монтажная 70л':
      return `Количество пены рассчитывается по формуле:
──────────────────────────────────
⌈(СИП панели 2,8м + СИП панели 2,5м) ÷ 1.5⌉
──────────────────────────────────
Назначение: для монтажа СИП панелей.
1 баллона пены хватает на 3 панели (~1.5 баллона на 2 панели)`;

    case 'Бикрост (Для гидро изоляции между СИП панелями и фундаментом)':
      return `Количество бикроста рассчитывается по формуле:
──────────────────────────────────
⌈(периметр фундамента ÷ 15) ÷ 4⌉
──────────────────────────────────
Где:
- 15 м - длина одного рулона
- ÷4 - использование рулона на 4 захода (укладка узкой полосой)`;

    default:
      return '';
  }
};

export const SipWallsEstimateTable: React.FC<SipWallsEstimateTableProps> = ({
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
            <td colSpan={4} className="px-4 py-2 text-right">Стоимость работы по монтажу СИП стен</td>
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
            <td colSpan={4} className="px-4 py-2 text-right">Доставка материала</td>
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
            <td colSpan={4} className="px-4 py-2 text-right">Итого, стоимость материалов + стоимость работ по монтажу SIP стен + доставка</td>
            <td className="px-4 py-2 text-right">{totalCost.toLocaleString()} ₸</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
};
