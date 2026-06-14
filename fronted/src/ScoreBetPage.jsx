import { useEffect, useMemo, useState } from "react";
import Admin from "./Admin";
import BookmakerDashboard from "./BookmakerDashboard";
import { getCachedJson, invalidateCachedJsonByPrefix } from "./apiCache";

const DEFAULT_SPORT = "soccer_fifa_world_cup";
const DEFAULT_REGIONS = "us,uk,au";
const SPORTS_CACHE_KEY = "sports:list";
const CACHE_TTL_SPORTS_MS = 5 * 60_000;
const CACHE_SWR_SPORTS_MS = 10 * 60_000;
const CACHE_TTL_SCORE_BETS_MS = 20_000;
const CACHE_SWR_SCORE_BETS_MS = 40_000;

function buildScoreBetCacheKey(sport, eventId = "all", includeOptions = false) {
  const detailKey = includeOptions ? "detail" : "summary";
  return `score-bets:${sport}:${eventId}:${DEFAULT_REGIONS}:${detailKey}`;
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

function normalizeFixture(fixture) {
  return {
    id: fixture.id,
    sportKey: fixture.sport_key,
    time: formatDateTime(fixture.commence_time),
    fixture: `${fixture.home_team} vs ${fixture.away_team}`,
    league: fixture.sport_title,
    bookmaker: fixture.bookmaker,
    pricingModel: fixture.pricing_model || {},
    options: fixture.options || [],
    optionCount: fixture.option_count || (fixture.options || []).length || 0,
  };
}

async function fetchScoreBets(apiBaseUrl, sport, options = {}) {
  const {
    eventId = "",
    includeOptions = false,
    forceRefresh = false,
    onRevalidate,
  } = options;

  const params = new URLSearchParams({
    sport,
    regions: DEFAULT_REGIONS,
    includeOptions: includeOptions ? "true" : "false",
  });

  if (eventId) {
    params.set("eventId", eventId);
  }

  const url = `${apiBaseUrl}/score-bets?${params.toString()}`;
  const data = await getCachedJson(url, {
    cacheKey: buildScoreBetCacheKey(sport, eventId || "all", includeOptions),
    ttlMs: CACHE_TTL_SCORE_BETS_MS,
    swrMs: CACHE_SWR_SCORE_BETS_MS,
    forceRefresh,
    onRevalidate: (latest) => onRevalidate?.(latest.map(normalizeFixture)),
  });

  return data.map(normalizeFixture);
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

function ScoreOptionButton({ option, selected, onSelect }) {
  return (
    <button
      type="button"
      className={`score-option ${selected ? "is-selected" : ""}`}
      onClick={() => onSelect(option)}>
      <span className="score-option__score">{option.score}</span>
      <span className="score-option__price">@{formatPrice(option.price)}</span>
    </button>
  );
}

function ScoreBetSlip({ apiBaseUrl, bet, onClose, onSuccess }) {
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
    ? (Math.floor(parseFloat(stake || 0) * effectivePrice) / 2).toFixed(2)
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
          id: `score_bet_${Date.now()}`,
          bet_type: "correct_score",
          time: new Date().toISOString(),
          matchId: bet.matchId,
          fixture: bet.fixture,
          league: bet.league,
          sport_key: bet.sportKey,
          market: "精确比分",
          selection: bet.selection,
          price: effectivePrice,
          bookmaker: bet.bookmaker,
          bettor: bettor.trim() || "匿名",
          stake: Number(stake),
          estimatedReturn: Number(returnAmount),
        }),
      });

      if (!response.ok) {
        throw new Error("保存比分投注失败");
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
      alert(`比分投注失败: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="betslip-panel score-betslip-panel">
      <div className="betslip-header">
        <h3>比分投注单</h3>
        <button
          type="button"
          className="betslip-close"
          onClick={onClose}
          aria-label="关闭比分投注单">
          <XIcon />
        </button>
      </div>

      <div className="betslip-body">
        <div className="betslip-details">
          <div className="betslip-selection">
            <span className="selection-name">{bet.selection}</span>
          </div>
          <div className="betslip-market">{bet.market}</div>
          <div className="betslip-fixture">{bet.fixture}</div>
          <div className="score-betslip-note">
            比赛结束后将按官方比分接口自动结算。
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
          {submitting ? "提交中..." : "确认比分投注"}
        </button>
      </div>
    </div>
  );
}

function ScoreBetSuccessDialog({ bet, onClose }) {
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
            <p>以下为已确认的比分投注信息。</p>
          </div>
        </div>

        <div className="score-success-list">
          <div className="score-success-item">
            <span>比赛</span>
            <strong>{bet.fixture}</strong>
          </div>
          <div className="score-success-item">
            <span>玩法</span>
            <strong>{bet.market}</strong>
          </div>
          <div className="score-success-item">
            <span>投注比分</span>
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

export default function ScoreBetPage({ apiBaseUrl }) {
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
  const [loadingMatchId, setLoadingMatchId] = useState("");
  const [fixtureDetails, setFixtureDetails] = useState({});
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
  }, [apiBaseUrl]);

  useEffect(() => {
    let ignore = false;

    async function loadFixtures() {
      setLoading(true);
      setError("");
      try {
        const data = await fetchScoreBets(apiBaseUrl, selectedSport, {
          includeOptions: false,
          onRevalidate: (latest) => {
            if (!ignore) {
              setFixtures(latest);
            }
          },
        });
        if (!ignore) {
          setFixtures(data);
          setExpandedMatchId("");
          setFixtureDetails({});
          setSelectedBet(null);
        }
      } catch (loadError) {
        if (!ignore) {
          setFixtures([]);
          setError(loadError.message || "加载比分盘口失败");
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

  const filteredFixtures = useMemo(() => {
    if (!teamQuery.trim()) {
      return fixtures;
    }
    const query = teamQuery.trim().toLowerCase();
    return fixtures.filter((fixture) =>
      fixture.fixture.toLowerCase().includes(query),
    );
  }, [fixtures, teamQuery]);

  async function handleRefresh() {
    setRefreshing(true);
    setError("");
    try {
      const latest = await fetchScoreBets(apiBaseUrl, selectedSport, {
        includeOptions: false,
        forceRefresh: true,
      });
      setFixtures(latest);
      setFixtureDetails({});
      setExpandedMatchId("");
      setSelectedBet(null);
    } catch (loadError) {
      setError(loadError.message || "刷新比分盘口失败");
    } finally {
      setRefreshing(false);
    }
  }

  async function handleMatchToggle(matchId) {
    if (expandedMatchId === matchId) {
      setExpandedMatchId("");
      return;
    }

    setExpandedMatchId(matchId);
    if (fixtureDetails[matchId]) {
      return;
    }

    setLoadingMatchId(matchId);
    try {
      const [detail] = await fetchScoreBets(apiBaseUrl, selectedSport, {
        eventId: matchId,
        includeOptions: true,
        forceRefresh: true,
      });
      if (detail) {
        setFixtureDetails((current) => ({ ...current, [matchId]: detail }));
      }
    } catch (loadError) {
      setError(loadError.message || "加载单场比分盘口失败");
    } finally {
      setLoadingMatchId("");
    }
  }

  function selectSport(sport) {
    setSelectedSport(sport.key);
    setSportQuery(sport.title);
    setIsSportMenuOpen(false);
    setSelectedBet(null);
  }

  function handleSelectOption(fixture, option) {
    setSelectedBet({
      matchId: fixture.id,
      fixture: fixture.fixture,
      league: fixture.league,
      sportKey: fixture.sportKey,
      bookmaker: fixture.bookmaker,
      market: "精确比分",
      selection: option.score,
      price: option.price,
    });
  }

  return (
    <>
      <section className="score-workspace-header">
        <div className="score-workspace-tabs">
          <button
            type="button"
            className={`score-workspace-tab ${workspaceView === "betting" ? "is-active" : ""}`}
            onClick={() => setWorkspaceView("betting")}>
            比分投注
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
            <p className="sidebar-panel__eyebrow">比分投注</p>

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
              <label htmlFor="score-team-search">球队筛选</label>
              <label className="search-box" htmlFor="score-team-search">
                <SearchIcon />
                <input
                  id="score-team-search"
                  type="text"
                  placeholder="输入球队名称筛选"
                  value={teamQuery}
                  onChange={(event) => setTeamQuery(event.target.value)}
                />
              </label>
            </div>

            <div className="filter-group">
              <label>盘口引擎</label>
              <div className="info-card">
                赛事列表只展示摘要，展开比赛时再实时请求精确比分盘口。
              </div>
            </div>

            <div className="filter-group">
              <button
                type="button"
                className="export-button score-refresh-button"
                onClick={handleRefresh}
                disabled={refreshing}>
                <RefreshIcon />
                <span>{refreshing ? "刷新中..." : "刷新比赛列表"}</span>
              </button>
            </div>
          </aside>

          <section className="main-panel">
            <div className="main-panel__header">
              <div>
                <h1>{selectedSportTitle}</h1>
                <p className="main-panel__meta">
                  {loading
                    ? "正在加载比分投注比赛..."
                    : `共 ${filteredFixtures.length} 场可投注比赛`}
                </p>
              </div>
            </div>

            {error ? (
              <div className="status-panel status-panel--error">{error}</div>
            ) : null}
            {!error && loading ? (
              <div className="status-panel">正在同步比赛列表，请稍候。</div>
            ) : null}
            {!error && !loading && filteredFixtures.length === 0 ? (
              <div className="status-panel">
                当前筛选条件下没有可投注的比赛。
              </div>
            ) : null}

            <div className="score-fixtures">
              {filteredFixtures.map((fixture) => {
                const isOpen = expandedMatchId === fixture.id;
                const detail = fixtureDetails[fixture.id];
                const isLoading = loadingMatchId === fixture.id;

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
                          <p className="match-card__time">{fixture.time}</p>
                          <h2>{fixture.fixture}</h2>
                          <p className="match-card__league">{fixture.league}</p>
                        </div>

                        <div className="score-market-card__meta">
                          <div className="score-chip">
                            {fixture.optionCount} 个比分选项
                          </div>
                          <div className="score-chip">
                            {isLoading
                              ? "盘口加载中"
                              : isOpen
                                ? "收起盘口"
                                : "展开盘口"}
                          </div>
                          <span className="match-card__arrow">
                            <ChevronIcon isOpen={isOpen} />
                          </span>
                        </div>
                      </div>
                    </button>

                    {isOpen ? (
                      isLoading ? (
                        <div className="status-panel score-inline-status">
                          正在加载该场比分盘口...
                        </div>
                      ) : detail ? (
                        <>
                          <div className="score-market-summary">
                            <div className="score-chip">
                              总进球均值{" "}
                              {detail.pricingModel.total_goals ?? "--"}
                            </div>
                            <div className="score-chip">
                              主队进球期望{" "}
                              {detail.pricingModel.home_lambda ?? "--"}
                            </div>
                            <div className="score-chip">
                              客队进球期望{" "}
                              {detail.pricingModel.away_lambda ?? "--"}
                            </div>
                          </div>

                          <div className="score-grid">
                            {detail.options.map((option) => (
                              <ScoreOptionButton
                                key={`${fixture.id}-${option.score}`}
                                option={option}
                                selected={
                                  selectedBet?.matchId === fixture.id &&
                                  selectedBet?.selection === option.score
                                }
                                onSelect={() =>
                                  handleSelectOption(detail, option)
                                }
                              />
                            ))}
                          </div>
                        </>
                      ) : (
                        <div className="status-panel status-panel--error score-inline-status">
                          该场盘口加载失败，请重试。
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
        <ScoreBetSlip
          apiBaseUrl={apiBaseUrl}
          bet={selectedBet}
          onSuccess={setConfirmedBet}
          onClose={() => setSelectedBet(null)}
        />
      ) : null}

      {workspaceView === "betting" && confirmedBet ? (
        <ScoreBetSuccessDialog
          bet={confirmedBet}
          onClose={() => setConfirmedBet(null)}
        />
      ) : null}
    </>
  );
}
