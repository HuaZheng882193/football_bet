import { useEffect, useState, useMemo } from "react";
import "./styles.css";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="16" height="16">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20L16.65 16.65" />
    </svg>
  );
}

function formatDate(isoString) {
  try {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    }).format(date);
  } catch (e) {
    return isoString;
  }
}

export default function Admin() {
  const [bets, setBets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    async function loadBets() {
      try {
        const response = await fetch(`${API_BASE_URL}/bets`);
        if (!response.ok) {
          throw new Error("获取投注数据失败");
        }
        const data = await response.json();
        setBets(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadBets();
  }, []);

  const filteredBets = useMemo(() => {
    return bets.filter(bet => {
      // 状态筛选
      if (statusFilter !== "all") {
        const betStatus = bet.status || "unsettled";
        if (statusFilter !== betStatus) return false;
      }

      // 关键词搜索
      if (!query.trim()) return true;
      const lowerQuery = query.toLowerCase();

      const matchFixture = bet.fixture?.toLowerCase().includes(lowerQuery);
      const matchBookmaker = bet.bookmaker?.toLowerCase().includes(lowerQuery);
      const matchSelection = bet.selection?.toLowerCase().includes(lowerQuery);
      const matchMarket = bet.market?.toLowerCase().includes(lowerQuery);
      const matchBettor = bet.bettor?.toLowerCase().includes(lowerQuery);
      
      let statusText = "未结算";
      if (bet.status === "win") statusText = "赢 红单";
      if (bet.status === "lose") statusText = "输 黑单";
      if (bet.status === "void") statusText = "走水 撤单";
      const matchStatus = statusText.includes(lowerQuery);

      return matchFixture || matchBookmaker || matchSelection || matchMarket || matchBettor || matchStatus;
    });
  }, [bets, query, statusFilter]);

  const stats = useMemo(() => {
    let totalStake = 0;
    let totalEstimatedReturn = 0;
    
    filteredBets.forEach(bet => {
      totalStake += bet.stake || 0;
      totalEstimatedReturn += bet.estimatedReturn || 0;
    });

    return { totalStake, totalEstimatedReturn };
  }, [filteredBets]);

  async function handleSettle(betId, status) {
    if (!window.confirm(`确定要将该笔订单结算为“${status === 'win' ? '赢' : status === 'lose' ? '输' : '走水'}”吗？`)) {
      return;
    }
    try {
      const response = await fetch(`${API_BASE_URL}/bets/settle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: betId, status })
      });
      if (!response.ok) throw new Error("结算请求失败");
      
      // Update local state
      setBets(prev => prev.map(b => b.id === betId ? { ...b, status } : b));
    } catch (err) {
      alert(`结算失败: ${err.message}`);
    }
  }

  function renderStatus(bet) {
    if (bet.status === 'win') {
      return <span style={{ color: '#10b981', fontWeight: 'bold' }}>赢 (红单)</span>;
    }
    if (bet.status === 'lose') {
      return <span style={{ color: '#ef4444', fontWeight: 'bold' }}>输 (黑单)</span>;
    }
    if (bet.status === 'void') {
      return <span style={{ color: 'var(--text-muted)' }}>走水/撤单</span>;
    }
    return (
      <div style={{ display: 'flex', gap: '8px' }}>
        <button onClick={() => handleSettle(bet.id, 'win')} style={{ padding: '4px 8px', fontSize: '12px', background: '#10b981', color: '#fff', borderRadius: '4px' }}>赢</button>
        <button onClick={() => handleSettle(bet.id, 'lose')} style={{ padding: '4px 8px', fontSize: '12px', background: '#ef4444', color: '#fff', borderRadius: '4px' }}>输</button>
        <button onClick={() => handleSettle(bet.id, 'void')} style={{ padding: '4px 8px', fontSize: '12px', background: 'var(--bg-inset)', color: 'var(--text-secondary)', borderRadius: '4px', border: '1px solid var(--border-divider)' }}>走水</button>
      </div>
    );
  }

  return (
    <div className="admin-panel" style={{ padding: '20px' }}>
      <header className="admin-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '32px' }}>后台管理 - 投注记录</h1>
          <p style={{ margin: '8px 0 0', color: 'var(--text-secondary)', display: 'flex', gap: '16px', alignItems: 'center' }}>
            <span>共 {filteredBets.length} 条记录</span>
            <span style={{ width: '1px', height: '14px', background: 'var(--border-divider)' }}></span>
            <span>投注总额: <strong style={{ color: 'var(--text-primary)' }}>¥{stats.totalStake.toFixed(2)}</strong></span>
            <span style={{ width: '1px', height: '14px', background: 'var(--border-divider)' }}></span>
            <span>预计总回报: <strong style={{ color: '#10b981' }}>¥{stats.totalEstimatedReturn.toFixed(2)}</strong></span>
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: '12px', width: '100%', maxWidth: '420px' }}>
          <select 
            value={statusFilter} 
            onChange={e => setStatusFilter(e.target.value)}
            style={{ 
              padding: '10px 14px', 
              borderRadius: '8px', 
              background: 'rgba(10, 14, 24, 0.76)', 
              color: 'var(--text-primary)',
              border: '1px solid var(--border-divider)',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="all">全部状态</option>
            <option value="unsettled">未结算</option>
            <option value="win">赢 (红单)</option>
            <option value="lose">输 (黑单)</option>
            <option value="void">走水/撤单</option>
          </select>

          <label className="search-box" htmlFor="bet-search" style={{ flex: 1, minWidth: 0 }}>
            <SearchIcon />
            <input
              id="bet-search"
              type="text"
              placeholder="搜索赛事、状态、投注人..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
        </div>
      </header>

      {error && <div className="status-panel status-panel--error">{error}</div>}
      {loading && <div className="status-panel">加载中...</div>}

      {!loading && !error && (
        <div className="admin-table-container" style={{ overflowX: 'auto', background: 'var(--bg-card-strong)', borderRadius: '16px', border: '1px solid var(--border-divider)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-divider)', background: 'var(--bg-card)', color: 'var(--text-tertiary)' }}>
                <th style={{ padding: '16px', fontWeight: '600' }}>时间</th>
                <th style={{ padding: '16px', fontWeight: '600' }}>投注人</th>
                <th style={{ padding: '16px', fontWeight: '600' }}>赛事</th>
                <th style={{ padding: '16px', fontWeight: '600' }}>机构</th>
                <th style={{ padding: '16px', fontWeight: '600' }}>盘口</th>
                <th style={{ padding: '16px', fontWeight: '600' }}>选择 (赔率)</th>
                <th style={{ padding: '16px', fontWeight: '600', textAlign: 'right' }}>投注金额</th>
                <th style={{ padding: '16px', fontWeight: '600', textAlign: 'right' }}>预计回报</th>
                <th style={{ padding: '16px', fontWeight: '600' }}>状态/操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredBets.length === 0 ? (
                <tr>
                  <td colSpan="9" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>没有找到匹配的记录</td>
                </tr>
              ) : (
                filteredBets.map((bet) => (
                  <tr key={bet.id} style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.05)' }}>
                    <td style={{ padding: '16px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{formatDate(bet.time)}</td>
                    <td style={{ padding: '16px', color: 'var(--text-primary)', fontWeight: 'bold' }}>{bet.bettor || "匿名"}</td>
                    <td style={{ padding: '16px', color: 'var(--text-primary)' }}>{bet.fixture}</td>
                    <td style={{ padding: '16px', color: 'var(--text-secondary)' }}>
                      <span className="bookmaker-badge muted" style={{ marginRight: '8px' }}>
                        {bet.bookmaker?.slice(0, 1)?.toUpperCase() || "?"}
                      </span>
                      {bet.bookmaker}
                    </td>
                    <td style={{ padding: '16px', color: 'var(--text-secondary)' }}>{bet.market}</td>
                    <td style={{ padding: '16px' }}>
                      <span style={{ color: 'var(--accent-soft)', fontWeight: 'bold' }}>{bet.selection}</span>
                      <span style={{ color: 'var(--text-tertiary)', marginLeft: '6px' }}>@{bet.price}</span>
                    </td>
                    <td style={{ padding: '16px', textAlign: 'right', fontWeight: '600' }}>¥ {bet.stake?.toFixed(2)}</td>
                    <td style={{ padding: '16px', textAlign: 'right', color: '#10b981', fontWeight: 'bold' }}>¥ {bet.estimatedReturn?.toFixed(2)}</td>
                    <td style={{ padding: '16px' }}>{renderStatus(bet)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
