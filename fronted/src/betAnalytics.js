function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function normalizeBetStatus(status) {
  return status || "unsettled";
}

export const UNCLASSIFIED_LEAGUE = "未分类联赛";

export function enrichBet(rawBet) {
  const status = normalizeBetStatus(rawBet.status);
  const stake = toNumber(rawBet.stake, 0);
  const price = toNumber(rawBet.price, 0);
  const rawLeague = typeof rawBet.league === "string" ? rawBet.league.trim() : "";
  const league =
    !rawLeague || rawLeague.toLowerCase() === "unknown"
      ? UNCLASSIFIED_LEAGUE
      : rawLeague;

  let payout = null;
  let houseProfit = null;

  if (status === "win") {
    payout = roundMoney(rawBet.payout ?? stake * price);
    houseProfit = roundMoney(rawBet.house_profit ?? stake - payout);
  } else if (status === "lose") {
    payout = roundMoney(rawBet.payout ?? 0);
    houseProfit = roundMoney(rawBet.house_profit ?? stake);
  } else if (status === "void") {
    payout = roundMoney(rawBet.payout ?? stake);
    houseProfit = roundMoney(rawBet.house_profit ?? 0);
  }

  const potentialLiability = roundMoney(Math.max(0, stake * Math.max(0, price - 1)));

  return {
    ...rawBet,
    status,
    stake,
    price,
    payout,
    houseProfit,
    potentialLiability,
    league,
    settledAt: rawBet.settled_at || null
  };
}

function getTimeForBet(bet) {
  const primary = bet.settledAt || bet.time;
  const date = primary ? new Date(primary) : null;
  if (!date || Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
}

export function filterBetsByRecentDays(bets, days) {
  if (days === "all") {
    return bets;
  }

  const dayCount = Number(days);
  if (!Number.isFinite(dayCount) || dayCount <= 0) {
    return bets;
  }

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (dayCount - 1));
  const startMs = start.getTime();

  return bets.filter((bet) => {
    const time = getTimeForBet(bet);
    return time ? time.getTime() >= startMs : false;
  });
}

function parseScore(selection) {
  if (typeof selection !== "string") return null;
  const parts = selection.split(":");
  if (parts.length !== 2) return null;
  const h = parseInt(parts[0], 10);
  const a = parseInt(parts[1], 10);
  if (Number.isNaN(h) || Number.isNaN(a)) return null;
  return { h, a };
}

function calculateMaxMatchPayout(matchBets) {
  if (!matchBets || matchBets.length === 0) return 0;

  const correctScoreBets = [];
  const standardBets = [];
  const spreadsBets = [];
  const totalsBets = [];

  matchBets.forEach((bet) => {
    const market = bet.market || "";
    const payout = toNumber(bet.stake, 0) * toNumber(bet.price, 0);

    if (market === "精确比分") {
      correctScoreBets.push({ ...bet, payout });
    } else if (market === "标准盘") {
      standardBets.push({ ...bet, payout });
    } else if (market === "让球") {
      spreadsBets.push({ ...bet, payout });
    } else if (market === "进球数") {
      totalsBets.push({ ...bet, payout });
    } else {
      standardBets.push({ ...bet, payout });
    }
  });

  const getStandardSum = (sel) =>
    standardBets
      .filter((b) => b.selection === sel)
      .reduce((sum, b) => sum + b.payout, 0);

  const getSpreadsSum = (sel) =>
    spreadsBets
      .filter((b) => b.selection === sel)
      .reduce((sum, b) => sum + b.payout, 0);

  const getCorrectScoreMax = (conditionFn) => {
    const scoreGroups = {};
    let unparsedSum = 0;
    correctScoreBets.forEach((b) => {
      const score = parseScore(b.selection);
      if (score) {
        if (conditionFn(score.h, score.a)) {
          scoreGroups[b.selection] = (scoreGroups[b.selection] || 0) + b.payout;
        }
      } else {
        unparsedSum += b.payout;
      }
    });
    const groupSums = Object.values(scoreGroups);
    return (groupSums.length > 0 ? Math.max(...groupSums) : 0) + unparsedSum;
  };

  const totalsOverSum = totalsBets
    .filter((b) => b.selection === "高于")
    .reduce((sum, b) => sum + b.payout, 0);
  const totalsUnderSum = totalsBets
    .filter((b) => b.selection === "低于")
    .reduce((sum, b) => sum + b.payout, 0);
  const maxTotalsPayout = Math.max(totalsOverSum, totalsUnderSum);

  const payoutHomeWin =
    getCorrectScoreMax((h, a) => h > a) +
    getStandardSum("胜") +
    getSpreadsSum("胜") +
    maxTotalsPayout;

  const payoutDraw =
    getCorrectScoreMax((h, a) => h === a) +
    getStandardSum("平") +
    Math.max(getSpreadsSum("胜"), getSpreadsSum("负")) +
    maxTotalsPayout;

  const payoutAwayWin =
    getCorrectScoreMax((h, a) => h < a) +
    getStandardSum("负") +
    getSpreadsSum("负") +
    maxTotalsPayout;

  return Math.max(payoutHomeWin, payoutDraw, payoutAwayWin);
}

export function buildBookmakerSummary(bets) {
  let totalStake = 0;
  let settledStake = 0;
  let totalPayout = 0;
  let realizedProfit = 0;
  let unsettledStake = 0;
  let settledCount = 0;
  let unsettledCount = 0;
  const unsettledBetsByMatch = {};
  let unknownMatchCounter = 0;

  bets.forEach((bet) => {
    totalStake += bet.stake;

    if (bet.status === "unsettled") {
      unsettledCount += 1;
      unsettledStake += bet.stake;
      const matchKey = bet.matchId || bet.fixture || `unknown_match_${unknownMatchCounter++}`;
      if (!unsettledBetsByMatch[matchKey]) {
        unsettledBetsByMatch[matchKey] = [];
      }
      unsettledBetsByMatch[matchKey].push(bet);
      return;
    }

    settledCount += 1;
    settledStake += bet.stake;
    totalPayout += toNumber(bet.payout, 0);
    realizedProfit += toNumber(bet.houseProfit, 0);
  });

  let overallWorstProfit = 0;
  Object.values(unsettledBetsByMatch).forEach((matchBets) => {
    const matchStake = matchBets.reduce((sum, b) => sum + toNumber(b.stake, 0), 0);
    const maxPayout = calculateMaxMatchPayout(matchBets);
    overallWorstProfit += (matchStake - maxPayout);
  });

  const settlementRate =
    bets.length > 0 ? roundMoney((settledCount / bets.length) * 100) : 0;

  const roi =
    settledStake > 0 ? roundMoney((realizedProfit / settledStake) * 100) : 0;

  return {
    totalStake: roundMoney(totalStake),
    settledStake: roundMoney(settledStake),
    totalPayout: roundMoney(totalPayout),
    realizedProfit: roundMoney(realizedProfit),
    roi,
    settledCount,
    unsettledCount,
    settlementRate,
    potentialMaxProfit: roundMoney(unsettledStake),
    potentialMaxLoss: roundMoney(Math.min(0, overallWorstProfit))
  };
}

function toDayKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function buildDailyTrendSeries(bets, days = 7) {
  const dayCount = Number.isFinite(Number(days)) ? Number(days) : 7;
  const safeDayCount = dayCount > 0 ? dayCount : 7;
  const map = new Map();

  const end = new Date();
  end.setHours(0, 0, 0, 0);

  for (let i = safeDayCount - 1; i >= 0; i -= 1) {
    const day = new Date(end);
    day.setDate(end.getDate() - i);
    map.set(toDayKey(day), { day: toDayKey(day), dailyProfit: 0, cumulativeProfit: 0 });
  }

  bets.forEach((bet) => {
    if (bet.status === "unsettled") {
      return;
    }

    const time = getTimeForBet(bet);
    if (!time) {
      return;
    }
    const key = toDayKey(time);
    const entry = map.get(key);
    if (!entry) {
      return;
    }
    entry.dailyProfit = roundMoney(entry.dailyProfit + toNumber(bet.houseProfit, 0));
  });

  let cumulative = 0;
  for (const entry of map.values()) {
    cumulative += entry.dailyProfit;
    entry.cumulativeProfit = roundMoney(cumulative);
  }

  return Array.from(map.values());
}

export function formatCurrency(value) {
  const amount = toNumber(value, 0);
  return `¥${amount.toFixed(2)}`;
}
