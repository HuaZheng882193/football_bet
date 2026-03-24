import { useEffect, useMemo, useState } from "react";
import { getCachedJson } from "./apiCache";
import {
  buildBookmakerSummary,
  buildDailyTrendSeries,
  enrichBet,
  filterBetsByRecentDays,
  formatCurrency,
  UNCLASSIFIED_LEAGUE
} from "./betAnalytics";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";
const BETS_CACHE_KEY = "bets:list";
const CACHE_TTL_BETS_MS = 30_000;
const CACHE_SWR_BETS_MS = 120_000;

function formatDateTime(value) {
  if (!value) {
    return "--";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(date);
}

function StatCard({ title, value, subtitle, accent = "#38bdf8" }) {
  return (
    <div
      style={{
        padding: "16px",
        borderRadius: "12px",
        border: "1px solid var(--border-divider)",
        background: "var(--bg-card-strong)"
      }}
    >
      <div style={{ color: "var(--text-tertiary)", fontSize: "12px", marginBottom: "10px" }}>{title}</div>
      <div style={{ color: accent, fontSize: "28px", fontWeight: 700, lineHeight: 1.2 }}>{value}</div>
      {subtitle ? <div style={{ color: "var(--text-secondary)", marginTop: "8px", fontSize: "13px" }}>{subtitle}</div> : null}
    </div>
  );
}

function TrendChart({ data }) {
  if (!data.length) {
    return <div className="status-panel">暂无趋势数据</div>;
  }

  const width = 860;
  const height = 250;
  const padding = 28;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const values = data.flatMap((item) => [item.dailyProfit, item.cumulativeProfit, 0]);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const range = maxValue - minValue || 1;

  const getX = (index) => {
    if (data.length <= 1) {
      return padding + chartWidth / 2;
    }
    return padding + (index / (data.length - 1)) * chartWidth;
  };

  const getY = (value) => {
    const normalized = (value - minValue) / range;
    return padding + (1 - normalized) * chartHeight;
  };

  const buildPath = (field) =>
    data
      .map((item, index) => `${index === 0 ? "M" : "L"} ${getX(index)} ${getY(item[field])}`)
      .join(" ");

  const zeroY = getY(0);

  return (
    <div
      style={{
        border: "1px solid var(--border-divider)",
        borderRadius: "12px",
        background: "var(--bg-card-strong)",
        padding: "12px",
        overflowX: "auto"
      }}
    >
      <svg width={width} height={height} role="img" aria-label="盈亏趋势图">
        <line x1={padding} y1={zeroY} x2={width - padding} y2={zeroY} stroke="rgba(148,163,184,0.35)" strokeDasharray="4 4" />
        <path d={buildPath("dailyProfit")} fill="none" stroke="#22c55e" strokeWidth="2.5" />
        <path d={buildPath("cumulativeProfit")} fill="none" stroke="#38bdf8" strokeWidth="2.5" />
      </svg>
      <div style={{ display: "flex", gap: "16px", padding: "0 8px 8px", color: "var(--text-secondary)", fontSize: "13px" }}>
        <span><strong style={{ color: "#22c55e" }}>当日</strong>已实现盈亏</span>
        <span><strong style={{ color: "#38bdf8" }}>累计</strong>已实现盈亏</span>
      </div>
    </div>
  );
}

export default function BookmakerDashboard() {
  const [bets, setBets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [days, setDays] = useState("7");
  const [marketFilter, setMarketFilter] = useState("all");
  const [bookmakerFilter, setBookmakerFilter] = useState("all");
  const [leagueFilter, setLeagueFilter] = useState("all");
  const [refreshing, setRefreshing] = useState(false);

  async function loadBets(options = {}) {
    const { forceRefresh = false } = options;
    try {
      const data = await getCachedJson(`${API_BASE_URL}/bets`, {
        cacheKey: BETS_CACHE_KEY,
        ttlMs: CACHE_TTL_BETS_MS,
        swrMs: CACHE_SWR_BETS_MS,
        forceRefresh,
        onRevalidate: (latest) => setBets(Array.isArray(latest) ? latest : [])
      });
      setBets(Array.isArray(data) ? data : []);
      setError("");
    } catch (err) {
      setError(err.message || "加载投注数据失败");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    let disposed = false;

    async function load() {
      try {
        const data = await getCachedJson(`${API_BASE_URL}/bets`, {
          cacheKey: BETS_CACHE_KEY,
          ttlMs: CACHE_TTL_BETS_MS,
          swrMs: CACHE_SWR_BETS_MS,
          onRevalidate: (latest) => {
            if (!disposed) {
              setBets(Array.isArray(latest) ? latest : []);
            }
          }
        });
        if (!disposed) {
          setBets(Array.isArray(data) ? data : []);
          setError("");
        }
      } catch (err) {
        if (!disposed) {
          setError(err.message || "加载投注数据失败");
        }
      } finally {
        if (!disposed) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      disposed = true;
    };
  }, []);

  const enrichedBets = useMemo(() => bets.map(enrichBet), [bets]);

  const leagues = useMemo(
    () => Array.from(new Set(enrichedBets.map((bet) => bet.league))).sort(),
    [enrichedBets]
  );
  const markets = useMemo(
    () => Array.from(new Set(enrichedBets.map((bet) => bet.market).filter(Boolean))).sort(),
    [enrichedBets]
  );
  const bookmakers = useMemo(
    () => Array.from(new Set(enrichedBets.map((bet) => bet.bookmaker).filter(Boolean))).sort(),
    [enrichedBets]
  );

  const filteredBets = useMemo(() => {
    const byDimension = enrichedBets.filter((bet) => {
      if (leagueFilter !== "all" && bet.league !== leagueFilter) {
        return false;
      }
      if (marketFilter !== "all" && bet.market !== marketFilter) {
        return false;
      }
      if (bookmakerFilter !== "all" && bet.bookmaker !== bookmakerFilter) {
        return false;
      }
      return true;
    });

    return filterBetsByRecentDays(byDimension, days);
  }, [enrichedBets, leagueFilter, marketFilter, bookmakerFilter, days]);

  const summary = useMemo(() => buildBookmakerSummary(filteredBets), [filteredBets]);
  const trendSeries = useMemo(
    () => buildDailyTrendSeries(filteredBets, days === "all" ? 30 : Number(days)),
    [filteredBets, days]
  );

  const settledRows = useMemo(
    () =>
      filteredBets
        .filter((bet) => bet.status !== "unsettled")
        .sort((a, b) => (b.houseProfit || 0) - (a.houseProfit || 0))
        .slice(0, 10),
    [filteredBets]
  );

  return (
    <div className="admin-panel" style={{ padding: "20px" }}>
      <header style={{ display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "center", marginBottom: "20px", flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "32px" }}>庄家盈亏看板</h1>
          <p style={{ margin: "8px 0 0", color: "var(--text-secondary)" }}>
            聚焦已结算盈亏、未结算风险敞口与利润趋势。
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setRefreshing(true);
            loadBets({ forceRefresh: true });
          }}
          disabled={refreshing}
          style={{
            padding: "10px 14px",
            borderRadius: "8px",
            border: "1px solid var(--border-divider)",
            background: "var(--bg-inset)",
            color: "var(--text-primary)",
            cursor: refreshing ? "not-allowed" : "pointer"
          }}
        >
          {refreshing ? "刷新中..." : "刷新数据"}
        </button>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(180px, 1fr))", gap: "12px", marginBottom: "14px" }}>
        <select value={days} onChange={(e) => setDays(e.target.value)} style={{ padding: "10px", borderRadius: "8px", background: "var(--bg-inset)", color: "var(--text-primary)", border: "1px solid var(--border-divider)" }}>
          <option value="7">近 7 天</option>
          <option value="30">近 30 天</option>
          <option value="90">近 90 天</option>
          <option value="all">全部时间</option>
        </select>
        <select value={leagueFilter} onChange={(e) => setLeagueFilter(e.target.value)} style={{ padding: "10px", borderRadius: "8px", background: "var(--bg-inset)", color: "var(--text-primary)", border: "1px solid var(--border-divider)" }}>
          <option value="all">全部联赛</option>
          {leagues.map((league) => (
            <option key={league} value={league}>
              {league === UNCLASSIFIED_LEAGUE ? "未分类联赛（历史数据）" : league}
            </option>
          ))}
        </select>
        <select value={marketFilter} onChange={(e) => setMarketFilter(e.target.value)} style={{ padding: "10px", borderRadius: "8px", background: "var(--bg-inset)", color: "var(--text-primary)", border: "1px solid var(--border-divider)" }}>
          <option value="all">全部盘口</option>
          {markets.map((market) => (
            <option key={market} value={market}>{market}</option>
          ))}
        </select>
        <select value={bookmakerFilter} onChange={(e) => setBookmakerFilter(e.target.value)} style={{ padding: "10px", borderRadius: "8px", background: "var(--bg-inset)", color: "var(--text-primary)", border: "1px solid var(--border-divider)" }}>
          <option value="all">全部机构</option>
          {bookmakers.map((bookmaker) => (
            <option key={bookmaker} value={bookmaker}>{bookmaker}</option>
          ))}
        </select>
      </div>

      {error ? <div className="status-panel status-panel--error">{error}</div> : null}
      {loading ? <div className="status-panel">正在加载看板数据...</div> : null}

      {!loading && !error ? (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(220px, 1fr))", gap: "12px", marginBottom: "14px" }}>
            <StatCard title="已实现盈亏" value={formatCurrency(summary.realizedProfit)} subtitle={`ROI ${summary.roi.toFixed(2)}%`} accent={summary.realizedProfit >= 0 ? "#22c55e" : "#ef4444"} />
            <StatCard title="总赔付金额" value={formatCurrency(summary.totalPayout)} subtitle={`已结算投注额 ${formatCurrency(summary.settledStake)}`} accent="#38bdf8" />
            <StatCard title="已结算 / 未结算" value={`${summary.settledCount} / ${summary.unsettledCount}`} subtitle={`结算率 ${summary.settlementRate.toFixed(2)}%`} accent="#f59e0b" />
            <StatCard title="总投注额" value={formatCurrency(summary.totalStake)} subtitle={`当前筛选 ${filteredBets.length} 条记录`} accent="#a78bfa" />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(280px, 1fr))", gap: "12px", marginBottom: "16px" }}>
            <StatCard title="潜在最大盈利（未结算全输）" value={formatCurrency(summary.potentialMaxProfit)} accent="#22c55e" />
            <StatCard title="潜在最大亏损（未结算全赢）" value={formatCurrency(summary.potentialMaxLoss)} accent="#ef4444" />
          </div>

          <TrendChart data={trendSeries} />

          <div style={{ marginTop: "16px", border: "1px solid var(--border-divider)", borderRadius: "12px", background: "var(--bg-card-strong)", overflowX: "auto" }}>
            <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border-divider)", color: "var(--text-secondary)" }}>
              已结算投注（按庄家盈亏前 10）
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "14px" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-divider)", color: "var(--text-tertiary)" }}>
                  <th style={{ padding: "12px 16px" }}>时间</th>
                  <th style={{ padding: "12px 16px" }}>投注人</th>
                  <th style={{ padding: "12px 16px" }}>赛事</th>
                  <th style={{ padding: "12px 16px" }}>投注选择</th>
                  <th style={{ padding: "12px 16px", textAlign: "right" }}>投注额</th>
                  <th style={{ padding: "12px 16px", textAlign: "right" }}>赔付额</th>
                  <th style={{ padding: "12px 16px", textAlign: "right" }}>庄家盈亏</th>
                </tr>
              </thead>
              <tbody>
                {settledRows.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ padding: "18px 16px", color: "var(--text-secondary)", textAlign: "center" }}>
                      当前筛选条件下暂无已结算投注。
                    </td>
                  </tr>
                ) : (
                  settledRows.map((bet) => (
                    <tr key={bet.id} style={{ borderBottom: "1px solid rgba(148, 163, 184, 0.08)" }}>
                      <td style={{ padding: "12px 16px", color: "var(--text-secondary)" }}>{formatDateTime(bet.settledAt || bet.time)}</td>
                      <td style={{ padding: "12px 16px", color: "var(--text-primary)", fontWeight: 600 }}>{bet.bettor || "匿名"}</td>
                      <td style={{ padding: "12px 16px", color: "var(--text-primary)" }}>{bet.fixture || "--"}</td>
                      <td style={{ padding: "12px 16px", color: "var(--text-secondary)" }}>{bet.selection || "--"}</td>
                      <td style={{ padding: "12px 16px", textAlign: "right" }}>{formatCurrency(bet.stake)}</td>
                      <td style={{ padding: "12px 16px", textAlign: "right" }}>{formatCurrency(bet.payout || 0)}</td>
                      <td style={{ padding: "12px 16px", textAlign: "right", color: (bet.houseProfit || 0) >= 0 ? "#22c55e" : "#ef4444", fontWeight: 700 }}>
                        {formatCurrency(bet.houseProfit || 0)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  );
}
