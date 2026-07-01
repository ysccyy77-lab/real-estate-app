import React, { useState, useCallback, useEffect } from 'react';
import Calculator from './components/Calculator';
import ResultDashboard from './components/ResultDashboard';
import GlossaryGuide from './components/GlossaryGuide';
import { calculateReconstruction } from './utils/calculator';
import MapDashboard from './components/MapDashboard';
import UnionChat from './components/UnionChat';

export default function App() {
  const [activeTab, setActiveTab] = useState('calc'); // 'calc', 'map', 'helper', 'chat', 'funding'
  const [calcResult, setCalcResult] = useState(null);
  const [dbProgress, setDbProgress] = useState(null);
  const [selectedApt, setSelectedApt] = useState(null);

  // 실시간 DB 갱신 진행률 폴링
  useEffect(() => {
    const fetchProgress = async () => {
      try {
        // Vite 개발 서버 환경이므로 timestamp를 쿼리로 붙여 캐시 우회하여 읽기
        const res = await fetch(`/src/utils/progress.json?t=${new Date().getTime()}`);
        if (res.ok) {
          const data = await res.json();
          setDbProgress(data);
        }
      } catch (err) {
        // 파일이 없거나 오류 시 무시
      }
    };
    fetchProgress();
    const interval = setInterval(fetchProgress, 2000);
    return () => clearInterval(interval);
  }, []);

  // 계산 콜백
  const handleCalculate = useCallback((inputs) => {
    if (!inputs) {
      setCalcResult(null);
      return;
    }
    const result = calculateReconstruction(inputs);
    setCalcResult(result);
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', paddingBottom: '70px' }}>
      {/* 1. 상단 앱 헤더 */}
      <header className="app-header" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, var(--color-secondary), var(--color-primary))',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              color: 'var(--text-dark)',
              fontWeight: '800',
              fontSize: '1rem'
            }}>
              🏢
            </div>
            <div>
              <h1 style={{ fontSize: '1.05rem', fontWeight: '700', lineHeight: 1.2 }}>하우징케어</h1>
              <span style={{ fontSize: '0.65rem', color: 'var(--color-primary)', fontWeight: '600', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                Reconstruction Helper
              </span>
            </div>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', padding: '4px 10px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.08)' }}>
            Ver 1.5 (Pro)
          </div>
        </div>

        {/* 실시간 프로그레스 바 UI */}
        {dbProgress && (
          <div style={{ 
            background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '10px',
            border: '1px solid rgba(255,255,255,0.05)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '6px' }}>
              <span style={{ color: 'var(--color-primary)', fontWeight: '600' }}>
                🚀 DB 백그라운드 실시간 갱신 중...
              </span>
              <span>{dbProgress.progress}% ({dbProgress.success + dbProgress.fail + dbProgress.skip} / {dbProgress.total})</span>
            </div>
            <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{ 
                width: `${dbProgress.progress}%`, 
                height: '100%', 
                background: 'linear-gradient(90deg, var(--color-secondary), var(--color-primary))',
                transition: 'width 0.5s ease-out'
              }} />
            </div>
          </div>
        )}
      </header>

      {/* 2. 메인 컨텐츠 영역 */}
      <main className="app-container">
        
        {/* TAB 1: 사업성 계산기 */}
        {activeTab === 'calc' && (
          <>
            <div style={{ textAlign: 'center', margin: '10px 0' }} className="animate-fade-in">
              <h2 style={{ fontSize: '1.5rem', marginBottom: '8px', fontWeight: '700' }}>재건축 사업성 계산기</h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                기본 정보 입력만으로 아파트 재건축 분담금과 사업성 가치를 바로 확인하세요.
              </p>
            </div>
            
            <Calculator onCalculate={handleCalculate} onAptSelect={setSelectedApt} />
            <ResultDashboard result={calcResult} />
            <GlossaryGuide />
          </>
        )}

        {/* TAB: 지도 기반 시각화 */}
        {activeTab === 'map' && <MapDashboard onAptSelect={setSelectedApt} />}

        {/* TAB 2: 재건축 도우미 (로드맵 프리뷰) */}
        {activeTab === 'helper' && (
          <div className="glass-card animate-fade-in" style={{ padding: '24px' }}>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <span style={{ fontSize: '2.5rem' }}>📋</span>
              <h2 style={{ fontSize: '1.3rem', margin: '12px 0 6px 0', fontWeight: '700' }}>재건축 단계별 도우미</h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                복잡한 재건축 절차를 제품 개발 스프린트처럼 한눈에 파악하고, 조합원과 추진위가 각 단계에서 당장 해야 할 업무 가이드를 제공합니다.
              </p>
            </div>

            {/* 타임라인 단계 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', position: 'relative', paddingLeft: '20px' }}>
              {/* 타임라인 수직선 */}
              <div style={{
                position: 'absolute',
                left: '4px',
                top: '10px',
                bottom: '10px',
                width: '2px',
                background: 'linear-gradient(to bottom, var(--color-primary), rgba(255,255,255,0.05))'
              }} />

              {/* 1단계 (완료/진행중 표시) */}
              <div style={{ position: 'relative' }}>
                <div style={{
                  position: 'absolute',
                  left: '-20px',
                  top: '4px',
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  background: 'var(--color-primary)',
                  boxShadow: '0 0 8px var(--color-primary)'
                }} />
                <h4 style={{ color: 'var(--color-primary)', fontSize: '0.95rem', marginBottom: '4px' }}>1단계: 준비 및 사업성 분석 (현재 단계)</h4>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                  소유주들이 모여 대략적인 사업성을 계산해 보고 사전 동의를 모으는 단계입니다. 현재 구동 중인 <strong>사업성 계산기</strong>가 이 단계에 해당합니다.
                </p>
                <div style={{ display: 'inline-block', marginTop: '6px', fontSize: '0.75rem', background: 'rgba(0, 242, 254, 0.15)', color: 'var(--color-primary)', padding: '2px 8px', borderRadius: '4px', fontWeight: '600' }}>
                  활성화됨
                </div>
              </div>

              {/* 2단계 */}
              <div style={{ position: 'relative', opacity: 0.6 }}>
                <div style={{
                  position: 'absolute',
                  left: '-20px',
                  top: '4px',
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  background: 'var(--text-muted)'
                }} />
                <h4 style={{ color: 'var(--text-main)', fontSize: '0.95rem', marginBottom: '4px' }}>2단계: 안전진단 및 구역 지정</h4>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                  단지의 노후도를 평가받고 재건축 정비구역을 지정받는 단계입니다. 조합원들이 모금을 진행하여 진단 수수료를 예치해야 합니다.
                </p>
              </div>

              {/* 3단계 */}
              <div style={{ position: 'relative', opacity: 0.6 }}>
                <div style={{
                  position: 'absolute',
                  left: '-20px',
                  top: '4px',
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  background: 'var(--text-muted)'
                }} />
                <h4 style={{ color: 'var(--text-main)', fontSize: '0.95rem', marginBottom: '4px' }}>3단계: 조합설립 인가</h4>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                  정식으로 조합원 총회를 열고 조합 설립 승인을 받는 시기입니다. 75% 이상의 동의서 확보가 가장 중요합니다.
                </p>
              </div>

              {/* 4단계 */}
              <div style={{ position: 'relative', opacity: 0.6 }}>
                <div style={{
                  position: 'absolute',
                  left: '-20px',
                  top: '4px',
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  background: 'var(--text-muted)'
                }} />
                <h4 style={{ color: 'var(--text-main)', fontSize: '0.95rem', marginBottom: '4px' }}>4단계: 시공사 선정 및 사업시행 인가</h4>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                  대형 건설사들의 입찰 공고를 내고 투표를 통해 시공 파트너를 최종 낙점하는 화려한 축제 단계입니다.
                </p>
              </div>

              {/* 5단계 */}
              <div style={{ position: 'relative', opacity: 0.6 }}>
                <div style={{
                  position: 'absolute',
                  left: '-20px',
                  top: '4px',
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  background: 'var(--text-muted)'
                }} />
                <h4 style={{ color: 'var(--text-main)', fontSize: '0.95rem', marginBottom: '4px' }}>5단계: 관리처분 계획 및 이주/착공</h4>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                  개인별 분담금이 최종 확정되고, 이주비 지급 후 기존 아파트를 철거하고 새로운 아파트 공사를 개시하는 종착지입니다.
                </p>
              </div>
            </div>
            
            <div style={{ marginTop: '24px', padding: '12px', background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>
              💡 추후 업데이트를 통해 단계별 체크리스트와 알림 가이드 기능이 추가될 예정입니다.
            </div>
          </div>
        )}

        {/* TAB 3: 조합원 소통 */}
        {activeTab === 'chat' && (
          <UnionChat selectedApt={selectedApt} onAptSelect={setSelectedApt} />
        )}

        {/* TAB 4: 입찰/모금 (준비 중) */}
        {activeTab === 'funding' && (
          <div className="glass-card animate-fade-in" style={{ padding: '24px' }}>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <span style={{ fontSize: '2.5rem' }}>💰</span>
              <h2 style={{ fontSize: '1.3rem', margin: '12px 0 6px 0', fontWeight: '700' }}>입찰 및 투명 모금 플랫폼</h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                안전진단 예치금 등 초기 단계에 필요한 비용을 조합원들이 모바일 결제로 투명하게 납부하고, 실시간 현황을 함께 모니터링합니다. 시공사 입찰 공고 및 공사비 제안 기능도 지원합니다.
              </p>
            </div>

            {/* 가상 모금 현황판 */}
            <div style={{
              background: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '20px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: '600' }}>🔒 1차 안전진단 비용 모금</span>
                <span style={{ fontSize: '0.85rem', color: 'var(--color-primary)', fontWeight: '700' }}>82% 달성</span>
              </div>
              <div style={{ height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden', marginBottom: '14px' }}>
                <div style={{ width: '82%', height: '100%', background: 'linear-gradient(90deg, var(--color-secondary), var(--color-primary))' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '0.8rem' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>현재 모금액: </span>
                  <span style={{ fontWeight: '700' }}>8,200 만원</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ color: 'var(--text-muted)' }}>목표 금액: </span>
                  <span style={{ fontWeight: '700' }}>1 억원</span>
                </div>
              </div>
            </div>

            {/* 가상 시공사 입찰 공고 */}
            <h3 style={{ fontSize: '0.95rem', color: 'var(--text-muted)', marginBottom: '12px', fontWeight: '600' }}>
              🏗️ 건설사 입찰 및 제안 현황
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ padding: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: '700' }}>현대건설 - 디에이치 프레스티지</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>제안 공사비: 평당 780만원 | 이주비 대출 지원 가능</div>
                </div>
                <span style={{ fontSize: '0.7rem', color: 'var(--color-success)', background: 'rgba(16,185,129,0.1)', padding: '2px 6px', borderRadius: '4px' }}>제안 접수</span>
              </div>

              <div style={{ padding: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: '700' }}>삼성물산 - 래미안 더 센트럴</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>제안 공사비: 평당 810만원 | 특별 조경 업그레이드 제안</div>
                </div>
                <span style={{ fontSize: '0.7rem', color: 'var(--color-success)', background: 'rgba(16,185,129,0.1)', padding: '2px 6px', borderRadius: '4px' }}>제안 접수</span>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* 3. 하단 네비게이션 탭바 */}
      <nav className="bottom-nav">
        <button
          className={`nav-item ${activeTab === 'calc' ? 'active' : ''}`}
          onClick={() => setActiveTab('calc')}
        >
          <svg viewBox="0 0 24 24" fill="none" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <line x1="9" y1="9" x2="15" y2="9" />
            <line x1="9" y1="13" x2="15" y2="13" />
            <line x1="9" y1="17" x2="15" y2="17" />
          </svg>
          <span>사업성 계산</span>
        </button>

        <button
          className={`nav-item ${activeTab === 'map' ? 'active' : ''}`}
          onClick={() => setActiveTab('map')}
        >
          <svg viewBox="0 0 24 24" fill="none" strokeWidth="2">
            <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
            <line x1="9" y1="3" x2="9" y2="18" />
            <line x1="15" y1="6" x2="15" y2="21" />
          </svg>
          <span>지도 보기</span>
        </button>

        <button
          className={`nav-item ${activeTab === 'helper' ? 'active' : ''}`}
          onClick={() => setActiveTab('helper')}
        >
          <svg viewBox="0 0 24 24" fill="none" strokeWidth="2">
            <path d="M9 11l3 3L22 4" />
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
          </svg>
          <span>재건축 도우미</span>
        </button>

        <button
          className={`nav-item ${activeTab === 'chat' ? 'active' : ''}`}
          onClick={() => setActiveTab('chat')}
        >
          <svg viewBox="0 0 24 24" fill="none" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <span>조합원 소통</span>
        </button>

        <button
          className={`nav-item ${activeTab === 'funding' ? 'active' : ''}`}
          onClick={() => setActiveTab('funding')}
        >
          <svg viewBox="0 0 24 24" fill="none" strokeWidth="2">
            <line x1="12" y1="1" x2="12" y2="23" />
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
          <span>입찰/모금</span>
        </button>
      </nav>
    </div>
  );
}
