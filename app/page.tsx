'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from 'recharts';
import {
  Users,
  Sparkles,
  TrendingUp,
  Flame,
  Search,
  X,
  ArrowRightLeft,
  ChevronRight,
  Loader2,
  Wifi,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ShieldCheck,
  Activity,
  Printer,
  BadgeDollarSign,
  BarChart3,
  SlidersHorizontal,
  RotateCcw,
  Globe,
  Calendar,
} from 'lucide-react';

type Position = 'FW' | 'MF' | 'DF' | 'GK';
type Language = 'uz' | 'ru';
type League = 'UZB' | 'KAZ';
type SeasonMode = 'current' | 'two';
type SortField = 'value' | 'age' | 'scout';
type SortOrder = 'asc' | 'desc';

interface RoleRadarMetrics {
  m1: number;
  m2: number;
  m3: number;
  m4: number;
  m5: number;
  m6: number;
}

interface Player {
  id: string;
  league: League;
  name: { uz: string; ru: string };
  age: number;
  isU21: boolean;
  isLegionnaire: boolean;
  club: { uz: string; ru: string };
  position: Position;
  number: number;
  height: number;
  preferredFoot: 'Right' | 'Left' | 'Both' | string;
  marketValue: string;
  rawMarketValueEUR: number;
  contractUntil: string;
  photoUrl: string;
  initials: string;
  scoutIndex: number;
  tags: string[];
  minutesPlayed: number;
  matchesPlayed: number;
  goals: number;
  assists: number;
  xG: number;
  xA: number;
  shots: number;
  keyPasses: number;
  dribbleSuccessRate: number;
  dribbleWon: number;
  dribbleTotal: number;
  duelWinRate: number;
  progressiveRuns: number;
  aerialWinRate: number;
  tackles?: number;
  interceptions?: number;
  saves: number;
  radar: RoleRadarMetrics;
}

const RADAR_AXIS_LABELS = {
  uz: {
    GK: ['Seyvlar', 'Chiqishlar', 'Darvozadan pas', 'Yakkakurash', 'Quruq o‘yinlar', 'Reaksiya'],
    DF: ['To‘p qaytarish', 'Havoda kurash', 'Yerdagi kurash', 'Intizom', 'Uzun paslar', 'Jismoniy holat'],
    MF: ['Xavfli paslar', 'Maydonni ko‘rish', 'To‘p nazorati', 'To‘pni qaytarish', 'Pas aniqligi', 'Dinamika'],
    FW: ['Zarba yakuni', 'xG xavflilik', '1-ga-1 Dribling', 'Jarimadagi harakat', 'Tezkor siljish', 'Bosh bilan o‘yin'],
  },
  ru: {
    GK: ['Сейвы', 'Игра на выходе', 'Ввод мяча', 'Единоборства', 'Сухие матчи', 'Реакция'],
    DF: ['Отборы/перехваты', 'Верховые дуэли', 'Единоборства', 'Позиционная игра', 'Первый пас', 'Физика'],
    MF: ['Острые пасы', 'Видение поля', 'Дриблинг/контроль', 'Возврат владения', 'Точность передач', 'Объем работы'],
    FW: ['Завершение', 'Острота xG', 'Дриблинг 1-в-1', 'Касания в штрафной', 'Рывки с мячом', 'Игра головой'],
  },
};

const TRANSLATIONS = {
  uz: {
    tagline: 'Markaziy Osiyo skautingi va professional tahlil platformasi',
    searchPlaceholder: 'Ism yoki jamoa bo‘yicha qidirish...',
    leagueUZB: '🇺🇿 O‘zbekiston (Superliga)',
    leagueKAZ: '🇰🇿 Qozog‘iston (Premyer-liga)',
    totalPlayers: 'Skauting bazasi',
    seasonCurrentBadge: 'Joriy mavsum statistikasi',
    seasonTwoBadge: 'Oxirgi 2 mavsum statistikasi',
    u21Players: 'U21 Iqtidorlari',
    u21PlayersSub: 'Yosh iqtidorlar',
    topScorer: 'Yetakchi to‘purar',
    topScoutIndex: 'Yetakchi reyting',
    filtersBtn: 'Filtrlar',
    filterPanelTitle: 'Qidiruv va Skauting Filtrlari',
    filterPanelSub: 'Parametrlarni birlashtirib mos futbolchilarni toping',
    seasonSelectorLabel: 'Statistika davri:',
    seasonCurrentOption: '1 mavsum (Joriy mavsum)',
    seasonTwoOption: '2 mavsum (Oxirgi 2 mavsum)',
    filterLegionnaire: 'Faqat legionerlar',
    filterLegionnaireDesc: 'Xorijdagi futbolchilar va chet elliklar',
    filterU21: 'Faqat U21 iqtidorlar',
    filterExpiringContract: 'Shartnomasi tugayotganlar (2026/2027)',
    filterMinMinutes: 'Asosiy tarkib futbolchilari (>450 daqiqa)',
    filterClub: 'Klub bo‘yicha filtr:',
    filterPosition: 'Amplua bo‘yicha filtr:',
    allClubs: 'Barcha klublar',
    allPositions: 'Barcha amplualar',
    resetFilters: 'Filtrlarni tozalash',
    applyFilters: 'Natijalarni ko‘rish',
    sortByValue: 'Narx',
    sortByAge: 'Yosh',
    sortByScout: 'Scout Index',
    tableHint: 'Batafsil ma‘lumot va tahlil uchun futbolchi ustiga bosing',
    colPlayer: 'Futbolchi',
    colClub: 'Klub',
    colPosition: 'Amplua',
    colMatchesAndMin: 'O‘yin (Daq.)',
    colGoals: 'Gollar',
    colAssists: 'Paslar',
    colDribbling: 'Dribling %',
    colScoutIndex: 'Scout Index',
    posFW: 'Hujumchi',
    posMF: 'Yarim himoyachi',
    posDF: 'Himoyachi',
    posGK: 'Darvozabon',
    years: 'yosh',
    compareBtn: 'Taqqoslov',
    exportPdfBtn: 'PDF Eksport',
    fullStatsBtn: 'To‘liq statistika',
    hideStatsBtn: 'Yashirish',
    pickerTitle: 'Taqqoslash uchun futbolchini tanlang',
    pickerSub: 'Asosiy futbolchi:',
    onlySamePositionNote: 'Faqat bir xil ampluadagi futbolchilar ko‘rsatilmoqda',
    h2hTitle: 'Head-to-Head Iqtidorlar taqqoslovi',
    changeOpponent: 'Raqibni o‘zgartirish:',
    close: 'Yopish',
    radarTitle: 'Ko‘nikmalar radari (Protsentil)',
    posAvgLabel: 'Amplua o‘rtachasi',
    metricLabel: 'Skauting profili',
    marketValue: 'Transfer narxi',
    matchesPlayed: 'O‘tkazilgan o‘yinlar',
    goalsSeason: 'Gollar',
    assistsSeason: 'Golli uzatmalar',
    xgLabel: 'Vaziyatlar xavfliligi (xG)',
    xaLabel: 'Kutilayotgan assistlar (xA)',
    shotsSeason: 'Jami zarbalar',
    keyPassesSeason: 'Xavfli paslar',
    dribbleDetailed: 'Dribling (Muvaffaqiyatli / Urinishlar)',
    duelPct: 'Yutilgan kurashlar %',
    aerialPct: 'Havodagi kurashlar %',
    loading: 'Futbolchilar statistikasi yuklanmoqda...',
    noData: 'Belgilangan parametrlar bo‘yicha futbolchilar topilmadi.',
    contractLeft: 'Shartnoma:',
    footLabel: 'Yetakchi oyoq:',
    physicalReport: 'Jismoniy va taktika ko‘rsatkichlari',
    gkReport: 'Darvozabon ko‘rsatkichlari',
    gkPassing: 'Oyoq bilan uzatmalar aniqligi %',
    gkSavesPerMatch: 'Har o‘yindagi seyvlar',
    gkTotalSaves: 'Jami seyvlar',
    gkCleanSheets: 'Quruq o‘yinlar',
    tacklesInterceptions: 'To‘pni qaytarish va to‘xtatish',
    tacklesOnly: 'To‘pni qaytarish',
    interceptionsOnly: 'To‘pni to‘xtatish',
    firstPassAcc: 'Birinchi pas aniqligi %',
    passAccPct: 'Pas aniqligi %',
    budgetReplacementsTitle: 'Arzonroq o‘xshash muqobillar (Moneyball Scouting)',
    budgetReplacementsSub: 'Bosish orqali to‘g‘ridan-to‘g‘ri o‘zaro taqqoslang',
    similarityScore: 'O‘xshashlik',
    noReplacements: 'Mos keluvchi muqobil futbolchilar topilmadi',
    footRight: 'O‘ng',
    footLeft: 'Chap',
    footBoth: 'Har ikkisi',
    matchWord: 'o‘yin',
    goalWord: 'gol',
    assistWord: 'uzatma',
    legionerBadge: 'Legioner',
  },
  ru: {
    tagline: 'Платформа скаутинга и аналитики Центральной Азии',
    searchPlaceholder: 'Поиск по имени или клубу...',
    leagueUZB: '🇺🇿 Узбекистан (Суперлига)',
    leagueKAZ: '🇰🇿 Казахстан (Премьер-лига)',
    totalPlayers: 'База игроков',
    seasonCurrentBadge: 'Статистика за текущий сезон',
    seasonTwoBadge: 'Статистика за 2 сезона',
    u21Players: 'Таланты U21',
    u21PlayersSub: 'Молодые таланты',
    topScorer: 'Топ-бомбардир',
    topScoutIndex: 'Высший Scout Index',
    filtersBtn: 'Фильтры',
    filterPanelTitle: 'Параметры и фильтры скаутинга',
    filterPanelSub: 'Комбинируйте параметры для точного поиска кандидатов',
    seasonSelectorLabel: 'Выбор сезона статистики:',
    seasonCurrentOption: '1 сезон (Текущий сезон)',
    seasonTwoOption: '2 сезона (Суммарно за 2 сезона)',
    filterLegionnaire: 'Только легионеры',
    filterLegionnaireDesc: 'Игроки за рубежом и иностранцы в чемпионате',
    filterU21: 'Только U21 таланты',
    filterExpiringContract: 'Истекающие контракты (2026/2027)',
    filterMinMinutes: 'Игроки основы (>450 минут)',
    filterClub: 'Фильтр по клубу:',
    filterPosition: 'Фильтр по амплуа:',
    allClubs: 'Все клубы',
    allPositions: 'Все амплуа',
    resetFilters: 'Сбросить фильтры',
    applyFilters: 'Применить',
    sortByValue: 'Стоимость',
    sortByAge: 'Возраст',
    sortByScout: 'Scout Index',
    tableHint: 'Нажмите на строку игрока для просмотра досье',
    colPlayer: 'Игрок',
    colClub: 'Клуб',
    colPosition: 'Позиция',
    colMatchesAndMin: 'Игры (Мин.)',
    colGoals: 'Голы',
    colAssists: 'Пасы',
    colDribbling: 'Дриблинг %',
    colScoutIndex: 'Scout Index',
    posFW: 'Нападающий',
    posMF: 'Полузащитник',
    posDF: 'Защитник',
    posGK: 'Вратарь',
    years: 'лет',
    compareBtn: 'Сравнить',
    exportPdfBtn: 'Экспорт PDF',
    fullStatsBtn: 'Вся статистика',
    hideStatsBtn: 'Скрыть',
    pickerTitle: 'Выберите оппонента для сравнения',
    pickerSub: 'Базовый игрок:',
    onlySamePositionNote: 'Показаны только игроки этого же амплуа',
    h2hTitle: 'Head-to-Head Сравнение талантов',
    changeOpponent: 'Сменить соперника:',
    close: 'Закрыть',
    radarTitle: 'Радар навыков (Процентили)',
    posAvgLabel: 'Среднее по позиции',
    metricLabel: 'Скаутский профиль',
    marketValue: 'Рыночная стоимость',
    matchesPlayed: 'Сыграно матчей',
    goalsSeason: 'Голы',
    assistsSeason: 'Голевые передачи',
    xgLabel: 'Острота моментов (xG)',
    xaLabel: 'Ожидаемые ассисты (xA)',
    shotsSeason: 'Всего ударов',
    keyPassesSeason: 'Острые передачи',
    dribbleDetailed: 'Дриблинг (Успешные / Попытки)',
    duelPct: 'Выигранные единоборства %',
    aerialPct: 'Верховые дуэли %',
    loading: 'Загрузка статистики игроков...',
    noData: 'По заданным фильтрам футболисты не найдены.',
    contractLeft: 'Контракт до:',
    footLabel: 'Рабочая нога:',
    physicalReport: 'Физические и тактические метрики',
    gkReport: 'Профильные метрики вратаря',
    gkPassing: 'Точность передач ногами %',
    gkSavesPerMatch: 'Сейвы в среднем за матч',
    gkTotalSaves: 'Всего сейвов',
    gkCleanSheets: 'Сухие матчи',
    tacklesInterceptions: 'Отборы и перехваты',
    tacklesOnly: 'Отборы',
    interceptionsOnly: 'Перехваты',
    firstPassAcc: 'Точность первого паса %',
    passAccPct: 'Точность передач %',
    budgetReplacementsTitle: 'Бюджетная замена с похожим профилем (Moneyball Scouting)',
    budgetReplacementsSub: 'Нажмите на карточку для мгновенного прямого сравнения',
    similarityScore: 'Сходство',
    noReplacements: 'Подходящих аналогов не найдено',
    footRight: 'Правая',
    footLeft: 'Левая',
    footBoth: 'Обе',
    matchWord: 'матчей',
    goalWord: 'гол',
    assistWord: 'пас',
    legionerBadge: 'Легионер',
  },
};

function getScoutBadgeColor(score: number): string {
  if (score >= 75) return 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400';
  if (score >= 60) return 'bg-amber-500/10 border-amber-500/40 text-amber-400';
  return 'bg-rose-500/10 border-rose-500/40 text-rose-400';
}

function PlayerHeadshot({ url, name, initials, size = 'md' }: { url: string; name: string; initials: string; size?: 'sm' | 'md' | 'lg' }) {
  const [error, setError] = useState(false);
  const dims = { sm: 'h-10 w-10', md: 'h-12 w-12', lg: 'h-20 w-20' }[size];

  if (error || !url) {
    return (
      <div className={`${dims} rounded-full bg-zinc-800 border-2 border-emerald-500/40 flex items-center justify-center font-bold text-emerald-400 text-sm shadow-md shrink-0`}>
        {initials}
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={name}
      onError={() => setError(true)}
      className={`${dims} rounded-full object-cover border-2 border-emerald-500/40 shadow-lg bg-zinc-900 shrink-0`}
    />
  );
}

function DynamicRoleRadar({
  primaryName,
  primaryPlayer,
  comparisonName,
  comparisonPlayer,
  positionAverages,
  lang,
}: {
  primaryName: string;
  primaryPlayer: Player;
  comparisonName?: string;
  comparisonPlayer?: Player;
  positionAverages: Record<Position, RoleRadarMetrics>;
  lang: Language;
}) {
  const t = TRANSLATIONS[lang];
  const pos = primaryPlayer.position;
  const labels = RADAR_AXIS_LABELS[lang][pos];
  const posAvg = positionAverages[pos] || { m1: 50, m2: 50, m3: 50, m4: 50, m5: 50, m6: 50 };

  const getPosName = (p: Position) => {
    switch (p) {
      case 'FW': return t.posFW;
      case 'MF': return t.posMF;
      case 'DF': return t.posDF;
      case 'GK': return t.posGK;
    }
  };

  const chartData = [
    { skill: labels[0], primary: primaryPlayer.radar.m1, comparison: comparisonPlayer?.radar.m1, avg: posAvg.m1 },
    { skill: labels[1], primary: primaryPlayer.radar.m2, comparison: comparisonPlayer?.radar.m2, avg: posAvg.m2 },
    { skill: labels[2], primary: primaryPlayer.radar.m3, comparison: comparisonPlayer?.radar.m3, avg: posAvg.m3 },
    { skill: labels[3], primary: primaryPlayer.radar.m4, comparison: comparisonPlayer?.radar.m4, avg: posAvg.m4 },
    { skill: labels[4], primary: primaryPlayer.radar.m5, comparison: comparisonPlayer?.radar.m5, avg: posAvg.m5 },
    { skill: labels[5], primary: primaryPlayer.radar.m6, comparison: comparisonPlayer?.radar.m6, avg: posAvg.m6 },
  ];

  const avgLegend = `${t.posAvgLabel} (${getPosName(pos)})`;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/90 p-5 shadow-xl">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-2">
        <h3 className="text-sm font-semibold text-zinc-100">{t.radarTitle}</h3>
        <span className="text-xs text-amber-400 font-medium">{avgLegend}</span>
      </div>
      <div className="h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="75%" data={chartData}>
            <PolarGrid stroke="#3f3f46" strokeDasharray="3 3" />
            <PolarAngleAxis dataKey="skill" tick={{ fill: '#e4e4e7', fontSize: 10, fontWeight: 500 }} />
            <PolarRadiusAxis domain={[0, 100]} stroke="#52525b" tick={{ fill: '#a1a1aa', fontSize: 9 }} />

            <Radar name={primaryName} dataKey="primary" stroke="#10b981" fill="#10b981" fillOpacity={0.4} strokeWidth={2.5} />
            {comparisonPlayer && comparisonName ? (
              <Radar name={comparisonName} dataKey="comparison" stroke="#38bdf8" fill="#38bdf8" fillOpacity={0.35} strokeWidth={2.5} />
            ) : (
              <Radar name={avgLegend} dataKey="avg" stroke="#f59e0b" strokeDasharray="4 4" strokeWidth={2} fill="#f59e0b" fillOpacity={0.09} />
            )}
            <Tooltip contentStyle={{ backgroundColor: '#09090b', borderColor: '#3f3f46', borderRadius: '8px', fontSize: '12px' }} />
            <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [lang, setLang] = useState<Language>('uz');
  const t = TRANSLATIONS[lang];

  // ВЫБОР ЛИГИ И РЕЖИМА СЕЗОНА
  const [currentLeague, setCurrentLeague] = useState<League>('UZB');
  const [seasonMode, setSeasonMode] = useState<SeasonMode>('current');

  const [players, setPlayers] = useState<Player[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterLegionnaire, setFilterLegionnaire] = useState(false);
  const [filterU21, setFilterU21] = useState(false);
  const [filterContract, setFilterContract] = useState(false);
  const [filterMinMinutes, setFilterMinMinutes] = useState(false);
  const [filterClub, setFilterClub] = useState('all');
  const [filterPosition, setFilterPosition] = useState('all');

  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [showFullStats, setShowFullStats] = useState(false);
  const [pickingOpponentFor, setPickingOpponentFor] = useState<Player | null>(null);
  const [compareA, setCompareA] = useState<Player | null>(null);
  const [compareB, setCompareB] = useState<Player | null>(null);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    fetch(`/api/players?season=${seasonMode}&league=${currentLeague}`)
      .then((res) => res.json())
      .then((data: any[]) => {
        if (isMounted) {
          if (Array.isArray(data)) {
            setPlayers(data);
          }
          setIsLoading(false);
        }
      })
      .catch((err) => {
        console.error('Ошибка загрузки данных:', err);
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [seasonMode, currentLeague]);

  const getPositionName = (pos: Position) => {
    switch (pos) {
      case 'FW': return t.posFW;
      case 'MF': return t.posMF;
      case 'DF': return t.posDF;
      case 'GK': return t.posGK;
    }
  };

  const getFootName = (foot: string) => {
    if (foot === 'Left') return t.footLeft;
    if (foot === 'Both') return t.footBoth;
    return t.footRight;
  };

  const uniqueClubs = useMemo(() => {
    const set = new Set<string>();
    players.forEach((p) => {
      if (p.club?.[lang]) set.add(p.club[lang]);
    });
    return Array.from(set).sort();
  }, [players, lang]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (seasonMode === 'two') count++;
    if (filterLegionnaire) count++;
    if (filterU21) count++;
    if (filterContract) count++;
    if (filterMinMinutes) count++;
    if (filterClub !== 'all') count++;
    if (filterPosition !== 'all') count++;
    return count;
  }, [seasonMode, filterLegionnaire, filterU21, filterContract, filterMinMinutes, filterClub, filterPosition]);

  const handleResetAllFilters = () => {
    setFilterLegionnaire(false);
    setFilterU21(false);
    setFilterContract(false);
    setFilterMinMinutes(false);
    setFilterClub('all');
    setFilterPosition('all');
    setSearchQuery('');
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const positionAverages = useMemo(() => {
    const accum: Record<Position, { count: number; m1: number; m2: number; m3: number; m4: number; m5: number; m6: number }> = {
      FW: { count: 0, m1: 0, m2: 0, m3: 0, m4: 0, m5: 0, m6: 0 },
      MF: { count: 0, m1: 0, m2: 0, m3: 0, m4: 0, m5: 0, m6: 0 },
      DF: { count: 0, m1: 0, m2: 0, m3: 0, m4: 0, m5: 0, m6: 0 },
      GK: { count: 0, m1: 0, m2: 0, m3: 0, m4: 0, m5: 0, m6: 0 },
    };

    players.forEach((p) => {
      const pos = p.position || 'MF';
      accum[pos].count += 1;
      accum[pos].m1 += p.radar?.m1 || 50;
      accum[pos].m2 += p.radar?.m2 || 50;
      accum[pos].m3 += p.radar?.m3 || 50;
      accum[pos].m4 += p.radar?.m4 || 50;
      accum[pos].m5 += p.radar?.m5 || 50;
      accum[pos].m6 += p.radar?.m6 || 50;
    });

    const result: Record<Position, RoleRadarMetrics> = {
      FW: { m1: 50, m2: 50, m3: 50, m4: 50, m5: 50, m6: 50 },
      MF: { m1: 50, m2: 50, m3: 50, m4: 50, m5: 50, m6: 50 },
      DF: { m1: 50, m2: 50, m3: 50, m4: 50, m5: 50, m6: 50 },
      GK: { m1: 50, m2: 50, m3: 50, m4: 50, m5: 50, m6: 50 },
    };

    (Object.keys(accum) as Position[]).forEach((pos) => {
      const c = accum[pos].count;
      if (c > 0) {
        result[pos] = {
          m1: Math.round(accum[pos].m1 / c),
          m2: Math.round(accum[pos].m2 / c),
          m3: Math.round(accum[pos].m3 / c),
          m4: Math.round(accum[pos].m4 / c),
          m5: Math.round(accum[pos].m5 / c),
          m6: Math.round(accum[pos].m6 / c),
        };
      }
    });

    return result;
  }, [players]);

  const filteredAndSortedPlayers = useMemo(() => {
    const list = players.filter((player) => {
      const pName = player.name?.[lang]?.toLowerCase() || '';
      const pClub = player.club?.[lang]?.toLowerCase() || '';
      const q = searchQuery.toLowerCase();
      const matchSearch = pName.includes(q) || pClub.includes(q);

      const matchLegion = !filterLegionnaire || player.isLegionnaire;
      const matchU21 = !filterU21 || player.isU21;
      const matchContract = !filterContract || (player.contractUntil && (player.contractUntil.includes('2026') || player.contractUntil.includes('2027')));
      const matchMinutes = !filterMinMinutes || player.minutesPlayed >= 450;
      const matchClub = filterClub === 'all' || player.club?.[lang] === filterClub;
      const matchPos = filterPosition === 'all' || player.position === filterPosition;

      return matchSearch && matchLegion && matchU21 && matchContract && matchMinutes && matchClub && matchPos;
    });

    if (sortField) {
      list.sort((a, b) => {
        let valA = 0;
        let valB = 0;
        if (sortField === 'value') {
          valA = a.rawMarketValueEUR || 0;
          valB = b.rawMarketValueEUR || 0;
        } else if (sortField === 'age') {
          valA = a.age || 0;
          valB = b.age || 0;
        } else if (sortField === 'scout') {
          valA = a.scoutIndex || 0;
          valB = b.scoutIndex || 0;
        }
        return sortOrder === 'desc' ? valB - valA : valA - valB;
      });
    }

    return list;
  }, [players, searchQuery, filterLegionnaire, filterU21, filterContract, filterMinMinutes, filterClub, filterPosition, sortField, sortOrder, lang]);

  const budgetReplacements = useMemo(() => {
    if (!selectedPlayer) return [];

    const target = selectedPlayer;
    const candidates = players.filter((p) => p.id !== target.id && p.position === target.position);
    const targetMins90 = Math.max(1, target.minutesPlayed / 90);

    const scored = candidates.map((cand) => {
      const candMins90 = Math.max(1, cand.minutesPlayed / 90);
      let vectorDistSq = 0;
      let totalWeights = 0;

      if (target.position === 'FW') {
        const xgP90_T = target.xG / targetMins90;
        const xgP90_C = cand.xG / candMins90;
        vectorDistSq += 2.5 * Math.pow((xgP90_T - xgP90_C) * 35, 2);
        const shotsP90_T = target.shots / targetMins90;
        const shotsP90_C = cand.shots / candMins90;
        vectorDistSq += 1.5 * Math.pow((shotsP90_T - shotsP90_C) * 10, 2);
        vectorDistSq += 1.5 * Math.pow((target.dribbleSuccessRate - cand.dribbleSuccessRate) * 0.4, 2);
        vectorDistSq += 1.0 * Math.pow((target.aerialWinRate - cand.aerialWinRate) * 0.3, 2);
        vectorDistSq += 1.0 * Math.pow((target.scoutIndex - cand.scoutIndex) * 1.2, 2);
        totalWeights = 7.5;
      } else if (target.position === 'MF') {
        const xaP90_T = target.xA / targetMins90;
        const xaP90_C = cand.xA / candMins90;
        vectorDistSq += 2.5 * Math.pow((xaP90_T - xaP90_C) * 35, 2);
        const kpP90_T = target.keyPasses / targetMins90;
        const kpP90_C = cand.keyPasses / candMins90;
        vectorDistSq += 2.0 * Math.pow((kpP90_T - kpP90_C) * 12, 2);
        vectorDistSq += 1.5 * Math.pow((target.dribbleSuccessRate - cand.dribbleSuccessRate) * 0.4, 2);
        vectorDistSq += 1.5 * Math.pow((target.duelWinRate - cand.duelWinRate) * 0.4, 2);
        vectorDistSq += 1.0 * Math.pow((target.scoutIndex - cand.scoutIndex) * 1.2, 2);
        totalWeights = 8.5;
      } else if (target.position === 'DF') {
        vectorDistSq += 2.5 * Math.pow((target.radar.m1 - cand.radar.m1) * 0.5, 2);
        vectorDistSq += 2.0 * Math.pow((target.duelWinRate - cand.duelWinRate) * 0.4, 2);
        vectorDistSq += 2.0 * Math.pow((target.aerialWinRate - cand.aerialWinRate) * 0.4, 2);
        vectorDistSq += 1.5 * Math.pow((target.radar.m5 - cand.radar.m5) * 0.35, 2);
        vectorDistSq += 1.0 * Math.pow((target.scoutIndex - cand.scoutIndex) * 1.2, 2);
        totalWeights = 9.0;
      } else {
        const savesP90_T = target.saves / targetMins90;
        const savesP90_C = cand.saves / candMins90;
        vectorDistSq += 3.0 * Math.pow((savesP90_T - savesP90_C) * 10, 2);
        vectorDistSq += 2.0 * Math.pow((target.radar.m1 - cand.radar.m1) * 0.4, 2);
        vectorDistSq += 1.5 * Math.pow((target.radar.m3 - cand.radar.m3) * 0.35, 2);
        vectorDistSq += 1.0 * Math.pow((target.scoutIndex - cand.scoutIndex) * 1.2, 2);
        totalWeights = 7.5;
      }

      const weightedDistance = Math.sqrt(vectorDistSq / totalWeights);
      const similarity = Math.max(54, Math.min(93, Math.round(98 - weightedDistance * 1.4)));
      const costDiff = target.rawMarketValueEUR - cand.rawMarketValueEUR;

      return {
        player: cand,
        similarity,
        costDiff,
        isCheaper: costDiff > 0,
      };
    });

    return scored.sort((a, b) => b.similarity - a.similarity).slice(0, 3);
  }, [selectedPlayer, players]);

  const handleCompareWithReplacement = (replacement: Player) => {
    if (!selectedPlayer) return;
    setCompareA(selectedPlayer);
    setCompareB(replacement);
    setSelectedPlayer(null);
  };

  const handleOpenPicker = (player: Player) => {
    setSelectedPlayer(null);
    setPickingOpponentFor(player);
  };

  const handleSelectOpponent = (opponent: Player) => {
    if (!pickingOpponentFor) return;
    setCompareA(pickingOpponentFor);
    setCompareB(opponent);
    setPickingOpponentFor(null);
  };

  const topScorer = useMemo(() => {
    if (players.length === 0) return null;
    return [...players].sort((a, b) => b.goals - a.goals)[0];
  }, [players]);

  const topScout = useMemo(() => {
    if (players.length === 0) return null;
    return [...players].sort((a, b) => b.scoutIndex - a.scoutIndex)[0];
  }, [players]);

  const handlePrintPdf = (player: Player) => {
    const printWindow = window.open('', '_blank', 'width=800,height=900');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Scout Dossier - ${player.name[lang]}</title>
          <style>
            @page { size: A4 portrait; margin: 12mm; }
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #111827; background: #fff; margin: 0; padding: 0; }
            .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #10b981; padding-bottom: 12px; margin-bottom: 16px; }
            .player-box { display: flex; align-items: center; gap: 14px; }
            .photo { width: 68px; height: 68px; border-radius: 50%; object-fit: cover; border: 2px solid #10b981; background: #f3f4f6; }
            .title { font-size: 20px; font-weight: bold; margin: 0; color: #111827; }
            .badge { background: #ecfdf5; color: #059669; border: 1px solid #10b981; padding: 6px 12px; border-radius: 6px; font-weight: bold; font-size: 15px; }
            .meta { font-size: 12px; color: #4b5563; margin-top: 4px; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }
            .card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 14px; background: #f9fafb; }
            .card-title { font-size: 11px; text-transform: uppercase; color: #6b7280; font-weight: 600; margin-bottom: 4px; }
            .card-val { font-size: 17px; font-weight: bold; color: #111827; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
            th, td { border: 1px solid #e5e7eb; padding: 7px 10px; text-align: left; }
            th { background: #f3f4f6; color: #374151; }
            .footer { margin-top: 20px; text-align: center; font-size: 10px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 8px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="player-box">
              <img class="photo" src="${player.photoUrl}" alt="${player.name[lang]}" onerror="this.style.display='none'" />
              <div>
                <h1 class="title">${player.name[lang]}</h1>
                <div class="meta">${player.club[lang]} | ${getPositionName(player.position)} | #${player.number} | ${player.age} ${t.years} | ${t.footLabel} ${getFootName(player.preferredFoot)}</div>
              </div>
            </div>
            <div class="badge">${player.marketValue}</div>
          </div>
          <div class="grid">
            <div class="card">
              <div class="card-title">Scout Index (Opta / CIES)</div>
              <div class="card-val" style="color: #059669;">${player.scoutIndex} / 100</div>
            </div>
            <div class="card">
              <div class="card-title">Игровое время и контракт (${seasonMode === 'two' ? '2 сезона' : '1 сезон'})</div>
              <div class="card-val">${player.matchesPlayed} ${t.matchWord} (${player.minutesPlayed}') | До: ${player.contractUntil}</div>
            </div>
          </div>
          <table>
            <thead>
              <tr><th>Метрика</th><th>Значение</th></tr>
            </thead>
            <tbody>
              <tr><td>Сыграно матчей</td><td><strong>${player.matchesPlayed} (${player.minutesPlayed}')</strong></td></tr>
              ${player.position === 'GK' ? `
              <tr><td>Всего сейвов</td><td><strong>${player.saves}</strong></td></tr>
              <tr><td>Сейвы за матч</td><td>${(player.saves / Math.max(1, player.matchesPlayed)).toFixed(1)}</td></tr>
              <tr><td>Точность передач ногами</td><td>${player.radar.m3}%</td></tr>
              ` : `
              <tr><td>Голы</td><td><strong>${player.goals}</strong></td></tr>
              <tr><td>Острота моментов (xG)</td><td>${player.xG.toFixed(2)} xG</td></tr>
              <tr><td>Голевые передачи</td><td><strong>${player.assists}</strong></td></tr>
              <tr><td>Удары всего</td><td>${player.shots}</td></tr>
              <tr><td>Единоборства</td><td>${player.duelWinRate}% внизу / ${player.aerialWinRate}% в воздухе</td></tr>
              <tr><td>Успешный дриблинг</td><td>${player.dribbleWon} из ${player.dribbleTotal} (${player.dribbleSuccessRate}%)</td></tr>
              `}
            </tbody>
          </table>
          <div class="footer">UzStat Talent Tracker • Официальный скаутский отчёт</div>
          <script>window.onload = function() { window.print(); setTimeout(function() { window.close(); }, 500); };</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const renderComparisonCell = (valA: number, valB: number, displayA: string | number, displayB: string | number, higherIsBetter = true) => {
    let classA = 'text-zinc-400 font-medium';
    let classB = 'text-zinc-400 font-medium';

    if (valA !== valB) {
      const isABetter = higherIsBetter ? valA > valB : valA < valB;
      if (isABetter) {
        classA = 'text-white font-black text-sm tracking-wide';
        classB = 'text-zinc-500 font-normal';
      } else {
        classB = 'text-white font-black text-sm tracking-wide';
        classA = 'text-zinc-500 font-normal';
      }
    }

    return { classA, classB, displayA, displayB };
  };

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 selection:bg-emerald-500 selection:text-black p-4 sm:p-6 lg:p-8">
      {/* HEADER */}
      <header className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-zinc-800 gap-4">
        <div className="flex items-center gap-3.5">
          <div className="h-11 w-11 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/25">
            <Flame className="h-6 w-6 text-zinc-950 font-bold" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold tracking-tight text-white">UzStat Talent Tracker</h1>
              {/* СЕЛЕКТОР ЛИГИ (УЗБЕКИСТАН / КАЗАХСТАН) */}
              <div className="flex rounded-md border border-zinc-800 bg-zinc-900 p-0.5 text-[11px] font-mono">
                <button
                  onClick={() => { setCurrentLeague('UZB'); setFilterClub('all'); }}
                  className={`px-2 py-0.5 rounded font-semibold transition ${currentLeague === 'UZB' ? 'bg-emerald-500 text-zinc-950 shadow-sm' : 'text-zinc-400 hover:text-white'}`}
                >
                  🇺🇿 SUPERLIGA
                </button>
                <button
                  onClick={() => { setCurrentLeague('KAZ'); setFilterClub('all'); }}
                  className={`px-2 py-0.5 rounded font-semibold transition ${currentLeague === 'KAZ' ? 'bg-emerald-500 text-zinc-950 shadow-sm' : 'text-zinc-400 hover:text-white'}`}
                >
                  🇰🇿 QAZAQSTAN QPL
                </button>
              </div>

              <span className="hidden lg:inline-flex items-center gap-1.5 text-[10px] text-emerald-400 bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded font-mono">
                <Wifi className="h-3 w-3 animate-pulse text-emerald-400" /> LIVE
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">{t.tagline}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center rounded-lg border border-zinc-800 bg-zinc-900 p-1">
            <button
              onClick={() => setLang('uz')}
              className={`px-2.5 py-1 rounded text-xs font-semibold transition ${lang === 'uz' ? 'bg-emerald-500 text-zinc-950' : 'text-zinc-400 hover:text-white'}`}
            >
              UZ
            </button>
            <button
              onClick={() => setLang('ru')}
              className={`px-2.5 py-1 rounded text-xs font-semibold transition ${lang === 'ru' ? 'bg-emerald-500 text-zinc-950' : 'text-zinc-400 hover:text-white'}`}
            >
              RU
            </button>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
            <input
              type="text"
              placeholder={t.searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-56 sm:w-64 rounded-lg border border-zinc-800 bg-zinc-900/90 pl-9 pr-4 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none transition shadow-sm"
            />
          </div>

          {/* ИКОНКА НАСТРОЙКИ ФИЛЬТРОВ СПРАВА */}
          <button
            onClick={() => setIsFilterOpen(true)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold transition shadow-sm ${
              activeFiltersCount > 0
                ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-400'
                : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700'
            }`}
          >
            <SlidersHorizontal className="h-4 w-4" />
            <span className="hidden sm:inline">{t.filtersBtn}</span>
            {activeFiltersCount > 0 && (
              <span className="h-5 w-5 rounded-full bg-emerald-500 text-zinc-950 text-[10px] font-black flex items-center justify-center">
                {activeFiltersCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* KPI METRICS */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 my-6">
        <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/70 p-4 backdrop-blur shadow-sm">
          <div className="flex justify-between items-center text-zinc-400 text-xs">
            <span className="uppercase tracking-wider font-semibold">{t.totalPlayers}</span>
            <Users className="h-4 w-4 text-zinc-400" />
          </div>
          <div className="text-2xl font-bold mt-2 text-white">{players.length}</div>
          <span className="text-[11px] text-zinc-500 mt-1 block">
            {seasonMode === 'current' ? t.seasonCurrentBadge : t.seasonTwoBadge}
          </span>
        </div>

        <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/70 p-4 backdrop-blur shadow-sm">
          <div className="flex justify-between items-center text-zinc-400 text-xs">
            <span className="uppercase tracking-wider font-semibold">{t.u21Players}</span>
            <Sparkles className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold mt-2 text-emerald-400">
            {players.filter((p) => p.isU21).length}
          </div>
          <span className="text-[11px] text-emerald-500/80 mt-1 block">{t.u21PlayersSub}</span>
        </div>

        <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/70 p-4 backdrop-blur shadow-sm">
          <div className="flex justify-between items-center text-zinc-400 text-xs">
            <span className="uppercase tracking-wider font-semibold">{t.topScorer}</span>
            <TrendingUp className="h-4 w-4 text-sky-400" />
          </div>
          <div className="text-lg font-bold mt-2 text-sky-400">
            {topScorer ? `${topScorer.name[lang]} (${topScorer.goals})` : '—'}
          </div>
          <span className="text-[11px] text-zinc-500 mt-1 block">
            {topScorer ? `${topScorer.club[lang]} · ${topScorer.matchesPlayed} ${t.matchWord}` : '—'}
          </span>
        </div>

        <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/70 p-4 backdrop-blur shadow-sm">
          <div className="flex justify-between items-center text-zinc-400 text-xs">
            <span className="uppercase tracking-wider font-semibold">{t.topScoutIndex}</span>
            <Flame className="h-4 w-4 text-amber-400" />
          </div>
          <div className="text-lg font-bold mt-2 text-amber-400">
            {topScout ? `${topScout.name[lang]} (${topScout.scoutIndex})` : '—'}
          </div>
          <span className="text-[11px] text-zinc-500 mt-1 block">
            {topScout ? `${topScout.club[lang]} · ${topScout.assists} ${t.assistWord}` : '—'}
          </span>
        </div>
      </div>

      {/* ПАНЕЛЬ БЫСТРОЙ СОРТИРОВКИ */}
      <div className="max-w-7xl mx-auto mb-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {activeFiltersCount > 0 && (
            <button
              onClick={handleResetAllFilters}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-rose-500/20 transition"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>{t.resetFilters} ({activeFiltersCount})</span>
            </button>
          )}

          <button
            onClick={() => toggleSort('value')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
              sortField === 'value' ? 'bg-zinc-800 text-emerald-400 border-emerald-500/50' : 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:text-white'
            }`}
          >
            <span>{t.sortByValue}</span>
            {sortField === 'value' ? (
              sortOrder === 'desc' ? <ArrowDown className="h-3.5 w-3.5 text-emerald-400" /> : <ArrowUp className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <ArrowUpDown className="h-3.5 w-3.5 text-zinc-500" />
            )}
          </button>

          <button
            onClick={() => toggleSort('age')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
              sortField === 'age' ? 'bg-zinc-800 text-emerald-400 border-emerald-500/50' : 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:text-white'
            }`}
          >
            <span>{t.sortByAge}</span>
            {sortField === 'age' ? (
              sortOrder === 'desc' ? <ArrowDown className="h-3.5 w-3.5 text-emerald-400" /> : <ArrowUp className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <ArrowUpDown className="h-3.5 w-3.5 text-zinc-500" />
            )}
          </button>

          <button
            onClick={() => toggleSort('scout')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
              sortField === 'scout' ? 'bg-zinc-800 text-emerald-400 border-emerald-500/50' : 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:text-white'
            }`}
          >
            <span>{t.sortByScout}</span>
            {sortField === 'scout' ? (
              sortOrder === 'desc' ? <ArrowDown className="h-3.5 w-3.5 text-emerald-400" /> : <ArrowUp className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <ArrowUpDown className="h-3.5 w-3.5 text-zinc-500" />
            )}
          </button>
        </div>

        <div className="text-xs text-zinc-400 flex items-center gap-2">
          <span className="font-semibold text-emerald-400 font-mono">
            [{seasonMode === 'current' ? '1 СЕЗОН' : '2 СЕЗОНА'}]
          </span>
          <span>{t.tableHint}</span>
        </div>
      </div>

      {/* ТАБЛИЦА */}
      <div className="max-w-7xl mx-auto rounded-xl border border-zinc-800 bg-zinc-900/60 overflow-hidden shadow-2xl backdrop-blur">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-16 text-zinc-400">
            <Loader2 className="h-9 w-9 animate-spin text-emerald-400 mb-3" />
            <span className="text-sm font-medium">{t.loading}</span>
          </div>
        ) : filteredAndSortedPlayers.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-16 text-zinc-500">
            <span className="text-sm">{t.noData}</span>
          </div>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-950/80 border-b border-zinc-800 text-zinc-400 uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4 font-semibold">{t.colPlayer}</th>
                <th className="py-3.5 px-3 font-semibold">{t.colClub}</th>
                <th className="py-3.5 px-3 font-semibold">{t.colPosition}</th>
                <th className="py-3.5 px-3 font-semibold">{t.colMatchesAndMin}</th>
                <th className="py-3.5 px-3 font-semibold">{t.colGoals}</th>
                <th className="py-3.5 px-3 font-semibold">{t.colAssists}</th>
                <th className="py-3.5 px-3 font-semibold">{t.colDribbling}</th>
                <th className="py-3.5 px-4 text-right font-semibold">{t.colScoutIndex}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/80">
              {filteredAndSortedPlayers.map((player, idx) => (
                <tr
                  key={`${player.id}-${idx}`}
                  onClick={() => { setSelectedPlayer(player); setShowFullStats(false); }}
                  className="cursor-pointer hover:bg-zinc-850/60 transition-colors"
                >
                  <td className="py-3 px-4 flex items-center gap-3.5">
                    <PlayerHeadshot url={player.photoUrl} name={player.name[lang]} initials={player.initials} size="sm" />
                    <div>
                      <div className="font-semibold text-white flex items-center gap-1.5">
                        {player.name[lang]}
                        {player.isU21 && (
                          <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.2 rounded font-bold">
                            U21
                          </span>
                        )}
                        {player.isLegionnaire && (
                          <span className="text-[10px] bg-sky-500/20 text-sky-400 border border-sky-500/30 px-1.5 py-0.2 rounded font-bold">
                            {t.legionerBadge}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-emerald-400 font-mono font-medium mt-0.5">
                        {player.marketValue} · <span className="text-zinc-400">{player.age} {t.years}</span>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-3 font-medium text-zinc-200">{player.club[lang]}</td>
                  <td className="py-3 px-3">
                    <span className="rounded bg-zinc-800/90 border border-zinc-700/60 px-2 py-0.5 text-[10px] font-semibold text-zinc-200">
                      {getPositionName(player.position)}
                    </span>
                  </td>
                  <td className="py-3 px-3 font-mono text-zinc-300">
                    <strong className="text-white font-semibold">{player.matchesPlayed}</strong>{' '}
                    <span className="text-zinc-500 text-[11px]">({player.minutesPlayed}')</span>
                  </td>
                  <td className="py-3 px-3 font-mono">
                    <strong className="text-white text-sm">{player.goals}</strong>
                  </td>
                  <td className="py-3 px-3 font-mono">
                    <strong className="text-white text-sm">{player.assists}</strong>
                  </td>
                  <td className="py-3 px-3 font-mono text-zinc-300 font-semibold">
                    {player.position === 'GK' ? '—' : `${player.dribbleSuccessRate}%`}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className={`inline-flex rounded-lg border px-2.5 py-1 text-xs font-bold ${getScoutBadgeColor(player.scoutIndex)}`}>
                      {player.scoutIndex}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* МОДАЛКА НАСТРОЙКИ ФИЛЬТРОВ И ВЫБОРА СЕЗОНА */}
      {isFilterOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="relative w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl my-auto">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4 mb-5">
              <div className="flex items-center gap-2.5">
                <SlidersHorizontal className="h-5 w-5 text-emerald-400" />
                <div>
                  <h3 className="text-base font-bold text-white">{t.filterPanelTitle}</h3>
                  <p className="text-xs text-zinc-400 mt-0.5">{t.filterPanelSub}</p>
                </div>
              </div>
              <button
                onClick={() => setIsFilterOpen(false)}
                className="rounded-lg bg-zinc-900 border border-zinc-800 p-2 text-zinc-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              {/* ВЫБОР СЕЗОНА: 1 СЕЗОН (ДЕФОЛТ) ИЛИ 2 СЕЗОНА */}
              <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-950/20">
                <label className="block text-xs font-bold text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Calendar className="h-4 w-4" />
                  {t.seasonSelectorLabel}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setSeasonMode('current')}
                    className={`px-3 py-2 rounded-lg text-xs font-semibold border transition text-center ${
                      seasonMode === 'current'
                        ? 'bg-emerald-500 text-zinc-950 border-emerald-400 font-bold shadow-md'
                        : 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:text-white'
                    }`}
                  >
                    {t.seasonCurrentOption}
                  </button>
                  <button
                    onClick={() => setSeasonMode('two')}
                    className={`px-3 py-2 rounded-lg text-xs font-semibold border transition text-center ${
                      seasonMode === 'two'
                        ? 'bg-emerald-500 text-zinc-950 border-emerald-400 font-bold shadow-md'
                        : 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:text-white'
                    }`}
                  >
                    {t.seasonTwoOption}
                  </button>
                </div>
              </div>

              {/* ЛЕГИОНЕРЫ */}
              <label className="flex items-start gap-3 p-3 rounded-xl border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-900 cursor-pointer transition">
                <input
                  type="checkbox"
                  checked={filterLegionnaire}
                  onChange={(e) => setFilterLegionnaire(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-zinc-700 bg-zinc-950 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-0"
                />
                <div>
                  <span className="text-sm font-semibold text-white flex items-center gap-1.5">
                    <Globe className="h-4 w-4 text-sky-400" />
                    {t.filterLegionnaire}
                  </span>
                  <p className="text-xs text-zinc-400 mt-0.5">{t.filterLegionnaireDesc}</p>
                </div>
              </label>

              {/* ТОЛЬКО U21 */}
              <label className="flex items-center gap-3 p-3 rounded-xl border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-900 cursor-pointer transition">
                <input
                  type="checkbox"
                  checked={filterU21}
                  onChange={(e) => setFilterU21(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-700 bg-zinc-950 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-0"
                />
                <span className="text-sm font-semibold text-white flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-emerald-400" />
                  {t.filterU21}
                </span>
              </label>

              {/* ИСТЕКАЮЩИЕ КОНТРАКТЫ */}
              <label className="flex items-center gap-3 p-3 rounded-xl border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-900 cursor-pointer transition">
                <input
                  type="checkbox"
                  checked={filterContract}
                  onChange={(e) => setFilterContract(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-700 bg-zinc-950 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-0"
                />
                <span className="text-sm font-semibold text-white flex items-center gap-1.5">
                  <Activity className="h-4 w-4 text-amber-400" />
                  {t.filterExpiringContract}
                </span>
              </label>

              {/* ОСНОВНОЙ СОСТАВ (>450 МИНУТ) */}
              <label className="flex items-center gap-3 p-3 rounded-xl border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-900 cursor-pointer transition">
                <input
                  type="checkbox"
                  checked={filterMinMinutes}
                  onChange={(e) => setFilterMinMinutes(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-700 bg-zinc-950 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-0"
                />
                <span className="text-sm font-semibold text-white flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-emerald-400" />
                  {t.filterMinMinutes}
                </span>
              </label>

              {/* ВЫБОР КЛУБА И АМПЛУА */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1.5">{t.filterClub}</label>
                  <select
                    value={filterClub}
                    onChange={(e) => setFilterClub(e.target.value)}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="all">{t.allClubs}</option>
                    {uniqueClubs.map((club) => (
                      <option key={club} value={club}>{club}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1.5">{t.filterPosition}</label>
                  <select
                    value={filterPosition}
                    onChange={(e) => setFilterPosition(e.target.value)}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="all">{t.allPositions}</option>
                    <option value="FW">{t.posFW}</option>
                    <option value="MF">{t.posMF}</option>
                    <option value="DF">{t.posDF}</option>
                    <option value="GK">{t.posGK}</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-zinc-800 pt-5 mt-6">
              <button
                onClick={handleResetAllFilters}
                className="flex items-center gap-1.5 text-xs font-semibold text-zinc-400 hover:text-white transition"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>{t.resetFilters}</span>
              </button>
              <button
                onClick={() => setIsFilterOpen(false)}
                className="px-5 py-2.5 rounded-lg bg-emerald-600 text-xs font-bold text-white shadow-lg shadow-emerald-600/30 hover:bg-emerald-500 transition"
              >
                {t.applyFilters}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 1. DOSSIER MODAL */}
      {selectedPlayer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-4xl rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl my-auto">
            <button
              onClick={() => setSelectedPlayer(null)}
              className="absolute right-4 top-4 rounded-lg bg-zinc-900 border border-zinc-800 p-2 text-zinc-400 hover:text-white transition"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
              <div className="flex items-center gap-4">
                <PlayerHeadshot url={selectedPlayer.photoUrl} name={selectedPlayer.name[lang]} initials={selectedPlayer.initials} size="lg" />
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-bold text-white tracking-tight">{selectedPlayer.name[lang]}</h2>
                    <span className="text-emerald-400 text-sm font-mono font-bold bg-emerald-950/60 border border-emerald-500/40 px-2.5 py-0.5 rounded-full">
                      {selectedPlayer.marketValue}
                    </span>
                    <span className="text-[11px] bg-zinc-900 border border-zinc-700 px-2.5 py-0.5 rounded-md text-zinc-300 font-medium">
                      🦶 {t.footLabel} <strong className="text-white">{getFootName(selectedPlayer.preferredFoot)}</strong>
                    </span>
                    {selectedPlayer.isLegionnaire && (
                      <span className="text-[11px] bg-sky-500/20 text-sky-400 border border-sky-500/40 px-2 py-0.5 rounded-md font-bold">
                        {t.legionerBadge}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-400 mt-1">
                    #{selectedPlayer.number} · {selectedPlayer.club[lang]} · {getPositionName(selectedPlayer.position)} · {selectedPlayer.age} {t.years} · {t.contractLeft} <strong className="text-zinc-200">{selectedPlayer.contractUntil}</strong>
                  </p>
                  <div className="flex gap-1.5 mt-2.5">
                    {selectedPlayer.tags?.map((tg, tgIdx) => (
                      <span key={`${tg}-${tgIdx}`} className="text-[10px] bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded text-zinc-300">
                        #{tg}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => setShowFullStats(!showFullStats)}
                  className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-800 transition shadow-sm"
                >
                  <BarChart3 className="h-4 w-4 text-sky-400" />
                  <span>{showFullStats ? t.hideStatsBtn : t.fullStatsBtn}</span>
                </button>
                <button
                  onClick={() => handlePrintPdf(selectedPlayer)}
                  className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-800 transition shadow-sm"
                >
                  <Printer className="h-4 w-4 text-emerald-400" />
                  <span>{t.exportPdfBtn}</span>
                </button>
                <button
                  onClick={() => handleOpenPicker(selectedPlayer)}
                  className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-lg shadow-emerald-600/30 hover:bg-emerald-500 transition"
                >
                  <ArrowRightLeft className="h-4 w-4" />
                  <span>{t.compareBtn}</span>
                </button>
              </div>
            </div>

            {/* Радар и дифференцированные плашки */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
              <DynamicRoleRadar
                primaryName={selectedPlayer.name[lang]}
                primaryPlayer={selectedPlayer}
                positionAverages={positionAverages}
                lang={lang}
              />

              <div className="rounded-xl border border-zinc-800 bg-zinc-900/90 p-5 shadow-xl flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 border-b border-zinc-800 pb-3 mb-4">
                    {selectedPlayer.position === 'GK' ? (
                      <ShieldCheck className="h-5 w-5 text-sky-400" />
                    ) : (
                      <Activity className="h-5 w-5 text-emerald-400" />
                    )}
                    <h3 className="text-sm font-semibold text-zinc-100">
                      {selectedPlayer.position === 'GK' ? t.gkReport : t.physicalReport}
                    </h3>
                  </div>

                  {/* 1. ПЛАШКИ GK */}
                  {selectedPlayer.position === 'GK' && (
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="p-3 bg-zinc-950/70 border border-zinc-800/80 rounded-lg">
                        <span className="text-zinc-500 text-[11px] block">{t.matchesPlayed}</span>
                        <span className="text-base font-bold text-white font-mono mt-0.5 block">{selectedPlayer.matchesPlayed} {t.matchWord}</span>
                      </div>
                      <div className="p-3 bg-zinc-950/70 border border-zinc-800/80 rounded-lg">
                        <span className="text-zinc-500 text-[11px] block">{t.gkTotalSaves}</span>
                        <span className="text-base font-bold text-emerald-400 font-mono mt-0.5 block">{selectedPlayer.saves}</span>
                      </div>
                      <div className="p-3 bg-zinc-950/70 border border-zinc-800/80 rounded-lg">
                        <span className="text-zinc-500 text-[11px] block">{t.gkSavesPerMatch}</span>
                        <span className="text-base font-bold text-sky-400 font-mono mt-0.5 block">
                          {(selectedPlayer.saves / Math.max(1, selectedPlayer.matchesPlayed)).toFixed(1)}
                        </span>
                      </div>
                      <div className="p-3 bg-zinc-950/70 border border-zinc-800/80 rounded-lg">
                        <span className="text-zinc-500 text-[11px] block">{t.gkPassing}</span>
                        <span className="text-base font-bold text-amber-400 font-mono mt-0.5 block">{selectedPlayer.radar.m3}%</span>
                      </div>
                    </div>
                  )}

                  {/* 2. ПЛАШКИ FW */}
                  {selectedPlayer.position === 'FW' && (
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="p-3 bg-zinc-950/70 border border-zinc-800/80 rounded-lg">
                        <span className="text-zinc-500 text-[11px] block">{t.matchesPlayed}</span>
                        <span className="text-base font-bold text-white font-mono mt-0.5 block">{selectedPlayer.matchesPlayed} {t.matchWord}</span>
                      </div>
                      <div className="p-3 bg-zinc-950/70 border border-zinc-800/80 rounded-lg">
                        <span className="text-zinc-500 text-[11px] block">{t.goalsSeason}</span>
                        <span className="text-base font-bold text-emerald-400 font-mono mt-0.5 block">{selectedPlayer.goals}</span>
                      </div>
                      <div className="p-3 bg-zinc-950/70 border border-zinc-800/80 rounded-lg">
                        <span className="text-zinc-500 text-[11px] block">{t.xgLabel}</span>
                        <span className="text-base font-bold text-amber-400 font-mono mt-0.5 block">{selectedPlayer.xG.toFixed(2)}</span>
                      </div>
                      <div className="p-3 bg-zinc-950/70 border border-zinc-800/80 rounded-lg">
                        <span className="text-zinc-500 text-[11px] block">{t.dribbleDetailed}</span>
                        <span className="text-base font-bold text-zinc-200 font-mono mt-0.5 block">
                          {selectedPlayer.dribbleWon} / {selectedPlayer.dribbleTotal} ({selectedPlayer.dribbleSuccessRate}%)
                        </span>
                      </div>
                    </div>
                  )}

                  {/* 3. ПЛАШКИ MF */}
                  {selectedPlayer.position === 'MF' && (
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="p-3 bg-zinc-950/70 border border-zinc-800/80 rounded-lg">
                        <span className="text-zinc-500 text-[11px] block">{t.matchesPlayed}</span>
                        <span className="text-base font-bold text-white font-mono mt-0.5 block">{selectedPlayer.matchesPlayed} {t.matchWord}</span>
                      </div>
                      <div className="p-3 bg-zinc-950/70 border border-zinc-800/80 rounded-lg">
                        <span className="text-zinc-500 text-[11px] block">{t.goalsSeason} / {t.assistsSeason}</span>
                        <span className="text-base font-bold text-emerald-400 font-mono mt-0.5 block">
                          {selectedPlayer.goals} {t.goalWord} / {selectedPlayer.assists} {t.assistWord}
                        </span>
                      </div>
                      <div className="p-3 bg-zinc-950/70 border border-zinc-800/80 rounded-lg">
                        <span className="text-zinc-500 text-[11px] block">{t.keyPassesSeason}</span>
                        <span className="text-base font-bold text-sky-400 font-mono mt-0.5 block">{selectedPlayer.keyPasses}</span>
                      </div>
                      <div className="p-3 bg-zinc-950/70 border border-zinc-800/80 rounded-lg">
                        <span className="text-zinc-500 text-[11px] block">{t.duelPct}</span>
                        <span className="text-base font-bold text-white font-mono mt-0.5 block">{selectedPlayer.duelWinRate}%</span>
                      </div>
                    </div>
                  )}

                  {/* 4. ПЛАШКИ DF */}
                  {selectedPlayer.position === 'DF' && (
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="p-3 bg-zinc-950/70 border border-zinc-800/80 rounded-lg">
                        <span className="text-zinc-500 text-[11px] block">{t.matchesPlayed}</span>
                        <span className="text-base font-bold text-white font-mono mt-0.5 block">{selectedPlayer.matchesPlayed} {t.matchWord}</span>
                      </div>
                      <div className="p-3 bg-zinc-950/70 border border-zinc-800/80 rounded-lg">
                        <span className="text-zinc-500 text-[11px] block">{t.tacklesInterceptions}</span>
                        <span className="text-base font-bold text-emerald-400 font-mono mt-0.5 block">
                          {selectedPlayer.tackles || 0} / {selectedPlayer.interceptions || 0}
                        </span>
                      </div>
                      <div className="p-3 bg-zinc-950/70 border border-zinc-800/80 rounded-lg">
                        <span className="text-zinc-500 text-[11px] block">{t.duelPct}</span>
                        <span className="text-base font-bold text-white font-mono mt-0.5 block">{selectedPlayer.duelWinRate}%</span>
                      </div>
                      <div className="p-3 bg-zinc-950/70 border border-zinc-800/80 rounded-lg">
                        <span className="text-zinc-500 text-[11px] block">{t.aerialPct}</span>
                        <span className="text-base font-bold text-sky-400 font-mono mt-0.5 block">{selectedPlayer.aerialWinRate}%</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-zinc-800 flex justify-between items-center text-xs">
                  <span className="text-zinc-400">{t.metricLabel} (Transfermarkt / Opta Protocol)</span>
                  <span className={`font-bold font-mono px-2 py-0.5 rounded border ${getScoutBadgeColor(selectedPlayer.scoutIndex)}`}>
                    {selectedPlayer.scoutIndex} / 100
                  </span>
                </div>
              </div>
            </div>

            {/* РАЗВОРАЧИВАЮЩИЙСЯ БЛОК: ВСЯ СТАТИСТИКА ИГРОКА */}
            {showFullStats && (
              <div className="mt-5 rounded-xl border border-zinc-800 bg-zinc-900/80 p-4 animate-in fade-in duration-300">
                <div className="flex items-center justify-between pb-3 border-b border-zinc-800 mb-3">
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                    {selectedPlayer.name[lang]} — {t.fullStatsBtn}
                  </span>
                  <span className="text-xs text-zinc-400 font-mono">
                    {selectedPlayer.matchesPlayed} {t.matchWord} ({selectedPlayer.minutesPlayed}')
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                  <div className="p-2.5 bg-zinc-950/80 border border-zinc-800 rounded">
                    <span className="text-zinc-500 block text-[10px]">{t.goalsSeason}</span>
                    <strong className="text-white text-sm">{selectedPlayer.goals}</strong>
                  </div>
                  <div className="p-2.5 bg-zinc-950/80 border border-zinc-800 rounded">
                    <span className="text-zinc-500 block text-[10px]">{t.assistsSeason}</span>
                    <strong className="text-white text-sm">{selectedPlayer.assists}</strong>
                  </div>
                  <div className="p-2.5 bg-zinc-950/80 border border-zinc-800 rounded">
                    <span className="text-zinc-500 block text-[10px]">{t.xgLabel}</span>
                    <strong className="text-amber-400 text-sm">{selectedPlayer.xG.toFixed(2)}</strong>
                  </div>
                  <div className="p-2.5 bg-zinc-950/80 border border-zinc-800 rounded">
                    <span className="text-zinc-500 block text-[10px]">{t.xaLabel}</span>
                    <strong className="text-sky-400 text-sm">{selectedPlayer.xA.toFixed(2)}</strong>
                  </div>
                  <div className="p-2.5 bg-zinc-950/80 border border-zinc-800 rounded">
                    <span className="text-zinc-500 block text-[10px]">{t.shotsSeason}</span>
                    <strong className="text-white text-sm">{selectedPlayer.shots}</strong>
                  </div>
                  <div className="p-2.5 bg-zinc-950/80 border border-zinc-800 rounded">
                    <span className="text-zinc-500 block text-[10px]">{t.keyPassesSeason}</span>
                    <strong className="text-white text-sm">{selectedPlayer.keyPasses}</strong>
                  </div>
                  <div className="p-2.5 bg-zinc-950/80 border border-zinc-800 rounded">
                    <span className="text-zinc-500 block text-[10px]">{t.dribbleDetailed}</span>
                    <strong className="text-zinc-200 text-sm">{selectedPlayer.dribbleWon} / {selectedPlayer.dribbleTotal} ({selectedPlayer.dribbleSuccessRate}%)</strong>
                  </div>
                  <div className="p-2.5 bg-zinc-950/80 border border-zinc-800 rounded">
                    <span className="text-zinc-500 block text-[10px]">{t.duelPct}</span>
                    <strong className="text-white text-sm">{selectedPlayer.duelWinRate}%</strong>
                  </div>
                  <div className="p-2.5 bg-zinc-950/80 border border-zinc-800 rounded">
                    <span className="text-zinc-500 block text-[10px]">{t.aerialPct}</span>
                    <strong className="text-white text-sm">{selectedPlayer.aerialWinRate}%</strong>
                  </div>
                  <div className="p-2.5 bg-zinc-950/80 border border-zinc-800 rounded">
                    <span className="text-zinc-500 block text-[10px]">{t.tacklesInterceptions}</span>
                    <strong className="text-emerald-400 text-sm">{selectedPlayer.tackles} / {selectedPlayer.interceptions}</strong>
                  </div>
                  <div className="p-2.5 bg-zinc-950/80 border border-zinc-800 rounded">
                    <span className="text-zinc-500 block text-[10px]">{t.passAccPct}</span>
                    <strong className="text-white text-sm">{selectedPlayer.radar.m5}%</strong>
                  </div>
                  <div className="p-2.5 bg-zinc-950/80 border border-zinc-800 rounded">
                    <span className="text-zinc-500 block text-[10px]">{t.metricLabel}</span>
                    <strong className="text-amber-400 text-sm">{selectedPlayer.scoutIndex} / 100</strong>
                  </div>
                </div>
              </div>
            )}

            {/* БЛОК 4: MONEYBALL СКАУТСКАЯ ЗАМЕНА */}
            <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 shadow-xl">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-3">
                <div className="flex items-center gap-2">
                  <BadgeDollarSign className="h-5 w-5 text-emerald-400" />
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-100">{t.budgetReplacementsTitle}</h3>
                    <p className="text-[11px] text-zinc-400 mt-0.5">{t.budgetReplacementsSub}</p>
                  </div>
                </div>
              </div>

              {budgetReplacements.length === 0 ? (
                <div className="text-xs text-zinc-500 py-3 text-center">{t.noReplacements}</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  {budgetReplacements.map((item, idx) => (
                    <div
                      key={`${item.player.id}-${idx}`}
                      onClick={() => handleCompareWithReplacement(item.player)}
                      title="Кликните для прямого сравнения"
                      className="group cursor-pointer rounded-lg border border-zinc-800 bg-zinc-950/70 p-3 hover:border-emerald-500/50 hover:bg-zinc-900 transition-all flex flex-col justify-between"
                    >
                      <div className="flex items-center gap-2.5">
                        <PlayerHeadshot url={item.player.photoUrl} name={item.player.name[lang]} initials={item.player.initials} size="sm" />
                        <div>
                          <div className="font-semibold text-xs text-zinc-100 group-hover:text-emerald-400 transition-colors flex items-center gap-1">
                            {item.player.name[lang]}
                            <ArrowRightLeft className="h-3 w-3 text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                          <div className="text-[11px] text-zinc-400">
                            {item.player.club[lang]} · {item.player.age} {t.years} · 🦶 {getFootName(item.player.preferredFoot)}
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-zinc-850 flex items-center justify-between text-[11px]">
                        <div>
                          <span className="text-zinc-500 block text-[10px]">{t.similarityScore}</span>
                          <span className="font-bold text-emerald-400 font-mono">{item.similarity}%</span>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-zinc-200 font-mono block">{item.player.marketValue}</span>
                          {item.costDiff !== 0 && (
                            <span className={`text-[10px] font-semibold ${item.isCheaper ? 'text-emerald-400' : 'text-rose-500'}`}>
                              {item.isCheaper ? `-€${Math.round(item.costDiff / 1000)}k` : `+€${Math.round(Math.abs(item.costDiff) / 1000)}k`}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2. PICKER MODAL */}
      {pickingOpponentFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md overflow-y-auto">
          <div className="relative w-full max-w-2xl rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl my-auto">
            <button
              onClick={() => { setSelectedPlayer(pickingOpponentFor); setPickingOpponentFor(null); }}
              className="absolute right-4 top-4 rounded-lg bg-zinc-900 border border-zinc-800 p-2 text-zinc-400 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="border-b border-zinc-800 pb-4 mb-4">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="h-5 w-5 text-emerald-400" />
                <h2 className="text-lg font-bold text-white">{t.pickerTitle}</h2>
              </div>
              <p className="text-xs text-zinc-400 mt-1">
                {t.pickerSub} <strong className="text-emerald-400">{pickingOpponentFor.name[lang]}</strong> ({pickingOpponentFor.club[lang]}, {getPositionName(pickingOpponentFor.position)})
              </p>
              <span className="inline-block mt-2 text-[11px] font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded">
                {t.onlySamePositionNote} ({getPositionName(pickingOpponentFor.position)})
              </span>
            </div>

            <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
              {players
                .filter((p) => p.id !== pickingOpponentFor.id && p.position === pickingOpponentFor.position)
                .map((opponent, opIdx) => (
                  <div
                    key={`${opponent.id}-${opIdx}`}
                    onClick={() => handleSelectOpponent(opponent)}
                    className="group flex items-center justify-between p-3 rounded-xl border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-850 hover:border-emerald-500/50 cursor-pointer transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <PlayerHeadshot url={opponent.photoUrl} name={opponent.name[lang]} initials={opponent.initials} size="sm" />
                      <div>
                        <div className="font-semibold text-sm text-zinc-100 group-hover:text-emerald-400 transition-colors">
                          {opponent.name[lang]}
                        </div>
                        <div className="text-xs text-zinc-400">
                          {opponent.club[lang]} · <span className="text-zinc-300 font-semibold">{getPositionName(opponent.position)}</span> · {opponent.age} {t.years}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <span className="text-[10px] text-zinc-500 block">{t.colScoutIndex}</span>
                        <span className={`text-sm font-black px-1.5 py-0.2 rounded border ${getScoutBadgeColor(opponent.scoutIndex)}`}>
                          {opponent.scoutIndex}
                        </span>
                      </div>
                      <ChevronRight className="h-5 w-5 text-zinc-600 group-hover:text-emerald-400 transition-transform group-hover:translate-x-1" />
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* 3. HEAD TO HEAD MODAL */}
      {compareA && compareB && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-3 sm:p-6 backdrop-blur-md overflow-y-auto">
          <div className="relative w-full max-w-4xl rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl my-auto">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4 mb-4">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="h-5 w-5 text-emerald-400" />
                <h2 className="text-lg font-bold text-white">{t.h2hTitle}</h2>
              </div>

              <div className="flex items-center gap-3">
                <div className="hidden sm:flex items-center gap-2 text-xs">
                  <span className="text-zinc-400">{t.changeOpponent}</span>
                  <select
                    value={compareB.id}
                    onChange={(e) => {
                      const found = players.find((p) => p.id === e.target.value);
                      if (found) setCompareB(found);
                    }}
                    className="rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-xs font-semibold text-sky-400 focus:outline-none"
                  >
                    {players
                      .filter((p) => p.id !== compareA.id && p.position === compareA.position)
                      .map((p, pIdx) => (
                        <option key={`${p.id}-${pIdx}`} value={p.id}>
                          {p.name[lang]} ({p.club[lang]})
                        </option>
                      ))}
                  </select>
                </div>

                <button
                  onClick={() => { setCompareA(null); setCompareB(null); }}
                  className="rounded-lg bg-zinc-900 border border-zinc-700 hover:bg-zinc-800 px-3 py-1.5 text-zinc-300 hover:text-white transition flex items-center gap-1.5 text-xs font-medium"
                >
                  <X className="h-4 w-4" />
                  <span>{t.close}</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 py-3 border-b border-zinc-800">
              <div className="flex items-center gap-3">
                <PlayerHeadshot url={compareA.photoUrl} name={compareA.name[lang]} initials={compareA.initials} size="md" />
                <div>
                  <div className="font-bold text-sm text-zinc-100">{compareA.name[lang]}</div>
                  <div className="text-xs text-emerald-400">{compareA.club[lang]} · {getPositionName(compareA.position)} · {compareA.marketValue} · 🦶 {getFootName(compareA.preferredFoot)}</div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 text-right">
                <div>
                  <div className="font-bold text-sm text-zinc-100">{compareB.name[lang]}</div>
                  <div className="text-xs text-sky-400">{compareB.club[lang]} · {getPositionName(compareB.position)} · {compareB.marketValue} · 🦶 {getFootName(compareB.preferredFoot)}</div>
                </div>
                <PlayerHeadshot url={compareB.photoUrl} name={compareB.name[lang]} initials={compareB.initials} size="md" />
              </div>
            </div>

            <div className="my-4">
              <DynamicRoleRadar
                primaryName={compareA.name[lang]}
                primaryPlayer={compareA}
                comparisonName={compareB.name[lang]}
                comparisonPlayer={compareB}
                positionAverages={positionAverages}
                lang={lang}
              />
            </div>

            {/* СПЕЦИАЛИЗИРОВАННАЯ ТАБЛИЦА СРАВНЕНИЯ ПОД АМПЛУА */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-zinc-950/80 border-b border-zinc-800 text-zinc-400 font-semibold">
                    <th className="py-2.5 px-4 text-emerald-400">{compareA.name[lang]}</th>
                    <th className="py-2.5 px-4 text-center">{t.metricLabel}</th>
                    <th className="py-2.5 px-4 text-right text-sky-400">{compareB.name[lang]}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {/* ОБЩИЕ МЕТРИКИ */}
                  {(() => {
                    const c = renderComparisonCell(compareA.scoutIndex, compareB.scoutIndex, compareA.scoutIndex, compareB.scoutIndex);
                    return (
                      <tr className="hover:bg-zinc-850/50">
                        <td className={`py-2 px-4 font-mono ${c.classA}`}>{c.displayA}</td>
                        <td className="py-2 px-4 text-center text-zinc-400">Scout Index (0-100)</td>
                        <td className={`py-2 px-4 text-right font-mono ${c.classB}`}>{c.displayB}</td>
                      </tr>
                    );
                  })()}

                  {(() => {
                    const c = renderComparisonCell(compareA.rawMarketValueEUR, compareB.rawMarketValueEUR, compareA.marketValue, compareB.marketValue);
                    return (
                      <tr className="hover:bg-zinc-850/50">
                        <td className={`py-2 px-4 font-mono ${c.classA}`}>{c.displayA}</td>
                        <td className="py-2 px-4 text-center text-zinc-400">{t.marketValue}</td>
                        <td className={`py-2 px-4 text-right font-mono ${c.classB}`}>{c.displayB}</td>
                      </tr>
                    );
                  })()}

                  {(() => {
                    const c = renderComparisonCell(compareA.matchesPlayed, compareB.matchesPlayed, compareA.matchesPlayed, compareB.matchesPlayed);
                    return (
                      <tr className="hover:bg-zinc-850/50">
                        <td className={`py-2 px-4 font-mono ${c.classA}`}>{c.displayA}</td>
                        <td className="py-2 px-4 text-center text-zinc-400">{t.matchesPlayed}</td>
                        <td className={`py-2 px-4 text-right font-mono ${c.classB}`}>{c.displayB}</td>
                      </tr>
                    );
                  })()}

                  {/* 1. GK */}
                  {compareA.position === 'GK' && (
                    <>
                      {(() => {
                        const c = renderComparisonCell(compareA.saves, compareB.saves, compareA.saves, compareB.saves);
                        return (
                          <tr className="hover:bg-zinc-850/50">
                            <td className={`py-2 px-4 font-mono ${c.classA}`}>{c.displayA}</td>
                            <td className="py-2 px-4 text-center text-zinc-400">{t.gkTotalSaves}</td>
                            <td className={`py-2 px-4 text-right font-mono ${c.classB}`}>{c.displayB}</td>
                          </tr>
                        );
                      })()}
                      {(() => {
                        const rateA = Number((compareA.saves / Math.max(1, compareA.matchesPlayed)).toFixed(1));
                        const rateB = Number((compareB.saves / Math.max(1, compareB.matchesPlayed)).toFixed(1));
                        const c = renderComparisonCell(rateA, rateB, rateA, rateB);
                        return (
                          <tr className="hover:bg-zinc-850/50">
                            <td className={`py-2 px-4 font-mono ${c.classA}`}>{c.displayA}</td>
                            <td className="py-2 px-4 text-center text-zinc-400">{t.gkSavesPerMatch}</td>
                            <td className={`py-2 px-4 text-right font-mono ${c.classB}`}>{c.displayB}</td>
                          </tr>
                        );
                      })()}
                      {(() => {
                        const c = renderComparisonCell(compareA.radar.m5, compareB.radar.m5, compareA.radar.m5, compareB.radar.m5);
                        return (
                          <tr className="hover:bg-zinc-850/50">
                            <td className={`py-2 px-4 font-mono ${c.classA}`}>{c.displayA}</td>
                            <td className="py-2 px-4 text-center text-zinc-400">{t.gkCleanSheets}</td>
                            <td className={`py-2 px-4 text-right font-mono ${c.classB}`}>{c.displayB}</td>
                          </tr>
                        );
                      })()}
                      {(() => {
                        const c = renderComparisonCell(compareA.radar.m3, compareB.radar.m3, `${compareA.radar.m3}%`, `${compareB.radar.m3}%`);
                        return (
                          <tr className="hover:bg-zinc-850/50">
                            <td className={`py-2 px-4 font-mono ${c.classA}`}>{c.displayA}</td>
                            <td className="py-2 px-4 text-center text-zinc-400">{t.gkPassing}</td>
                            <td className={`py-2 px-4 text-right font-mono ${c.classB}`}>{c.displayB}</td>
                          </tr>
                        );
                      })()}
                    </>
                  )}

                  {/* 2. DF */}
                  {compareA.position === 'DF' && (
                    <>
                      {(() => {
                        const c = renderComparisonCell(
                          (compareA.tackles || 0) + (compareA.interceptions || 0),
                          (compareB.tackles || 0) + (compareB.interceptions || 0),
                          `${compareA.tackles || 0} ${t.tacklesOnly} / ${compareA.interceptions || 0} ${t.interceptionsOnly}`,
                          `${compareB.tackles || 0} ${t.tacklesOnly} / ${compareB.interceptions || 0} ${t.interceptionsOnly}`
                        );
                        return (
                          <tr className="hover:bg-zinc-850/50">
                            <td className={`py-2 px-4 font-mono ${c.classA}`}>{c.displayA}</td>
                            <td className="py-2 px-4 text-center text-zinc-400">{t.tacklesInterceptions}</td>
                            <td className={`py-2 px-4 text-right font-mono ${c.classB}`}>{c.displayB}</td>
                          </tr>
                        );
                      })()}
                      {(() => {
                        const c = renderComparisonCell(compareA.duelWinRate, compareB.duelWinRate, `${compareA.duelWinRate}%`, `${compareB.duelWinRate}%`);
                        return (
                          <tr className="hover:bg-zinc-850/50">
                            <td className={`py-2 px-4 font-mono ${c.classA}`}>{c.displayA}</td>
                            <td className="py-2 px-4 text-center text-zinc-400">{t.duelPct}</td>
                            <td className={`py-2 px-4 text-right font-mono ${c.classB}`}>{c.displayB}</td>
                          </tr>
                        );
                      })()}
                      {(() => {
                        const c = renderComparisonCell(compareA.aerialWinRate, compareB.aerialWinRate, `${compareA.aerialWinRate}%`, `${compareB.aerialWinRate}%`);
                        return (
                          <tr className="hover:bg-zinc-850/50">
                            <td className={`py-2 px-4 font-mono ${c.classA}`}>{c.displayA}</td>
                            <td className="py-2 px-4 text-center text-zinc-400">{t.aerialPct}</td>
                            <td className={`py-2 px-4 text-right font-mono ${c.classB}`}>{c.displayB}</td>
                          </tr>
                        );
                      })()}
                      {(() => {
                        const c = renderComparisonCell(compareA.radar.m5, compareB.radar.m5, `${compareA.radar.m5}%`, `${compareB.radar.m5}%`);
                        return (
                          <tr className="hover:bg-zinc-850/50">
                            <td className={`py-2 px-4 font-mono ${c.classA}`}>{c.displayA}</td>
                            <td className="py-2 px-4 text-center text-zinc-400">{t.firstPassAcc}</td>
                            <td className={`py-2 px-4 text-right font-mono ${c.classB}`}>{c.displayB}</td>
                          </tr>
                        );
                      })()}
                    </>
                  )}

                  {/* 3. MF */}
                  {compareA.position === 'MF' && (
                    <>
                      {(() => {
                        const c = renderComparisonCell(compareA.goals, compareB.goals, compareA.goals, compareB.goals);
                        return (
                          <tr className="hover:bg-zinc-850/50">
                            <td className={`py-2 px-4 font-mono ${c.classA}`}>{c.displayA}</td>
                            <td className="py-2 px-4 text-center text-zinc-400">{t.goalsSeason}</td>
                            <td className={`py-2 px-4 text-right font-mono ${c.classB}`}>{c.displayB}</td>
                          </tr>
                        );
                      })()}
                      {(() => {
                        const c = renderComparisonCell(compareA.assists, compareB.assists, compareA.assists, compareB.assists);
                        return (
                          <tr className="hover:bg-zinc-850/50">
                            <td className={`py-2 px-4 font-mono ${c.classA}`}>{c.displayA}</td>
                            <td className="py-2 px-4 text-center text-zinc-400">{t.assistsSeason}</td>
                            <td className={`py-2 px-4 text-right font-mono ${c.classB}`}>{c.displayB}</td>
                          </tr>
                        );
                      })()}
                      {(() => {
                        const c = renderComparisonCell(compareA.keyPasses, compareB.keyPasses, compareA.keyPasses, compareB.keyPasses);
                        return (
                          <tr className="hover:bg-zinc-850/50">
                            <td className={`py-2 px-4 font-mono ${c.classA}`}>{c.displayA}</td>
                            <td className="py-2 px-4 text-center text-zinc-400">{t.keyPassesSeason}</td>
                            <td className={`py-2 px-4 text-right font-mono ${c.classB}`}>{c.displayB}</td>
                          </tr>
                        );
                      })()}
                      {(() => {
                        const c = renderComparisonCell(
                          compareA.dribbleSuccessRate,
                          compareB.dribbleSuccessRate,
                          `${compareA.dribbleWon} / ${compareA.dribbleTotal} (${compareA.dribbleSuccessRate}%)`,
                          `${compareB.dribbleWon} / ${compareB.dribbleTotal} (${compareB.dribbleSuccessRate}%)`
                        );
                        return (
                          <tr className="hover:bg-zinc-850/50">
                            <td className={`py-2 px-4 font-mono ${c.classA}`}>{c.displayA}</td>
                            <td className="py-2 px-4 text-center text-zinc-400">{t.dribbleDetailed}</td>
                            <td className={`py-2 px-4 text-right font-mono ${c.classB}`}>{c.displayB}</td>
                          </tr>
                        );
                      })()}
                      {(() => {
                        const c = renderComparisonCell(compareA.duelWinRate, compareB.duelWinRate, `${compareA.duelWinRate}%`, `${compareB.duelWinRate}%`);
                        return (
                          <tr className="hover:bg-zinc-850/50">
                            <td className={`py-2 px-4 font-mono ${c.classA}`}>{c.displayA}</td>
                            <td className="py-2 px-4 text-center text-zinc-400">{t.duelPct}</td>
                            <td className={`py-2 px-4 text-right font-mono ${c.classB}`}>{c.displayB}</td>
                          </tr>
                        );
                      })()}
                    </>
                  )}

                  {/* 4. FW */}
                  {compareA.position === 'FW' && (
                    <>
                      {(() => {
                        const c = renderComparisonCell(compareA.goals, compareB.goals, compareA.goals, compareB.goals);
                        return (
                          <tr className="hover:bg-zinc-850/50">
                            <td className={`py-2 px-4 font-mono ${c.classA}`}>{c.displayA}</td>
                            <td className="py-2 px-4 text-center text-zinc-400">{t.goalsSeason}</td>
                            <td className={`py-2 px-4 text-right font-mono ${c.classB}`}>{c.displayB}</td>
                          </tr>
                        );
                      })()}
                      {(() => {
                        const c = renderComparisonCell(compareA.xG, compareB.xG, compareA.xG.toFixed(2), compareB.xG.toFixed(2));
                        return (
                          <tr className="hover:bg-zinc-850/50">
                            <td className={`py-2 px-4 font-mono ${c.classA}`}>{c.displayA}</td>
                            <td className="py-2 px-4 text-center text-zinc-400">{t.xgLabel}</td>
                            <td className={`py-2 px-4 text-right font-mono ${c.classB}`}>{c.displayB}</td>
                          </tr>
                        );
                      })()}
                      {(() => {
                        const c = renderComparisonCell(compareA.shots, compareB.shots, compareA.shots, compareB.shots);
                        return (
                          <tr className="hover:bg-zinc-850/50">
                            <td className={`py-2 px-4 font-mono ${c.classA}`}>{c.displayA}</td>
                            <td className="py-2 px-4 text-center text-zinc-400">{t.shotsSeason}</td>
                            <td className={`py-2 px-4 text-right font-mono ${c.classB}`}>{c.displayB}</td>
                          </tr>
                        );
                      })()}
                      {(() => {
                        const c = renderComparisonCell(
                          compareA.dribbleSuccessRate,
                          compareB.dribbleSuccessRate,
                          `${compareA.dribbleWon} / ${compareA.dribbleTotal} (${compareA.dribbleSuccessRate}%)`,
                          `${compareB.dribbleWon} / ${compareB.dribbleTotal} (${compareB.dribbleSuccessRate}%)`
                        );
                        return (
                          <tr className="hover:bg-zinc-850/50">
                            <td className={`py-2 px-4 font-mono ${c.classA}`}>{c.displayA}</td>
                            <td className="py-2 px-4 text-center text-zinc-400">{t.dribbleDetailed}</td>
                            <td className={`py-2 px-4 text-right font-mono ${c.classB}`}>{c.displayB}</td>
                          </tr>
                        );
                      })()}
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}