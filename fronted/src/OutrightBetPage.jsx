import { useEffect, useMemo, useState } from "react";
import Admin from "./Admin";
import BookmakerDashboard from "./BookmakerDashboard";
import { getCachedJson, invalidateCachedJsonByPrefix } from "./apiCache";

const DEFAULT_SPORT = "soccer_fifa_world_cup_winner";
const DEFAULT_REGIONS = "us,uk,au";
const SPORTS_CACHE_KEY = "sports:list";
const CACHE_TTL_SPORTS_MS = 5 * 60_000;
const CACHE_SWR_SPORTS_MS = 10 * 60_000;
const CACHE_TTL_OUTRIGHT_BETS_MS = 20_000;
const CACHE_SWR_OUTRIGHT_BETS_MS = 40_000;

function buildOutrightBetCacheKey(sport) {
  return `outright-bets:${sport}:${DEFAULT_REGIONS}`;
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
  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    return "--";
  }
  return amount.toFixed(2);
}

async function fetchOutrightBets(apiBaseUrl, sport, options = {}) {
  const { forceRefresh = false, onRevalidate } = options;

  const params = new URLSearchParams({
    sport,
    regions: DEFAULT_REGIONS,
  });

  const url = `${apiBaseUrl}/outrights?${params.toString()}`;
  const data = await getCachedJson(url, {
    cacheKey: buildOutrightBetCacheKey(sport),
    ttlMs: CACHE_TTL_OUTRIGHT_BETS_MS,
    swrMs: CACHE_SWR_OUTRIGHT_BETS_MS,
    forceRefresh,
    onRevalidate: (latest) => onRevalidate?.(latest),
  });

  return data;
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20L16.65 16.65" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <path d="M21 3v6h-6" />
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

function ChevronIcon({ isOpen = false }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      style={{ transform: isOpen ? "rotate(180deg)" : "none" }}>
      <path d="M6 9L12 15L18 9" />
    </svg>
  );
}

function OutrightOptionButton({ option, selected, onSelect }) {
  return (
    <button
      type="button"
      className={`score-option ${selected ? "is-selected" : ""}`}
      onClick={() => onSelect(option)}>
      <span className="score-option__score">{option.name}</span>
      <span className="score-option__price">@{formatPrice(option.price)}</span>
    </button>
  );
}

function OutrightBetSlip({ apiBaseUrl, bet, onClose, onSuccess }) {
  const [stake, setStake] = useState("");
  const [bettor, setBettor] = useState("");
  const [editablePrice, setEditablePrice] = useState(formatPrice(bet.price));
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setEditablePrice(formatPrice(bet.price));
  }, [bet]);

  const parsedPrice = Number(editablePrice);
  const effectivePrice =
    Number.isFinite(parsedPrice) && parsedPrice > 0 ? parsedPrice : 0;
  const returnAmount = stake
    ? (parseFloat(stake || 0) * effectivePrice).toFixed(2)
    : "0.00";

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const response = await fetch(`${apiBaseUrl}/bet`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: `outright_bet_${Date.now()}`,
          bet_type: "outright",
          time: new Date().toISOString(),
          matchId: bet.matchId,
          fixture: bet.fixture,
          league: bet.league,
          sport_key: bet.sportKey,
          market: "冠军投注",
          selection: bet.selection,
          price: effectivePrice,
          bookmaker: bet.bookmaker,
          bettor: bettor.trim() || "匿名",
          stake: Number(stake),
          estimatedReturn: Number(returnAmount),
        }),
      });

      if (!response.ok) {
        throw new Error("保存冠军投注失败");
      }

      invalidateCachedJsonByPrefix("bets:");
      onSuccess?.({
        fixture: bet.fixture,
        selection: bet.selection,
        market: bet.market,
        bookmaker: bet.bookmaker,
        bettor: bettor.trim() || "匿名",
        stake: Number(stake),
        price: effectivePrice,
        estimatedReturn: Number(returnAmount),
        confirmedAt: new Date().toISOString(),
      });
      onClose();
    } catch (error) {
      alert(`冠军投注失败: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="betslip-panel score-betslip-panel">
      <div className="betslip-header">
        <h3>冠军投注单</h3>
        <button
          type="button"
          className="betslip-close"
          onClick={onClose}
          aria-label="关闭冠军投注单">
          <XIcon />
        </button>
      </div>

      <div className="betslip-body">
        <div className="betslip-details">
          <div className="betslip-selection">
            <span className="selection-name">{bet.selection}</span>
          </div>
          <div className="betslip-market">{bet.market} - {bet.bookmaker}</div>
          <div className="betslip-fixture">{bet.fixture}</div>
          <div className="score-betslip-note">
            比赛结束后请管理员手动结算。
          </div>
        </div>

        <div className="betslip-stake">
          <label htmlFor="score-price-input">选中赔率</label>
          <div className="stake-input-wrapper">
            <input
              id="score-price-input"
              type="number"
              value={editablePrice}
              onChange={(event) => setEditablePrice(event.target.value)}
              placeholder="0.00"
              min="0"
              step="0.01"
            />
          </div>
        </div>

        <div className="betslip-stake">
          <label htmlFor="score-bettor-input">投注人</label>
          <div className="stake-input-wrapper">
            <input
              id="score-bettor-input"
              type="text"
              value={bettor}
              onChange={(event) => setBettor(event.target.value)}
              placeholder="请输入投注人名称"
            />
          </div>
        </div>

        <div className="betslip-stake">
          <label htmlFor="score-stake-input">投注金额</label>
          <div className="stake-input-wrapper">
            <span className="currency-symbol">￥</span>
            <input
              id="score-stake-input"
              type="number"
              value={stake}
              onChange={(event) => setStake(event.target.value)}
              placeholder="0.00"
              min="0"
              step="1"
            />
          </div>
        </div>

        <div className="betslip-returns">
          <span className="returns-label">预计回报</span>
          <span className="returns-value">￥ {returnAmount}</span>
        </div>

        <button
          type="button"
          className="betslip-submit"
          disabled={
            submitting ||
            !stake ||
            parseFloat(stake) <= 0 ||
            !(Number.isFinite(parsedPrice) && parsedPrice > 0)
          }
          onClick={handleSubmit}>
          {submitting ? "提交中..." : "确认冠军投注"}
        </button>
      </div>
    </div>
  );
}

function OutrightBetSuccessDialog({ bet, onClose }) {
  if (!bet) {
    return null;
  }

  return (
    <div
      className="score-success-overlay"
      role="dialog"
      aria-modal="true"
      onClick={onClose}>
      <div className="score-success-dialog" onClick={onClose}>
        <div className="score-success-dialog__header">
          <div>
            <h3>投注成功</h3>
            <p>以下为已确认的冠军投注信息。</p>
          </div>
        </div>

        <div className="score-success-list">
          <div className="score-success-item">
            <span>赛事</span>
            <strong>{bet.fixture}</strong>
          </div>
          <div className="score-success-item">
            <span>玩法</span>
            <strong>{bet.market}</strong>
          </div>
          <div className="score-success-item">
            <span>博彩机构</span>
            <strong>{bet.bookmaker}</strong>
          </div>
          <div className="score-success-item">
            <span>投注对象</span>
            <strong>{bet.selection}</strong>
          </div>
          <div className="score-success-item">
            <span>确认赔率</span>
            <strong>@{formatPrice(bet.price)}</strong>
          </div>
          <div className="score-success-item">
            <span>投注金额</span>
            <strong>￥ {formatPrice(bet.stake)}</strong>
          </div>
          <div className="score-success-item">
            <span>预计回报</span>
            <strong>￥ {formatPrice(bet.estimatedReturn)}</strong>
          </div>
          <div className="score-success-item">
            <span>投注人</span>
            <strong>{bet.bettor}</strong>
          </div>
          <div className="score-success-item">
            <span>确认时间</span>
            <strong>{formatDateTime(bet.confirmedAt)}</strong>
          </div>
        </div>

      </div>
    </div>
  );
}

export default function OutrightBetPage({ apiBaseUrl }) {
  const [workspaceView, setWorkspaceView] = useState("betting");
  const [sports, setSports] = useState([]);
  const [selectedSport, setSelectedSport] = useState(DEFAULT_SPORT);
  const [sportQuery, setSportQuery] = useState("");
  const [teamQuery, setTeamQuery] = useState("");
  const [fixtures, setFixtures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [isSportMenuOpen, setIsSportMenuOpen] = useState(false);
  const [expandedMatchId, setExpandedMatchId] = useState("");
  const [selectedBet, setSelectedBet] = useState(null);
  const [confirmedBet, setConfirmedBet] = useState(null);

  useEffect(() => {
    let ignore = false;

    async function loadSports() {
      try {
        const data = await getCachedJson(`${apiBaseUrl}/sports`, {
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
            data.find((item) => item.key === DEFAULT_SPORT) || data.find((item) => item.key.includes("winner")) || data[0];
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
  }, [apiBaseUrl]);

  useEffect(() => {
    let ignore = false;

    async function loadFixtures() {
      setLoading(true);
      setError("");
      try {
        const data = await fetchOutrightBets(apiBaseUrl, selectedSport, {
          onRevalidate: (latest) => {
            if (!ignore) {
              setFixtures(latest);
            }
          },
        });
        if (!ignore) {
          setFixtures(data);
          setExpandedMatchId("");
          setSelectedBet(null);
        }
      } catch (loadError) {
        if (!ignore) {
          setFixtures([]);
          setError(loadError.message || "加载冠军盘口失败");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    if (selectedSport) {
      loadFixtures();
    }

    return () => {
      ignore = true;
    };
  }, [apiBaseUrl, selectedSport]);

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

  async function handleRefresh() {
    setRefreshing(true);
    setError("");
    try {
      const latest = await fetchOutrightBets(apiBaseUrl, selectedSport, {
        forceRefresh: true,
      });
      setFixtures(latest);
      setExpandedMatchId("");
      setSelectedBet(null);
    } catch (loadError) {
      setError(loadError.message || "刷新冠军盘口失败");
    } finally {
      setRefreshing(false);
    }
  }

  function handleMatchToggle(matchId) {
    if (expandedMatchId === matchId) {
      setExpandedMatchId("");
      return;
    }
    setExpandedMatchId(matchId);
  }

  function selectSport(sport) {
    setSelectedSport(sport.key);
    setSportQuery(sport.title);
    setIsSportMenuOpen(false);
    setSelectedBet(null);
  }

  function handleSelectOption(fixture, bookmaker, option) {
    setSelectedBet({
      matchId: fixture.id,
      fixture: fixture.sport_title || "冠军投注",
      league: fixture.sport_title,
      sportKey: fixture.sport_key,
      bookmaker: bookmaker.bookmaker,
      market: "冠军投注",
      selection: option.name,
      price: option.price,
    });
  }

  // Filter bookmakers' outcomes based on teamQuery
  const getFilteredBookmakers = (bookmakers) => {
    if (!teamQuery.trim()) return bookmakers;
    const query = teamQuery.trim().toLowerCase();
    
    return bookmakers.map(bm => {
      return {
        ...bm,
        outcomes: bm.outcomes.filter(o => o.name.toLowerCase().includes(query))
      };
    }).filter(bm => bm.outcomes.length > 0);
  };

  return (
    <>
      <section className="score-workspace-header">
        <div className="score-workspace-tabs">
          <button
            type="button"
            className={`score-workspace-tab ${workspaceView === "betting" ? "is-active" : ""}`}
            onClick={() => setWorkspaceView("betting")}>
            冠军投注
          </button>
          <button
            type="button"
            className={`score-workspace-tab ${workspaceView === "admin" ? "is-active" : ""}`}
            onClick={() => setWorkspaceView("admin")}>
            后台管理
          </button>
          <button
            type="button"
            className={`score-workspace-tab ${workspaceView === "dashboard" ? "is-active" : ""}`}
            onClick={() => setWorkspaceView("dashboard")}>
            看板
          </button>
        </div>
      </section>

      {workspaceView === "admin" ? <Admin /> : null}
      {workspaceView === "dashboard" ? <BookmakerDashboard /> : null}

      {workspaceView === "betting" ? (
        <main className="content-grid score-content-grid">
          <aside className="sidebar-panel score-sidebar-panel">
            <p className="sidebar-panel__eyebrow">冠军投注</p>

            <div className="filter-group">
              <label htmlFor="score-sport-search">赛事选择</label>
              <div className="combo-box">
                <div className="combo-input-wrap">
                  <input
                    id="score-sport-search"
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
              <label htmlFor="score-team-search">队伍筛选</label>
              <label className="search-box" htmlFor="score-team-search">
                <SearchIcon />
                <input
                  id="score-team-search"
                  type="text"
                  placeholder="输入队伍名称筛选"
                  value={teamQuery}
                  onChange={(event) => setTeamQuery(event.target.value)}
                />
              </label>
            </div>

            <div className="filter-group">
              <button
                type="button"
                className="export-button score-refresh-button"
                onClick={handleRefresh}
                disabled={refreshing}>
                <RefreshIcon />
                <span>{refreshing ? "刷新中..." : "刷新冠军列表"}</span>
              </button>
            </div>
          </aside>

          <section className="main-panel">
            <div className="main-panel__header">
              <div>
                <h1>{selectedSportTitle}</h1>
                <p className="main-panel__meta">
                  {loading
                    ? "正在加载冠军赔率..."
                    : `共 ${fixtures.length} 个相关赛事`}
                </p>
              </div>
            </div>

            {error ? (
              <div className="status-panel status-panel--error">{error}</div>
            ) : null}
            {!error && loading ? (
              <div className="status-panel">正在同步冠军赔率列表，请稍候。</div>
            ) : null}
            {!error && !loading && fixtures.length === 0 ? (
              <div className="status-panel">
                当前筛选条件下没有可投注的冠军赛事。
              </div>
            ) : null}

            <div className="score-fixtures">
              {fixtures.map((fixture) => {
                const isOpen = expandedMatchId === fixture.id || fixtures.length === 1;
                const bookmakers = getFilteredBookmakers(fixture.bookmakers || []);

                return (
                  <section
                    key={fixture.id}
                    className="match-card score-market-card">
                    <button
                      type="button"
                      className="match-card__toggle"
                      onClick={() => handleMatchToggle(fixture.id)}
                      aria-expanded={isOpen}>
                      <div className="score-market-card__header">
                        <div>
                          <p className="match-card__time">{formatDateTime(fixture.commence_time)}</p>
                          <h2>{fixture.sport_title || "冠军投注"}</h2>
                          <p className="match-card__league">{fixture.sport_key}</p>
                        </div>

                        <div className="score-market-card__meta">
                          <div className="score-chip">
                            {fixture.bookmakers?.length || 0} 家博彩机构
                          </div>
                          <span className="match-card__arrow">
                            <ChevronIcon isOpen={isOpen} />
                          </span>
                        </div>
                      </div>
                    </button>

                    {isOpen ? (
                      bookmakers.length > 0 ? (
                        <div style={{ padding: '0 16px 16px 16px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                          {bookmakers.map((bm) => (
                            <div key={bm.bookmaker} className="bookmaker-outright-section">
                                <h4 style={{ margin: '0 0 12px 0', color: 'var(--text-secondary)' }}>{bm.bookmaker}</h4>
                                <div className="score-grid">
                                    {bm.outcomes.map((option) => (
                                    <OutrightOptionButton
                                        key={`${fixture.id}-${bm.bookmaker}-${option.name}`}
                                        option={option}
                                        selected={
                                        selectedBet?.matchId === fixture.id &&
                                        selectedBet?.bookmaker === bm.bookmaker &&
                                        selectedBet?.selection === option.name
                                        }
                                        onSelect={() =>
                                          handleSelectOption(fixture, bm, option)
                                        }
                                    />
                                    ))}
                                </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="status-panel score-inline-status">
                          该场盘口没有符合筛选条件的队伍。
                        </div>
                      )
                    ) : null}
                  </section>
                );
              })}
            </div>
          </section>
        </main>
      ) : null}

      {workspaceView === "betting" && selectedBet ? (
        <OutrightBetSlip
          apiBaseUrl={apiBaseUrl}
          bet={selectedBet}
          onSuccess={setConfirmedBet}
          onClose={() => setSelectedBet(null)}
        />
      ) : null}

      {workspaceView === "betting" && confirmedBet ? (
        <OutrightBetSuccessDialog
          bet={confirmedBet}
          onClose={() => setConfirmedBet(null)}
        />
      ) : null}
    </>
  );
}
