import React from 'react';

export default function ResultDashboard({ result }) {
  if (!result) return null;

  const {
    realLandShare,
    generalContributionShare,
    totalMemberCost,
    generalContributionProfit,
    estimatedContribution,
    rentalFarContribution,
    rentalRatio,
    businessGrade,
    gradeColor,
    score, // score 변수 안에 비례율(%) 값이 들어있음
    appraisalValue,
    rightsValue,
    proportionalRate,
    summaryText,
    investmentAnalysis,
    inputs
  } = result;

  const isRefund = estimatedContribution < 0;
  const absContribution = Math.abs(estimatedContribution);
  const contributionInEok = (absContribution / 10000).toFixed(2);

  // 용도지역 정보 한국어 친화 매핑
  const zoneName = inputs.zoneRegion || '제3종일반주거지역';

  return (
    <div className="glass-card animate-fade-in" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* 아파트 주소 표기 (연동 시에만 노출) */}
      {inputs.apartmentName && (
        <div style={{
          background: 'rgba(0, 242, 254, 0.03)',
          border: '1px solid rgba(0, 242, 254, 0.1)',
          borderRadius: '8px',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <span style={{ fontSize: '1.2rem' }}>📍</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--color-primary)' }}>{inputs.apartmentName}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>{inputs.apartmentAddress}</div>
          </div>
        </div>
      )}

      {/* 게이지 및 등급 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        <div style={{ position: 'relative', width: '100px', height: '100px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <svg style={{ transform: 'rotate(-90deg)', width: '100px', height: '100px' }}>
            <circle
              cx="50"
              cy="50"
              r="40"
              stroke="rgba(255, 255, 255, 0.05)"
              strokeWidth="8"
              fill="transparent"
            />
            <circle
              cx="50"
              cy="50"
              r="40"
              stroke={gradeColor}
              strokeWidth="8"
              fill="transparent"
              strokeDasharray={2 * Math.PI * 40}
              strokeDashoffset={(2 * Math.PI * 40) - (Math.min(score, 150) / 150) * (2 * Math.PI * 40)}
              strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 0.6s ease' }}
            />
          </svg>
          <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span style={{ fontSize: '1.3rem', fontWeight: '800', color: 'var(--text-main)' }}>{score}</span>
            <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>% (비례율)</span>
          </div>
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>기대 사업성</span>
            <span style={{
              background: `${gradeColor}18`,
              color: gradeColor,
              border: `1px solid ${gradeColor}33`,
              padding: '1px 8px',
              borderRadius: '12px',
              fontSize: '0.75rem',
              fontWeight: '700'
            }}>
              {businessGrade}
            </span>
          </div>
          <h2 style={{ fontSize: '1.15rem', marginBottom: '4px', fontWeight: '700' }}>
            {isRefund ? '환급을 받을 가능성이 높습니다!' : '추가 분담금이 예상됩니다.'}
          </h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
            {summaryText}
          </p>
        </div>
      </div>

      <hr style={{ border: 'none', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }} />

      {/* 용적률 및 임대 기부채납 정보 바 */}
      {rentalFarContribution > 0 && (
        <div style={{
          background: 'rgba(245, 158, 11, 0.04)',
          border: '1px solid rgba(245, 158, 11, 0.12)',
          borderRadius: '8px',
          padding: '12px',
          fontSize: '0.8rem',
          lineHeight: '1.4',
          color: 'var(--color-warning)'
        }}>
          ⚠️ <strong>법정 기부채납 임대 차감 조항 반영:</strong><br />
          {zoneName} 용적률 상한 초과 완화분 중 <strong>{rentalRatio}%</strong>(용적률 {rentalFarContribution}%p 상당)는 장기전세 임대주택 공급으로 공제되어 일반분양 수입에서 제외 처리되었습니다.
        </div>
      )}

      {/* 예상 분담금/환급금 표시 카드 */}
      <div style={{
        background: isRefund ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
        border: isRefund ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(239, 68, 68, 0.2)',
        borderRadius: '12px',
        padding: '16px',
        textAlign: 'center'
      }}>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '500' }}>
          예상 {isRefund ? '환급금' : '추가 분담금'} ({inputs.targetSize}평형 신축 기준)
        </span>
        <div style={{
          fontSize: '2rem',
          fontWeight: '800',
          color: isRefund ? 'var(--color-success)' : 'var(--color-warning)',
          margin: '4px 0',
          letterSpacing: '-0.02em'
        }}>
          {isRefund ? '+' : '-'} {absContribution.toLocaleString()} 만원
        </div>
        <span style={{ fontSize: '0.9rem', color: 'var(--text-main)', fontWeight: '600', opacity: 0.9 }}>
          (약 {contributionInEok} 억원)
        </span>
      </div>

      {/* 2. 투자 수익성 리포트 (실거래가 연동 시에만 노출) */}
      {investmentAnalysis && (
        <div style={{
          background: 'rgba(19, 27, 46, 0.5)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: '12px',
          padding: '18px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <h3 style={{ fontSize: '0.9rem', color: 'var(--color-primary)', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}>
            📈 법정동 신축 시세 대비 가치 분석
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>기존 매입가 (최근 실거래가)</span>
              <span>{(investmentAnalysis.recentPrice / 10000).toFixed(2)} 억원</span>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>예상 총 취득 비용 (매입가 + 분담금)</span>
              <span style={{ fontWeight: '600' }}>{(investmentAnalysis.totalAcquisitionPrice / 10000).toFixed(2)} 억원</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '8px' }}>
              <span style={{ color: 'var(--text-muted)' }}>완공 후 예상 가치 (인근 신축 {inputs.targetSize}평형 평균가)</span>
              <span>{(investmentAnalysis.expectedValue / 10000).toFixed(2)} 억원</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', paddingTop: '4px' }}>
              <span style={{ fontWeight: '700', color: 'var(--text-main)' }}>기대 안전마진 (수익금)</span>
              <span style={{
                fontWeight: '800',
                color: investmentAnalysis.expectedMargin >= 0 ? 'var(--color-success)' : 'var(--color-danger)'
              }}>
                {investmentAnalysis.expectedMargin >= 0 ? `+${(investmentAnalysis.expectedMargin / 10000).toFixed(2)}` : `${(investmentAnalysis.expectedMargin / 10000).toFixed(2)}`} 억원
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
              <span style={{ fontWeight: '700', color: 'var(--text-main)' }}>예상 투자 수익률 (ROI)</span>
              <span style={{
                fontWeight: '800',
                color: investmentAnalysis.expectedROI >= 0 ? 'var(--color-success)' : 'var(--color-danger)'
              }}>
                {investmentAnalysis.expectedROI >= 0 ? `+${investmentAnalysis.expectedROI}` : investmentAnalysis.expectedROI}%
              </span>
            </div>
          </div>

          <div style={{
            background: investmentAnalysis.expectedMargin >= 0 ? 'rgba(16, 185, 129, 0.05)' : 'rgba(239, 68, 68, 0.05)',
            border: investmentAnalysis.expectedMargin >= 0 ? '1px solid rgba(16, 185, 129, 0.1)' : '1px solid rgba(239, 68, 68, 0.1)',
            borderRadius: '6px',
            padding: '8px 12px',
            fontSize: '0.75rem',
            lineHeight: 1.4,
            color: investmentAnalysis.expectedMargin >= 0 ? 'var(--color-success)' : 'var(--color-warning)',
            textAlign: 'center'
          }}>
            {investmentAnalysis.expectedMargin >= 0 
              ? `💡 인근 신축 실거래 시세 대비 약 ${(investmentAnalysis.expectedMargin / 10000).toFixed(1)}억 원 저렴하게 취득하는 효과가 있습니다.`
              : '💡 주변 동네 신축 시세 대비 안전마진이 부족하여 보수적인 정비계획 수립이 필요합니다.'
            }
          </div>
        </div>
      )}

      {/* 세부 분석 리포트 */}
      <div>
        <h3 style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '10px', fontWeight: '600' }}>
          📊 상세 사업비 및 자산 내역 (단일 세대 기준 환산)
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', padding: '4px 0', borderBottom: '1px dashed rgba(255,255,255,0.04)' }}>
            <span style={{ color: 'var(--text-muted)' }}>종전자산 감정평가액 (현재 집값 가치)</span>
            <span style={{ fontWeight: '500' }}>{appraisalValue ? (appraisalValue / 10000).toFixed(2) : 0} 억원</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', padding: '4px 0', borderBottom: '1px dashed rgba(255,255,255,0.04)' }}>
            <span style={{ color: 'var(--text-muted)' }}>정비사업 비례율</span>
            <span style={{ fontWeight: '600', color: gradeColor }}>{score} %</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: '4px' }}>
            <span style={{ color: 'var(--text-main)', fontWeight: '700' }}>최종 권리가액 (내 재산 인정액)</span>
            <span style={{ fontWeight: '700', color: 'var(--color-primary)' }}>{rightsValue ? (rightsValue / 10000).toFixed(2) : 0} 억원</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', padding: '4px 0', borderBottom: '1px dashed rgba(255,255,255,0.04)' }}>
            <span style={{ color: 'var(--text-muted)' }}>실사용 대지지분 (기부채납 공제 후)</span>
            <span style={{ fontWeight: '500' }}>{realLandShare} 평 (기존 {inputs.existingLandShare}평)</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', padding: '4px 0', borderBottom: '1px dashed rgba(255,255,255,0.04)' }}>
            <span style={{ color: 'var(--text-muted)' }}>일반분양 공급면적 (세대당 기여분)</span>
            <span style={{
              fontWeight: '600',
              color: generalContributionShare >= 0 ? 'var(--color-success)' : 'var(--color-danger)'
            }}>
              {generalContributionShare >= 0 ? `+${generalContributionShare}` : generalContributionShare} 평
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', padding: '4px 0', borderBottom: '1px dashed rgba(255,255,255,0.04)' }}>
            <span style={{ color: 'var(--text-muted)' }}>조합원 총 사업비 지출</span>
            <span style={{ fontWeight: '500' }}>{(totalMemberCost / 10000).toFixed(2)} 억원</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', padding: '4px 0' }}>
            <span style={{ color: 'var(--text-muted)' }}>일반분양 총 분양수입 정산액</span>
            <span style={{
              fontWeight: '600',
              color: generalContributionProfit >= 0 ? 'var(--color-success)' : 'var(--color-danger)'
            }}>
              {generalContributionProfit >= 0 ? `+${(generalContributionProfit / 10000).toFixed(2)}` : `${(generalContributionProfit / 10000).toFixed(2)}`} 억원
            </span>
          </div>

        </div>
      </div>
    </div>
  );
}
