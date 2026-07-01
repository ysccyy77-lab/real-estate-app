import React, { useEffect, useState } from 'react';



export default function AptDetailModal({ apt, calcResult, onClose }) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [apiAuthError, setApiAuthError] = useState(false); // API 권한 미신청 및 500에러 감지 상태

  useEffect(() => {
    if (!apt) return;

    let isMounted = true;
    const fetchHistory = async () => {
      setLoading(true);
      setError(false);
      setApiAuthError(false);

      if (!apt.id) {
        if (isMounted) setLoading(false);
        return;
      }

      try {
        const response = await fetch(`/data/transactions/${apt.id}.json`);
        
        if (!response.ok) {
          if (response.status === 404) {
            // 파일이 없으면 거래 내역이 없는 것으로 간주
            if (isMounted) setTransactions([]);
          } else {
            if (isMounted) setError(true);
          }
          if (isMounted) setLoading(false);
          return;
        }

        const data = await response.json();
        if (isMounted) {
          setTransactions(data);
          setLoading(false);
        }
      } catch (e) {
        console.error('Failed to fetch transactions:', e);
        if (isMounted) {
          setError(true);
          setLoading(false);
        }
      }
    };

    fetchHistory();
    return () => { isMounted = false; };
  }, [apt]);

  if (!apt) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.6)',
      backdropFilter: 'blur(4px)',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-end',
      animation: 'fadeIn 0.3s ease-out'
    }}>
      <div style={{
        background: 'rgba(20, 24, 34, 0.98)',
        borderTopLeftRadius: '24px',
        borderTopRightRadius: '24px',
        borderTop: '1px solid rgba(255,255,255,0.1)',
        boxShadow: '0 -10px 40px rgba(0,0,0,0.5)',
        width: '100%',
        height: '85vh',
        display: 'flex',
        flexDirection: 'column',
        animation: 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
      }}>
        {/* 모달 핸들 */}
        <div style={{ width: '100%', display: 'flex', justifyContent: 'center', padding: '12px 0', cursor: 'pointer' }} onClick={onClose}>
          <div style={{ width: '40px', height: '5px', borderRadius: '3px', background: 'rgba(255,255,255,0.2)' }} />
        </div>

        <div style={{ padding: '0 24px 24px', overflowY: 'auto', flex: 1 }}>
          {/* 헤더 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
            <div>
              <h2 style={{ fontSize: '1.6rem', fontWeight: '800', margin: '0 0 4px 0', color: '#fff' }}>{apt.name}</h2>
              <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>{apt.address}</p>
            </div>
            <button onClick={onClose} style={{
              background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%',
              width: '32px', height: '32px', color: '#fff', fontSize: '1.2rem', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>×</button>
          </div>

          {/* 사업성 및 스펙 */}
          {calcResult && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '12px', border: `1px solid ${calcResult.gradeColor}` }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>사업성 등급</div>
                <div style={{ fontSize: '1.4rem', fontWeight: '800', color: calcResult.gradeColor }}>{calcResult.businessGrade} <span style={{fontSize:'0.9rem'}}>({calcResult.score}점)</span></div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>건축물 스펙</div>
                <div style={{ fontSize: '0.9rem', color: '#fff', lineHeight: 1.4 }}>
                  준공: <span style={{fontWeight:'bold'}}>{apt.buildYear || '미상'}년</span><br/>
                  용적률: <span style={{fontWeight:'bold'}}>{apt.curVolumetricRate ? `${apt.curVolumetricRate}%` : '미상'}</span>
                </div>
              </div>
            </div>
          )}

          {/* 실거래가 영역 */}
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              📉 최근 실거래가 이력 <span style={{ fontSize:'0.8rem', fontWeight:'normal', color:'var(--text-muted)' }}>(로컬 정적 DB 로드)</span>
            </h3>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: '2rem', animation: 'pulse 1.5s infinite' }}>🏢</div>
                <div style={{ marginTop: '12px', fontSize: '0.9rem' }}>초고속 로컬 DB에서 데이터를 불러오는 중입니다...</div>
              </div>
            ) : apiAuthError ? (
              <div style={{ 
                padding: '20px', background: 'rgba(239, 68, 68, 0.08)', 
                border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '12px', 
                color: '#fca5a5', fontSize: '0.9rem', lineHeight: '1.6' 
              }}>
                <div style={{ fontWeight: 'bold', fontSize: '1rem', color: '#ef4444', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  ⚠️ 공공데이터 API 연동 실패 (인증오류)
                </div>
                현재 등록된 공공데이터 인증키에 <strong>'국토교통부_아파트매매 실거래 상세 자료'</strong> API 활용 권한이 승인되지 않았거나 만료되었습니다.<br/>
                <div style={{ marginTop: '10px', fontSize: '0.8rem', color: '#cbd5e1', padding: '10px', background: 'rgba(0,0,0,0.2)', borderRadius: '6px' }}>
                  💡 <strong>해결 방법:</strong><br/>
                  1. <a href="https://www.data.go.kr" target="_blank" rel="noreferrer" style={{color:'var(--color-primary)', textDecoration:'underline'}}>공공데이터포털(data.go.kr)</a> 로그인<br/>
                  2. <strong>'국토교통부_아파트매매 실거래가 상세 자료'</strong> 서비스 검색 후 [활용신청]<br/>
                  3. 승인 완료(보통 즉시 승인) 후 다시 테스트해 주세요.
                </div>
              </div>
            ) : error ? (
              <div style={{ textAlign: 'center', padding: '30px 0', color: '#ff6b6b', background: 'rgba(255,107,107,0.1)', borderRadius: '12px' }}>
                네트워크 오류 또는 공공데이터 서버 장애로 데이터를 불러오는데 실패했습니다.
              </div>
            ) : transactions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.02)', borderRadius: '12px' }}>
                수집된 과거 실거래 내역이 없습니다.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {transactions.map((tx, idx) => {
                  const pyeong = (tx.area * 0.3025).toFixed(1);
                  // 국토부 데이터는 dealAmount ("54,000" 형태의 문자열)로 들어옵니다.
                  const priceNum = parseInt((tx.dealAmount || '0').replace(/,/g, ''), 10);
                  const priceStr = priceNum >= 10000 
                    ? `${Math.floor(priceNum/10000)}억 ${priceNum%10000 === 0 ? '' : (priceNum%10000).toLocaleString()}`
                    : `${priceNum.toLocaleString()}`;

                  return (
                    <div key={idx} style={{ 
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '16px', background: 'rgba(255,255,255,0.04)', borderRadius: '12px',
                      border: '1px solid rgba(255,255,255,0.05)'
                    }}>
                      <div>
                        <div style={{ fontSize: '1.1rem', fontWeight: '700', color: '#fff' }}>{priceStr}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>전용 {tx.area}㎡ ({pyeong}평) · {tx.floor}층</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>계약일</div>
                        <div style={{ fontSize: '0.95rem', fontWeight: '600', color: '#ccc', marginTop: '2px' }}>{tx.date}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
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
          0% { opacity: 0.5; transform: scale(0.95); }
          50% { opacity: 1; transform: scale(1.05); }
          100% { opacity: 0.5; transform: scale(0.95); }
        }
      `}</style>
    </div>
  );
}
