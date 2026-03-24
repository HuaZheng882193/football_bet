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

export function buildBookmakerSummary(bets) {
  let totalStake = 0;
  let settledStake = 0;
  let totalPayout = 0;
  let realizedProfit = 0;
  let unsettledStake = 0;
  let potentialMaxLoss = 0;
  let settledCount = 0;
  let unsettledCount = 0;

  bets.forEach((bet) => {
    totalStake += bet.stake;

    if (bet.status === "unsettled") {
      unsettledCount += 1;
      unsettledStake += bet.stake;
      potentialMaxLoss += bet.potentialLiability;
      return;
    }

    settledCount += 1;
    settledStake += bet.stake;
    totalPayout += toNumber(bet.payout, 0);
    realizedProfit += toNumber(bet.houseProfit, 0);
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
    potentialMaxLoss: roundMoney(-potentialMaxLoss)
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
