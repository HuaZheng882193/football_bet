import { useEffect, useMemo, useState } from "react";
import Admin from "./Admin";
import BookmakerDashboard from "./BookmakerDashboard";
import { getCachedJson, invalidateCachedJsonByPrefix } from "./apiCache";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";
const DEFAULT_SPORT = "soccer_china_superleague";
const DEFAULT_MARKETS = "h2h,spreads,totals";
const DEFAULT_REGIONS = "us,uk,au";
const SPORTS_CACHE_KEY = "sports:list";
const CACHE_TTL_ODDS_MS = 20_000;
const CACHE_SWR_ODDS_MS = 40_000;
const CACHE_TTL_SPORTS_MS = 5 * 60_000;
const CACHE_SWR_SPORTS_MS = 10 * 60_000;

function buildOddsCacheKey(sport) {
  return `odds:${sport}:${DEFAULT_REGIONS}:${DEFAULT_MARKETS}:parsed`;
}

function formatDateTime(value) {
  if (!value) {
    return "--";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatPrice(value) {
  if (value === null || value === undefined) {
    return "--";
  }
  return String(value);
}

function getBadgeTone(index) {
  return index % 2 === 0 ? "accent" : "muted";
}

function buildHandicap(spreads) {
  if (!spreads?.length) {
    return ["--", "--", "--"];
  }

  const primary = spreads[0];
  const opposite = spreads[1];
  return [
    primary?.point ?? "--",
    formatPrice(primary?.price),
    formatPrice(opposite?.price),
  ];
}

function buildTotals(totals) {
  if (!totals?.length) {
    return ["--", "--", "--"];
  }

  const over = totals.find((item) => item.name === "Over") || totals[0];
  const under = totals.find((item) => item.name === "Under") || totals[1];
  return [
    over?.point ?? under?.point ?? "--",
    formatPrice(over?.price),
    formatPrice(under?.price),
  ];
}

function normalizeMatch(match) {
  return {
    id: match.id,
    time: formatDateTime(match.commence_time),
    fixture: `${match.home_team} 对阵 ${match.away_team}`,
    league: match.sport_title || DEFAULT_SPORT,
    rows: (match.bookmakers || []).map((row, index) => ({
      bookmaker: row.bookmaker,
      badge: row.bookmaker?.slice(0, 1)?.toUpperCase() || "?",
      badgeTone: getBadgeTone(index),
      oneXTwo: [
        formatPrice(row.home),
        formatPrice(row.draw),
        formatPrice(row.away),
      ],
      handicap: buildHandicap(row.spreads),
      totals: buildTotals(row.totals),
    })),
  };
}

async function fetchOddsBySport(sport, options = {}) {
  const { forceRefresh = false, onRevalidate } = options;
  const params = new URLSearchParams({
    sport,
    regions: DEFAULT_REGIONS,
    markets: DEFAULT_MARKETS,
    parsed: "true",
  });

  const url = `${API_BASE_URL}/odds?${params.toString()}`;
  const data = await getCachedJson(url, {
    cacheKey: buildOddsCacheKey(sport),
    ttlMs: CACHE_TTL_ODDS_MS,
    swrMs: CACHE_SWR_ODDS_MS,
    forceRefresh,
    onRevalidate: (latest) => {
      onRevalidate?.(latest.map(normalizeMatch));
    },
  });

  return data.map(normalizeMatch);
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20L16.65 16.65" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3V15" />
      <path d="M7 10L12 15L17 10" />
      <path d="M5 21H19" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 9L12 15L18 9" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M18 6L6 18" />
      <path d="M6 6L18 18" />
    </svg>
  );
}

function OddsCell({ label, value, className = "", isSelected, onClick }) {
  const isClickable =
    value !== "--" && value !== null && value !== undefined && !!onClick;

  if (!isClickable) {
    return (
      <div className={`odds-cell ${className}`.trim()} data-label={label}>
        <span>{value}</span>
      </div>
    );
  }

  return (
    <button
      type="button"
      className={`odds-cell odds-cell--clickable ${isSelected ? "is-selected" : ""} ${className}`.trim()}
      data-label={label}
      onClick={onClick}>
      <span>{value}</span>
    </button>
  );
}

function OddsRow({ match, row, betslip, onBetSelect }) {
  const isSelected = (market, selection) => {
    return (
      betslip?.matchId === match.id &&
      betslip?.bookmaker === row.bookmaker &&
      betslip?.market === market &&
      betslip?.selection === selection
    );
  };

  const handleSelect = (market, selection, price) => {
    onBetSelect({
      matchId: match.id,
      fixture: match.fixture,
      league: match.league,
      market,
      selection,
      price,
      bookmaker: row.bookmaker,
    });
  };

  return (
    <div className="odds-row">
      <div className="bookmaker-cell" data-label="机构">
        <div className={`bookmaker-badge ${row.badgeTone}`}>{row.badge}</div>
        <span>{row.bookmaker}</span>
      </div>

      <OddsCell
        label="胜"
        value={row.oneXTwo[0]}
        className="is-highlight"
        isSelected={isSelected("标准盘", "胜")}
        onClick={() => handleSelect("标准盘", "胜", row.oneXTwo[0])}
      />
      <OddsCell
        label="平"
        value={row.oneXTwo[1]}
        isSelected={isSelected("标准盘", "平")}
        onClick={() => handleSelect("标准盘", "平", row.oneXTwo[1])}
      />
      <OddsCell
        label="负"
        value={row.oneXTwo[2]}
        className="is-main"
        isSelected={isSelected("标准盘", "负")}
        onClick={() => handleSelect("标准盘", "负", row.oneXTwo[2])}
      />

      <OddsCell label="让球" value={row.handicap[0]} className="is-line" />
      <OddsCell
        label="胜"
        value={row.handicap[1]}
        className="is-main"
        isSelected={isSelected("让球", "胜")}
        onClick={() => handleSelect("让球", "胜", row.handicap[1])}
      />
      <OddsCell
        label="负"
        value={row.handicap[2]}
        isSelected={isSelected("让球", "负")}
        onClick={() => handleSelect("让球", "负", row.handicap[2])}
      />

      <OddsCell label="进球数" value={row.totals[0]} className="is-line" />
      <OddsCell
        label="高于"
        value={row.totals[1]}
        className="is-main"
        isSelected={isSelected("进球数", "高于")}
        onClick={() => handleSelect("进球数", "高于", row.totals[1])}
      />
      <OddsCell
        label="低于"
        value={row.totals[2]}
        isSelected={isSelected("进球数", "低于")}
        onClick={() => handleSelect("进球数", "低于", row.totals[2])}
      />
    </div>
  );
}

function MatchCard({
  match,
  isExpanded,
  isRefreshing,
  onToggle,
  betslip,
  onBetSelect,
}) {
  return (
    <section
      className={`match-card ${isExpanded ? "is-expanded" : "is-collapsed"}`}>
      <button
        type="button"
        className="match-card__toggle"
        onClick={() => onToggle(match.id, isExpanded)}
        aria-expanded={isExpanded}
        disabled={isRefreshing}>
        <div className="match-card__header">
          <div>
            <p className="match-card__time">{match.time}</p>
            <h2>{match.fixture}</h2>
            <p className="match-card__league">{match.league}</p>
          </div>

          <div className="match-card__meta">
            <span className="match-card__count">
              {isRefreshing ? "刷新中..." : `${match.rows.length} 家机构`}
            </span>
            <span
              className={`match-card__arrow ${isExpanded ? "is-open" : ""} ${isRefreshing ? "is-loading" : ""}`}>
              <ChevronIcon />
            </span>
          </div>
        </div>
      </button>

      {isExpanded ? (
        <div className="odds-table">
          <div className="odds-table__header">
            <span>机构</span>
            <span>胜</span>
            <span>平</span>
            <span>负</span>
            <span>让球</span>
            <span>胜</span>
            <span>负</span>
            <span>进球数</span>
            <span>高于</span>
            <span>低于</span>
          </div>

          <div className="odds-table__body">
            {match.rows.map((row) => (
              <OddsRow
                key={`${match.id}-${row.bookmaker}`}
                match={match}
                row={row}
                betslip={betslip}
                onBetSelect={onBetSelect}
              />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function BetslipPanel({ bet, onClose }) {
  const [stake, setStake] = useState("");
  const [bettor, setBettor] = useState("");

  const returnAmount = stake
    ? (parseFloat(stake) * parseFloat(bet.price)).toFixed(2)
    : "0.00";

  async function handlePlaceBet() {
    const betData = {
      id: `bet_${Date.now()}`,
      time: new Date().toISOString(),
      matchId: bet.matchId,
      fixture: bet.fixture,
      league: bet.league,
      market: bet.market,
      selection: bet.selection,
      price: bet.price,
      bookmaker: bet.bookmaker,
      bettor: bettor.trim() || "匿名",
      stake: Number(stake),
      estimatedReturn: Number(returnAmount),
    };

    try {
      const response = await fetch(`${API_BASE_URL}/bet`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(betData),
      });

      if (!response.ok) {
        throw new Error("保存投注数据失败");
      }

      invalidateCachedJsonByPrefix("bets:");

      alert(
        `成功投注 ¥${stake || 0} 于 "${bet.selection}"！\n数据已增量保存到后台的 bets.json 文件中。`,
      );
      onClose();
    } catch (err) {
      alert(`投注出错: ${err.message}`);
    }
  }

  return (
    <div className="betslip-panel">
      <div className="betslip-header">
        <h3>投注单</h3>
        <button
          type="button"
          className="betslip-close"
          onClick={onClose}
          aria-label="关闭投注单">
          <XIcon />
        </button>
      </div>
      <div className="betslip-body">
        <div className="betslip-details">
          <div className="betslip-selection">
            <span className="selection-name">{bet.selection}</span>
            <span className="selection-price">{bet.price}</span>
          </div>
          <div className="betslip-market">
            {bet.market} - {bet.bookmaker}
          </div>
          <div className="betslip-fixture">{bet.fixture}</div>
        </div>

        <div className="betslip-stake">
          <label htmlFor="bettor-input">投注人姓名</label>
          <div className="stake-input-wrapper">
            <input
              id="bettor-input"
              type="text"
              value={bettor}
              onChange={(e) => setBettor(e.target.value)}
              placeholder="请输入起名字（默认：匿名）"
            />
          </div>
        </div>

        <div className="betslip-stake">
          <label htmlFor="stake-input">投注金额（最低投注额 ¥50）</label>
          <div className="stake-input-wrapper">
            <span className="currency-symbol">¥</span>
            <input
              id="stake-input"
              type="number"
              value={stake}
              onChange={(e) => setStake(e.target.value)}
              placeholder="0.00"
              min="0"
              step="1"
            />
          </div>
        </div>

        <div className="betslip-returns">
          <span className="returns-label">预计回报</span>
          <span className="returns-value">¥ {returnAmount}</span>
        </div>

        <button
          type="button"
          className="betslip-submit"
          onClick={handlePlaceBet}
          disabled={!stake || parseFloat(stake) <= 0}>
          确认投注
        </button>
      </div>
    </div>
  );
}

function App() {
  const [sports, setSports] = useState([]);
  const [selectedSport, setSelectedSport] = useState(DEFAULT_SPORT);
  const [sportQuery, setSportQuery] = useState("");
  const [teamQuery, setTeamQuery] = useState("");
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isSportMenuOpen, setIsSportMenuOpen] = useState(false);
  const [expandedMatchId, setExpandedMatchId] = useState("");
  const [refreshingMatchId, setRefreshingMatchId] = useState("");
  const [betslip, setBetslip] = useState(null);
  const [currentView, setCurrentView] = useState("user");

  useEffect(() => {
    let ignore = false;

    async function loadSports() {
      try {
        const data = await getCachedJson(`${API_BASE_URL}/sports`, {
          cacheKey: SPORTS_CACHE_KEY,
          ttlMs: CACHE_TTL_SPORTS_MS,
          swrMs: CACHE_SWR_SPORTS_MS,
          onRevalidate: (latestSports) => {
            if (!ignore) {
              setSports(latestSports);
            }
          },
        });
        if (!ignore) {
          setSports(data);
          const preferredSport =
            data.find((item) => item.key === DEFAULT_SPORT) || data[0];

          if (preferredSport) {
            setSelectedSport(preferredSport.key);
            setSportQuery(preferredSport.title);
          }
        }
      } catch (loadError) {
        if (!ignore) {
          setError(loadError.message || "加载赛事列表失败");
          setLoading(false);
        }
      }
    }

    loadSports();
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    let ignore = false;

    async function loadOdds() {
      setLoading(true);
      setError("");

      try {
        const latestMatches = await fetchOddsBySport(selectedSport, {
          onRevalidate: (freshMatches) => {
            if (!ignore) {
              setMatches(freshMatches);
            }
          },
        });
        if (!ignore) {
          setMatches(latestMatches);
          setExpandedMatchId("");
        }
      } catch (loadError) {
        if (!ignore) {
          setMatches([]);
          setError(loadError.message || "加载赔率失败");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    if (selectedSport) {
      loadOdds();
    }

    return () => {
      ignore = true;
    };
  }, [selectedSport]);

  const selectedSportTitle =
    sports.find((item) => item.key === selectedSport)?.title || selectedSport;

  const sportFilterTerm =
    isSportMenuOpen && sportQuery === selectedSportTitle
      ? ""
      : sportQuery.trim().toLowerCase();

  const filteredSports = useMemo(() => {
    if (!sportFilterTerm) {
      return sports;
    }

    return sports.filter((sport) => {
      const title = (sport.title || "").toLowerCase();
      const key = (sport.key || "").toLowerCase();
      return title.includes(sportFilterTerm) || key.includes(sportFilterTerm);
    });
  }, [sportFilterTerm, sports]);

  const filteredMatches = useMemo(() => {
    if (!teamQuery.trim()) {
      return matches;
    }

    const query = teamQuery.trim().toLowerCase();
    return matches.filter((match) =>
      match.fixture.toLowerCase().includes(query),
    );
  }, [matches, teamQuery]);

  async function refreshMatchData(matchId) {
    setRefreshingMatchId(matchId);
    setError("");

    try {
      const latestMatches = await fetchOddsBySport(selectedSport, {
        forceRefresh: true,
      });
      setMatches(latestMatches);
      setExpandedMatchId(matchId);
    } catch (loadError) {
      setError(loadError.message || "刷新赔率失败");
    } finally {
      setRefreshingMatchId("");
    }
  }

  async function handleMatchToggle(matchId, isExpanded) {
    if (isExpanded) {
      setExpandedMatchId("");
      return;
    }

    await refreshMatchData(matchId);
  }

  function exportJson() {
    const payload = JSON.stringify(filteredMatches, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${selectedSport}-odds.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function selectSport(sport) {
    setSelectedSport(sport.key);
    setSportQuery(sport.title);
    setIsSportMenuOpen(false);
    setExpandedMatchId("");
    setBetslip(null);
  }

  function handleBetSelect(bet) {
    if (
      betslip?.matchId === bet.matchId &&
      betslip?.bookmaker === bet.bookmaker &&
      betslip?.market === bet.market &&
      betslip?.selection === bet.selection
    ) {
      setBetslip(null);
    } else {
      setBetslip(bet);
    }
  }

  return (
    <div className="app-shell">
      <div className="page-glow page-glow--left" />
      <div className="page-glow page-glow--right" />

      <header className="topbar">
        <div className="brand-wrap">
          <div className="brand">Bets</div>
          <div style={{ display: "flex", gap: "16px", marginTop: "12px" }}>
            <button
              type="button"
              onClick={() => setCurrentView("user")}
              style={{
                padding: "6px 16px",
                borderRadius: "20px",
                background:
                  currentView === "user" ? "var(--accent)" : "var(--bg-inset)",
                color:
                  currentView === "user"
                    ? "var(--text-inverted)"
                    : "var(--text-primary)",
                fontWeight: "bold",
              }}>
              前台查询
            </button>
            <button
              type="button"
              onClick={() => setCurrentView("admin")}
              style={{
                padding: "6px 16px",
                borderRadius: "20px",
                background:
                  currentView === "admin" ? "var(--accent)" : "var(--bg-inset)",
                color:
                  currentView === "admin"
                    ? "var(--text-inverted)"
                    : "var(--text-primary)",
                fontWeight: "bold",
              }}>
              后台管理
            </button>
            <button
              type="button"
              onClick={() => setCurrentView("dashboard")}
              style={{
                padding: "6px 16px",
                borderRadius: "20px",
                background:
                  currentView === "dashboard"
                    ? "var(--accent)"
                    : "var(--bg-inset)",
                color:
                  currentView === "dashboard"
                    ? "var(--text-inverted)"
                    : "var(--text-primary)",
                fontWeight: "bold",
              }}>
              看板
            </button>
          </div>
        </div>

        {currentView === "user" && (
          <div className="topbar__actions">
            <label className="search-box" htmlFor="team-search">
              <SearchIcon />
              <input
                id="team-search"
                type="text"
                placeholder="输入球队名称筛选"
                value={teamQuery}
                onChange={(event) => setTeamQuery(event.target.value)}
              />
            </label>

            {/* <button
              type="button"
              className="export-button"
              onClick={exportJson}>
              <DownloadIcon />
              <span>导出 JSON</span>
            </button> */}
          </div>
        )}
      </header>

      {currentView === "admin" ? (
        <Admin />
      ) : currentView === "dashboard" ? (
        <BookmakerDashboard />
      ) : (
        <main className="content-grid">
          <aside className="sidebar-panel">
            <p className="sidebar-panel__eyebrow">筛选条件</p>

            <div className="filter-group">
              <label htmlFor="sport-search">赛事选择</label>
              <div className="combo-box">
                <div className="combo-input-wrap">
                  <input
                    id="sport-search"
                    className="combo-input"
                    type="text"
                    placeholder="输入联赛名称或 key"
                    value={sportQuery}
                    onFocus={() => setIsSportMenuOpen(true)}
                    onClick={() => setIsSportMenuOpen(true)}
                    onChange={(event) => {
                      setSportQuery(event.target.value);
                      setIsSportMenuOpen(true);
                    }}
                  />
                  <button
                    type="button"
                    className="combo-toggle"
                    onClick={() => setIsSportMenuOpen((open) => !open)}
                    aria-label="切换赛事列表">
                    <ChevronIcon />
                  </button>
                </div>

                {isSportMenuOpen ? (
                  <div className="combo-menu">
                    {filteredSports.length > 0 ? (
                      filteredSports.map((sport) => (
                        <button
                          key={sport.key}
                          type="button"
                          className={`combo-option ${sport.key === selectedSport ? "is-active" : ""}`}
                          onClick={() => selectSport(sport)}>
                          <span>{sport.title}</span>
                          <small>{sport.key}</small>
                        </button>
                      ))
                    ) : (
                      <div className="combo-empty">未找到匹配赛事</div>
                    )}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="filter-group">
              <label>接口地址</label>
              <div className="info-card">{API_BASE_URL}</div>
            </div>
          </aside>

          <section className="main-panel">
            <div className="main-panel__header">
              <div>
                <h1>{selectedSportTitle}</h1>
                <p className="main-panel__meta">
                  {loading
                    ? "正在加载最新赔率..."
                    : `共 ${filteredMatches.length} 场比赛`}
                </p>
              </div>
            </div>

            {error ? (
              <div className="status-panel status-panel--error">{error}</div>
            ) : null}
            {!error && loading ? (
              <div className="status-panel">正在同步最新赔率数据，请稍候。</div>
            ) : null}
            {!error && !loading && filteredMatches.length === 0 ? (
              <div className="status-panel">
                当前筛选条件下没有可展示的比赛。
              </div>
            ) : null}

            <div className="matches-list">
              {filteredMatches.map((match) => (
                <MatchCard
                  key={match.id}
                  match={match}
                  isExpanded={expandedMatchId === match.id}
                  isRefreshing={refreshingMatchId === match.id}
                  onToggle={handleMatchToggle}
                  betslip={betslip}
                  onBetSelect={handleBetSelect}
                />
              ))}
            </div>
          </section>
        </main>
      )}

      {currentView === "user" && betslip && (
        <BetslipPanel bet={betslip} onClose={() => setBetslip(null)} />
      )}
    </div>
  );
}

export default App;
