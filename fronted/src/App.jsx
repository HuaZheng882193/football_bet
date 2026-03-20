import { useEffect, useMemo, useState } from "react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";
const DEFAULT_SPORT = "soccer_china_superleague";
const DEFAULT_MARKETS = "h2h,spreads,totals";
const DEFAULT_REGIONS = "us,uk,au";

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
    minute: "2-digit"
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
    formatPrice(opposite?.price)
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
    formatPrice(under?.price)
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
        formatPrice(row.away)
      ],
      handicap: buildHandicap(row.spreads),
      totals: buildTotals(row.totals)
    }))
  };
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

function OddsRow({ row }) {
  return (
    <div className="odds-row">
      <div className="bookmaker-cell" data-label="机构">
        <div className={`bookmaker-badge ${row.badgeTone}`}>{row.badge}</div>
        <span>{row.bookmaker}</span>
      </div>

      <div className="odds-group" data-label="胜平负">
        {row.oneXTwo.map((value, index) => (
          <span key={`${row.bookmaker}-1x2-${index}`} className={index === 0 ? "is-highlight" : ""}>
            {value}
          </span>
        ))}
      </div>

      <div className="odds-group" data-label="让球">
        {row.handicap.map((value, index) => (
          <span key={`${row.bookmaker}-hdp-${index}`} className={index === 0 ? "is-line" : index === 1 ? "is-main" : ""}>
            {value}
          </span>
        ))}
      </div>

      <div className="odds-group" data-label="大小球">
        {row.totals.map((value, index) => (
          <span key={`${row.bookmaker}-ou-${index}`} className={index === 0 ? "is-line" : index === 1 ? "is-main" : ""}>
            {value}
          </span>
        ))}
      </div>
    </div>
  );
}

function MatchCard({ match }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <section className={`match-card ${isExpanded ? "is-expanded" : "is-collapsed"}`}>
      <button
        type="button"
        className="match-card__toggle"
        onClick={() => setIsExpanded((value) => !value)}
        aria-expanded={isExpanded}
      >
        <div className="match-card__header">
          <div>
            <p className="match-card__time">{match.time}</p>
            <h2>{match.fixture}</h2>
            <p className="match-card__league">{match.league}</p>
          </div>

          <div className="match-card__meta">
            <span className="match-card__count">{match.rows.length} 家机构</span>
            <span className={`match-card__arrow ${isExpanded ? "is-open" : ""}`}>
              <ChevronIcon />
            </span>
          </div>
        </div>
      </button>

      {isExpanded ? (
        <div className="odds-table">
          <div className="odds-table__header">
            <span>机构</span>
            <span>胜平负</span>
            <span>让球</span>
            <span>大小球</span>
          </div>

          <div className="odds-table__body">
            {match.rows.map((row) => (
              <OddsRow key={`${match.id}-${row.bookmaker}`} row={row} />
            ))}
          </div>
        </div>
      ) : null}
    </section>
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

  useEffect(() => {
    let ignore = false;

    async function loadSports() {
      try {
        const response = await fetch(`${API_BASE_URL}/sports`);
        if (!response.ok) {
          throw new Error(`sports request failed: ${response.status}`);
        }

        const data = await response.json();
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
        const params = new URLSearchParams({
          sport: selectedSport,
          regions: DEFAULT_REGIONS,
          markets: DEFAULT_MARKETS,
          parsed: "true"
        });
        const response = await fetch(`${API_BASE_URL}/odds?${params.toString()}`);
        if (!response.ok) {
          throw new Error(`odds request failed: ${response.status}`);
        }

        const data = await response.json();
        if (!ignore) {
          setMatches(data.map(normalizeMatch));
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
    isSportMenuOpen && sportQuery === selectedSportTitle ? "" : sportQuery.trim().toLowerCase();

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
    return matches.filter((match) => match.fixture.toLowerCase().includes(query));
  }, [matches, teamQuery]);

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
  }

  return (
    <div className="app-shell">
      <div className="page-glow page-glow--left" />
      <div className="page-glow page-glow--right" />

      <header className="topbar">
        <div className="brand-wrap">
          <div className="brand">足球赔率查询</div>
          <p className="brand-subtitle">多联赛赔率聚合与快速筛选</p>
        </div>

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

          <button type="button" className="export-button" onClick={exportJson}>
            <DownloadIcon />
            <span>导出 JSON</span>
          </button>
        </div>
      </header>

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
                  aria-label="切换赛事列表"
                >
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
                        onClick={() => selectSport(sport)}
                      >
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
                {loading ? "正在加载最新赔率..." : `共 ${filteredMatches.length} 场比赛`}
              </p>
            </div>
          </div>

          {error ? <div className="status-panel status-panel--error">{error}</div> : null}
          {!error && loading ? <div className="status-panel">正在同步最新赔率数据，请稍候。</div> : null}
          {!error && !loading && filteredMatches.length === 0 ? (
            <div className="status-panel">当前筛选条件下没有可展示的比赛。</div>
          ) : null}

          <div className="matches-list">
            {filteredMatches.map((match) => (
              <MatchCard key={match.id} match={match} />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
