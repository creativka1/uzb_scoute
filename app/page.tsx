'use client';

import {CandidateLinkButton} from '@/components/football/decision-workspace';
import {useDecisionStore} from '@/hooks/use-decision-store';
import { PlayerDossier, PlayerPicker, PlayerComparison, PlayerAvatar, AnalysisDialog, CoverageLabel } from '@/components/football/player-analysis';
import { FootyStatsPanel } from '@/components/football/footystats-panel';
import { TeamWorkspace } from '@/components/football/match-workspace';
import { RoleAudit } from '@/components/football/role-audit';
import { rankPlayersForNeed, NEED_FIT_VERSION } from '@/lib/recruitment';
import React, { useState, useMemo, useEffect } from 'react';
import {
  Users,
  Sparkles,
  Search,
  X,
  ChevronRight,
  Loader2,
  Activity,
  BarChart3,
  SlidersHorizontal,
  RotateCcw,
  Bookmark,
  ArrowRight,
} from 'lucide-react';

import type { AnalysisLocation } from '@/types/matches';
import type { Position, AnalyticalRole, DetailedPosition, Language, League, SeasonMode, SortField, SortOrder, MainView, FootFilter, NationalityFilter, Player } from '@/types/players';

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
    filterPanelTitle: 'Futbolchilar bazasi filtrlari',
    filterPanelSub: 'Tez ko‘rish uchun oddiy filtrlar. Aniq tanlov uchun “Vazifa uchun qidiruv”dan foydalaning.',
    seasonSelectorLabel: 'Statistika davri:',
    seasonCurrentOption: '1 mavsum (Joriy mavsum)',
    seasonTwoOption: '2 mavsum (Oxirgi 2 mavsum)',
    filterLegionnaire: 'Faqat legionerlar',
    filterLegionnaireDesc: 'Xorijdagi futbolchilar va chet elliklar',
    filterU21: 'Faqat U21 iqtidorlar',
    filterExpiringContract: 'Shartnomasi 12 oy ichida tugaydi',
    filterMinMinutes: 'Kamida 450 daqiqa o‘ynaganlar',
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
    detailedPositionLabel: 'Aniq pozitsiya',
    detailedPositionNoData: 'Yetarli ma’lumot yo‘q',
    detailedPositionStarts: 'start',
    detailedPositionHeatmap: 'issiqlik xaritasi',
    recruitmentDetailedPosition: 'Maydondagi roli',
    allDetailedPositions: 'Barcha aniq pozitsiyalar',
    dposGK: 'Darvozabon',
    dposRB: 'O‘ng himoyachi',
    dposCB: 'Markaziy himoyachi',
    dposLB: 'Chap himoyachi',
    dposRWB: 'O‘ng qanot himoyachisi',
    dposLWB: 'Chap qanot himoyachisi',
    dposDM: 'Tayanch yarim himoyachi',
    dposCM: 'Markaziy yarim himoyachi',
    dposAM: 'Hujumkor yarim himoyachi',
    dposRM: 'O‘ng yarim himoyachi',
    dposLM: 'Chap yarim himoyachi',
    dposRW: 'O‘ng vinger',
    dposLW: 'Chap vinger',
    dposST: 'Markaziy hujumchi',
    roleGK: 'Darvozabon',
    roleDF: 'Himoyachi',
    roleMF: 'Yarim himoyachi',
    roleAM: 'Hujumkor yarim himoyachi',
    roleFW: 'Hujumchi',
    calculatedRoleNote: 'Platforma tomonidan real o‘yin metrikalaridan hisoblangan',
    recruitmentTitle: 'Futbolchi tanlash',
    recruitmentSub: 'Klub talablari bo‘yicha qisqa ro‘yxat — faqat mavjud real ma’lumotlar asosida',
    recruitmentPosition: 'Jamoa chizig‘i',
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
    sourceVsRoleHelp: 'Manba pozitsiyasi — umumiy kategoriya. Aniq pozitsiya faqat manba profilida bir ma’noli va zid bo‘lmagan ma’lumot mavjud bo‘lsa ko‘rsatiladi.',
    missingMetricsLabel: 'Ma’lumot yetishmaydigan metrikalar',
    liveLabel: 'JONLI',
    seasonCurrentShort: '1 MAVSUM',
    seasonTwoShort: '2 MAVSUM',
    statsCurrentSeason: 'Joriy mavsum',
    statsPreviousSeason: 'O‘tgan mavsum',
    statsTwoSeasons: '2 mavsum',
    profileSourceNote: 'Tasdiqlangan o‘yin ma’lumotlari asosidagi rol profili',
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
    filterPanelTitle: 'Фильтры базы игроков',
    filterPanelSub: 'Простые фильтры для просмотра базы. Для точного подбора используйте «Поиск под задачу».',
    seasonSelectorLabel: 'Выбор сезона статистики:',
    seasonCurrentOption: '1 сезон (Текущий сезон)',
    seasonTwoOption: '2 сезона (Суммарно за 2 сезона)',
    filterLegionnaire: 'Только легионеры',
    filterLegionnaireDesc: 'Игроки за рубежом и иностранцы в чемпионате',
    filterU21: 'Только игроки U21',
    filterExpiringContract: 'Контракт истекает в течение 12 месяцев',
    filterMinMinutes: 'Не менее 450 сыгранных минут',
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
    colAssists: 'Ассисты',
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
    keyPassesSeason: 'Ключевые передачи',
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
    assistWord: 'ассист',
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
    detailedPositionLabel: 'Точная позиция',
    detailedPositionNoData: 'Недостаточно данных',
    detailedPositionStarts: 'стартов',
    detailedPositionHeatmap: 'тепловая карта',
    recruitmentDetailedPosition: 'Роль на поле',
    allDetailedPositions: 'Все точные позиции',
    dposGK: 'Вратарь',
    dposRB: 'Правый защитник',
    dposCB: 'Центральный защитник',
    dposLB: 'Левый защитник',
    dposRWB: 'Правый латераль',
    dposLWB: 'Левый латераль',
    dposDM: 'Опорный полузащитник',
    dposCM: 'Центральный полузащитник',
    dposAM: 'Атакующий полузащитник',
    dposRM: 'Правый полузащитник',
    dposLM: 'Левый полузащитник',
    dposRW: 'Правый вингер',
    dposLW: 'Левый вингер',
    dposST: 'Центральный нападающий',
    roleGK: 'Вратарь',
    roleDF: 'Защитник',
    roleMF: 'Полузащитник',
    roleAM: 'Атакующий полузащитник',
    roleFW: 'Нападающий',
    calculatedRoleNote: 'Рассчитано платформой только из доступных игровых метрик',
    recruitmentTitle: 'Подбор игроков',
    recruitmentSub: 'Короткий список кандидатов под требования клуба — только по имеющимся реальным данным',
    recruitmentPosition: 'Линия команды',
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
    sourceVsRoleHelp: 'Позиция источника — общая категория. Точная позиция показывается только при однозначных непротиворечивых данных профиля источника. Расчёты по порядку состава не считаются подтверждением.',
    missingMetricsLabel: 'Метрики без данных',
    liveLabel: 'ОНЛАЙН',
    seasonCurrentShort: '1 СЕЗОН',
    seasonTwoShort: '2 СЕЗОНА',
    statsCurrentSeason: 'Текущий сезон',
    statsPreviousSeason: 'Прошлый сезон',
    statsTwoSeasons: '2 сезона',
    profileSourceNote: 'Ролевой профиль по подтверждённым матчевым данным',
    directCompareHint: 'Нажмите для прямого сравнения',
    roleRatingComparisonLabel: 'Ролевой рейтинг (0–100, не абсолютная оценка)',
  },
};

function nullableRateNumber(value: number | null, denominator: number): number | null {
  return value === null || denominator <= 0 ? null : Number((value / denominator).toFixed(1));
}
function nullableRate(value: number | null, denominator: number): string {
  return nullableRateNumber(value, denominator)?.toFixed(1) ?? '—';
}
function nullableSum(a: number | null, b: number | null): number | null {
  return a === null || b === null ? null : a + b;
}
function isContractExpiring(contractUntil: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(contractUntil)) return false;
  const expiry = new Date(`${contractUntil}T00:00:00Z`);
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const horizon = new Date(Date.UTC(now.getUTCFullYear() + 1, now.getUTCMonth(), now.getUTCDate()));
  return Number.isFinite(expiry.getTime()) && expiry >= today && expiry <= horizon;
}

function getScoutBadgeColor(score: number | null): string {
  if (score === null) return 'bg-zinc-800/60 border-zinc-700 text-zinc-400';
  if (score >= 75) return 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400';
  if (score >= 60) return 'bg-amber-500/10 border-amber-500/40 text-amber-400';
  return 'bg-rose-500/10 border-rose-500/40 text-rose-400';
}

function PlayerHeadshot({ url, name, initials, size = 'md' }: { url: string; name: string; initials: string; size?: 'sm' | 'md' | 'lg' }) {
  const [attempt, setAttempt] = useState(0);
  useEffect(() => setAttempt(0), [url]);
  const dims = { sm: 'h-10 w-10', md: 'h-12 w-12', lg: 'h-20 w-20' }[size];

  const sources = useMemo(() => {
    if (!url) return [];
    const fallback = url.includes('img.sofascore.com')
      ? url.replace('img.sofascore.com', 'api.sofascore.com')
      : url.replace('api.sofascore.com', 'img.sofascore.com');
    return fallback !== url ? [url, fallback] : [url];
  }, [url]);

  if (!sources.length || attempt >= sources.length) {
    return (
      <div className={`${dims} rounded-full bg-zinc-800 border-2 border-emerald-500/40 flex items-center justify-center font-bold text-emerald-400 text-sm shadow-md shrink-0`}>
        {initials}
      </div>
    );
  }

  return (
    <img
      src={sources[attempt]}
      alt={name}
      onError={() => setAttempt((current) => current + 1)}
      className={`${dims} rounded-full object-cover border-2 border-emerald-500/40 shadow-lg bg-zinc-900 shrink-0`}
    />
  );
}

export default function Dashboard() {
  const [lang, setLang] = useState<Language>('uz');
  const [activeView, setActiveView] = useState<MainView>('players');
  const t = TRANSLATIONS[lang];

  // ВЫБОР ЛИГИ И РЕЖИМА СЕЗОНА
  const [currentLeague, setCurrentLeague] = useState<League>('UZB');
  const [seasonMode, setSeasonMode] = useState<SeasonMode>('latest');

  const [players, setPlayers] = useState<Player[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [periodLabel, setPeriodLabel] = useState('');
  const [coverageComplete, setCoverageComplete] = useState(false);

  const [savedCandidates, setSavedCandidates] = useState<Pick<Player, 'id' | 'name'>[]>([]);
  const [savedReady, setSavedReady] = useState(false);
  const [saveError, setSaveError] = useState(false);
  useEffect(() => {
    try {
      const value = JSON.parse(localStorage.getItem('uzstat.shortlist.v1') || '[]');
      if (!Array.isArray(value) || value.some(p => typeof p?.id !== 'string' || typeof p?.name?.ru !== 'string' || typeof p?.name?.uz !== 'string')) throw new Error('Invalid saved candidates');
      setSavedCandidates(value);
      setSavedReady(true);
    } catch { setSaveError(true); }
  }, []);
  useEffect(() => {
    if (!savedReady) return;
    try { localStorage.setItem('uzstat.shortlist.v1', JSON.stringify(savedCandidates)); setSaveError(false); }
    catch { setSaveError(true); }
  }, [savedCandidates, savedReady]);
  const saveCandidates = (items: Player[]) => setSavedCandidates(previous => {
    const unique = new Map(previous.map(p => [p.id, p]));
    items.forEach(p => unique.set(p.id, { id: p.id, name: p.name }));
    return [...unique.values()];
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(40);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterU21, setFilterU21] = useState(false);
  const [filterClub, setFilterClub] = useState('all');
  const [filterPosition, setFilterPosition] = useState('all');

  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const [analysisSelection,setAnalysisSelection]=useState<AnalysisLocation|null>(null);
  const [recruitmentContext,setRecruitmentContext]=useState('');
  const [activeNeedId,setActiveNeedId]=useState<string|null>(null);
  const {store:decisionStore}=useDecisionStore();
  const activeNeed=decisionStore.needs.find(n=>n.id===activeNeedId);
  const needRankedCandidates = useMemo(() => rankPlayersForNeed(activeNeed, players), [activeNeed, players]);
  const needFitByPlayerId = useMemo(() => new Map(needRankedCandidates.map(item => [item.player.id, item])), [needRankedCandidates]);

  const [inspectionPlayers,setInspectionPlayers]=useState<Player[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [pickingOpponentFor, setPickingOpponentFor] = useState<Player | null>(null);
  const [compareA, setCompareA] = useState<Player | null>(null);
  const [compareB, setCompareB] = useState<Player | null>(null);

  // ЭТАП 4: RECRUITMENT ENGINE
  const [recruitmentPosition, setRecruitmentPosition] = useState<'all' | Position>('all');
  const [recruitmentDetailedPosition, setRecruitmentDetailedPosition] = useState<'all' | DetailedPosition>('all');
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
    setLoadError(false);
    setPlayers([]);
    setPeriodLabel('');
    setCoverageComplete(false);
    setSelectedPlayer(null);
    setCompareA(null);
    setCompareB(null);
    setPickingOpponentFor(null);

    fetch(`/api/players?season=${seasonMode}&league=${currentLeague}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`Player API: ${res.status}`);
        const metadata = JSON.parse(res.headers.get('X-Data-Metadata') || '{}');
        const period = metadata.periods?.[currentLeague];
        if (isMounted) {
          setPeriodLabel(period?.label || '—');
          setCoverageComplete(period?.complete === true);
        }
        const data = await res.json();
        if (!Array.isArray(data)) throw new Error('Invalid player response');
        return data;
      })
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
        if (isMounted) { setPlayers([]); setLoadError(true); setIsLoading(false); }
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
      default: return '—';
    }
  };

  const getAnalyticalRoleName = (role: AnalyticalRole) => {
    switch (role) {
      case 'GOALKEEPER': return t.roleGK;
      case 'DEFENDER': return t.roleDF;
      case 'MIDFIELDER': return t.roleMF;
      case 'ATTACKING_MIDFIELDER': return t.roleAM;
      case 'FORWARD': return t.roleFW;
      default: return '—';
    }
  };

  const getDetailedPositionName = (position: DetailedPosition | null) => {
    switch (position) {
      case 'GK': return t.dposGK;
      case 'RB': return t.dposRB;
      case 'CB': return t.dposCB;
      case 'LB': return t.dposLB;
      case 'RWB': return t.dposRWB;
      case 'LWB': return t.dposLWB;
      case 'DM': return t.dposDM;
      case 'CM': return t.dposCM;
      case 'AM': return t.dposAM;
      case 'RM': return t.dposRM;
      case 'LM': return t.dposLM;
      case 'RW': return t.dposRW;
      case 'LW': return t.dposLW;
      case 'ST': return t.dposST;
      default: return t.detailedPositionNoData;
    }
  };

  const getFootName = (foot: string) => {
    if (foot === 'Right') return t.footRight;
    if (foot === 'Left') return t.footLeft;
    if (foot === 'Both') return t.footBoth;
    return t.footUnknown;
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
    if (filterU21) count++;
    if (filterClub !== 'all') count++;
    if (filterPosition !== 'all') count++;
    return count;
  }, [filterU21, filterClub, filterPosition]);

  const handleResetAllFilters = () => {
    setFilterU21(false);
    setFilterClub('all');
    setFilterPosition('all');
    setSearchQuery('');
  };

  const filteredAndSortedPlayers = useMemo(() => {
    const list = players.filter((player) => {
      const pName = player.name?.[lang]?.toLowerCase() || '';
      const pClub = player.club?.[lang]?.toLowerCase() || '';
      const q = searchQuery.toLowerCase();
      const matchSearch = pName.includes(q) || pClub.includes(q);

      const matchU21 = !filterU21 || player.isU21;
      const matchClub = filterClub === 'all' || player.club?.[lang] === filterClub;
      const matchPos = filterPosition === 'all' || player.position === filterPosition;

      return matchSearch && matchU21 && matchClub && matchPos;
    });

    if (sortField) {
      list.sort((a, b) => {
        const read = (p: Player) => sortField === 'value' ? p.rawMarketValueEUR : sortField === 'age' ? p.age : p.scoutingEngine?.roleScore ?? null;
        const valA = read(a), valB = read(b);
        if (valA === null) return valB === null ? 0 : 1;
        if (valB === null) return -1;
        return sortOrder === 'desc' ? valB - valA : valA - valB;
      });
    }

    return list;
  }, [players, searchQuery, filterU21, filterClub, filterPosition, sortField, sortOrder, lang]);

  useEffect(() => setVisibleCount(40), [players, searchQuery, filterClub, filterPosition, filterU21, sortField, sortOrder]);

  const hasRecruitmentCriteria = useMemo(() => {
    return (
      recruitmentPosition !== 'all' ||
      recruitmentDetailedPosition !== 'all' ||
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
    recruitmentDetailedPosition,
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
        if (!activeNeed && recruitmentPosition !== 'all' && p.sourcePosition !== recruitmentPosition) return false;
        if (!activeNeed && recruitmentDetailedPosition !== 'all' && p.detailedPosition !== recruitmentDetailedPosition) return false;
        if (recruitmentFoot !== 'all' && p.preferredFoot !== recruitmentFoot) return false;
        if (recruitmentNationality === 'local' && p.isLegionnaire !== false) return false;
        if (recruitmentNationality === 'legionnaire' && p.isLegionnaire !== true) return false;
        if (maxAge !== null && Number.isFinite(maxAge) && (p.age === null || p.age > maxAge)) return false;

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
        const needFit = activeNeed ? needFitByPlayerId.get(p.id) : null;
        if (activeNeed && !needFit) return null;
        if (needFit) {
          reasons.push(lang === 'ru' ? `Fit к потребности: ${needFit.fitScore}/100` : `Ehtiyojga moslik: ${needFit.fitScore}/100`);
          for (const item of needFit.reasons) {
            const [kind,a,b,c] = item.split(':');
            if (kind === 'profile') reasons.push(lang === 'ru' ? `Профиль Fit: ${a}` : `Fit profili: ${a}`);
            if (kind === 'profileScore') reasons.push(lang === 'ru' ? `Ролевой профиль: ${a}/100` : `Rol profili: ${a}/100`);
            if (kind === 'profileCoverage') reasons.push(lang === 'ru' ? `Покрытие профильных метрик: ${a}%` : `Profil metrikalari qamrovi: ${a}%`);
            if (kind === 'metric') reasons.push(lang === 'ru' ? `${a}: ${b}-й процентиль · вес ${c}%` : `${a}: ${b}-percentil · vazn ${c}%`);
            if (kind === 'profileFallback') reasons.push(lang === 'ru' ? 'Мало профильных метрик: использован общий ролевой рейтинг' : 'Profil metrikalari kam: umumiy rol reytingi ishlatildi');
            if (kind === 'exact') reasons.push(lang === 'ru' ? `Точная роль: ${a}` : `Aniq rol: ${a}`);
            if (kind === 'role') reasons.push(lang === 'ru' ? `Общий ролевой рейтинг: ${a}` : `Umumiy rol reytingi: ${a}`);
            if (kind === 'minutes') reasons.push(lang === 'ru' ? `${a} минут в выборке` : `Tanlovda ${a} daqiqa`);
            if (kind === 'confidence') reasons.push(lang === 'ru' ? `Надёжность: ${a}` : `Ishonchlilik: ${a}`);
            if (kind === 'strength') reasons.push(lang === 'ru' ? `${a}: ${b}-й процентиль` : `${a}: ${b}-percentil`);
          }
        }
        if (recruitmentPosition !== 'all') reasons.push(getPositionName(p.sourcePosition));
        if (recruitmentDetailedPosition !== 'all') reasons.push(getDetailedPositionName(p.detailedPosition));
        if (recruitmentFoot !== 'all') reasons.push(getFootName(p.preferredFoot));
        if (recruitmentNationality !== 'all') reasons.push(p.isLegionnaire ? t.statusLegionnaire : t.statusLocal);
        if (maxAge !== null && Number.isFinite(maxAge)) reasons.push(lang === 'ru' ? `Возраст ${p.age ?? '—'} ≤ ${maxAge}` : `Yosh ${p.age ?? '—'} ≤ ${maxAge}`);
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

        return { player: p, reasons, fitScore: needFit?.fitScore ?? null, fitReasons: needFit?.reasons ?? [], fitVersion: needFit?.fitVersion ?? null };
      })
      .filter((item): item is {player: Player; reasons: string[]; fitScore: number|null; fitReasons: string[]; fitVersion: typeof NEED_FIT_VERSION|null} => item !== null)
      .sort((a, b) => {
        if (activeNeed) {
          const fitDiff = (b.fitScore ?? -1) - (a.fitScore ?? -1);
          if (fitDiff !== 0) return fitDiff;
        }
        const scoreA = a.player.scoutingEngine?.roleScore ?? -1;
        const scoreB = b.player.scoutingEngine?.roleScore ?? -1;
        if (scoreB !== scoreA) return scoreB - scoreA;
        return (b.player.scoutingEngine?.attackingScore ?? -1) - (a.player.scoutingEngine?.attackingScore ?? -1);
      });
  }, [
    players,
    hasRecruitmentCriteria,
    recruitmentPosition,
    recruitmentDetailedPosition,
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
    activeNeed,
    needFitByPlayerId,
    lang,
  ]);

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

    const escapeHtml = (value: unknown) => String(value ?? '—').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]!));
    const reportMetrics = player.position === 'GK'
      ? [[p.saves, 'saves', player.saves], [p.passAccuracy, 'passAccPct', player.passAccPct]]
      : [[p.goals, 'goals', player.goals], [p.assists, 'assists', player.assists], [p.shots, 'shots', player.shots],
         [p.keyPasses, 'keyPasses', player.keyPasses], [p.dribbling, 'dribbleSuccessRate', player.dribbleSuccessRate],
         [p.tackles90, 'tackles', player.roleMetrics?.tacklesPer90], [p.interceptions90, 'interceptions', player.roleMetrics?.interceptionsPer90],
         [p.passAccuracy, 'passAccPct', player.passAccPct]];
    const statRows = reportMetrics.map(([label, key, value]) => {
      const d = player.statsMetricDetails?.[String(key)];
      const coverage = d ? `${d.matches}/${d.totalMatches} ${lang==='ru'?'матчей':'o‘yin'}; ${d.minutes} ${lang==='ru'?'покрытых минут':'qamrab olingan daqiqa'}` : '—';
      const displayed = typeof value === 'number' ? Number(value.toFixed(2)) : '—';
      return `<tr><td>${escapeHtml(label)}</td><td>${escapeHtml(displayed)}<br/><small>${escapeHtml(coverage)}</small></td></tr>`;
    }).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="${lang}">
        <head>
          <title>${p.title} — ${escapeHtml(player.name[lang])}</title>
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
              <img class="photo" src="${escapeHtml(player.photoUrl)}" alt="${escapeHtml(player.name[lang])}" onerror="this.style.display='none'" />
              <div>
                <h1 class="title">${escapeHtml(player.name[lang])}</h1>
                <div class="meta">${escapeHtml(player.club[lang])} | ${getPositionName(player.position)} | #${player.number ?? '—'} | ${player.age ?? '—'} ${t.years} | ${t.footLabel} ${getFootName(player.preferredFoot)}</div>
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
              <div class="card-title">${p.playingTimeContract} (${player.statsSeasonLabel} · ${lang === 'ru' ? 'По загруженным матчам' : 'Yuklangan o‘yinlar bo‘yicha'})</div>
              <div class="card-val">${player.matchesPlayed} ${t.matchWord} (${player.minutesPlayed}') | ${p.until}: ${player.contractUntil}</div>
            </div>
          </div>
          <p>${lang==='ru'?'Частичная выборка по загруженным матчам. Покрытие указано отдельно для каждого показателя. Индекс — предварительная расчётная оценка.':'Yuklangan o‘yinlarning qisman tanlovi. Qamrov har bir ko‘rsatkich uchun alohida. Indeks — dastlabki hisoblangan baho.'}</p>
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

  return (
    <main className="football-workspace min-h-screen selection:bg-emerald-500 selection:text-black">
      <header className="workspace-header">
        <a href="#" className="brand" aria-label="UzStat"><span className="brand-mark"><BarChart3 size={23} /></span><span>Uzstat<small>FOOTBALL INTELLIGENCE</small></span></a>
        <nav className="workspace-nav" aria-label={lang === 'ru' ? 'Основная навигация' : 'Asosiy navigatsiya'}>
          <button aria-current={activeView === 'players' ? 'page' : undefined} onClick={() => setActiveView('players')}><Users size={17} />{t.tabPlayers}</button>
          <button aria-current={activeView === 'recruitment' ? 'page' : undefined} onClick={() => setActiveView('recruitment')}><Search size={17} />{lang === 'ru' ? 'Поиск под задачу' : 'Vazifa uchun qidiruv'}</button>
          <button aria-current={activeView === 'team' ? 'page' : undefined} onClick={()=>{setAnalysisSelection(null);setActiveView('team');}}><Activity size={17}/>{lang==='ru'?'Команда и матчи':'Jamoa va o‘yinlar'}</button>
          <button aria-current={activeView === 'saved' ? 'page' : undefined} onClick={() => setActiveView('saved')}><Bookmark size={17} />{lang === 'ru' ? 'Сохранённые' : 'Saqlanganlar'}<span className="nav-count">{savedCandidates.length}</span></button>
        </nav>
        <div className="language-switch" aria-label={lang === 'ru' ? 'Язык' : 'Til'}>{(['uz', 'ru'] as Language[]).map(l => <button key={l} aria-pressed={lang === l} onClick={() => setLang(l)}>{l.toUpperCase()}</button>)}</div>
      </header>
      <section className="workspace-intro">
        <div><span className="eyebrow">{lang === 'ru' ? 'РАБОЧЕЕ ПРОСТРАНСТВО АНАЛИТИКА' : 'TAHLILCHINING ISH MAYDONI'}</span>
          <h1>{activeView === 'team' ? (lang==='ru'?'Поймите игру своей команды.':'Jamoangiz o‘yinini tushuning.') : activeView === 'players' ? (lang === 'ru' ? 'Начните с игрока.' : 'Futbolchidan boshlang.') : activeView === 'saved' ? (lang === 'ru' ? 'Игроки, к которым стоит вернуться.' : 'Qayta ko‘rib chiqiladigan futbolchilar.') : (lang === 'ru' ? 'Найдите игрока под свою задачу.' : 'Vazifangizga mos futbolchini toping.')}</h1>
          <p>{activeView === 'team' ? (lang==='ru'?'Откройте матч, проверьте вклад игроков и сохраните вывод.':'O‘yinni oching, futbolchilar hissasini tekshiring va xulosani saqlang.') : activeView === 'players' ? (lang === 'ru' ? 'Изучите показатели, откройте профиль и сравните игроков.' : 'Ko‘rsatkichlarni o‘rganing, profilni oching va futbolchilarni taqqoslang.') : activeView === 'saved' ? (lang === 'ru' ? 'Ваш список сохраняется в этом браузере и не зависит от фильтров.' : 'Ro‘yxatingiz shu brauzerda saqlanadi va filtrlarga bog‘liq emas.') : (lang === 'ru' ? 'Укажите роль, возраст и бюджет. Остальные условия — по необходимости.' : 'Pozitsiya, yosh va byudjetni belgilang. Qolgan shartlar — zaruratga ko‘ra.')}</p>
        </div>
      </section>
      <div className="scope-toolbar">
        <label>{lang === 'ru' ? 'Чемпионат' : 'Chempionat'}<select value={currentLeague} onChange={e => { setCurrentLeague(e.target.value as League);setAnalysisSelection(null);setRecruitmentContext('');setActiveNeedId(null); setFilterClub('all'); }}><option value="UZB">{t.leagueUZB}</option><option value="KAZ">{t.leagueKAZ}</option></select></label>
        {activeView!=='team'&&<label>{lang === 'ru' ? 'Период' : 'Davr'}<select value={seasonMode} onChange={e => setSeasonMode(e.target.value as SeasonMode)}><option value="latest">{lang === 'ru' ? 'Последний доступный сезон' : 'Oxirgi mavjud mavsum'}</option><option value="current">{t.statsCurrentSeason}</option><option value="previous">{t.statsPreviousSeason}</option><option value="two">{t.statsTwoSeasons}</option></select></label>}
        {activeView!=='team'&&<div className="scope-summary"><strong>{isLoading ? '…' : periodLabel || '—'}</strong><span>{isLoading ? t.loading : `${players.length} ${lang === 'ru' ? 'игроков с данными' : 'futbolchida ma’lumot bor'}`}</span></div>}
      </div>
      {activeView!=='team' && !isLoading && !loadError && !coverageComplete && <div className="coverage-note"><span>{lang === 'ru' ? 'Неполные данные' : 'Ma’lumot to‘liq emas'}</span></div>}
      {loadError && <p role="alert" className="error-notice">{lang === 'ru' ? 'Не удалось загрузить данные. Выберите период ещё раз.' : 'Ma’lumot yuklanmadi. Davrni qayta tanlang.'}</p>}
      {saveError && <p role="alert" className="error-notice">{lang === 'ru' ? 'Не удалось прочитать или сохранить список в браузере. Существующее сохранение не перезаписано.' : 'Brauzerdagi ro‘yxatni o‘qish yoki saqlash imkoni bo‘lmadi. Mavjud saqlanma o‘zgartirilmagan.'}</p>}
      {activeView==='team'&&<TeamWorkspace key={`${currentLeague}:${seasonMode}`} initialSelection={analysisSelection} league={currentLeague} seasonMode={seasonMode} lang={lang}
        onRecruit={(pos,period,team,need)=>{setActiveNeedId(need?.id||null);setAnalysisSelection(null);setRecruitmentPosition(pos);setRecruitmentDetailedPosition(need?.detailedPosition||'all');setSeasonMode(period);setRecruitmentContext(team);setActiveView('recruitment');if(pos==='GK'){setRecruitmentMinAttackScore('');setRecruitmentMinGoals90('');setRecruitmentMinAssists90('');setRecruitmentMinShots90('');setRecruitmentMinKeyPasses90('');setRecruitmentMinDribble('');}}}
        onPlayer={(player,pool)=>{setInspectionPlayers(pool);setSelectedPlayer(player);}}/>}
      {activeView === 'saved' && <section className="saved-workspace"><div className="section-heading"><h2>{lang === 'ru' ? 'Ваш список' : 'Sizning ro‘yxatingiz'}</h2><span>{savedCandidates.length}</span></div>{!savedCandidates.length ? <div className="workspace-empty"><Bookmark size={30} /><h3>{lang === 'ru' ? 'Здесь появятся сохранённые игроки' : 'Saqlangan futbolchilar shu yerda ko‘rinadi'}</h3><p>{lang === 'ru' ? 'Откройте профиль и нажмите «Сохранить».' : 'Profilni oching va «Saqlash»ni bosing.'}</p><button className="action-primary" onClick={() => setActiveView('players')}>{lang === 'ru' ? 'Посмотреть игроков' : 'Futbolchilarni ko‘rish'}<ArrowRight size={16} /></button></div> : <div className="saved-grid">{savedCandidates.map(saved => { const player = players.find(p => p.id === saved.id); return <article className="saved-card" key={saved.id}><div className="saved-card-main">{player ? <PlayerAvatar player={player} lang={lang} /> : <span className="player-avatar"><Bookmark size={18} /></span>}<div><h3>{saved.name[lang]}</h3><p>{player ? player.club[lang] : (lang === 'ru' ? 'Нет данных в выбранной лиге и периоде' : 'Tanlangan liga va davrda ma’lumot yo‘q')}</p></div></div><div className="saved-card-actions"><button className="action-secondary" disabled={!player} onClick={() => { if(player) setSelectedPlayer(player); }}>{lang === 'ru' ? 'Открыть профиль' : 'Profilni ochish'}<ChevronRight size={15} /></button><button className="icon-button" aria-label={`${lang === 'ru' ? 'Удалить из сохранённых:' : 'Saqlanganlardan o‘chirish:'} ${saved.name[lang]}`} onClick={() => setSavedCandidates(items => items.filter(p => p.id !== saved.id))}><X size={16} /></button></div></article>; })}</div>}</section>}
      <FootyStatsPanel league={currentLeague} lang={lang}/>
      {activeView==='recruitment'&&<RoleAudit players={players} lang={lang} onPlayer={setSelectedPlayer}/>}
      {activeView === 'players' && (<>
      {!isLoading&&players.length>0&&<section className="featured-section"><div className="section-heading"><h2>{lang==='ru'?'Игроки в фокусе':'Diqqatdagi futbolchilar'}</h2><span>{periodLabel}</span></div><div className="featured-grid">{players.filter(p=>p.scoutingEngine.roleScore!==null&&p.minutesPlayed>=450).sort((a,b)=>(b.scoutingEngine.roleScore??0)-(a.scoutingEngine.roleScore??0)).slice(0,4).map(p=><button className="featured-player" key={p.id} onClick={()=>setSelectedPlayer(p)}><div className="featured-top"><PlayerAvatar player={p} lang={lang}/><span className="rating-tile">{p.scoutingEngine.roleScore}</span></div><h3>{p.name[lang]}</h3><p>{p.club[lang]}</p><div className="featured-meta"><span>{p.detailedPosition||p.position}</span><small>{p.age??'—'} · {p.matchesPlayed} {lang==='ru'?'игр':'o‘yin'}<br/>{p.minutesPlayed} {lang==='ru'?'мин':'daq'}</small></div></button>)}</div><p className="muted">{lang==='ru'?'По скаутскому индексу · минимум 450 минут · широкие позиции сравниваются в отдельных группах.':'Skaut indeksi bo‘yicha · kamida 450 daqiqa · umumiy pozitsiyalar alohida guruhlarda taqqoslanadi.'}</p></section>}
      <div className="position-pills" role="group" aria-label={lang==='ru'?'Амплуа':'Amplua'}>{[['all',lang==='ru'?'Все':'Barchasi'],['FW',lang==='ru'?'Нападающие':'Hujumchilar'],['MF',lang==='ru'?'Полузащитники':'Yarim himoyachilar'],['DF',lang==='ru'?'Защитники':'Himoyachilar'],['GK',lang==='ru'?'Вратари':'Darvozabonlar']].map(([v,label])=><button key={v} aria-pressed={filterPosition===v} onClick={()=>setFilterPosition(v)}>{label}</button>)}</div>
      <div className="player-toolbar"><label className="search-field"><Search size={18} /><input type="search" placeholder={t.searchPlaceholder} aria-label={t.searchPlaceholder} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} /></label>
        <button className="action-secondary" onClick={() => setIsFilterOpen(true)}><SlidersHorizontal size={17} />{t.filtersBtn}{activeFiltersCount > 0 ? ` · ${activeFiltersCount}` : ''}</button>
        <label className="sort-select">{lang === 'ru' ? 'Порядок' : 'Tartib'}<select value={sortField ? `${sortField}:${sortOrder}` : 'default'} onChange={e => { if(e.target.value === 'default') setSortField(null); else {const [field,order] = e.target.value.split(':'); setSortField(field as SortField); setSortOrder(order as SortOrder);} }}><option value="default">{lang === 'ru' ? 'Исходный список' : 'Boshlang‘ich ro‘yxat'}</option><option value="age:asc">{lang === 'ru' ? 'Сначала младше' : 'Avval yoshlar'}</option><option value="value:asc">{lang === 'ru' ? 'Сначала дешевле' : 'Avval arzonroqlar'}</option><option value="value:desc">{lang === 'ru' ? 'Сначала дороже' : 'Avval qimmatroqlar'}</option><option value="scout:desc">{lang === 'ru' ? 'По скаутскому индексу' : 'Skaut indeksi bo‘yicha'}</option></select></label>
      </div>
      <div className="results-caption"><span>{lang === 'ru' ? 'Найдено игроков' : 'Topilgan futbolchilar'}: <strong>{filteredAndSortedPlayers.length}</strong></span>{activeFiltersCount > 0 && <button onClick={handleResetAllFilters}>{t.resetFilters}<X size={13} /></button>}</div>
      </>)}

      {activeView === 'recruitment' && (
      <>
      {/* RECRUITMENT */}
      {activeNeed&&<div className="analysis-card recruitment-need"><div className="section-heading"><div><strong>{activeNeed.observation}</strong><p>{activeNeed.requirement}</p></div><span className="context-chip">{lang==='ru'?'Автоподбор':'Avto tanlov'} · {needRankedCandidates.length}</span></div><small>{activeNeed.detailedPosition||activeNeed.position} · {activeNeed.seasonName}</small><p className="muted">{lang==='ru'?'Fit использует отдельный профиль роли (GK / CB / FB-WB / DM / CM / AM / winger / ST), игровое время, надёжность выборки и точное совпадение позиции. Отсутствующая метрика не считается нулём: веса доступных метрик перенормируются. Это приоритизация для просмотра, а не прогноз успешности трансфера.':'Fit alohida rol profili (GK / CB / FB-WB / DM / CM / AM / winger / ST), o‘yin vaqti, tanlov ishonchliligi va aniq pozitsiya mosligini hisobga oladi. Yetishmayotgan metrika nol hisoblanmaydi: mavjud metrikalar vazni qayta normallashtiriladi. Bu transfer muvaffaqiyati prognozi emas.'}</p></div>}
      {recruitmentContext&&<div className="recruitment-context"><span>{lang==='ru'?'Усиление для':'Kuchaytirish uchun'}: <strong>{recruitmentContext}</strong></span><button className="text-link" onClick={()=>{setAnalysisSelection(null);setActiveView('team');}}>← {lang==='ru'?'К команде':'Jamoaga'}</button><button className="icon-button" aria-label={lang==='ru'?'Убрать контекст команды':'Jamoa kontekstini olib tashlash'} onClick={()=>{setRecruitmentContext('');setActiveNeedId(null);}}><X size={14}/></button></div>}
      <section className="recruitment-panel max-w-7xl mx-auto mb-5 rounded-xl border border-zinc-800 bg-zinc-900/70 p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-zinc-800 pb-4 mb-4">
          <div className="flex items-start gap-2.5">
            <Search className="h-5 w-5 text-sky-400 mt-0.5" />
            <div>
              <h2 className="text-sm font-bold text-white">{t.recruitmentTitle}</h2>
              <p className="text-[11px] text-zinc-400 mt-0.5">{t.recruitmentSub}</p>

            </div>
          </div>
          <button
            onClick={() => {
              setRecruitmentPosition('all');
              setRecruitmentDetailedPosition('all');
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

        <div className="primary-filter-grid">
          <label>{t.recruitmentPosition}<select value={recruitmentPosition} onChange={e => {setRecruitmentPosition(e.target.value as 'all' | Position); setRecruitmentDetailedPosition('all'); if(e.target.value === 'GK') {setRecruitmentMinAttackScore('');setRecruitmentMinGoals90('');setRecruitmentMinAssists90('');setRecruitmentMinShots90('');setRecruitmentMinKeyPasses90('');setRecruitmentMinDribble('');}}}><option value="all">{t.allPositions}</option>{(['GK','DF','MF','FW'] as Position[]).map(pos => <option key={pos} value={pos}>{getPositionName(pos)}</option>)}</select></label>
          <label>{t.recruitmentDetailedPosition}<select value={recruitmentDetailedPosition} onChange={e => setRecruitmentDetailedPosition(e.target.value as 'all' | DetailedPosition)}><option value="all">{t.allDetailedPositions}</option>{(Object.entries({GK:['GK'],DF:['RB','CB','LB','RWB','LWB'],MF:['DM','CM','AM','RM','LM','RW','LW','RWB','LWB'],FW:['ST','RW','LW','AM']}).filter(([pos]) => recruitmentPosition === 'all' || recruitmentPosition === pos).flatMap(([,roles]) => roles).filter((role,index,list) => list.indexOf(role) === index) as DetailedPosition[]).map(role => <option key={role} value={role}>{getDetailedPositionName(role)}</option>)}</select></label>
          <label>{t.recruitmentMaxAge}<input type="number" min="15" max="60" value={recruitmentMaxAge} onChange={e => setRecruitmentMaxAge(e.target.value)} placeholder={lang === 'ru' ? 'Без ограничения' : 'Cheklanmagan'} /></label>
          <label>{t.recruitmentMaxBudget}<input type="number" min="0" step="25000" value={recruitmentMaxBudget} onChange={e => setRecruitmentMaxBudget(e.target.value)} placeholder={lang === 'ru' ? 'Без ограничения' : 'Cheklanmagan'} /></label>
          <label>{t.recruitmentMinMinutes}<input type="number" min="0" step="90" value={recruitmentMinMinutes} onChange={e => setRecruitmentMinMinutes(e.target.value)} placeholder={lang === 'ru' ? 'Любое время' : 'Istalgan vaqt'} /></label>
          <label>{t.recruitmentFoot}<select value={recruitmentFoot} onChange={e => setRecruitmentFoot(e.target.value as FootFilter)}><option value="all">{t.statusAll}</option><option value="Right">{t.footRight}</option><option value="Left">{t.footLeft}</option><option value="Both">{t.footBoth}</option></select></label>
        </div>
        <details className="filter-disclosure"><summary>{lang === 'ru' ? 'Дополнительные условия' : 'Qo‘shimcha shartlar'}</summary><div className="extra-filter-grid">
          <label>{t.recruitmentNationality}<select value={recruitmentNationality} onChange={e => setRecruitmentNationality(e.target.value as NationalityFilter)}><option value="all">{t.statusAll}</option><option value="local">{t.statusLocal}</option><option value="legionnaire">{t.statusLegionnaire}</option></select></label>
          <label>{t.recruitmentMinBudget}<input type="number" min="0" step="25000" value={recruitmentMinBudget} onChange={e => setRecruitmentMinBudget(e.target.value)} placeholder="—" /></label>
          <label>{t.recruitmentMinRole}<input type="number" min="0" max="100" value={recruitmentMinRoleScore} onChange={e => setRecruitmentMinRoleScore(e.target.value)} placeholder="—" /></label>
          {recruitmentPosition !== 'GK' && <label>{t.recruitmentMinAttack}<input type="number" min="0" max="100" value={recruitmentMinAttackScore} onChange={e => setRecruitmentMinAttackScore(e.target.value)} placeholder="—" /></label>}
        </div><div className="filter-checkboxes"><label><input type="checkbox" checked={recruitmentExpiring} onChange={e => setRecruitmentExpiring(e.target.checked)} />{t.recruitmentExpiring}</label><label><input type="checkbox" checked={recruitmentReliableOnly} onChange={e => setRecruitmentReliableOnly(e.target.checked)} />{t.recruitmentReliable}</label></div><p>{t.sourceVsRoleHelp} {t.unknownValueExcluded}</p></details>
        <details className="filter-disclosure"><summary>{lang === 'ru' ? 'Фильтры по игровым показателям' : 'O‘yin ko‘rsatkichlari bo‘yicha filtrlar'}</summary><div className="extra-filter-grid">
          {recruitmentPosition !== 'GK' && <>
            <label>{t.minGoals90}<input type="number" min="0" step="0.01" value={recruitmentMinGoals90} onChange={e => setRecruitmentMinGoals90(e.target.value)} placeholder="—" /></label>
            <label>{t.minAssists90}<input type="number" min="0" step="0.01" value={recruitmentMinAssists90} onChange={e => setRecruitmentMinAssists90(e.target.value)} placeholder="—" /></label>
            <label>{t.minShots90}<input type="number" min="0" step="0.01" value={recruitmentMinShots90} onChange={e => setRecruitmentMinShots90(e.target.value)} placeholder="—" /></label>
            <label>{t.minKeyPasses90}<input type="number" min="0" step="0.01" value={recruitmentMinKeyPasses90} onChange={e => setRecruitmentMinKeyPasses90(e.target.value)} placeholder="—" /></label>
            <label>{t.minDribble}<input type="number" min="0" max="100" value={recruitmentMinDribble} onChange={e => setRecruitmentMinDribble(e.target.value)} placeholder="—" /></label>
          </>}
          <label>{t.minPassAcc}<input type="number" min="0" max="100" value={recruitmentMinPassAcc} onChange={e => setRecruitmentMinPassAcc(e.target.value)} placeholder="—" /></label>
        </div><p>{lang === 'ru' ? '«За 90 минут» позволяет сравнивать игроков с разным игровым временем. При неполном покрытии выводы предварительные.' : '«90 daqiqa hisobida» o‘yin vaqti turlicha futbolchilarni taqqoslashga yordam beradi. Qamrov to‘liq bo‘lmasa, xulosalar dastlabki.'}</p></details>

        <div className="mt-5 pt-4 border-t border-zinc-800">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-zinc-200">{lang === 'ru' ? 'Результаты поиска' : 'Qidiruv natijalari'}</h3>
            <div className="flex items-center gap-3"><span className="text-sm text-zinc-400">{recruitmentCandidates.length}</span><button className="action-secondary" disabled={!savedReady || !recruitmentCandidates.length} onClick={() => saveCandidates(recruitmentCandidates.map(item => item.player))}><Bookmark size={15} />{lang === 'ru' ? 'Сохранить результаты' : 'Natijalarni saqlash'}</button></div>
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
              {recruitmentCandidates.map(({ player, reasons, fitScore, fitReasons, fitVersion }) => (
                <article key={player.id} className="recruitment-result"><button
                  onClick={() => { setSelectedPlayer(player); }}
                  className="w-full text-left rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 hover:border-sky-500/40 hover:bg-zinc-900 transition"
                >
                  <div className="flex items-center gap-3">
                    <PlayerHeadshot url={player.photoUrl} name={player.name[lang]} initials={player.initials} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-sm text-white truncate">{player.name[lang]}</div>
                      <div className="text-[10px] text-zinc-400 truncate">
                        {player.club[lang]} · {player.age ?? '—'} {t.years} · {player.marketValue}
                      </div>
                      <div className="text-[10px] text-sky-400 mt-0.5">
                        {getPositionName(player.sourcePosition)}{player.detailedPosition ? ` · ${getDetailedPositionName(player.detailedPosition)}` : ''}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-bold text-emerald-400">{activeNeed ? (fitScore ?? '—') : (player.scoutingEngine?.roleScore ?? '—')}</div>
                      <div className="text-[9px] text-zinc-500">{activeNeed ? 'Fit / 100' : t.roleScoreLabel}</div>
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
                </button>{activeNeedId&&<CandidateLinkButton needId={activeNeedId} player={player} lang={lang} fitScore={fitScore ?? undefined} fitReasons={fitReasons} fitVersion={fitVersion ?? undefined}/>}</article>
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
      <div className="player-table-shell">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-16 text-zinc-400">
            <Loader2 className="h-9 w-9 animate-spin text-emerald-400 mb-3" />
            <span className="text-sm font-medium">{t.loading}</span>
          </div>
        ) : filteredAndSortedPlayers.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-16 text-zinc-500">
            <span className="text-sm">{t.noData}</span><p className="mt-3 text-xs text-zinc-400">{players.length === 0 ? (lang === 'ru' ? 'Попробуйте последний доступный сезон.' : 'Oxirgi mavjud mavsumni tanlab ko‘ring.') : (lang === 'ru' ? 'Измените поиск или сбросьте фильтры.' : 'Qidiruvni o‘zgartiring yoki filtrlarni tozalang.')}</p>
          </div>
        ) : (
          <table className="player-table">
            <thead className="bg-zinc-950/80 border-b border-zinc-800 text-zinc-400 uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4 font-semibold">{t.colPlayer}</th>
                <th className="py-3.5 px-3 font-semibold">{t.colClub}</th>
                <th className="py-3.5 px-3 font-semibold">{t.colPosition}</th>
                <th className="py-3.5 px-3 font-semibold">{t.colMatchesAndMin}</th>
                <th className="py-3.5 px-3 font-semibold">{t.colGoals}</th>
                <th className="py-3.5 px-3 font-semibold">{t.colAssists}</th><th>{lang==='ru'?'Скаутский индекс':'Skaut indeksi'}</th>

                <th><span className="sr-only">{lang === 'ru' ? 'Профиль' : 'Profil'}</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/80">
              {filteredAndSortedPlayers.slice(0, visibleCount).map((player, idx) => (
                <tr
                  key={`${player.id}-${idx}`}
                  onClick={() => { setSelectedPlayer(player); }}
                  className="cursor-pointer hover:bg-zinc-850/60 transition-colors"
                >
                  <td className="py-3 px-4"><div className="flex items-center gap-3.5">
                    <PlayerHeadshot url={player.photoUrl} name={player.name[lang]} initials={player.initials} size="sm" />
                    <div>
                      <div className="font-semibold text-white flex items-center gap-1.5">
                        <button className="player-name" onClick={e => { e.stopPropagation(); setSelectedPlayer(player); }}>{player.name[lang]}</button>
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
                        {player.isEstimatedMarketValue ? '~' : ''}{player.marketValue} · <span className="text-zinc-400">{player.age ?? '—'} {t.years}</span>
                      </div>
                    </div>
                  </div></td>
                  <td className="py-3 px-3 font-medium text-zinc-200">{player.club[lang]}</td>
                  <td className="py-3 px-3">
                    <span className="rounded bg-zinc-800/90 border border-zinc-700/60 px-2 py-0.5 text-[10px] font-semibold text-zinc-200">
                      {getPositionName(player.sourcePosition)}
                    </span>
                    {player.detailedPosition && (
                      <span className="block mt-1 text-[10px] text-sky-400">
                        {getDetailedPositionName(player.detailedPosition)}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-3 font-mono text-zinc-300">
                    <strong className="block text-white font-semibold">{player.matchesPlayed}</strong>
                    <span className="block text-zinc-500 text-[11px]">{player.minutesPlayed} {lang==='ru'?'мин':'daq'}</span>
                  </td>
                  <td className="py-3 px-3 font-mono">
                    <strong className="text-white text-sm">{player.goals ?? '—'}</strong>{player.statsMetricDetails?.goals?.status==='partial'&&<small className="metric-coverage partial">{lang==='ru'?'Частично':'Qisman'}</small>}
                  </td>
                  <td className="py-3 px-3 font-mono">
                    <strong className="text-white text-sm">{player.assists ?? '—'}</strong>{player.statsMetricDetails?.assists?.status==='partial'&&<small className="metric-coverage partial">{lang==='ru'?'Частично':'Qisman'}</small>}
                  </td>
                  <td><strong className="table-index">{player.scoutingEngine.roleScore??'—'}</strong><small className="metric-coverage">{player.scoutingEngine.metricCoverage} / {player.scoutingEngine.totalRoleMetrics} {lang==='ru'?'метрик':'ko‘rsatkich'}</small></td><td><button className="icon-button" aria-label={`${lang === 'ru' ? 'Открыть профиль:' : 'Profilni ochish:'} ${player.name[lang]}`} onClick={e => {e.stopPropagation(); setSelectedPlayer(player);}}><ChevronRight size={18} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      </>
      )}

      {activeView === 'players' && !isLoading && filteredAndSortedPlayers.length > 0 && <div className="table-footer"><span>{lang === 'ru' ? 'Показано' : 'Ko‘rsatilgan'} {Math.min(visibleCount, filteredAndSortedPlayers.length)} / {filteredAndSortedPlayers.length}</span>{visibleCount < filteredAndSortedPlayers.length && <button className="action-secondary" onClick={() => setVisibleCount(n => n + 40)}>{lang === 'ru' ? 'Показать ещё' : 'Yana ko‘rsatish'}</button>}</div>}

      {/* МОДАЛКА НАСТРОЙКИ ФИЛЬТРОВ И ВЫБОРА СЕЗОНА */}
      {isFilterOpen && (
        <AnalysisDialog title={t.filterPanelTitle} lang={lang} onClose={() => setIsFilterOpen(false)} narrow>
          <div className="filter-dialog-content">
            <p className="filter-dialog-hint">{t.filterPanelSub}</p>
            <div className="space-y-4">
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
                aria-label={t.applyFilters}
                className="px-5 py-2.5 rounded-lg bg-emerald-600 text-xs font-bold text-white shadow-lg shadow-emerald-600/30 hover:bg-emerald-500 transition"
              >
                {t.applyFilters}
              </button>
            </div>
          </div>
        </AnalysisDialog>
      )}

      {selectedPlayer && <PlayerDossier key={selectedPlayer.id} player={selectedPlayer} players={[...players,...inspectionPlayers.filter(p=>!players.some(x=>x.id===p.id&&JSON.stringify(x.statsSeasonIds)===JSON.stringify(p.statsSeasonIds)))]} lang={lang}
        saved={savedCandidates.some(p => p.id === selectedPlayer.id)} canSave={savedReady} onSave={() => saveCandidates([selectedPlayer])}
        onCompare={() => handleOpenPicker(selectedPlayer)} onCompareReplacement={handleCompareWithReplacement}
        onOpenMatch={location=>{setSelectedPlayer(null);setCurrentLeague(location.league);setAnalysisSelection(location);setActiveView('team');}}
        onPrint={() => handlePrintPdf(selectedPlayer)} onClose={() => setSelectedPlayer(null)}
        detailedLabel={getDetailedPositionName(selectedPlayer.detailedPosition)} footLabel={getFootName(selectedPlayer.preferredFoot)} />}
      {pickingOpponentFor && <PlayerPicker player={pickingOpponentFor} players={[...players,...inspectionPlayers.filter(p=>!players.some(x=>x.id===p.id&&JSON.stringify(x.statsSeasonIds)===JSON.stringify(p.statsSeasonIds)))]} lang={lang} onChoose={handleSelectOpponent}
        onClose={() => { setSelectedPlayer(pickingOpponentFor); setPickingOpponentFor(null); }} />}
      {compareA && compareB && <PlayerComparison primary={compareA} other={compareB} players={[...players,...inspectionPlayers.filter(p=>!players.some(x=>x.id===p.id&&JSON.stringify(x.statsSeasonIds)===JSON.stringify(p.statsSeasonIds)))]} lang={lang} onChange={setCompareB}
        onClose={() => { setSelectedPlayer(compareA); setCompareA(null); setCompareB(null); }} />}
    </main>
  );
}
