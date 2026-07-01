import React, { useEffect, useState } from 'react';

export default function AptDetailModal({ apt, calcResult, onClose }) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!apt) return;
    let isMounted = true;

    const fetchHistory = async () => {
      setLoading(true);
      setError(false);
      if (!apt.id) { if (isMounted) setLoading(false); return; }

      try {
        const response = await fetch(`/data/transactions/${apt.id}.json`);
        if (!response.ok) {
          if (isMounted) { setTransactions([]); setLoading(false); }
          return;
        }
        const data = await response.json();
        if (isMounted) { setTransactions(data); setLoading(false); }
      } catch (e) {
        if (isMounted) { setError(true); setLoading(false); }
      }
    };

    fetchHistory();
    return () => { isMounted = false; };
  }, [apt]);

  if (!apt) return null;

  // 평형별로 최근 실거래가 매칭
  // transactions는 이미 날짜 내림차순(최신순)으로 정렬되어 있음
  const buildTypeCards = () => {
    if (!apt.types || apt.types.length === 0) return [];

    // area 기준으로 가장 최근 거래 찾기 (소수점 1자리까지 매칭)
    const latestByArea = {};
    transactions.forEach(tx => {
      const areaKey = parseFloat(tx.area).toFixed(1);
      if (!latestByArea[areaKey]) latestByArea[areaKey] = tx; // 이미 최신순이므로 첫번째가 최신
    });

    return apt.types.map(type => {
      const areaKey = parseFloat(type.area).toFixed(1);
      const latestTx = latestByArea[areaKey] || null;
      return { type, latestTx };
    });
  };

  const typeCards = buildTypeCards();

  const formatPrice = (dealAmount) => {
    if (!dealAmount) return null;
    const priceNum = parseInt(dealAmount.replace(/,/g, ''), 10);
    if (isNaN(priceNum)) return null;
    if (priceNum >= 10000) {
      const eok = Math.floor(priceNum / 10000);
      const man = priceNum % 10000;
      return man === 0 ? `${eok}억` : `${eok}억 ${man.toLocaleString()}만`;
    }
    return `${priceNum.toLocaleString()}만`;
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
      zIndex: 9999, display: 'flex', flexDirection: 'column',
      justifyContent: 'flex-end', animation: 'fadeIn 0.3s ease-out'
    }}>
      <div style={{
        background: 'rgba(20, 24, 34, 0.98)',
        borderTopLeftRadius: '24px', borderTopRightRadius: '24px',
        borderTop: '1px solid rgba(255,255,255,0.1)',
        boxShadow: '0 -10px 40px rgba(0,0,0,0.5)',
        width: '100%', height: '88vh',
        display: 'flex', flexDirection: 'column',
        animation: 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
      }}>
        {/* 핸들 */}
        <div style={{ width: '100%', display: 'flex', justifyContent: 'center', padding: '12px 0', cursor: 'pointer' }} onClick={onClose}>
          <div style={{ width: '40px', height: '5px', borderRadius: '3px', background: 'rgba(255,255,255,0.2)' }} />
        </div>

        <div style={{ padding: '0 24px 32px', overflowY: 'auto', flex: 1 }}>
          {/* 헤더 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: '800', margin: '0 0 4px 0', color: '#fff' }}>{apt.name}</h2>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>{apt.address}</p>
            </div>
            <button onClick={onClose} style={{
              background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%',
              width: '32px', height: '32px', color: '#fff', fontSize: '1.2rem',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
            }}>×</button>
          </div>

          {/* 단지 기본 스펙 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '24px' }}>
            {[
              { label: '준공연도', value: apt.buildYear ? `${apt.buildYear}년` : '미상' },
              { label: '총 가구수', value: apt.hhldCnt ? `${apt.hhldCnt.toLocaleString()}세대` : '미상' },
              { label: '현재 용적률', value: apt.curVolumetricRate ? `${apt.curVolumetricRate}%` : '미상' },
            ].map(({ label, value }) => (
              <div key={label} style={{ background: 'rgba(255,255,255,0.04)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '4px' }}>{label}</div>
                <div style={{ fontSize: '0.95rem', fontWeight: '700', color: '#fff' }}>{value}</div>
              </div>
            ))}
          </div>

          {/* 사업성 등급 */}
          {calcResult && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              padding: '14px 16px', marginBottom: '24px',
              background: 'rgba(255,255,255,0.03)', borderRadius: '12px',
              border: `1px solid ${calcResult.gradeColor}44`
            }}>
              <div style={{ fontSize: '1.6rem', fontWeight: '900', color: calcResult.gradeColor }}>{calcResult.businessGrade}</div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>사업성 등급 ({calcResult.score}점)</div>
                <div style={{ fontSize: '0.82rem', color: '#ccc', marginTop: '2px' }}>{calcResult.summaryText}</div>
              </div>
            </div>
          )}

          {/* 평형별 실거래가 섹션 */}
          <h3 style={{ fontSize: '1rem', fontWeight: '700', margin: '0 0 14px 0', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
            🏠 평형별 최근 실거래가
          </h3>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '1.8rem', animation: 'pulse 1.5s infinite' }}>🏢</div>
              <div style={{ marginTop: '10px', fontSize: '0.85rem' }}>실거래 데이터 불러오는 중...</div>
            </div>
          ) : error ? (
            <div style={{ textAlign: 'center', padding: '24px', color: '#ff6b6b', background: 'rgba(255,107,107,0.08)', borderRadius: '10px' }}>
              데이터를 불러오는데 실패했습니다.
            </div>
          ) : typeCards.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.02)', borderRadius: '10px' }}>
              평형 정보가 없습니다.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {typeCards.map(({ type, latestTx }, idx) => {
                const priceStr = latestTx ? formatPrice(latestTx.dealAmount) : null;
                return (
                  <div key={idx} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '16px 18px', background: 'rgba(255,255,255,0.04)',
                    borderRadius: '12px', border: '1px solid rgba(255,255,255,0.07)'
                  }}>
                    {/* 평형 정보 */}
                    <div>
                      <div style={{ fontSize: '1.05rem', fontWeight: '800', color: '#fff' }}>
                        {type.pyung}평
                        <span style={{ fontSize: '0.8rem', fontWeight: '400', color: 'var(--text-muted)', marginLeft: '6px' }}>
                          전용 {type.area}㎡
                        </span>
                      </div>
                      {type.landShare && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                          대지지분 {type.landShare}평
                        </div>
                      )}
                    </div>

                    {/* 최근 실거래가 */}
                    <div style={{ textAlign: 'right' }}>
                      {priceStr ? (
                        <>
                          <div style={{ fontSize: '1.05rem', fontWeight: '700', color: 'var(--color-primary)' }}>{priceStr}</div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>{latestTx.date} 계약</div>
                        </>
                      ) : (
                        <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.25)' }}>수집된 거래 없음</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 전체 거래 이력 (접을 수 있는 섹션) */}
          {!loading && !error && transactions.length > 0 && (
            <details style={{ marginTop: '24px' }}>
              <summary style={{
                fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-muted)',
                cursor: 'pointer', padding: '10px 0',
                borderTop: '1px solid rgba(255,255,255,0.07)', listStyle: 'none',
                display: 'flex', alignItems: 'center', gap: '6px'
              }}>
                📋 전체 거래 이력 ({transactions.length}건) 펼치기
              </summary>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
                {transactions.map((tx, idx) => {
                  const pyeong = (tx.area * 0.3025).toFixed(1);
                  return (
                    <div key={idx} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '12px 14px', background: 'rgba(255,255,255,0.03)',
                      borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)'
                    }}>
                      <div>
                        <div style={{ fontSize: '0.95rem', fontWeight: '700', color: '#fff' }}>{formatPrice(tx.dealAmount)}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                          전용 {tx.area}㎡ ({pyeong}평) · {tx.floor}층
                        </div>
                      </div>
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', textAlign: 'right' }}>{tx.date}</div>
                    </div>
                  );
                })}
              </div>
            </details>
          )}
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.5; transform: scale(0.95); }
          50% { opacity: 1; transform: scale(1.05); }
        }
        details summary::-webkit-details-marker { display: none; }
      `}</style>
    </div>
  );
}
