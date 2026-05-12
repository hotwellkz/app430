import React, { useState } from 'react';
import { RoofEstimateItem } from '../../types/estimate';
import { EstimateTooltip } from './estimate/EstimateTooltip';

interface RoofEstimateTableProps {
  items: RoofEstimateItem[];
  totalMaterialsCost: number;
  roofWorkCost: number;
  deliveryCost: number;
  totalCost: number;
  onUpdateItem: (index: number, field: keyof RoofEstimateItem, value: number) => void;
  onUpdateCosts: (field: 'roofWorkCost' | 'deliveryCost', value: number) => void;
  isEditing: boolean;
}

const getTooltipContent = (item: RoofEstimateItem): string => {
  switch (item.name) {
    case 'Брус 40x140x6000':
      return `Количество бруса рассчитывается по формуле:
──────────────────────────────────
⌈((пог. бруса крыши + чердака 40x14) ÷ 6) + 15⌉
──────────────────────────────────
Назначение: для устройства стропильной системы крыши.
- 6 м - длина одного бруса
- +15 шт - запас на непредвиденные расходы`;

    case 'Брус 25x100x6000 (Для обрешетки)':
      return `Количество бруса обрешётки рассчитывается по формуле:
──────────────────────────────────
⌈(пог. обрешётки 20x9 ÷ 6) + 15⌉
──────────────────────────────────
- 6 м - длина одного бруса
- +15 шт - запас`;

    case 'Металлочерепица глянец (Сырье Россия) (Форм СуперМонтеррей толщ. 0,45мм)':
      return `Количество металлочерепицы:
──────────────────────────────────
площадь металлочерепицы (м²) - значение из параметров крыши
──────────────────────────────────
Вводится в характеристиках дома, цена применяется напрямую`;

    case 'Паро. пленка (Под обрешетку) и (Для обшивки потолок 2эт.)':
      return `Количество паро-плёнки рассчитывается по формуле:
──────────────────────────────────
⌈(площадь металлочерепицы ÷ 50) + (площадь пола ÷ 50)⌉
──────────────────────────────────
Назначение: паро-гидро изоляция, класс D.
- 50 м² - полезная площадь одного рулона (рулон 60 м с нахлёстами)`;

    case 'Конек бочкообразный (Для металлочерепицы двухметровый)':
      return `Количество коньков рассчитывается по формуле:
──────────────────────────────────
⌈длина конька ÷ 1.85⌉
──────────────────────────────────
- 1.85 м - полезная длина одного конька (2 м с учётом нахлёста)`;

    case 'Заглушка конусная (Для бочкообразного конька)':
      return `Количество заглушек берётся из параметра «конусная заглушка».
──────────────────────────────────
Значение вводится в характеристиках крыши.
По 1 заглушке на каждый торец конька`;

    case 'Тройник (Для стыков бочкообразных коньков)':
      return `Количество тройников берётся из параметра «тройник».
──────────────────────────────────
Значение вводится в характеристиках крыши.
По 1 тройнику на каждый стык коньков (для четырёхскатной крыши)`;

    case 'Ендова внешняя 80x80мм (Для металлочерепицы двухметровая)':
      return `Количество внешних ендов рассчитывается по формуле:
──────────────────────────────────
⌈длина ендовы ÷ 1.85⌉
──────────────────────────────────
- 1.85 м - полезная длина одной ендовы`;

    case 'Ендова внутренняя 600x600мм (Под металлочереп 600x600 двухметровая)':
      return `Количество внутренних ендов рассчитывается по формуле:
──────────────────────────────────
⌈длина ендовы ÷ 1.85⌉
──────────────────────────────────
- 1.85 м - полезная длина одной ендовы (нахлёст с предыдущей)`;

    case 'Планка примыкания к стене 150x150мм (В местах примык. мет. чер. к стене)':
      return `Количество планок примыкания берётся из параметра «планка примыкания».
──────────────────────────────────
Значение вводится в характеристиках крыши.
По длине участков примыкания металлочерепицы к стене`;

    case 'Пенополистирол Толщ 145мм (Для Утепления пот. 2-го эт)':
      return `Количество пенополистирола рассчитывается по формуле:
──────────────────────────────────
⌈площадь чердака ÷ 2.88⌉
──────────────────────────────────
- 2.88 м² - площадь одного листа толщиной 145 мм`;

    case 'Гвозди 120':
      return `Количество гвоздей 120 рассчитывается по формуле:
──────────────────────────────────
⌈количество бруса 40x140 × 0.15⌉
──────────────────────────────────
Назначение: устройство стропильной системы.
0.15 кг гвоздей на одну стропилу`;

    case 'Гвозди 70 (Для монтажа обрешетки)':
      return `Количество гвоздей 70 рассчитывается по формуле:
──────────────────────────────────
⌈количество бруса обрешётки × 0.166⌉
──────────────────────────────────
0.166 кг гвоздей на 1 брус обрешётки (25x100)`;

    case 'Шурупы 4 (Для монтажа металлочерепицы)':
      return `Количество шурупов рассчитывается по формуле:
──────────────────────────────────
⌈площадь металлочерепицы × 0.074⌉
──────────────────────────────────
- 0.074 пачки на 1 м² металлочерепицы`;

    case 'Пена монтажная 70л':
      return `Количество пены рассчитывается по формуле:
──────────────────────────────────
⌈количество пенополистирола × 0.5⌉
──────────────────────────────────
Назначение: утепление потолка 2-го этажа + периметр перекрытия.
0.5 баллона на 1 лист пенополистирола`;

    case 'Скобы (Для крепления паро пленки)':
      return `Количество скоб рассчитывается по формуле:
──────────────────────────────────
максимум(0, количество паро-плёнки − 1)
──────────────────────────────────
1 пачка скоб закрывает 1 стык между рулонами плёнки`;

    case 'Шурупы 4 крупная резьба':
      return `Количество шурупов рассчитывается вручную или по умолчанию.
──────────────────────────────────
Назначение: монтаж фронтонов.
1 пачка хватает на 7 листов OSB`;

    case 'OSB 9мм (Для фронтона. Только для двух или односкатных крыш)':
      return `Количество OSB для фронтона рассчитывается по формуле:
──────────────────────────────────
⌈площадь фронтона ÷ 3.125⌉ + 2
──────────────────────────────────
- 3.125 м² - площадь одного листа OSB
- +2 - запас на подрезку
Только для двух- или односкатных крыш`;

    default:
      return '';
  }
};

export const RoofEstimateTable: React.FC<RoofEstimateTableProps> = ({
  items,
  totalMaterialsCost,
  roofWorkCost,
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
            <td colSpan={4} className="px-4 py-2 text-right">Стоимость кровельных работ с утеплением потолка второго этажа</td>
            <td className="px-4 py-2">
              <input
                type="number"
                value={roofWorkCost}
                onChange={(e) => onUpdateCosts('roofWorkCost', Number(e.target.value))}
                className="w-full px-2 py-1 text-right border rounded"
                disabled={!isEditing}
              />
            </td>
          </tr>
          <tr>
            <td colSpan={4} className="px-4 py-2 text-right">Доставка Черепицы, бруса, пенопласта потолок</td>
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
            <td colSpan={4} className="px-4 py-2 text-right">Итого, стоимость материалов + стоимость кровельных работ</td>
            <td className="px-4 py-2 text-right">{totalCost.toLocaleString()} ₸</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
};
