export const ASTANA_BRANCH_NAME = 'Астана';
export const ALMATY_BRANCH_NAME = 'Алматы';

const ASTANA_CITIES = [
  'Астана', 'Кокшетау', 'Косшы', 'Степногорск', 'Акколь', 'Атбасар', 'Державинск', 'Есиль',
  'Ерейментау', 'Макинск', 'Степняк', 'Щучинск', 'Караганда', 'Балхаш', 'Приозерск', 'Сарань',
  'Темиртау', 'Шахтинск', 'Абай', 'Каркаралинск', 'Жезказган', 'Сатпаев', 'Каражал', 'Костанай',
  'Рудный', 'Лисаковск', 'Аркалык', 'Житикара', 'Тобыл', 'Петропавловск', 'Булаево', 'Мамлютка',
  'Сергеевка', 'Тайынша', 'Павлодар', 'Аксу', 'Экибастуз', 'Семей', 'Курчатов', 'Аягоз', 'Шар',
  'Усть-Каменогорск', 'Риддер', 'Алтай', 'Зайсан', 'Серебрянск', 'Шемонаиха'
] as const;

const ALMATY_CITIES = [
  'Алматы', 'Шымкент', 'Конаев', 'Алатау', 'Есик', 'Каскелен', 'Талгар', 'Талдыкорган',
  'Текели', 'Жаркент', 'Ушарал', 'Сарканд', 'Уштобе', 'Тараз', 'Каратау', 'Жанатас', 'Шу',
  'Туркестан', 'Кентау', 'Арысь', 'Шардара', 'Жетысай', 'Сарыагаш', 'Ленгер', 'Кызылорда',
  'Байконур', 'Аральск', 'Казалинск', 'Атырау', 'Кульсары', 'Уральск', 'Аксай', 'Актобе',
  'Алга', 'Жем', 'Кандыагаш', 'Темир', 'Хромтау', 'Шалкар', 'Эмба', 'Актау', 'Жанаозен',
  'Форт-Шевченко'
] as const;

export const PINNED_CITY_NAMES = [
  'Алматы',
  'Астана',
  'Шымкент',
  'Караганда',
  'Конаев',
  'Талдыкорган',
  'Тараз',
  'Актобе',
  'Павлодар',
  'Костанай'
] as const;

const ALIASES: Record<string, string> = {
  'алмата': 'Алматы',
  'капчагай': 'Конаев',
  'алматы обл': 'Алматы',
  'алматинская область': 'Алматы',
  'нур султан': 'Астана',
  'нурсултан': 'Астана'
};

function normalizeKey(value: string): string {
  return (value ?? '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/^\s*г\.?\s*/i, '')
    .replace(/[()]/g, ' ')
    .replace(/[-_/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const CITY_TO_BRANCH = new Map<string, string>();
const CITY_CANONICAL = new Map<string, string>();

for (const city of ASTANA_CITIES) {
  const key = normalizeKey(city);
  CITY_TO_BRANCH.set(key, ASTANA_BRANCH_NAME);
  CITY_CANONICAL.set(key, city);
}
for (const city of ALMATY_CITIES) {
  const key = normalizeKey(city);
  CITY_TO_BRANCH.set(key, ALMATY_BRANCH_NAME);
  CITY_CANONICAL.set(key, city);
}
for (const [alias, canonical] of Object.entries(ALIASES)) {
  const aliasKey = normalizeKey(alias);
  const canonicalKey = normalizeKey(canonical);
  CITY_CANONICAL.set(aliasKey, CITY_CANONICAL.get(canonicalKey) ?? canonical);
  CITY_TO_BRANCH.set(aliasKey, CITY_TO_BRANCH.get(canonicalKey) ?? ALMATY_BRANCH_NAME);
}

export function normalizeCityToCanonical(rawCity: string | null | undefined): string | null {
  const key = normalizeKey(rawCity ?? '');
  if (!key) return null;
  return CITY_CANONICAL.get(key) ?? null;
}

export function resolveBranchNameByCity(rawCity: string | null | undefined): string | null {
  const key = normalizeKey(rawCity ?? '');
  if (!key) return null;
  return CITY_TO_BRANCH.get(key) ?? null;
}

/** Убирает префикс «Филиал …» для сопоставления с нормативным именем («Алматы», «Астана»). */
export function stripFilialPrefixFromBranchLabel(name: string): string {
  return (name ?? '')
    .trim()
    .replace(/^\s*филиал\s+/iu, '')
    .trim();
}

/**
 * Находит запись филиала по нормативному имени (как в CITY_TO_BRANCH: «Алматы», «Астана»).
 * Совпадение: точное (без учёта регистра) или после снятия префикса «Филиал ».
 */
export function findBranchByRegulatedName(
  branches: Array<{ id: string; name: string }>,
  regulatedBranchName: string
): { id: string; name: string } | undefined {
  const target = (regulatedBranchName ?? '').trim().toLowerCase();
  if (!target) return undefined;
  return branches.find((b) => {
    const n = b.name.trim();
    if (n.toLowerCase() === target) return true;
    return stripFilialPrefixFromBranchLabel(n).toLowerCase() === target;
  });
}

export function buildConsistentCityBranch(
  rawCity: string | null | undefined,
  branches: Array<{ id: string; name: string }>
): { city: string | null; branchId: string | null; branchName: string | null } {
  const city = normalizeCityToCanonical(rawCity) ?? null;
  if (!city) {
    return { city: null, branchId: null, branchName: null };
  }
  const branchName = resolveBranchNameByCity(city);
  if (!branchName) {
    return { city, branchId: null, branchName: null };
  }
  const branch = findBranchByRegulatedName(branches, branchName);
  return {
    city,
    branchId: branch?.id ?? null,
    branchName
  };
}

export function getRegulatedCitiesList(): string[] {
  const set = new Set<string>([...ASTANA_CITIES, ...ALMATY_CITIES]);
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'ru'));
}

export function getOrderedCities(
  cities: string[],
  counts?: Record<string, number>
): { primary: string[]; rest: string[] } {
  const unique = Array.from(new Set(cities.filter(Boolean).map((c) => c.trim()).filter(Boolean)));
  const byName = new Map(unique.map((c) => [c, counts?.[c] ?? 0]));
  const pinned = PINNED_CITY_NAMES.filter((c) => byName.has(c));
  const nonPinned = unique
    .filter((c) => !pinned.includes(c as (typeof PINNED_CITY_NAMES)[number]))
    .sort((a, b) => {
      const diff = (byName.get(b) ?? 0) - (byName.get(a) ?? 0);
      if (diff !== 0) return diff;
      return a.localeCompare(b, 'ru');
    });
  const primary = [...pinned, ...nonPinned.slice(0, Math.max(0, 10 - pinned.length))];
  const rest = nonPinned.filter((c) => !primary.includes(c));
  return { primary, rest };
}

