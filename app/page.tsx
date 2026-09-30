'use client';

import React, { useState, useMemo, useEffect } from 'react';
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
type AnalyticalRole = 'GOALKEEPER' | 'DEFENDER' | 'MIDFIELDER' | 'ATTACKING_MIDFIELDER' | 'FORWARD';
type Language = 'uz' | 'ru';
type League = 'UZB' | 'KAZ';
type SeasonMode = 'current' | 'two';
type SortField = 'value' | 'age' | 'scout';
type SortOrder = 'asc' | 'desc';
type MainView = 'players' | 'recruitment';
type FootFilter = 'all' | 'Right' | 'Left' | 'Both';
type NationalityFilter = 'all' | 'local' | 'legionnaire';

interface RoleRadarMetrics {
  m1: number | null;
  m2: number | null;
  m3: number | null;
  m4: number | null;
  m5: number | null;
  m6: number | null;
}

interface ScoutingMetricSignal {
  key: string;
  value: number;
  percentile: number;
}

interface ScoutingEngine {
  rawRoleScore: number | null;
  roleScore: number | null;
  rawAttackingScore?: number | null;
  attackingScore: number | null;
  sampleWeight: number;
  adjustedRadar: RoleRadarMetrics;
  confidence: 'low' | 'medium' | 'high';
  metricCoverage: number;
  totalRoleMetrics: number;
  benchmarkPlayers: number;
  benchmarkMinMinutes: number;
  isLowSample: boolean;
  strengths: ScoutingMetricSignal[];
  watchouts: ScoutingMetricSignal[];
  missingMetrics: string[];
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
  sourcePosition: Position;
  analyticalRole: AnalyticalRole;
  analyticalRoleIsCalculated: boolean;
  analyticalRoleBasis: string;
  number: number | null;
  height: number | null;
  preferredFoot: 'Right' | 'Left' | 'Both' | string;
  marketValue: string;
  rawMarketValueEUR: number | null;
  isEstimatedMarketValue?: boolean;
  countryCode?: string;
  contractUntil: string;
  photoUrl: string;
  initials: string;
  scoutIndex: number | null;
  scoutIndexBasis?: string;
  scoutingEngine: ScoutingEngine;
  tags: string[];
  minutesPlayed: number;
  matchesPlayed: number;
  goals: number;
  assists: number;
  xG: number | null;
  xA: number | null;
  shots: number;
  keyPasses: number;
  goalsPer90: number | null;
  assistsPer90: number | null;
  shotsPer90: number | null;
  keyPassesPer90: number | null;
  passAccPct: number | null;
  dribbleSuccessRate: number | null;
  dribbleWon: number;
  dribbleTotal: number;
  duelWinRate: number | null;
  progressiveRuns: number | null;
  aerialWinRate: number | null;
  tackles?: number;
  interceptions?: number;
  saves: number;
  roleMetrics?: Record<string, number | null>;
  radar: RoleRadarMetrics;
}

const RADAR_AXIS_LABELS = {
  uz: {
    GK: ['Seyvlar/90', 'Pas aniqligi %'],
    DF: ['To‘p qaytarish/90', 'To‘xtatish/90', 'Pas aniqligi %', 'Dribling %', 'Xavfli paslar/90'],
    MF: ['Xavfli paslar/90', 'Assistlar/90', 'Dribling %', 'To‘p qaytarish/90', 'Pas aniqligi %'],
    FW: ['Gollar/90', 'Assistlar/90', 'Zarbalar/90', 'Xavfli paslar/90', 'Dribling %'],
  },
  ru: {
    GK: ['Сейвы/90', 'Точность передач %'],
    DF: ['Отборы/90', 'Перехваты/90', 'Точность передач %', 'Дриблинг %', 'Ключевые передачи/90'],
    MF: ['Ключевые передачи/90', 'Ассисты/90', 'Дриблинг %', 'Отборы/90', 'Точность передач %'],
    FW: ['Голы/90', 'Ассисты/90', 'Удары/90', 'Ключевые передачи/90', 'Дриблинг %'],
  },
};


const ROLE_KEYS_BY_POSITION: Record<Position, string[]> = {
  GK: ['savesPer90', 'passAccPct'],
  DF: ['tacklesPer90', 'interceptionsPer90', 'passAccPct', 'dribbleSuccessPct', 'keyPassesPer90'],
  MF: ['keyPassesPer90', 'assistsPer90', 'dribbleSuccessPct', 'tacklesPer90', 'passAccPct'],
  FW: ['goalsPer90', 'assistsPer90', 'shotsPer90', 'keyPassesPer90', 'dribbleSuccessPct'],
};

function formatRoleMetricRaw(key: string, value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  if (key.endsWith('Pct')) return `${Math.round(value)}%`;
  return value.toFixed(2);
}

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
    topScoutIndex: 'Eng yuqori rol reytingi',
    filtersBtn: 'Filtrlar',
    filterPanelTitle: 'Qidiruv va skauting filtrlari',
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
    sortByScout: 'Rol reytingi',
    tableHint: 'Batafsil ma‘lumot va tahlil uchun futbolchi ustiga bosing',
    colPlayer: 'Futbolchi',
    colClub: 'Klub',
    colPosition: 'Amplua',
    colMatchesAndMin: 'O‘yin (Daq.)',
    colGoals: 'Gollar',
    colAssists: 'Golli uzatmalar',
    colDribbling: 'Dribling %',
    colScoutIndex: 'Rol reytingi',
    posFW: 'Hujumchi',
    posMF: 'Yarim himoyachi',
    posDF: 'Himoyachi',
    posGK: 'Darvozabon',
    years: 'yosh',
    compareBtn: 'Taqqoslash',
    exportPdfBtn: 'PDF eksporti',
    fullStatsBtn: 'To‘liq statistika',
    hideStatsBtn: 'Yashirish',
    pickerTitle: 'Taqqoslash uchun futbolchini tanlang',
    pickerSub: 'Asosiy futbolchi:',
    onlySamePositionNote: 'Faqat bir xil ampluadagi futbolchilar ko‘rsatilmoqda',
    h2hTitle: 'Futbolchilarni o‘zaro taqqoslash',
    changeOpponent: 'Raqibni o‘zgartirish:',
    close: 'Yopish',
    radarTitle: 'Rol profili',
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
    dribbleDetailed: 'Dribling (muvaffaqiyatli / urinishlar)',
    duelPct: 'Yutilgan kurashlar %',
    aerialPct: 'Havodagi kurashlar %',
    loading: 'Futbolchilar statistikasi yuklanmoqda...',
    noData: 'Belgilangan parametrlar bo‘yicha futbolchilar topilmadi.',
    contractLeft: 'Shartnoma:',
    footLabel: 'Yetakchi oyoq:',
    physicalReport: 'O‘yin ko‘rsatkichlari',
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
    budgetReplacementsTitle: 'Arzonroq o‘xshash muqobillar',
    budgetReplacementsSub: 'Bosish orqali to‘g‘ridan-to‘g‘ri o‘zaro taqqoslang',
    similarityScore: 'O‘xshashlik',
    noReplacements: 'Mos keluvchi muqobil futbolchilar topilmadi',
    footRight: 'O‘ng',
    footLeft: 'Chap',
    footBoth: 'Har ikkisi',
    footUnknown: 'Ma’lumot yo‘q',
    matchWord: 'o‘yin',
    goalWord: 'gol',
    assistWord: 'uzatma',
    legionerBadge: 'Legioner',
    scoutingEngineTitle: 'Skauting profili',
    scoutingEngineSub: 'Futbolchining roli, hujum hissasi va asosiy skautlik signallari',
    roleScoreLabel: 'Rol reytingi',
    roleScoreNote: 'Pozitsiya ichidagi qiyosiy profil; futbolchining mutlaq bahosi emas.',
    attackingScoreLabel: 'Hujum hissasi',
    confidenceLabel: 'Ma’lumot ishonchliligi',
    rawRoleScoreLabel: 'Xom rol indeksi',
    adjustedRadarLabel: 'Kam daqiqalar uchun tuzatilgan profil',
    coverageLabel: 'Metrikalar qamrovi',
    benchmarkLabel: 'Taqqoslash bazasi',
    strengthsLabel: 'Kuchli signallar',
    watchoutsLabel: 'Pozitsiya bo‘yicha past ko‘rsatkichlar',
    confidenceLow: 'Past',
    confidenceMedium: 'O‘rta',
    confidenceHigh: 'Yuqori',
    lowSampleWarning: 'Kam o‘yin vaqti: profil mavjud, lekin natijani ehtiyotkor talqin qiling.',
    noMetricData: 'Ma’lumot yo‘q',
    methodologyLabel: 'Metodologiya va ma’lumot sifati',
    abovePlayers: 'futbolchilardan yuqori',
    belowPlayers: 'futbolchilardan past',
    sampleWeightLabel: 'Tanlov og‘irligi',
    sourcePositionLabel: 'Manba pozitsiyasi',
    analyticalRoleLabel: 'Analitik rol',
    roleGK: 'Darvozabon',
    roleDF: 'Himoyachi',
    roleMF: 'Yarim himoyachi',
    roleAM: 'Hujumkor yarim himoyachi',
    roleFW: 'Hujumchi',
    calculatedRoleNote: 'Platforma tomonidan real o‘yin metrikalaridan hisoblangan',
    recruitmentTitle: 'Futbolchi tanlash',
    recruitmentSub: 'Klub talablari bo‘yicha qisqa ro‘yxat — faqat mavjud real ma’lumotlar asosida',
    recruitmentPosition: 'Pozitsiya (manba)',
    recruitmentRole: 'O‘yin profili (hisoblangan)',
    recruitmentMaxAge: 'Maks. yosh',
    recruitmentMinBudget: 'Narxdan (€)',
    recruitmentMaxBudget: 'Narxgacha (€)',
    recruitmentMinMinutes: 'Min. daqiqa',
    recruitmentMinRole: 'Min. rol reytingi',
    recruitmentMinAttack: 'Min. hujum hissasi',
    recruitmentExpiring: 'Shartnomasi 12 oy ichida tugaydi',
    recruitmentReliable: 'Faqat ishonchli namuna (≥450 daqiqa)',
    shortlistTitle: 'Qisqa ro‘yxat',
    shortlistReasons: 'Nega mos keldi',
    noShortlist: 'Bu talablarga mos, yetarli ma’lumotli futbolchi topilmadi.',
    unknownValueExcluded: 'Talab qilingan ko‘rsatkich mavjud bo‘lmasa, futbolchi mezondan o‘tmaydi.',
    allRoles: 'Barcha profillar',
    tabPlayers: 'Futbolchilar',
    tabRecruitment: 'Futbolchi tanlash',
    recruitmentFoot: 'Yetakchi oyoq',
    recruitmentNationality: 'Status',
    statusAll: 'Barchasi',
    statusLocal: 'Mahalliy',
    statusLegionnaire: 'Legioner',
    minGoals90: 'Min. gollar/90',
    minAssists90: 'Min. assistlar/90',
    minShots90: 'Min. zarbalar/90',
    minKeyPasses90: 'Min. xavfli paslar/90',
    minDribble: 'Min. dribling %',
    minPassAcc: 'Min. pas aniqligi %',
    advancedMetrics: 'Qo‘shimcha o‘yin metrikalari',
    basicCriteria: 'Asosiy talablar',
    setCriteriaPrompt: 'Qisqa ro‘yxatni ko‘rish uchun kamida bitta talab kiriting.',
    incompleteRadarTitle: 'To‘liq radar uchun ma’lumot yetarli emas',
    incompleteRadarText: 'Qisman radar chizilmaydi — bu noto‘g‘ri taassurot berishi mumkin.',
    availableMetricsLabel: 'Mavjud',
    missingMetricsShort: 'Yo‘q',
    playerProfileLegend: 'Futbolchi',
    positionAverageLegend: 'Pozitsiya o‘rtachasi',
    percentileMeaning: 'pozitsiyada',
    sourceVsRoleHelp: 'Pozitsiya — manbadagi rasmiy kategoriya. O‘yin profili — platforma real metrikalardan hisoblagan rol.',
    missingMetricsLabel: 'Ma’lumot yetishmaydigan metrikalar',
    liveLabel: 'JONLI',
    seasonCurrentShort: '1 MAVSUM',
    seasonTwoShort: '2 MAVSUM',
    profileSourceNote: 'SofaScore ma’lumotlari asosidagi rol profili',
    directCompareHint: 'To‘g‘ridan-to‘g‘ri taqqoslash uchun bosing',
    roleRatingComparisonLabel: 'Rol reytingi (0–100, mutlaq baho emas)',
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
    topScoutIndex: 'Высший ролевой рейтинг',
    filtersBtn: 'Фильтры',
    filterPanelTitle: 'Параметры и фильтры скаутинга',
    filterPanelSub: 'Комбинируйте параметры для точного поиска кандидатов',
    seasonSelectorLabel: 'Выбор сезона статистики:',
    seasonCurrentOption: '1 сезон (Текущий сезон)',
    seasonTwoOption: '2 сезона (Суммарно за 2 сезона)',
    filterLegionnaire: 'Только легионеры',
    filterLegionnaireDesc: 'Игроки за рубежом и иностранцы в чемпионате',
    filterU21: 'Только игроки U21',
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
    sortByScout: 'Ролевой рейтинг',
    tableHint: 'Нажмите на строку игрока для просмотра досье',
    colPlayer: 'Игрок',
    colClub: 'Клуб',
    colPosition: 'Позиция',
    colMatchesAndMin: 'Игры (Мин.)',
    colGoals: 'Голы',
    colAssists: 'Пасы',
    colDribbling: 'Дриблинг %',
    colScoutIndex: 'Ролевой рейтинг',
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
    h2hTitle: 'Сравнение игроков',
    changeOpponent: 'Сменить соперника:',
    close: 'Закрыть',
    radarTitle: 'Ролевой профиль',
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
    physicalReport: 'Матчевые показатели',
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
    budgetReplacementsTitle: 'Бюджетная замена с похожим профилем',
    budgetReplacementsSub: 'Нажмите на карточку для мгновенного прямого сравнения',
    similarityScore: 'Сходство',
    noReplacements: 'Подходящих аналогов не найдено',
    footRight: 'Правая',
    footLeft: 'Левая',
    footBoth: 'Обе',
    footUnknown: 'Нет данных',
    matchWord: 'матчей',
    goalWord: 'гол',
    assistWord: 'пас',
    legionerBadge: 'Легионер',
    scoutingEngineTitle: 'Скаутский профиль',
    scoutingEngineSub: 'Роль игрока, атакующий вклад и ключевые сигналы для скаута',
    roleScoreLabel: 'Ролевой рейтинг',
    roleScoreNote: 'Сравнительный профиль внутри позиции, а не абсолютная оценка игрока.',
    attackingScoreLabel: 'Атакующий вклад',
    confidenceLabel: 'Надёжность данных',
    rawRoleScoreLabel: 'Сырой ролевой индекс',
    adjustedRadarLabel: 'Профиль с поправкой на малую выборку',
    coverageLabel: 'Покрытие метрик',
    benchmarkLabel: 'База сравнения',
    strengthsLabel: 'Сильные сигналы',
    watchoutsLabel: 'Ниже среднего по позиции',
    confidenceLow: 'Низкая',
    confidenceMedium: 'Средняя',
    confidenceHigh: 'Высокая',
    lowSampleWarning: 'Мало игрового времени: профиль показан, но выводы нужно трактовать осторожно.',
    noMetricData: 'Нет данных',
    methodologyLabel: 'Методология и качество данных',
    abovePlayers: 'выше игроков',
    belowPlayers: 'ниже игроков',
    sampleWeightLabel: 'Вес выборки',
    sourcePositionLabel: 'Позиция источника',
    analyticalRoleLabel: 'Аналитическая роль',
    roleGK: 'Вратарь',
    roleDF: 'Защитник',
    roleMF: 'Полузащитник',
    roleAM: 'Атакующий полузащитник',
    roleFW: 'Нападающий',
    calculatedRoleNote: 'Рассчитано платформой только из доступных игровых метрик',
    recruitmentTitle: 'Подбор игроков',
    recruitmentSub: 'Короткий список кандидатов под требования клуба — только по имеющимся реальным данным',
    recruitmentPosition: 'Позиция (из источника)',
    recruitmentRole: 'Игровой профиль (расчёт)',
    recruitmentMaxAge: 'Макс. возраст',
    recruitmentMinBudget: 'Цена от (€)',
    recruitmentMaxBudget: 'Цена до (€)',
    recruitmentMinMinutes: 'Мин. минут',
    recruitmentMinRole: 'Мин. ролевой рейтинг',
    recruitmentMinAttack: 'Мин. атакующий вклад',
    recruitmentExpiring: 'Контракт истекает в течение 12 месяцев',
    recruitmentReliable: 'Только надёжная выборка (≥450 минут)',
    shortlistTitle: 'Короткий список кандидатов',
    shortlistReasons: 'Почему подходит',
    noShortlist: 'Нет игроков с достаточными данными, подходящих под эти требования.',
    unknownValueExcluded: 'Если требуемой метрики нет, игрок не проходит этот критерий.',
    allRoles: 'Все профили',
    tabPlayers: 'Игроки',
    tabRecruitment: 'Подбор игроков',
    recruitmentFoot: 'Рабочая нога',
    recruitmentNationality: 'Статус',
    statusAll: 'Все',
    statusLocal: 'Местный',
    statusLegionnaire: 'Легионер',
    minGoals90: 'Мин. голов/90',
    minAssists90: 'Мин. ассистов/90',
    minShots90: 'Мин. ударов/90',
    minKeyPasses90: 'Мин. ключевых передач/90',
    minDribble: 'Мин. дриблинг %',
    minPassAcc: 'Мин. точность паса %',
    advancedMetrics: 'Дополнительные игровые метрики',
    basicCriteria: 'Основные требования',
    setCriteriaPrompt: 'Задайте хотя бы одно требование, чтобы сформировать список кандидатов.',
    incompleteRadarTitle: 'Недостаточно данных для полного радара',
    incompleteRadarText: 'Частичный радар не строится, чтобы не создавать ложное впечатление.',
    availableMetricsLabel: 'Доступно',
    missingMetricsShort: 'Нет',
    playerProfileLegend: 'Игрок',
    positionAverageLegend: 'Среднее по позиции',
    percentileMeaning: 'по позиции',
    sourceVsRoleHelp: 'Позиция — официальная категория из источника. Игровой профиль — расчёт платформы по реальным метрикам.',
    missingMetricsLabel: 'Метрики без данных',
    liveLabel: 'ОНЛАЙН',
    seasonCurrentShort: '1 СЕЗОН',
    seasonTwoShort: '2 СЕЗОНА',
    profileSourceNote: 'Ролевой профиль на основе данных SofaScore',
    directCompareHint: 'Нажмите для прямого сравнения',
    roleRatingComparisonLabel: 'Ролевой рейтинг (0–100, не абсолютная оценка)',
  },
};

function isContractExpiring(contractUntil: string): boolean {
  if (!contractUntil || contractUntil === '—') return false;

  const value = contractUntil.trim();
  let year = 0;
  let month = 0;
  let day = 1;

  let match = value.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/);
  if (match) {
    day = Number(match[1]);
    month = Number(match[2]);
    year = Number(match[3]);
  } else {
    match = value.match(/^(\d{1,2})[\/.\-](\d{4})$/);
    if (match) {
      month = Number(match[1]);
      year = Number(match[2]);
    } else {
      match = value.match(/^(\d{4})[\/.\-](\d{1,2})$/);
      if (match) {
        year = Number(match[1]);
        month = Number(match[2]);
      } else {
        match = value.match(/^(\d{4})$/);
        if (match) {
          year = Number(match[1]);
          month = 12;
        }
      }
    }
  }

  if (!year || !month || month < 1 || month > 12) return false;

  const expiry = new Date(year, month - 1, day);
  const now = new Date();
  const horizon = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());

  return expiry >= now && expiry <= horizon;
}

function getScoutBadgeColor(score: number | null): string {
  if (score === null) return 'bg-zinc-800/60 border-zinc-700 text-zinc-400';
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
  const roleKeys = ROLE_KEYS_BY_POSITION[pos];
  const posAvg = positionAverages[pos] || { m1: null, m2: null, m3: null, m4: null, m5: null, m6: null };

  const rawRadar = primaryPlayer.scoutingEngine?.isLowSample
    ? primaryPlayer.scoutingEngine.adjustedRadar
    : primaryPlayer.radar;
  const comparisonRadar = comparisonPlayer
    ? (comparisonPlayer.scoutingEngine?.isLowSample ? comparisonPlayer.scoutingEngine.adjustedRadar : comparisonPlayer.radar)
    : undefined;

  const slots: (keyof RoleRadarMetrics)[] = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6'];

  const rows = roleKeys.map((key, index) => ({
    key,
    label: labels[index],
    percentile: rawRadar[slots[index]],
    raw: primaryPlayer.roleMetrics?.[key] ?? null,
    average: posAvg[slots[index]],
    comparisonPercentile: comparisonRadar?.[slots[index]] ?? null,
    comparisonRaw: comparisonPlayer?.roleMetrics?.[key] ?? null,
  }));

  const available = rows.filter((row) => row.percentile !== null).length;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-5 shadow-xl">
      <div className="flex items-start justify-between gap-4 border-b border-zinc-800 pb-3 mb-3">
        <div>
          <h3 className="text-sm font-semibold text-zinc-100">{t.radarTitle}</h3>
            </div>
        <span className="rounded-md border border-zinc-800 bg-zinc-950/70 px-2 py-1 text-[10px] font-mono text-zinc-400">
          {available}/{rows.length}
        </span>
      </div>

      {primaryPlayer.scoutingEngine?.isLowSample && (
        <div className="mb-3 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-300">
          {t.lowSampleWarning}
        </div>
      )}

      <div className="space-y-4">
        {rows.map((row) => (
          <div key={row.key}>
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <span className="text-[11px] font-medium text-zinc-300">{row.label}</span>
              <div className="flex items-center gap-2 text-[10px] font-mono">
                {!comparisonPlayer ? (
                  <span className={row.raw === null ? 'text-zinc-600' : 'text-zinc-200'}>
                    {formatRoleMetricRaw(row.key, row.raw)}
                  </span>
                ) : row.raw !== null && row.comparisonRaw !== null && row.raw === row.comparisonRaw ? (
                  <span className="text-zinc-300">
                    {formatRoleMetricRaw(row.key, row.raw)}
                  </span>
                ) : row.raw !== null && (row.comparisonRaw === null || row.raw > row.comparisonRaw) ? (
                  <span className="text-emerald-400">
                    {formatRoleMetricRaw(row.key, row.raw)}
                  </span>
                ) : row.comparisonRaw !== null ? (
                  <span className="text-sky-400">
                    {formatRoleMetricRaw(row.key, row.comparisonRaw)}
                  </span>
                ) : (
                  <span className="text-zinc-600">—</span>
                )}
              </div>
            </div>

            {row.percentile === null ? (
              <div className="flex h-7 items-center rounded-md border border-dashed border-zinc-800 bg-zinc-950/40 px-2 text-[10px] text-zinc-600">
                {t.noMetricData}
              </div>
            ) : (
              <div className="relative">
                <div className="h-2.5 overflow-hidden rounded-full bg-zinc-800">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all"
                    style={{ width: `${Math.max(2, row.percentile)}%` }}
                  />
                </div>

                {!comparisonPlayer && row.average !== null && (
                  <div
                    className="absolute -top-1 h-4 w-0.5 rounded bg-amber-400"
                    style={{ left: `${Math.max(0, Math.min(100, row.average))}%` }}
                    title={t.positionAverageLegend}
                  />
                )}

                {comparisonPlayer && row.comparisonPercentile !== null && (
                  <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-zinc-800">
                    <div
                      className="h-full rounded-full bg-sky-400 transition-all"
                      style={{ width: `${Math.max(2, row.comparisonPercentile)}%` }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-zinc-800 pt-3 text-[10px]">
        <span className="flex items-center gap-1.5 text-zinc-400">
          <span className="h-2 w-4 rounded-full bg-emerald-500" />
          {primaryName}
        </span>
        {comparisonPlayer && comparisonName ? (
          <span className="flex items-center gap-1.5 text-zinc-400">
            <span className="h-2 w-4 rounded-full bg-sky-400" />
            {comparisonName}
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-zinc-500">
            <span className="h-3 w-0.5 bg-amber-400" />
            {t.positionAverageLegend}
          </span>
        )}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [lang, setLang] = useState<Language>('uz');
  const [activeView, setActiveView] = useState<MainView>('players');
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

  // ЭТАП 4: RECRUITMENT ENGINE
  const [recruitmentPosition, setRecruitmentPosition] = useState<'all' | Position>('all');
  const [recruitmentRole, setRecruitmentRole] = useState<'all' | AnalyticalRole>('all');
  const [recruitmentMaxAge, setRecruitmentMaxAge] = useState('');
  const [recruitmentMinBudget, setRecruitmentMinBudget] = useState('');
  const [recruitmentMaxBudget, setRecruitmentMaxBudget] = useState('');
  const [recruitmentMinMinutes, setRecruitmentMinMinutes] = useState('');
  const [recruitmentMinRoleScore, setRecruitmentMinRoleScore] = useState('');
  const [recruitmentMinAttackScore, setRecruitmentMinAttackScore] = useState('');
  const [recruitmentExpiring, setRecruitmentExpiring] = useState(false);
  const [recruitmentReliableOnly, setRecruitmentReliableOnly] = useState(false);
  const [recruitmentFoot, setRecruitmentFoot] = useState<FootFilter>('all');
  const [recruitmentNationality, setRecruitmentNationality] = useState<NationalityFilter>('all');
  const [recruitmentMinGoals90, setRecruitmentMinGoals90] = useState('');
  const [recruitmentMinAssists90, setRecruitmentMinAssists90] = useState('');
  const [recruitmentMinShots90, setRecruitmentMinShots90] = useState('');
  const [recruitmentMinKeyPasses90, setRecruitmentMinKeyPasses90] = useState('');
  const [recruitmentMinDribble, setRecruitmentMinDribble] = useState('');
  const [recruitmentMinPassAcc, setRecruitmentMinPassAcc] = useState('');

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

  const getAnalyticalRoleName = (role: AnalyticalRole) => {
    switch (role) {
      case 'GOALKEEPER': return t.roleGK;
      case 'DEFENDER': return t.roleDF;
      case 'MIDFIELDER': return t.roleMF;
      case 'ATTACKING_MIDFIELDER': return t.roleAM;
      case 'FORWARD': return t.roleFW;
    }
  };

  const getFootName = (foot: string) => {
    if (foot === 'Right') return t.footRight;
    if (foot === 'Left') return t.footLeft;
    if (foot === 'Both') return t.footBoth;
    return t.footUnknown;
  };

  const renderFootIcon = (foot: string) => {
    if (foot === 'Both') {
      return (
        <span className="inline-flex items-center gap-0.5" aria-hidden="true">
          <span className="inline-block">🦶</span>
          <span className="inline-block scale-x-[-1]">🦶</span>
        </span>
      );
    }

    return (
      <span
        className={`inline-block ${foot === 'Right' ? 'scale-x-[-1]' : ''}`}
        aria-hidden="true"
      >
        🦶
      </span>
    );
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
    const positions: Position[] = ['FW', 'MF', 'DF', 'GK'];
    const keys: (keyof RoleRadarMetrics)[] = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6'];

    const result = {} as Record<Position, RoleRadarMetrics>;

    positions.forEach((pos) => {
      const group = players.filter((p) => p.position === pos && !p.scoutingEngine?.isLowSample);
      const metrics = {} as RoleRadarMetrics;

      keys.forEach((key) => {
        const values = group
          .map((p) => p.radar?.[key])
          .filter((value): value is number => value !== null && value !== undefined && Number.isFinite(value));

        metrics[key] = values.length
          ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
          : null;
      });

      result[pos] = metrics;
    });

    return result;
  }, [players]);

  const filteredAndSortedPlayers = useMemo(() => {
    const list = players.filter((player) => {
      const pName = player.name?.[lang]?.toLowerCase() || '';
      const pClub = player.club?.[lang]?.toLowerCase() || '';
      const q = searchQuery.toLowerCase();
      const matchSearch = pName.includes(q) || pClub.includes(q);

      const leagueCountry = currentLeague === 'KAZ' ? 'KZ' : 'UZ';
      const matchLegion =
        !filterLegionnaire ||
        player.isLegionnaire ||
        (!!player.countryCode && player.countryCode.toUpperCase() !== leagueCountry);

      const matchU21 = !filterU21 || player.isU21;
      const matchContract = !filterContract || isContractExpiring(player.contractUntil);
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
          valA = a.scoutingEngine?.roleScore ?? -1;
          valB = b.scoutingEngine?.roleScore ?? -1;
        }
        return sortOrder === 'desc' ? valB - valA : valA - valB;
      });
    }

    return list;
  }, [players, searchQuery, filterLegionnaire, filterU21, filterContract, filterMinMinutes, filterClub, filterPosition, sortField, sortOrder, lang]);

  const hasRecruitmentCriteria = useMemo(() => {
    return (
      recruitmentPosition !== 'all' ||
      recruitmentRole !== 'all' ||
      recruitmentFoot !== 'all' ||
      recruitmentNationality !== 'all' ||
      recruitmentMaxAge !== '' ||
      recruitmentMinBudget !== '' ||
      recruitmentMaxBudget !== '' ||
      recruitmentMinMinutes !== '' ||
      recruitmentMinRoleScore !== '' ||
      recruitmentMinAttackScore !== '' ||
      recruitmentMinGoals90 !== '' ||
      recruitmentMinAssists90 !== '' ||
      recruitmentMinShots90 !== '' ||
      recruitmentMinKeyPasses90 !== '' ||
      recruitmentMinDribble !== '' ||
      recruitmentMinPassAcc !== '' ||
      recruitmentExpiring ||
      recruitmentReliableOnly
    );
  }, [
    recruitmentPosition,
    recruitmentRole,
    recruitmentFoot,
    recruitmentNationality,
    recruitmentMaxAge,
    recruitmentMinBudget,
    recruitmentMaxBudget,
    recruitmentMinMinutes,
    recruitmentMinRoleScore,
    recruitmentMinAttackScore,
    recruitmentMinGoals90,
    recruitmentMinAssists90,
    recruitmentMinShots90,
    recruitmentMinKeyPasses90,
    recruitmentMinDribble,
    recruitmentMinPassAcc,
    recruitmentExpiring,
    recruitmentReliableOnly,
  ]);

  const recruitmentCandidates = useMemo(() => {
    if (!hasRecruitmentCriteria) return [];

    const maxAge = recruitmentMaxAge === '' ? null : Number(recruitmentMaxAge);
    const minBudget = recruitmentMinBudget === '' ? null : Number(recruitmentMinBudget);
    const maxBudget = recruitmentMaxBudget === '' ? null : Number(recruitmentMaxBudget);
    const minMinutes = recruitmentMinMinutes === '' ? null : Number(recruitmentMinMinutes);
    const minRole = recruitmentMinRoleScore === '' ? null : Number(recruitmentMinRoleScore);
    const minAttack = recruitmentMinAttackScore === '' ? null : Number(recruitmentMinAttackScore);
    const minGoals90 = recruitmentMinGoals90 === '' ? null : Number(recruitmentMinGoals90);
    const minAssists90 = recruitmentMinAssists90 === '' ? null : Number(recruitmentMinAssists90);
    const minShots90 = recruitmentMinShots90 === '' ? null : Number(recruitmentMinShots90);
    const minKeyPasses90 = recruitmentMinKeyPasses90 === '' ? null : Number(recruitmentMinKeyPasses90);
    const minDribble = recruitmentMinDribble === '' ? null : Number(recruitmentMinDribble);
    const minPassAcc = recruitmentMinPassAcc === '' ? null : Number(recruitmentMinPassAcc);

    return players
      .filter((p) => {
        if (recruitmentPosition !== 'all' && p.sourcePosition !== recruitmentPosition) return false;
        if (recruitmentRole !== 'all' && p.analyticalRole !== recruitmentRole) return false;
        if (recruitmentFoot !== 'all' && p.preferredFoot !== recruitmentFoot) return false;
        if (recruitmentNationality === 'local' && p.isLegionnaire) return false;
        if (recruitmentNationality === 'legionnaire' && !p.isLegionnaire) return false;
        if (maxAge !== null && Number.isFinite(maxAge) && p.age > maxAge) return false;

        if (minBudget !== null && Number.isFinite(minBudget)) {
          if (p.rawMarketValueEUR === null || p.rawMarketValueEUR < minBudget) return false;
        }
        if (maxBudget !== null && Number.isFinite(maxBudget)) {
          if (p.rawMarketValueEUR === null || p.rawMarketValueEUR > maxBudget) return false;
        }

        if (minMinutes !== null && Number.isFinite(minMinutes) && p.minutesPlayed < minMinutes) return false;

        const roleScore = p.scoutingEngine?.roleScore ?? null;
        if (minRole !== null && Number.isFinite(minRole)) {
          if (roleScore === null || roleScore < minRole) return false;
        }

        const attackScore = p.scoutingEngine?.attackingScore ?? null;
        if (minAttack !== null && Number.isFinite(minAttack)) {
          if (attackScore === null || attackScore < minAttack) return false;
        }

        if (minGoals90 !== null && Number.isFinite(minGoals90) && (p.goalsPer90 === null || p.goalsPer90 < minGoals90)) return false;
        if (minAssists90 !== null && Number.isFinite(minAssists90) && (p.assistsPer90 === null || p.assistsPer90 < minAssists90)) return false;
        if (minShots90 !== null && Number.isFinite(minShots90) && (p.shotsPer90 === null || p.shotsPer90 < minShots90)) return false;
        if (minKeyPasses90 !== null && Number.isFinite(minKeyPasses90) && (p.keyPassesPer90 === null || p.keyPassesPer90 < minKeyPasses90)) return false;
        if (minDribble !== null && Number.isFinite(minDribble) && (p.dribbleSuccessRate === null || p.dribbleSuccessRate < minDribble)) return false;
        if (minPassAcc !== null && Number.isFinite(minPassAcc) && (p.passAccPct === null || p.passAccPct < minPassAcc)) return false;

        if (recruitmentExpiring && !isContractExpiring(p.contractUntil)) return false;
        if (recruitmentReliableOnly && p.scoutingEngine?.confidence === 'low') return false;

        return true;
      })
      .map((p) => {
        const reasons: string[] = [];
        if (recruitmentPosition !== 'all') reasons.push(getPositionName(p.sourcePosition));
        if (recruitmentRole !== 'all') reasons.push(getAnalyticalRoleName(p.analyticalRole));
        if (recruitmentFoot !== 'all') reasons.push(getFootName(p.preferredFoot));
        if (recruitmentNationality !== 'all') reasons.push(p.isLegionnaire ? t.statusLegionnaire : t.statusLocal);
        if (maxAge !== null && Number.isFinite(maxAge)) reasons.push(lang === 'ru' ? `Возраст ${p.age} ≤ ${maxAge}` : `Yosh ${p.age} ≤ ${maxAge}`);
        if ((minBudget !== null || maxBudget !== null) && p.rawMarketValueEUR !== null) {
          reasons.push(lang === 'ru' ? `Цена: ${p.marketValue}` : `Narxi: ${p.marketValue}`);
        }
        if (minMinutes !== null && Number.isFinite(minMinutes)) reasons.push(`${p.minutesPlayed}' ≥ ${minMinutes}'`);
        if (minRole !== null && Number.isFinite(minRole) && p.scoutingEngine?.roleScore !== null) reasons.push(lang === 'ru' ? `Ролевой рейтинг ${p.scoutingEngine.roleScore} ≥ ${minRole}` : `Rol reytingi ${p.scoutingEngine.roleScore} ≥ ${minRole}`);
        if (minAttack !== null && Number.isFinite(minAttack) && p.scoutingEngine?.attackingScore !== null) reasons.push(lang === 'ru' ? `Атакующий вклад ${p.scoutingEngine.attackingScore} ≥ ${minAttack}` : `Hujum hissasi ${p.scoutingEngine.attackingScore} ≥ ${minAttack}`);
        if (minGoals90 !== null && Number.isFinite(minGoals90) && p.goalsPer90 !== null) reasons.push(lang === 'ru' ? `Голы/90 ${p.goalsPer90.toFixed(2)} ≥ ${minGoals90}` : `Gollar/90 ${p.goalsPer90.toFixed(2)} ≥ ${minGoals90}`);
        if (minAssists90 !== null && Number.isFinite(minAssists90) && p.assistsPer90 !== null) reasons.push(lang === 'ru' ? `Ассисты/90 ${p.assistsPer90.toFixed(2)} ≥ ${minAssists90}` : `Assistlar/90 ${p.assistsPer90.toFixed(2)} ≥ ${minAssists90}`);
        if (minShots90 !== null && Number.isFinite(minShots90) && p.shotsPer90 !== null) reasons.push(lang === 'ru' ? `Удары/90 ${p.shotsPer90.toFixed(2)} ≥ ${minShots90}` : `Zarbalar/90 ${p.shotsPer90.toFixed(2)} ≥ ${minShots90}`);
        if (minKeyPasses90 !== null && Number.isFinite(minKeyPasses90) && p.keyPassesPer90 !== null) reasons.push(lang === 'ru' ? `Ключевые передачи/90 ${p.keyPassesPer90.toFixed(2)} ≥ ${minKeyPasses90}` : `Xavfli paslar/90 ${p.keyPassesPer90.toFixed(2)} ≥ ${minKeyPasses90}`);
        if (minDribble !== null && Number.isFinite(minDribble) && p.dribbleSuccessRate !== null) reasons.push(lang === 'ru' ? `Дриблинг ${p.dribbleSuccessRate}% ≥ ${minDribble}%` : `Dribling ${p.dribbleSuccessRate}% ≥ ${minDribble}%`);
        if (minPassAcc !== null && Number.isFinite(minPassAcc) && p.passAccPct !== null) reasons.push(lang === 'ru' ? `Точность передач ${p.passAccPct}% ≥ ${minPassAcc}%` : `Pas aniqligi ${p.passAccPct}% ≥ ${minPassAcc}%`);
        if (recruitmentExpiring) reasons.push(lang === 'ru' ? 'Контракт ≤ 12 мес.' : 'Shartnoma ≤ 12 oy');
        if (recruitmentReliableOnly) reasons.push(`${t.confidenceLabel}: ${p.scoutingEngine?.confidence === 'high' ? t.confidenceHigh : t.confidenceMedium}`);

        return { player: p, reasons };
      })
      .sort((a, b) => {
        const scoreA = a.player.scoutingEngine?.roleScore ?? -1;
        const scoreB = b.player.scoutingEngine?.roleScore ?? -1;
        if (scoreB !== scoreA) return scoreB - scoreA;
        return (b.player.scoutingEngine?.attackingScore ?? -1) - (a.player.scoutingEngine?.attackingScore ?? -1);
      });
  }, [
    players,
    hasRecruitmentCriteria,
    recruitmentPosition,
    recruitmentRole,
    recruitmentMaxAge,
    recruitmentMinBudget,
    recruitmentMaxBudget,
    recruitmentMinMinutes,
    recruitmentMinRoleScore,
    recruitmentMinAttackScore,
    recruitmentExpiring,
    recruitmentReliableOnly,
    recruitmentFoot,
    recruitmentNationality,
    recruitmentMinGoals90,
    recruitmentMinAssists90,
    recruitmentMinShots90,
    recruitmentMinKeyPasses90,
    recruitmentMinDribble,
    recruitmentMinPassAcc,
    lang,
  ]);

  const budgetReplacements = useMemo(() => {
    if (!selectedPlayer) return [];

    const target = selectedPlayer;
    const radarKeys: (keyof RoleRadarMetrics)[] = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6'];

    const scored = players
      .filter((p) => p.id !== target.id && p.position === target.position)
      .map((cand) => {
        const shared = radarKeys
          .map((key) => {
            const a = target.radar[key];
            const b = cand.radar[key];
            return a !== null && b !== null ? Math.abs(a - b) : null;
          })
          .filter((v): v is number => v !== null);

        if (shared.length < 3) return null;

        const meanAbsoluteDifference = shared.reduce((sum, v) => sum + v, 0) / shared.length;
        const similarity = Math.round(Math.max(0, 100 - meanAbsoluteDifference));

        const hasBothValues = target.rawMarketValueEUR !== null && cand.rawMarketValueEUR !== null;
        const costDiff = hasBothValues
          ? target.rawMarketValueEUR! - cand.rawMarketValueEUR!
          : null;

        return {
          player: cand,
          similarity,
          comparedMetrics: shared.length,
          costDiff,
          isCheaper: costDiff !== null && costDiff > 0,
        };
      })
      .filter((item): item is {
        player: Player;
        similarity: number;
        comparedMetrics: number;
        costDiff: number | null;
        isCheaper: boolean;
      } => item !== null);

    return scored
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 3);
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
    return [...players].sort((a, b) => (b.scoutingEngine?.roleScore ?? -1) - (a.scoutingEngine?.roleScore ?? -1))[0];
  }, [players]);

  const handlePrintPdf = (player: Player) => {
    const printWindow = window.open('', '_blank', 'width=800,height=900');
    if (!printWindow) return;

    const p = lang === 'ru'
      ? {
          title: 'Скаутский отчёт',
          roleRating: 'Ролевой рейтинг',
          playingTimeContract: 'Игровое время и контракт',
          oneSeason: '1 сезон',
          twoSeasons: '2 сезона',
          until: 'до',
          metric: 'Показатель',
          value: 'Значение',
          matches: 'Сыграно матчей',
          saves: 'Всего сейвов',
          savesPerMatch: 'Сейвы за матч',
          passAccuracy: 'Точность передач',
          goals: 'Голы',
          assists: 'Голевые передачи',
          shots: 'Удары',
          keyPasses: 'Ключевые передачи',
          dribbling: 'Дриблинг',
          tackles90: 'Отборы/90',
          interceptions90: 'Перехваты/90',
          officialReport: 'Скаутский отчёт',
        }
      : {
          title: 'Skautlik hisoboti',
          roleRating: 'Rol reytingi',
          playingTimeContract: 'O‘yin vaqti va shartnoma',
          oneSeason: '1 mavsum',
          twoSeasons: '2 mavsum',
          until: 'gacha',
          metric: 'Ko‘rsatkich',
          value: 'Qiymat',
          matches: 'O‘tkazilgan o‘yinlar',
          saves: 'Jami seyvlar',
          savesPerMatch: 'Har o‘yindagi seyvlar',
          passAccuracy: 'Pas aniqligi',
          goals: 'Gollar',
          assists: 'Golli uzatmalar',
          shots: 'Zarbalar',
          keyPasses: 'Xavfli paslar',
          dribbling: 'Dribling',
          tackles90: 'To‘pni qaytarish/90',
          interceptions90: 'To‘pni to‘xtatish/90',
          officialReport: 'Skautlik hisoboti',
        };

    const statRows = player.position === 'GK'
      ? `
        <tr><td>${p.saves}</td><td><strong>${player.saves}</strong></td></tr>
        <tr><td>${p.savesPerMatch}</td><td>${(player.saves / Math.max(1, player.matchesPlayed)).toFixed(1)}</td></tr>
        <tr><td>${p.passAccuracy}</td><td>${player.passAccPct === null ? '—' : player.passAccPct + '%'}</td></tr>
      `
      : `
        <tr><td>${p.goals}</td><td><strong>${player.goals}</strong></td></tr>
        <tr><td>${p.assists}</td><td><strong>${player.assists}</strong></td></tr>
        <tr><td>${p.shots}</td><td>${player.shots}</td></tr>
        <tr><td>${p.keyPasses}</td><td>${player.keyPasses}</td></tr>
        <tr><td>${p.dribbling}</td><td>${player.dribbleSuccessRate === null ? '—' : player.dribbleSuccessRate + '%'}</td></tr>
        <tr><td>${p.tackles90}</td><td>${player.roleMetrics?.tacklesPer90?.toFixed(2) ?? '—'}</td></tr>
        <tr><td>${p.interceptions90}</td><td>${player.roleMetrics?.interceptionsPer90?.toFixed(2) ?? '—'}</td></tr>
        <tr><td>${p.passAccuracy}</td><td>${player.passAccPct === null ? '—' : player.passAccPct + '%'}</td></tr>
      `;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="${lang}">
        <head>
          <title>${p.title} — ${player.name[lang]}</title>
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
                <div class="meta">${player.club[lang]} | ${getPositionName(player.position)} | #${player.number ?? '—'} | ${player.age} ${t.years} | ${t.footLabel} ${getFootName(player.preferredFoot)}</div>
              </div>
            </div>
            <div class="badge">${player.marketValue}</div>
          </div>
          <div class="grid">
            <div class="card">
              <div class="card-title">${p.roleRating}</div>
              <div class="card-val" style="color: #059669;">${player.scoutingEngine?.roleScore ?? '—'} / 100</div>
            </div>
            <div class="card">
              <div class="card-title">${p.playingTimeContract} (${seasonMode === 'two' ? p.twoSeasons : p.oneSeason})</div>
              <div class="card-val">${player.matchesPlayed} ${t.matchWord} (${player.minutesPlayed}') | ${p.until}: ${player.contractUntil}</div>
            </div>
          </div>
          <table>
            <thead>
              <tr><th>${p.metric}</th><th>${p.value}</th></tr>
            </thead>
            <tbody>
              <tr><td>${p.matches}</td><td><strong>${player.matchesPlayed} (${player.minutesPlayed}')</strong></td></tr>
              ${statRows}
            </tbody>
          </table>
          <div class="footer">UzStat Talent Tracker • ${p.officialReport}</div>
          <script>window.onload = function() { window.print(); setTimeout(function() { window.close(); }, 500); };</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const renderComparisonCell = (
    valA: number | null,
    valB: number | null,
    displayA: string | number,
    displayB: string | number,
    higherIsBetter = true
  ) => {
    let classA = 'text-zinc-400 font-medium';
    let classB = 'text-zinc-400 font-medium';

    if (valA !== null && valB !== null && valA !== valB) {
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
                  {t.leagueUZB}
                </button>
                <button
                  onClick={() => { setCurrentLeague('KAZ'); setFilterClub('all'); }}
                  className={`px-2 py-0.5 rounded font-semibold transition ${currentLeague === 'KAZ' ? 'bg-emerald-500 text-zinc-950 shadow-sm' : 'text-zinc-400 hover:text-white'}`}
                >
                  {t.leagueKAZ}
                </button>
              </div>

              <span className="hidden lg:inline-flex items-center gap-1.5 text-[10px] text-emerald-400 bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded font-mono">
                <Wifi className="h-3 w-3 animate-pulse text-emerald-400" /> {t.liveLabel}
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

          {activeView === 'players' && (
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
          )}

          {/* ИКОНКА НАСТРОЙКИ ФИЛЬТРОВ СПРАВА */}
          {activeView === 'players' && (
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
          )}
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
            {topScout ? `${topScout.name[lang]} (${topScout.scoutingEngine?.roleScore ?? '—'})` : '—'}
          </div>
          <span className="text-[11px] text-zinc-500 mt-1 block">
            {topScout ? `${topScout.club[lang]} · ${topScout.assists} ${t.assistWord}` : '—'}
          </span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto mb-5 flex items-center gap-2">
        <button
          onClick={() => setActiveView('players')}
          className={`rounded-lg border px-4 py-2 text-xs font-semibold transition ${activeView === 'players' ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-400' : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white'}`}
        >
          {t.tabPlayers}
        </button>
        <button
          onClick={() => setActiveView('recruitment')}
          className={`rounded-lg border px-4 py-2 text-xs font-semibold transition ${activeView === 'recruitment' ? 'border-sky-500/50 bg-sky-500/15 text-sky-400' : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white'}`}
        >
          {t.tabRecruitment}
        </button>
      </div>

      {activeView === 'players' && (<>
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
            [{seasonMode === 'current' ? t.seasonCurrentShort : t.seasonTwoShort}]
          </span>
          <span>{t.tableHint}</span>
        </div>
      </div>

      </>)}

      {activeView === 'recruitment' && (
      <>
      {/* RECRUITMENT */}
      <section className="max-w-7xl mx-auto mb-5 rounded-xl border border-sky-500/20 bg-zinc-900/70 p-5 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-zinc-800 pb-4 mb-4">
          <div className="flex items-start gap-2.5">
            <Search className="h-5 w-5 text-sky-400 mt-0.5" />
            <div>
              <h2 className="text-sm font-bold text-white">{t.recruitmentTitle}</h2>
              <p className="text-[11px] text-zinc-400 mt-0.5">{t.recruitmentSub}</p>
              <p className="text-[10px] text-zinc-500 mt-1">{t.sourceVsRoleHelp}</p>
              <p className="text-[10px] text-amber-400/80 mt-1">{t.unknownValueExcluded}</p>
            </div>
          </div>
          <button
            onClick={() => {
              setRecruitmentPosition('all');
              setRecruitmentRole('all');
              setRecruitmentMaxAge('');
              setRecruitmentMinBudget('');
              setRecruitmentMaxBudget('');
              setRecruitmentMinMinutes('');
              setRecruitmentMinRoleScore('');
              setRecruitmentMinAttackScore('');
              setRecruitmentExpiring(false);
              setRecruitmentReliableOnly(false);
              setRecruitmentFoot('all');
              setRecruitmentNationality('all');
              setRecruitmentMinGoals90('');
              setRecruitmentMinAssists90('');
              setRecruitmentMinShots90('');
              setRecruitmentMinKeyPasses90('');
              setRecruitmentMinDribble('');
              setRecruitmentMinPassAcc('');
            }}
            className="self-start lg:self-auto text-[11px] font-semibold text-zinc-400 hover:text-white border border-zinc-800 rounded-lg px-3 py-1.5"
          >
            {t.resetFilters}
          </button>
        </div>

        <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">{t.basicCriteria}</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          <div>
            <label className="block text-[10px] text-zinc-500 mb-1">{t.recruitmentPosition}</label>
            <select value={recruitmentPosition} onChange={(e) => { setRecruitmentPosition(e.target.value as 'all' | Position); setRecruitmentRole('all'); }}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-2 text-xs text-white">
              <option value="all">{t.allPositions}</option>
              <option value="FW">{t.posFW}</option>
              <option value="MF">{t.posMF}</option>
              <option value="DF">{t.posDF}</option>
              <option value="GK">{t.posGK}</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] text-zinc-500 mb-1">{t.recruitmentRole}</label>
            <select value={recruitmentRole} onChange={(e) => setRecruitmentRole(e.target.value as 'all' | AnalyticalRole)}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-2 text-xs text-white">
              <option value="all">{t.allRoles}</option>
              {(recruitmentPosition === 'all' || recruitmentPosition === 'FW') && <option value="FORWARD">{t.roleFW}</option>}
              {(recruitmentPosition === 'all' || recruitmentPosition === 'MF') && <option value="ATTACKING_MIDFIELDER">{t.roleAM}</option>}
              {(recruitmentPosition === 'all' || recruitmentPosition === 'MF') && <option value="MIDFIELDER">{t.roleMF}</option>}
              {(recruitmentPosition === 'all' || recruitmentPosition === 'DF') && <option value="DEFENDER">{t.roleDF}</option>}
              {(recruitmentPosition === 'all' || recruitmentPosition === 'GK') && <option value="GOALKEEPER">{t.roleGK}</option>}
            </select>
          </div>

          <div>
            <label className="block text-[10px] text-zinc-500 mb-1">{t.recruitmentFoot}</label>
            <select value={recruitmentFoot} onChange={(e) => setRecruitmentFoot(e.target.value as FootFilter)}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-2 text-xs text-white">
              <option value="all">{t.statusAll}</option>
              <option value="Right">{t.footRight}</option>
              <option value="Left">{t.footLeft}</option>
              <option value="Both">{t.footBoth}</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] text-zinc-500 mb-1">{t.recruitmentNationality}</label>
            <select value={recruitmentNationality} onChange={(e) => setRecruitmentNationality(e.target.value as NationalityFilter)}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-2 text-xs text-white">
              <option value="all">{t.statusAll}</option>
              <option value="local">{t.statusLocal}</option>
              <option value="legionnaire">{t.statusLegionnaire}</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] text-zinc-500 mb-1">{t.recruitmentMaxAge}</label>
            <input type="number" min="15" max="45" value={recruitmentMaxAge} onChange={(e) => setRecruitmentMaxAge(e.target.value)}
              placeholder="—" className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-2 text-xs text-white" />
          </div>

          <div>
            <label className="block text-[10px] text-zinc-500 mb-1">{t.recruitmentMinBudget}</label>
            <input type="number" min="0" step="25000" value={recruitmentMinBudget} onChange={(e) => setRecruitmentMinBudget(e.target.value)}
              placeholder="—" className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-2 text-xs text-white" />
          </div>

          <div>
            <label className="block text-[10px] text-zinc-500 mb-1">{t.recruitmentMaxBudget}</label>
            <input type="number" min="0" step="25000" value={recruitmentMaxBudget} onChange={(e) => setRecruitmentMaxBudget(e.target.value)}
              placeholder="—" className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-2 text-xs text-white" />
          </div>

          <div>
            <label className="block text-[10px] text-zinc-500 mb-1">{t.recruitmentMinMinutes}</label>
            <input type="number" min="0" step="90" value={recruitmentMinMinutes} onChange={(e) => setRecruitmentMinMinutes(e.target.value)}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-2 text-xs text-white" />
          </div>

          <div>
            <label className="block text-[10px] text-zinc-500 mb-1">{t.recruitmentMinRole}</label>
            <input type="number" min="0" max="100" value={recruitmentMinRoleScore} onChange={(e) => setRecruitmentMinRoleScore(e.target.value)}
              placeholder="—" className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-2 text-xs text-white" />
          </div>

          <div>
            <label className="block text-[10px] text-zinc-500 mb-1">{t.recruitmentMinAttack}</label>
            <input type="number" min="0" max="100" value={recruitmentMinAttackScore} onChange={(e) => setRecruitmentMinAttackScore(e.target.value)}
              placeholder="—" className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-2 text-xs text-white" />
          </div>

          <div className="flex flex-col gap-2 justify-end">
            <label className="flex items-center gap-2 text-[10px] text-zinc-300 cursor-pointer">
              <input type="checkbox" checked={recruitmentReliableOnly} onChange={(e) => setRecruitmentReliableOnly(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-zinc-700 bg-zinc-950 text-emerald-500" />
              {t.recruitmentReliable}
            </label>
            <label className="flex items-center gap-2 text-[10px] text-zinc-300 cursor-pointer">
              <input type="checkbox" checked={recruitmentExpiring} onChange={(e) => setRecruitmentExpiring(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-zinc-700 bg-zinc-950 text-emerald-500" />
              {t.recruitmentExpiring}
            </label>
          </div>
        </div>

        <details className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950/35">
          <summary className="cursor-pointer px-3 py-3 text-[10px] uppercase tracking-wider text-zinc-400 hover:text-zinc-200">
            {t.advancedMetrics}
          </summary>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 px-3 pb-3">
            {recruitmentPosition !== 'GK' && (
              <>
                <input type="number" step="0.01" min="0" value={recruitmentMinGoals90} onChange={(e) => setRecruitmentMinGoals90(e.target.value)} placeholder={t.minGoals90}
                  className="rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-2 text-xs text-white placeholder-zinc-600" />
                <input type="number" step="0.01" min="0" value={recruitmentMinAssists90} onChange={(e) => setRecruitmentMinAssists90(e.target.value)} placeholder={t.minAssists90}
                  className="rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-2 text-xs text-white placeholder-zinc-600" />
                <input type="number" step="0.01" min="0" value={recruitmentMinShots90} onChange={(e) => setRecruitmentMinShots90(e.target.value)} placeholder={t.minShots90}
                  className="rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-2 text-xs text-white placeholder-zinc-600" />
                <input type="number" step="0.01" min="0" value={recruitmentMinKeyPasses90} onChange={(e) => setRecruitmentMinKeyPasses90(e.target.value)} placeholder={t.minKeyPasses90}
                  className="rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-2 text-xs text-white placeholder-zinc-600" />
                <input type="number" step="1" min="0" max="100" value={recruitmentMinDribble} onChange={(e) => setRecruitmentMinDribble(e.target.value)} placeholder={t.minDribble}
                  className="rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-2 text-xs text-white placeholder-zinc-600" />
              </>
            )}
            <input type="number" step="1" min="0" max="100" value={recruitmentMinPassAcc} onChange={(e) => setRecruitmentMinPassAcc(e.target.value)} placeholder={t.minPassAcc}
              className="rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-2 text-xs text-white placeholder-zinc-600" />
          </div>
        </details>

        <div className="mt-5 pt-4 border-t border-zinc-800">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-zinc-200">{t.shortlistTitle}</h3>
            <span className="text-[11px] font-mono text-sky-400">{recruitmentCandidates.length}</span>
          </div>

          {!hasRecruitmentCriteria ? (
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-5 text-center text-xs text-zinc-500">
              {t.setCriteriaPrompt}
            </div>
          ) : recruitmentCandidates.length === 0 ? (
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-5 text-center text-xs text-zinc-500">
              {t.noShortlist}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {recruitmentCandidates.map(({ player, reasons }) => (
                <button
                  key={player.id}
                  onClick={() => { setSelectedPlayer(player); setShowFullStats(false); }}
                  className="text-left rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 hover:border-sky-500/40 hover:bg-zinc-900 transition"
                >
                  <div className="flex items-center gap-3">
                    <PlayerHeadshot url={player.photoUrl} name={player.name[lang]} initials={player.initials} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-sm text-white truncate">{player.name[lang]}</div>
                      <div className="text-[10px] text-zinc-400 truncate">
                        {player.club[lang]} · {player.age} {t.years} · {player.marketValue}
                      </div>
                      <div className="text-[10px] text-sky-400 mt-0.5">
                        {getPositionName(player.sourcePosition)} · {getAnalyticalRoleName(player.analyticalRole)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-bold text-emerald-400">{player.scoutingEngine?.roleScore ?? '—'}</div>
                      <div className="text-[9px] text-zinc-500">{t.roleScoreLabel}</div>
                    </div>
                  </div>

                  <div className="mt-3">
                    <div className="text-[9px] uppercase tracking-wider text-zinc-500 mb-1.5">{t.shortlistReasons}</div>
                    <div className="flex flex-wrap gap-1">
                      {reasons.slice(0, 5).map((reason, idx) => (
                        <span key={idx} className="rounded border border-zinc-800 bg-zinc-900 px-1.5 py-0.5 text-[9px] text-zinc-300">
                          {reason}
                        </span>
                      ))}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>
      </>
      )}

      {activeView === 'players' && (
      <>
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
                        {player.isEstimatedMarketValue ? '~' : ''}{player.marketValue} · <span className="text-zinc-400">{player.age} {t.years}</span>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-3 font-medium text-zinc-200">{player.club[lang]}</td>
                  <td className="py-3 px-3">
                    <span className="rounded bg-zinc-800/90 border border-zinc-700/60 px-2 py-0.5 text-[10px] font-semibold text-zinc-200">
                      {getPositionName(player.sourcePosition)}
                    </span>
                    {player.analyticalRole !== (
                      player.sourcePosition === 'GK' ? 'GOALKEEPER' :
                      player.sourcePosition === 'DF' ? 'DEFENDER' :
                      player.sourcePosition === 'MF' ? 'MIDFIELDER' : 'FORWARD'
                    ) && (
                      <span className="block mt-1 text-[10px] text-sky-400">
                        {getAnalyticalRoleName(player.analyticalRole)}
                      </span>
                    )}
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
                    {player.position === 'GK' || player.dribbleSuccessRate === null ? '—' : `${player.dribbleSuccessRate}%`}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className={`inline-flex rounded-lg border px-2.5 py-1 text-xs font-bold ${getScoutBadgeColor(player.scoutingEngine?.roleScore ?? null)}`}>
                      {player.scoutingEngine?.roleScore ?? '—'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      </>
      )}

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
                      {renderFootIcon(selectedPlayer.preferredFoot)} {t.footLabel} <strong className="text-white">{getFootName(selectedPlayer.preferredFoot)}</strong>
                    </span>
                    {selectedPlayer.isLegionnaire && (
                      <span className="text-[11px] bg-sky-500/20 text-sky-400 border border-sky-500/40 px-2 py-0.5 rounded-md font-bold">
                        {t.legionerBadge}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-400 mt-1">
                    #{selectedPlayer.number} · {selectedPlayer.club[lang]} · {t.sourcePositionLabel}: {getPositionName(selectedPlayer.sourcePosition)} · {selectedPlayer.age} {t.years} · {t.contractLeft} <strong className="text-zinc-200">{selectedPlayer.contractUntil}</strong>
                  </p>
                  <div className="mt-2 flex items-center gap-2 text-[11px]">
                    <span className="text-zinc-500">{t.analyticalRoleLabel}:</span>
                    <span className="rounded-md border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 font-semibold text-sky-400">
                      {getAnalyticalRoleName(selectedPlayer.analyticalRole)}
                    </span>
                    {selectedPlayer.analyticalRoleIsCalculated && (
                      <span className="text-zinc-500">{t.calculatedRoleNote}</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2.5">
                    <span className="text-[10px] bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded text-zinc-300">
                      #{selectedPlayer.club[lang]}
                    </span>
                    <span className="text-[10px] bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded text-zinc-300">
                      #{getPositionName(selectedPlayer.sourcePosition)}
                    </span>
                    <span className="text-[10px] bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded text-zinc-300">
                      #{selectedPlayer.isLegionnaire ? t.statusLegionnaire : t.statusLocal}
                    </span>
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

            {/* Ролевой профиль и матчевые показатели */}
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
                        <span className="text-base font-bold text-amber-400 font-mono mt-0.5 block">
                          {selectedPlayer.passAccPct === null ? '—' : `${selectedPlayer.passAccPct}%`}
                        </span>
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
                        <span className="text-zinc-500 text-[11px] block">{t.goalsSeason} / {t.assistsSeason}</span>
                        <span className="text-base font-bold text-emerald-400 font-mono mt-0.5 block">
                          {selectedPlayer.goals} {t.goalWord} / {selectedPlayer.assists} {t.assistWord}
                        </span>
                        <span className="text-[10px] text-zinc-500 font-mono block mt-1">
                          /90: {selectedPlayer.goalsPer90 === null ? '—' : selectedPlayer.goalsPer90.toFixed(2)} / {selectedPlayer.assistsPer90 === null ? '—' : selectedPlayer.assistsPer90.toFixed(2)}
                        </span>
                      </div>
                      <div className="p-3 bg-zinc-950/70 border border-zinc-800/80 rounded-lg">
                        <span className="text-zinc-500 text-[11px] block">{t.shotsSeason}</span>
                        <span className="text-base font-bold text-amber-400 font-mono mt-0.5 block">{selectedPlayer.shots}</span>
                      </div>
                      <div className="p-3 bg-zinc-950/70 border border-zinc-800/80 rounded-lg">
                        <span className="text-zinc-500 text-[11px] block">{t.dribbleDetailed}</span>
                        <span className="text-base font-bold text-zinc-200 font-mono mt-0.5 block">
                          {selectedPlayer.dribbleWon} / {selectedPlayer.dribbleTotal} ({selectedPlayer.dribbleSuccessRate === null ? '—' : `${selectedPlayer.dribbleSuccessRate}%`})
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
                        <span className="text-base font-bold text-white font-mono mt-0.5 block">{selectedPlayer.duelWinRate === null ? '—' : `${selectedPlayer.duelWinRate}%`}</span>
                      </div>
                    </div>
                  )}

                  {/* 4. ПЛАШКИ DF */}
                  {selectedPlayer.position === 'DF' && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                      <div className="p-3 bg-zinc-950/70 border border-zinc-800/80 rounded-lg">
                        <span className="text-zinc-500 text-[11px] block">{t.matchesPlayed}</span>
                        <span className="text-base font-bold text-white font-mono mt-0.5 block">{selectedPlayer.matchesPlayed} {t.matchWord}</span>
                      </div>
                      <div className="p-3 bg-zinc-950/70 border border-zinc-800/80 rounded-lg">
                        <span className="text-zinc-500 text-[11px] block">{t.tacklesOnly}/90</span>
                        <span className="text-base font-bold text-emerald-400 font-mono mt-0.5 block">
                          {selectedPlayer.roleMetrics?.tacklesPer90?.toFixed(2) ?? '—'}
                        </span>
                      </div>
                      <div className="p-3 bg-zinc-950/70 border border-zinc-800/80 rounded-lg">
                        <span className="text-zinc-500 text-[11px] block">{t.interceptionsOnly}/90</span>
                        <span className="text-base font-bold text-emerald-400 font-mono mt-0.5 block">
                          {selectedPlayer.roleMetrics?.interceptionsPer90?.toFixed(2) ?? '—'}
                        </span>
                      </div>
                      <div className="p-3 bg-zinc-950/70 border border-zinc-800/80 rounded-lg">
                        <span className="text-zinc-500 text-[11px] block">{t.duelPct}</span>
                        <span className="text-base font-bold text-white font-mono mt-0.5 block">{selectedPlayer.duelWinRate === null ? '—' : `${selectedPlayer.duelWinRate}%`}</span>
                      </div>
                      <div className="p-3 bg-zinc-950/70 border border-zinc-800/80 rounded-lg">
                        <span className="text-zinc-500 text-[11px] block">{t.aerialPct}</span>
                        <span className="text-base font-bold text-sky-400 font-mono mt-0.5 block">{selectedPlayer.aerialWinRate === null ? '—' : `${selectedPlayer.aerialWinRate}%`}</span>
                      </div>
                      <div className="p-3 bg-zinc-950/70 border border-zinc-800/80 rounded-lg">
                        <span className="text-zinc-500 text-[11px] block">{t.passAccPct}</span>
                        <span className="text-base font-bold text-white font-mono mt-0.5 block">{selectedPlayer.passAccPct === null ? '—' : `${selectedPlayer.passAccPct}%`}</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-zinc-800 flex justify-between items-center text-xs">
                  <span className="text-zinc-400">{t.metricLabel} · {t.profileSourceNote}</span>
                  <span className={`font-bold font-mono px-2 py-0.5 rounded border ${getScoutBadgeColor(selectedPlayer.scoutingEngine?.roleScore ?? selectedPlayer.scoutIndex)}`}>
                    {(selectedPlayer.scoutingEngine?.roleScore ?? selectedPlayer.scoutIndex) === null
                      ? '—'
                      : `${selectedPlayer.scoutingEngine?.roleScore ?? selectedPlayer.scoutIndex} / 100`}
                  </span>
                </div>
              </div>
            </div>

            {/* СКАУТСКИЙ ПРОФИЛЬ */}
            {selectedPlayer.scoutingEngine && (
              <div className="mt-5 rounded-xl border border-zinc-800 bg-zinc-900/80 p-5 shadow-xl">
                <div className="flex items-center gap-2 border-b border-zinc-800 pb-3 mb-4">
                  <BarChart3 className="h-5 w-5 text-emerald-400" />
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-100">{t.scoutingEngineTitle}</h3>
                    <p className="text-[11px] text-zinc-500 mt-0.5">{t.scoutingEngineSub}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                  <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
                    <span className="text-[11px] text-zinc-500 block">{t.roleScoreLabel}</span>
                    <strong className="text-xl text-emerald-400 font-mono">
                      {selectedPlayer.scoutingEngine.roleScore === null ? '—' : `${selectedPlayer.scoutingEngine.roleScore}/100`}
                    </strong>
                    <span className="mt-1 block text-[9px] leading-snug text-zinc-600">{t.roleScoreNote}</span>
                  </div>
                  <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
                    <span className="text-[11px] text-zinc-500 block">{t.attackingScoreLabel}</span>
                    <strong className="text-xl text-sky-400 font-mono">
                      {selectedPlayer.scoutingEngine.attackingScore === null ? '—' : `${selectedPlayer.scoutingEngine.attackingScore}/100`}
                    </strong>
                  </div>
                  <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
                    <span className="text-[11px] text-zinc-500 block">{t.confidenceLabel}</span>
                    <strong className="text-base text-white">
                      {selectedPlayer.scoutingEngine.confidence === 'high'
                        ? t.confidenceHigh
                        : selectedPlayer.scoutingEngine.confidence === 'medium'
                          ? t.confidenceMedium
                          : t.confidenceLow}
                    </strong>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
                    <span className="text-emerald-400 font-semibold block mb-2">{t.strengthsLabel}</span>
                    {selectedPlayer.scoutingEngine.strengths.length ? selectedPlayer.scoutingEngine.strengths.map((signal) => {
                      const idx = ROLE_KEYS_BY_POSITION[selectedPlayer.position].indexOf(signal.key);
                      return (
                        <div key={signal.key} className="flex items-center justify-between gap-4 py-1.5 border-b border-zinc-900 last:border-0">
                          <span className="text-zinc-300">{idx >= 0 ? RADAR_AXIS_LABELS[lang][selectedPlayer.position][idx] : signal.key}</span>
                          <span className="font-medium text-emerald-400 whitespace-nowrap">
                            {lang === 'ru' ? `Выше ${signal.percentile}% игроков` : `${signal.percentile}% futbolchilardan yuqori`}
                          </span>
                        </div>
                      );
                    }) : <span className="text-zinc-500">{t.noMetricData}</span>}
                  </div>

                  <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
                    <span className="text-amber-400 font-semibold block mb-2">{t.watchoutsLabel}</span>
                    {selectedPlayer.scoutingEngine.watchouts.length ? selectedPlayer.scoutingEngine.watchouts.map((signal) => {
                      const idx = ROLE_KEYS_BY_POSITION[selectedPlayer.position].indexOf(signal.key);
                      const below = 100 - signal.percentile;
                      return (
                        <div key={signal.key} className="flex items-center justify-between gap-4 py-1.5 border-b border-zinc-900 last:border-0">
                          <span className="text-zinc-300">{idx >= 0 ? RADAR_AXIS_LABELS[lang][selectedPlayer.position][idx] : signal.key}</span>
                          <span className="font-medium text-amber-400 whitespace-nowrap">
                            {lang === 'ru' ? `Ниже ${below}% игроков` : `${below}% futbolchilardan past`}
                          </span>
                        </div>
                      );
                    }) : <span className="text-zinc-500">{t.noMetricData}</span>}
                  </div>
                </div>

                <details className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950/40">
                  <summary className="cursor-pointer px-3 py-2.5 text-xs font-medium text-zinc-400 hover:text-zinc-200">
                    {t.methodologyLabel}
                  </summary>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 px-3 pb-3 text-[11px]">
                    <div className="rounded bg-zinc-900/70 p-2">
                      <span className="text-zinc-500 block">{t.rawRoleScoreLabel}</span>
                      <span className="text-zinc-200 font-mono">
                        {selectedPlayer.scoutingEngine.rawRoleScore === null ? '—' : `${selectedPlayer.scoutingEngine.rawRoleScore}/100`}
                      </span>
                    </div>
                    <div className="rounded bg-zinc-900/70 p-2">
                      <span className="text-zinc-500 block">{t.coverageLabel}</span>
                      <span className="text-zinc-200 font-mono">
                        {selectedPlayer.scoutingEngine.metricCoverage}/{selectedPlayer.scoutingEngine.totalRoleMetrics}
                      </span>
                    </div>
                    <div className="rounded bg-zinc-900/70 p-2">
                      <span className="text-zinc-500 block">{t.benchmarkLabel}</span>
                      <span className="text-zinc-200 font-mono">
                        {selectedPlayer.scoutingEngine.benchmarkPlayers} ≥ {selectedPlayer.scoutingEngine.benchmarkMinMinutes}'
                      </span>
                    </div>
                    <div className="rounded bg-zinc-900/70 p-2">
                      <span className="text-zinc-500 block">{t.sampleWeightLabel}</span>
                      <span className="text-zinc-200 font-mono">
                        {Math.round((selectedPlayer.scoutingEngine.sampleWeight || 0) * 100)}%
                      </span>
                    </div>
                  </div>
                  {selectedPlayer.scoutingEngine.missingMetrics.length > 0 && (
                    <div className="px-3 pb-3 text-[11px]">
                      <span className="text-zinc-500 block mb-1">{t.missingMetricsLabel}</span>
                      <div className="flex flex-wrap gap-1">
                        {selectedPlayer.scoutingEngine.missingMetrics.map((key) => {
                          const idx = ROLE_KEYS_BY_POSITION[selectedPlayer.position].indexOf(key);
                          const label = idx >= 0 ? RADAR_AXIS_LABELS[lang][selectedPlayer.position][idx] : key;
                          return (
                            <span key={key} className="rounded border border-zinc-800 bg-zinc-900 px-1.5 py-0.5 text-zinc-400">
                              {label}: {t.noMetricData}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </details>
              </div>
            )}

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
                    <span className="text-zinc-500 block text-[10px]">{t.shotsSeason}</span>
                    <strong className="text-white text-sm">{selectedPlayer.shots}</strong>
                  </div>
                  <div className="p-2.5 bg-zinc-950/80 border border-zinc-800 rounded">
                    <span className="text-zinc-500 block text-[10px]">{t.keyPassesSeason}</span>
                    <strong className="text-white text-sm">{selectedPlayer.keyPasses}</strong>
                  </div>
                  <div className="p-2.5 bg-zinc-950/80 border border-zinc-800 rounded">
                    <span className="text-zinc-500 block text-[10px]">{t.dribbleDetailed}</span>
                    <strong className="text-zinc-200 text-sm">{selectedPlayer.dribbleWon} / {selectedPlayer.dribbleTotal} ({selectedPlayer.dribbleSuccessRate === null ? '—' : `${selectedPlayer.dribbleSuccessRate}%`})</strong>
                  </div>
                  {selectedPlayer.duelWinRate !== null && (
                    <div className="p-2.5 bg-zinc-950/80 border border-zinc-800 rounded">
                      <span className="text-zinc-500 block text-[10px]">{t.duelPct}</span>
                      <strong className="text-white text-sm">{selectedPlayer.duelWinRate}%</strong>
                    </div>
                  )}
                  {selectedPlayer.aerialWinRate !== null && (
                    <div className="p-2.5 bg-zinc-950/80 border border-zinc-800 rounded">
                      <span className="text-zinc-500 block text-[10px]">{t.aerialPct}</span>
                      <strong className="text-white text-sm">{selectedPlayer.aerialWinRate}%</strong>
                    </div>
                  )}
                  <div className="p-2.5 bg-zinc-950/80 border border-zinc-800 rounded">
                    <span className="text-zinc-500 block text-[10px]">{t.tacklesOnly}/90</span>
                    <strong className="text-emerald-400 text-sm">{selectedPlayer.roleMetrics?.tacklesPer90?.toFixed(2) ?? '—'}</strong>
                  </div>
                  <div className="p-2.5 bg-zinc-950/80 border border-zinc-800 rounded">
                    <span className="text-zinc-500 block text-[10px]">{t.interceptionsOnly}/90</span>
                    <strong className="text-emerald-400 text-sm">{selectedPlayer.roleMetrics?.interceptionsPer90?.toFixed(2) ?? '—'}</strong>
                  </div>
                  <div className="p-2.5 bg-zinc-950/80 border border-zinc-800 rounded">
                    <span className="text-zinc-500 block text-[10px]">{t.passAccPct}</span>
                    <strong className="text-white text-sm">{selectedPlayer.passAccPct === null ? '—' : `${selectedPlayer.passAccPct}%`}</strong>
                  </div>
                  <div className="p-2.5 bg-zinc-950/80 border border-zinc-800 rounded">
                    <span className="text-zinc-500 block text-[10px]">{t.metricLabel}</span>
                    <strong className="text-amber-400 text-sm">{selectedPlayer.scoutingEngine?.roleScore === null ? '—' : `${selectedPlayer.scoutingEngine?.roleScore}/100`}</strong>
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
                      title={t.directCompareHint}
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
                            {item.player.club[lang]} · {item.player.age} {t.years} · {renderFootIcon(item.player.preferredFoot)} {getFootName(item.player.preferredFoot)}
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
                        <span className={`text-sm font-black px-1.5 py-0.2 rounded border ${getScoutBadgeColor(opponent.scoutingEngine?.roleScore ?? null)}`}>
                          {opponent.scoutingEngine?.roleScore ?? '—'}
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
                  <div className="text-xs text-emerald-400">{compareA.club[lang]} · {getPositionName(compareA.position)} · {compareA.marketValue} · {renderFootIcon(compareA.preferredFoot)} {getFootName(compareA.preferredFoot)}</div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 text-right">
                <div>
                  <div className="font-bold text-sm text-zinc-100">{compareB.name[lang]}</div>
                  <div className="text-xs text-sky-400">{compareB.club[lang]} · {getPositionName(compareB.position)} · {compareB.marketValue} · {renderFootIcon(compareB.preferredFoot)} {getFootName(compareB.preferredFoot)}</div>
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
                    const scoreA = compareA.scoutingEngine?.roleScore ?? null;
                    const scoreB = compareB.scoutingEngine?.roleScore ?? null;
                    const c = renderComparisonCell(scoreA ?? -1, scoreB ?? -1, scoreA ?? '—', scoreB ?? '—');
                    return (
                      <tr className="hover:bg-zinc-850/50">
                        <td className={`py-2 px-4 font-mono ${c.classA}`}>{c.displayA}</td>
                        <td className="py-2 px-4 text-center text-zinc-400">{t.roleRatingComparisonLabel}</td>
                        <td className={`py-2 px-4 text-right font-mono ${c.classB}`}>{c.displayB}</td>
                      </tr>
                    );
                  })()}

                  <tr className="hover:bg-zinc-850/50">
                    <td className="py-2 px-4 font-mono text-emerald-400">
                      {compareA.scoutingEngine?.attackingScore === null || compareA.scoutingEngine?.attackingScore === undefined ? '—' : compareA.scoutingEngine.attackingScore}
                    </td>
                    <td className="py-2 px-4 text-center text-zinc-400">{t.attackingScoreLabel} (0-100)</td>
                    <td className="py-2 px-4 text-right font-mono text-sky-400">
                      {compareB.scoutingEngine?.attackingScore === null || compareB.scoutingEngine?.attackingScore === undefined ? '—' : compareB.scoutingEngine.attackingScore}
                    </td>
                  </tr>

                  <tr className="hover:bg-zinc-850/50">
                    <td className="py-2 px-4 text-zinc-300">
                      {compareA.scoutingEngine?.confidence === 'high' ? t.confidenceHigh : compareA.scoutingEngine?.confidence === 'medium' ? t.confidenceMedium : t.confidenceLow}
                    </td>
                    <td className="py-2 px-4 text-center text-zinc-400">{t.confidenceLabel}</td>
                    <td className="py-2 px-4 text-right text-zinc-300">
                      {compareB.scoutingEngine?.confidence === 'high' ? t.confidenceHigh : compareB.scoutingEngine?.confidence === 'medium' ? t.confidenceMedium : t.confidenceLow}
                    </td>
                  </tr>

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
                        const c = renderComparisonCell(compareA.duelWinRate, compareB.duelWinRate, compareA.duelWinRate === null ? '—' : `${compareA.duelWinRate}%`, compareB.duelWinRate === null ? '—' : `${compareB.duelWinRate}%`);
                        return (
                          <tr className="hover:bg-zinc-850/50">
                            <td className={`py-2 px-4 font-mono ${c.classA}`}>{c.displayA}</td>
                            <td className="py-2 px-4 text-center text-zinc-400">{t.duelPct}</td>
                            <td className={`py-2 px-4 text-right font-mono ${c.classB}`}>{c.displayB}</td>
                          </tr>
                        );
                      })()}
                      {(() => {
                        const c = renderComparisonCell(compareA.aerialWinRate, compareB.aerialWinRate, compareA.aerialWinRate === null ? '—' : `${compareA.aerialWinRate}%`, compareB.aerialWinRate === null ? '—' : `${compareB.aerialWinRate}%`);
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
                          compareA.dribbleSuccessRate === null ? `${compareA.dribbleWon} / ${compareA.dribbleTotal} (—)` : `${compareA.dribbleWon} / ${compareA.dribbleTotal} (${compareA.dribbleSuccessRate}%)`,
                          compareB.dribbleSuccessRate === null ? `${compareB.dribbleWon} / ${compareB.dribbleTotal} (—)` : `${compareB.dribbleWon} / ${compareB.dribbleTotal} (${compareB.dribbleSuccessRate}%)`
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
                        const c = renderComparisonCell(compareA.duelWinRate, compareB.duelWinRate, compareA.duelWinRate === null ? '—' : `${compareA.duelWinRate}%`, compareB.duelWinRate === null ? '—' : `${compareB.duelWinRate}%`);
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
                          compareA.dribbleSuccessRate === null ? `${compareA.dribbleWon} / ${compareA.dribbleTotal} (—)` : `${compareA.dribbleWon} / ${compareA.dribbleTotal} (${compareA.dribbleSuccessRate}%)`,
                          compareB.dribbleSuccessRate === null ? `${compareB.dribbleWon} / ${compareB.dribbleTotal} (—)` : `${compareB.dribbleWon} / ${compareB.dribbleTotal} (${compareB.dribbleSuccessRate}%)`
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