import React, { useState } from 'react';

export default function GlossaryGuide() {
  const [activeIndex, setActiveIndex] = useState(null);

  const glossaryItems = [
    {
      title: '🔑 평균 대지지분 (가장 중요!)',
      description: '단지 전체 대지면적을 기존 전체 세대수로 나눈 면적입니다. 조합원 한 명이 평균적으로 가진 "땅의 지분"을 말합니다. 대지지분이 넓을수록 신축 아파트를 짓고 남는 땅이 많아져 일반분양을 더 많이 할 수 있고, 이는 곧 조합원의 분담금 절감으로 이어집니다. 보통 15평 이상이면 사업성이 양호하다고 봅니다.',
    },
    {
      title: '🏢 용적률 (기존 vs 신축)',
      description: '단지 대지면적 대비 건물 총 층면적의 비율입니다. 기존 용적률이 낮을수록(예: 150% 이하) 신축 시 늘릴 수 있는 용적률의 여유가 많아져 사업성이 좋습니다. 반대로 기존 용적률이 이미 높으면(예: 200% 이상) 재건축으로 늘어나는 세대수가 적어 사업성이 제한됩니다.',
    },
    {
      title: '🌳 기부채납 비율',
      description: '도로, 공원, 도서관 등 공공시설을 짓도록 아파트 단지 땅의 일부를 시/군/구 지자체에 무상으로 기증하는 것입니다. 기부채납을 늘리면 인센티브로 신축 용적률을 높여주지만, 조합원이 소유한 실질 땅 지분이 그만큼 줄어들게 됩니다. 통상 5% ~ 15% 사이에서 결정됩니다.',
    },
    {
      title: '🛠️ 평당 공사비',
      description: '건설사(시공사)가 아파트를 짓는 데 필요한 평당 비용입니다. 순수 시공 비용 외에 인허가, 설계, 감리비 및 금융 이자 등 제반 사업 비용이 더해집니다. 최근 원자재 가격 및 인건비 상승으로 인해 재건축 분담금을 결정하는 가장 핵심적이고 민감한 변수입니다.',
    },
    {
      title: '💰 일반분양가',
      description: '조합원에게 배정하고 남은 아파트를 일반인에게 분양할 때 책정하는 가격입니다. 일반분양가가 높게 책정될수록 일반분양 수입이 극대화되어 조합원의 추가분담금이 대폭 줄어듭니다. 단, 주변 시세 대비 지나치게 높으면 미분양 리스크가 발생할 수 있습니다.',
    },
    {
      title: '💵 분담금 vs 환급금',
      description: '조합원이 원해서 신청한 신축 아파트의 분양 가격(조합원분양가)이 자신이 가지고 있던 기존 지분의 가치(권리가액)보다 클 경우 내야 하는 차액이 "분담금"입니다. 반대로 기존 지분 가치가 신축 분양가보다 크면 돈을 돌려받게 되며, 이를 "환급금"이라고 합니다.',
    }
  ];

  const handleToggle = (index) => {
    setActiveIndex(activeIndex === index ? null : index);
  };

  return (
    <div className="glass-card animate-fade-in" style={{ padding: '24px' }}>
      <h3 style={{ marginBottom: '16px', fontSize: '1.10rem', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <svg xmlns="http://www.w3.org/2000/svg" style={{ width: '20px', height: '20px', fill: 'none', stroke: 'currentColor', strokeWidth: 2 }} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
        초보자를 위한 재건축 필수 용어 사전
      </h3>
      
      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '16px', lineHeight: '1.4' }}>
        재건축 사업성은 단 한 번에 완벽히 이해하기 어렵습니다. 아래 핵심 용어를 터치하여 재건축 계산 결과를 더 깊이 있게 이해해 보세요!
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {glossaryItems.map((item, index) => {
          const isOpen = activeIndex === index;
          return (
            <div
              key={index}
              style={{
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                borderRadius: '8px',
                overflow: 'hidden',
                transition: 'var(--transition-smooth)'
              }}
            >
              <button
                onClick={() => handleToggle(index)}
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: isOpen ? 'rgba(255, 255, 255, 0.04)' : 'transparent',
                  border: 'none',
                  color: isOpen ? 'var(--color-primary)' : 'var(--text-main)',
                  fontWeight: '600',
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'var(--transition-smooth)'
                }}
              >
                <span>{item.title}</span>
                <span style={{
                  fontSize: '0.75rem',
                  transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.3s ease',
                  color: 'var(--text-muted)'
                }}>
                  ▼
                </span>
              </button>
              
              <div style={{
                maxHeight: isOpen ? '250px' : '0',
                opacity: isOpen ? 1 : 0,
                overflow: 'hidden',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                padding: isOpen ? '12px 16px 16px 16px' : '0 16px'
              }}>
                <p style={{
                  fontSize: '0.85rem',
                  color: 'var(--text-muted)',
                  lineHeight: '1.5',
                  whiteSpace: 'pre-line'
                }}>
                  {item.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
