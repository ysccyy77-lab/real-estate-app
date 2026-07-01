import React, { useState, useEffect, useRef } from 'react';
import { searchApartments, fetchRealPriceFromMolit, fetchDongNewPrice, fetchRealLandShare, fetchCurrentFar } from '../utils/apartmentDB';
import { estimateExistingLandShare, ZONE_REGULATORY_LIMITS } from '../utils/calculator';

export default function Calculator({ onCalculate, onAptSelect }) {
  // 모드 설정: 'search' (아파트 검색), 'manual' (수동 입력)
  const [inputMode, setInputMode] = useState('search');
  const [isDetailMode, setIsDetailMode] = useState(false); // 수동 입력 시 상세 토글
  
  // 검색 상태
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedApt, setSelectedApt] = useState(null);
  const dropdownRef = useRef(null);

  // 공통 계산 파라미터 상태
  const [existingLandShare, setExistingLandShare] = useState(13.0); // 평균 대지지분 (평)
  const [targetSize, setTargetSize] = useState(34); // 신축 희망 평형
  const [donationRatio, setDonationRatio] = useState(13); // 토지 기부채납 (%)
  const [constructionCost, setConstructionCost] = useState(950); // 평당 공사비 (만원) - 2026년 기준 실질 공사비 정밀 정합성 일치
  const [generalSalesPrice, setGeneralSalesPrice] = useState(3500); // 평당 일반분양가 (만원)
  const [recentPrice, setRecentPrice] = useState(0); // 최근 실거래가 (만원)
  const [nearNewPricePerPyung, setNearNewPricePerPyung] = useState(0); // 인근 신축 평당가 (만원)
  
  // 단지 전체 동적 연동용 상태
  const [complexAvgLandShare, setComplexAvgLandShare] = useState(15.0);
  const [complexAvgPyung, setComplexAvgPyung] = useState(25.0);
  
  // 용도지역 및 용적률 상태
  const [zoneRegion, setZoneRegion] = useState('제3종일반주거지역'); // 용도지역
  const [targetFar, setTargetFar] = useState(300); // 희망 신축 용적률 (%)
  const [curVolumetricRate, setCurVolumetricRate] = useState(0); // 현재 용적률 (%)

  // API 실시간 연동용 상태
  const [apiKey, setApiKey] = useState('861650caaf89e02504e6a50ee864ec6c6ff3338b71a7fa0c9fe22f294e2dc99d'); // 공공데이터포털 일반 인증키
  const [apiStatus, setApiStatus] = useState('idle'); // 'idle', 'loading', 'success', 'error'
  const [realtimeDealDate, setRealtimeDealDate] = useState(''); // 실시간 거래일자

  // 수동 모드용: 기존 평형 선택
  const [existingPyung, setExistingPyung] = useState(25);

  // 부모 컴포넌트에 선택 단지 정보 전달 동기화
  useEffect(() => {
    if (onAptSelect) {
      onAptSelect(selectedApt);
    }
  }, [selectedApt, onAptSelect]);

  // 외부 클릭 시 검색 드롭다운 닫기
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 검색어 입력 시 결과 업데이트
  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchQuery(value);
    if (value.trim() !== '') {
      const results = searchApartments(value);
      setSearchResults(results);
      setShowDropdown(true);
    } else {
      setSearchResults([]);
      setShowDropdown(false);
    }
  };

  // 아파트 단지 선택 시 데이터 바인딩
  const handleSelectApartment = async (apt) => {
    // 실시간 동기화를 위해 원본 훼손 없이 깊은 복사 진행
    const updatedApt = JSON.parse(JSON.stringify(apt));
    
    setSelectedApt(updatedApt);
    setSearchQuery(updatedApt.name);
    setShowDropdown(false);
    
    // 1) 기본 파라미터 연동
    setDonationRatio(updatedApt.defaultDonationRatio || 13);
    
    // 용도지역 판별 (데이터베이스에서 사전에 가공된 zoneRegion 최우선 적용)
    const determinedZone = updatedApt.zoneRegion || '제3종일반주거지역';
    setZoneRegion(determinedZone);
    
    // 용적률 한계 설정
    const limits = ZONE_REGULATORY_LIMITS[determinedZone] || ZONE_REGULATORY_LIMITS['제3종일반주거지역'];
    setTargetFar(updatedApt.expectedTargetFar || limits.maxFar);
    
    // 현재 용적률 세팅 (DB에 있으면 바로 쓰고 없으면 0)
    setCurVolumetricRate(updatedApt.curVolumetricRate || 0);
    
    // 2) 인근 신축 평당 시세 연동 (기본값 설정 후 동적 API 쿼리)
    let initialPricePerPyung = updatedApt.nearNewPricePerPyung || 4000;
    setNearNewPricePerPyung(initialPricePerPyung);
    setGeneralSalesPrice(Math.round(initialPricePerPyung * 1.0)); // 일반분양가 100% 반영

    // 단지 진짜 평균 대지지분 및 평수 계산 (동적 가상 모델 연동)
    if (updatedApt.types && updatedApt.types.length > 0) {
      let totalLand = 0;
      let totalArea = 0;
      updatedApt.types.forEach(t => {
        totalLand += (t.landShare || 10);
        totalArea += (t.area || 84);
      });
      setComplexAvgLandShare(totalLand / updatedApt.types.length);
      setComplexAvgPyung((totalArea / updatedApt.types.length) / 3.3);
    } else {
      setComplexAvgLandShare(15.0);
      setComplexAvgPyung(25.0);
    }

    // 🚀 [핵심 개선]: 아파트의 '모든 평형(types)'에 대해 병렬로 실시간 공공대장 API를 쏴서 각각의 대지지분을 모두 덮어씌움
    if (apiKey && updatedApt.dongCode && updatedApt.types) {
      setApiStatus('loading');
      try {
        const sigunguCd = updatedApt.dongCode.substring(0, 5);
        const bjdongCd = updatedApt.dongCode.substring(5, 10);
        
        await Promise.all(updatedApt.types.map(async (type) => {
          const realLandShare = await fetchRealLandShare({
            sigunguCd,
            bjdongCd,
            bonbun: updatedApt.bonbun,
            bubun: updatedApt.bubun,
            targetArea: type.area,
            aptName: updatedApt.name,
            serviceKey: apiKey
          });
          if (realLandShare && realLandShare > 0) {
            type.landShare = realLandShare; // 객체 업데이트
          }
        }));
        
        // 현재 용적률 API 실시간 보완 (DB에 값이 없을 때)
        if (!updatedApt.curVolumetricRate) {
          const fetchedFar = await fetchCurrentFar({
            sigunguCd,
            bjdongCd,
            bonbun: updatedApt.bonbun,
            bubun: updatedApt.bubun,
            serviceKey: apiKey
          });
          if (fetchedFar) {
            updatedApt.curVolumetricRate = fetchedFar;
            setCurVolumetricRate(fetchedFar);
          }
        }
        
        // 병렬 수집이 완료된 updatedApt로 다시 세팅하여 버튼들에 새로운 평형별 지분 노출!
        setSelectedApt({...updatedApt});
        setApiStatus('success');
      } catch (e) {
        console.warn('모든 평형 실시간 대지지분 동기화 실패', e);
      }
    }

    // 첫 번째 보유 평형 자동 선택
    if (updatedApt.types && updatedApt.types.length > 0) {
      handleSelectType(updatedApt, updatedApt.types[0], determinedZone);
    }
    
    // 3) 실시간 동 단위 신축 평당 시세 연동 트리거 (API Key 존재 시)
    if (apiKey && apt.dongCode) {
      try {
        const dynamicNewPrice = await fetchDongNewPrice({
          dongCode: apt.dongCode,
          serviceKey: apiKey
        });
        
        if (dynamicNewPrice && dynamicNewPrice > 0) {
          setNearNewPricePerPyung(dynamicNewPrice);
          setGeneralSalesPrice(Math.round(dynamicNewPrice * 1.0));
        }
      } catch (err) {
        console.warn('실시간 동별 신축 시세 연동 실패, 로컬 기본값 사용:', err.message);
      }
    }
  };

  // 선택한 아파트의 특정 평형 선택 시 (실시간 공공 대장 대지지분 및 실거래가 동시 쿼리)
  const handleSelectType = async (apt, type, currentZone) => {
    // 1) 반응 속도를 위해 우선 로컬 DB 기본값을 즉시 화면에 주입
    setExistingLandShare(type.landShare);
    setRecentPrice(type.recentPrice || 0);
    setRealtimeDealDate('');
    setExistingPyung(type.pyung); // 보유 평형 상태 업데이트 반영
    
    // 2) API Key 존재 시 실시간으로 건축물대장 전유부를 쿼리하여 진짜 대지지분(평) 추출 연동
    if (apiKey && apt.dongCode) {
      setApiStatus('loading');
      try {
        const sigunguCd = apt.dongCode.substring(0, 5);
        const bjdongCd = apt.dongCode.substring(5, 10);
        
        // 전유부 API 실시간 호출
        const realtimeLandShare = await fetchRealLandShare({
          sigunguCd,
          bjdongCd,
          bonbun: apt.bonbun,
          bubun: apt.bubun,
          targetArea: type.area,
          aptName: apt.name,
          serviceKey: apiKey
        });
        
        if (realtimeLandShare && realtimeLandShare > 0) {
          // 수집 성공 시 진짜 대지지분으로 덮어쓰기!
          setExistingLandShare(realtimeLandShare);
          setApiStatus('success');
        }
      } catch (err) {
        console.warn('실시간 대장 대지지분 연동 실패, 로컬 DB 보정값 사용:', err.message);
      }
    }
    
    // 3) 실거래가 조회 실행
    if (apiKey) {
      triggerRealtimeFetch(apt, type);
    }
  };

  // 국토부 실시간 실거래가 조회 실행
  const triggerRealtimeFetch = async (apt, type) => {
    if (!apiKey) return;
    
    setApiStatus('loading');
    const lawdCd = apt.dongCode ? apt.dongCode.substring(0, 5) : '';
    
    if (!lawdCd) {
      setApiStatus('error');
      return;
    }

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = (now.getMonth() + 1).toString().padStart(2, '0');
    const prevMonth = now.getMonth() === 0 ? '12' : now.getMonth().toString().padStart(2, '0');
    const prevYear = now.getMonth() === 0 ? currentYear - 1 : currentYear;

    const monthsToTry = [
      `${currentYear}${currentMonth}`,
      `${prevYear}${prevMonth}`,
      '202605',
      '202412'
    ];

    let apiResult = null;

    for (const dealYmd of monthsToTry) {
      apiResult = await fetchRealPriceFromMolit({
        lawdCd,
        dealYmd,
        aptName: apt.name,
        bonbun: apt.bonbun,
        bubun: apt.bubun,
        serviceKey: apiKey
      });

      if (apiResult) break;
    }

    if (apiResult && apiResult.price > 0) {
      setRecentPrice(apiResult.price);
      setRealtimeDealDate(apiResult.date);
      setApiStatus('success');
    } else {
      // API 실패 시 엑셀 내장 가격이 0 이상이면 그것을 유지하고 API 상태만 완료 처리
      setApiStatus('error');
    }
  };

  // 수동 입력 모드 - 평형 선택 시 대지지분 자동 추정
  useEffect(() => {
    if (inputMode === 'manual' && !isDetailMode) {
      const estimated = estimateExistingLandShare(existingPyung);
      setExistingLandShare(estimated);
      setRecentPrice(0);
      setNearNewPricePerPyung(0);
    }
  }, [existingPyung, isDetailMode, inputMode]);

  // 입력값이 변경될 때마다 부모 컴포넌트에 결과 전달
  useEffect(() => {
    if (inputMode === 'search' && !selectedApt) {
      onCalculate(null);
      return;
    }
    
    onCalculate({
      existingLandShare: parseFloat(existingLandShare) || 12.0,
      targetSize: parseInt(targetSize),
      donationRatio: parseFloat(donationRatio),
      constructionCost: parseInt(constructionCost),
      generalSalesPrice: parseInt(generalSalesPrice),
      extraCostRatio: 30,
      recentPrice: parseInt(recentPrice),
      nearNewPricePerPyung: parseInt(nearNewPricePerPyung),
      apartmentName: inputMode === 'search' && selectedApt ? selectedApt.name : null,
      apartmentAddress: inputMode === 'search' && selectedApt ? selectedApt.address : null,
      zoneRegion,
      targetFar: parseInt(targetFar),
      complexAvgLandShare: parseFloat(complexAvgLandShare) || 15.0,
      complexAvgPyung: parseFloat(complexAvgPyung) || 25.0
    });
  }, [
    existingLandShare,
    targetSize,
    donationRatio,
    constructionCost,
    generalSalesPrice,
    recentPrice,
    nearNewPricePerPyung,
    inputMode,
    selectedApt,
    zoneRegion,
    targetFar,
    complexAvgLandShare,
    complexAvgPyung,
    onCalculate
  ]);

  return (
    <div className="glass-card animate-fade-in" style={{ padding: '24px', position: 'relative', zIndex: 100 }}>
      
      {/* 검색 vs 수동 모드 토글 탭 */}
      <div style={{
        display: 'flex',
        background: 'rgba(15, 23, 42, 0.6)',
        borderRadius: '8px',
        padding: '4px',
        marginBottom: '24px',
        border: '1px solid rgba(255, 255, 255, 0.05)'
      }}>
        <button
          onClick={() => {
            setInputMode('search');
            setSelectedApt(null);
            setSearchQuery('');
            setRecentPrice(0);
            setNearNewPricePerPyung(0);
          }}
          style={{
            flex: 1,
            padding: '10px 12px',
            background: inputMode === 'search' ? 'linear-gradient(135deg, var(--color-secondary), var(--color-primary))' : 'transparent',
            color: inputMode === 'search' ? 'var(--text-dark)' : 'var(--text-muted)',
            border: 'none',
            borderRadius: '6px',
            fontWeight: '700',
            cursor: 'pointer',
            transition: 'var(--transition-smooth)',
            fontSize: '0.9rem'
          }}
        >
          🔍 단지 검색 입력
        </button>
        <button
          onClick={() => {
            setInputMode('manual');
            setRecentPrice(0);
            setNearNewPricePerPyung(0);
          }}
          style={{
            flex: 1,
            padding: '10px 12px',
            background: inputMode === 'manual' ? 'linear-gradient(135deg, var(--color-secondary), var(--color-primary))' : 'transparent',
            color: inputMode === 'manual' ? 'var(--text-dark)' : 'var(--text-muted)',
            border: 'none',
            borderRadius: '6px',
            fontWeight: '700',
            cursor: 'pointer',
            transition: 'var(--transition-smooth)',
            fontSize: '0.9rem'
          }}
        >
          ✍️ 수동 직접 입력
        </button>
      </div>

      {/* 1. 단지 검색 모드 */}
      {inputMode === 'search' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* 주소/단지명 검색창 */}
          <div className="input-group" style={{ position: 'relative', zIndex: 9999 }} ref={dropdownRef}>
            <label className="input-label">전국 아파트 단지명 검색</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                type="text"
                className="input-control"
                placeholder="예: 은마, 압구정 현대, 구로현대연예인..."
                value={searchQuery}
                onChange={handleSearchChange}
                onFocus={() => searchQuery.trim() !== '' && setShowDropdown(true)}
                style={{ paddingLeft: '40px' }}
              />
              <span style={{ position: 'absolute', left: '16px', fontSize: '1rem', opacity: 0.6 }}>🔍</span>
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedApt(null);
                    setSearchResults([]);
                    setShowDropdown(false);
                    setRecentPrice(0);
                  }}
                  style={{
                    position: 'absolute',
                    right: '16px',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    fontSize: '1rem'
                  }}
                >
                  ✕
                </button>
              )}
            </div>

            {/* 자동완성 드롭다운 */}
            {showDropdown && searchResults.length > 0 && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                marginTop: '6px',
                zIndex: 9999,
                maxHeight: '200px',
                overflowY: 'auto',
                boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
              }}>
                {searchResults.map((apt) => (
                  <div
                    key={apt.id}
                    onClick={() => handleSelectApartment(apt)}
                    style={{
                      padding: '12px 16px',
                      cursor: 'pointer',
                      borderBottom: '1px solid rgba(255,255,255,0.03)',
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => e.target.style.background = 'rgba(255,255,255,0.05)'}
                    onMouseLeave={(e) => e.target.style.background = 'transparent'}
                  >
                    <div style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-main)' }}>{apt.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>{apt.address}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 단지 선택 후 보유 평형 선택 UI */}
          {selectedApt && (
            <div className="animate-fade-in" style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.04)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600' }}>📍 {selectedApt.address}</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-primary)', background: 'rgba(0, 242, 254, 0.1)', padding: '2px 8px', borderRadius: '4px', fontWeight: '700' }}>
                  {zoneRegion} (한계 용적률: {ZONE_REGULATORY_LIMITS[zoneRegion]?.maxFar}%)
                </span>
              </div>
              
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label className="input-label" style={{ marginBottom: 0 }}>보유 중인 평형 선택</label>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>현재 용적률: {selectedApt.curVolumetricRate || 180}%</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '8px' }}>
                  {selectedApt.types.map((type) => {
                    const isSelected = existingPyung === type.pyung;
                    return (
                      <button
                        key={type.pyung}
                        onClick={() => handleSelectType(selectedApt, type, zoneRegion)}
                        style={{
                          padding: '12px 8px',
                          background: isSelected ? 'rgba(0, 242, 254, 0.15)' : 'rgba(255,255,255,0.02)',
                          border: isSelected ? '1px solid var(--color-primary)' : '1px solid rgba(255,255,255,0.08)',
                          borderRadius: '8px',
                          color: isSelected ? 'var(--color-primary)' : 'var(--text-main)',
                          fontWeight: '600',
                          fontSize: '0.85rem',
                          cursor: 'pointer',
                          transition: 'var(--transition-smooth)'
                        }}
                      >
                        <div>{type.pyung}평형</div>
                        <div style={{ fontSize: '0.65rem', opacity: 0.7, fontWeight: '400', marginTop: '2px' }}>
                          지분 {isSelected ? existingLandShare : type.landShare}평
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 연동 데이터 요약 표시 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px' }}>
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    {realtimeDealDate ? `실거래가 (${realtimeDealDate})` : '직전 실거래가'}
                  </div>
                  <div style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--color-warning)' }}>
                    {recentPrice > 0 ? `${(recentPrice / 10000).toFixed(2)} 억 원` : '정보 없음 (아래 인증 필요)'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    인근 동(洞) 신축 평균 평당가
                  </div>
                  <div style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--color-primary)' }}>
                    {nearNewPricePerPyung > 0 ? `${nearNewPricePerPyung.toLocaleString()} 만원` : '조회 실패'}
                  </div>
                </div>
              </div>

              {/* 실시간 API 인증키 입력 패널 */}
              <div style={{
                marginTop: '6px',
                padding: '12px',
                background: 'rgba(0, 0, 0, 0.2)',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.04)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label className="input-label" style={{ fontSize: '0.75rem', marginBottom: 0 }}>
                    국토부 실거래가 실시간 연동 (선택)
                  </label>
                  {apiStatus === 'loading' && <span style={{ color: 'var(--color-primary)', fontSize: '0.75rem' }}>🔄 조회 중...</span>}
                  {apiStatus === 'success' && <span style={{ color: 'var(--color-success)', fontSize: '0.75rem' }}>✅ 연동 성공</span>}
                  {apiStatus === 'error' && <span style={{ color: 'var(--color-danger)', fontSize: '0.75rem' }}>❌ 조회 실패 (키 확인 권장)</span>}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="password"
                    placeholder="공공데이터포털 API 인증키(Service Key) 입력"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    style={{
                      flex: 1,
                      background: 'rgba(15, 23, 42, 0.8)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '4px',
                      color: 'var(--text-main)',
                      padding: '6px 10px',
                      fontSize: '0.75rem'
                    }}
                  />
                  <button
                    onClick={() => selectedApt && triggerRealtimeFetch(selectedApt, { landShare: existingLandShare })}
                    style={{
                      background: 'var(--color-primary)',
                      color: 'var(--text-dark)',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '6px 12px',
                      fontSize: '0.75rem',
                      fontWeight: '700',
                      cursor: 'pointer'
                    }}
                  >
                    연동
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2. 수동 직접 입력 모드 */}
      {inputMode === 'manual' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
            <button
              onClick={() => setIsDetailMode(!isDetailMode)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--color-primary)',
                fontSize: '0.8rem',
                cursor: 'pointer',
                fontWeight: '600'
              }}
            >
              {isDetailMode ? '⚡ 간편 입력 모드로 변경' : '⚙️ 비용 변수 직접 조정 (상세)'}
            </button>
          </div>

          <h3 style={{ marginBottom: '16px', fontSize: '1.1rem', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ display: 'inline-block', width: '4px', height: '16px', background: 'var(--color-primary)', borderRadius: '2px' }}></span>
            보유 아파트 정보 수동 입력
          </h3>

          {!isDetailMode ? (
            <div className="input-group">
              <label className="input-label">
                현재 대략적인 아파트 평수
                <span className="badge">{existingPyung}평형</span>
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px', marginTop: '4px' }}>
                {[15, 20, 25, 30, 34].map((pyung) => (
                  <button
                    key={pyung}
                    onClick={() => setExistingPyung(pyung)}
                    style={{
                      padding: '12px 0',
                      background: existingPyung === pyung ? 'rgba(0, 242, 254, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                      border: existingPyung === pyung ? '1px solid var(--color-primary)' : '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '8px',
                      color: existingPyung === pyung ? 'var(--color-primary)' : 'var(--text-main)',
                      fontWeight: '600',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      transition: 'var(--transition-smooth)'
                    }}
                  >
                    {pyung}평
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="input-group">
              <label className="input-label">
                평균 대지지분 (세대당)
                <span className="badge">{existingLandShare} 평</span>
              </label>
              <input
                type="range"
                min="5"
                max="30"
                step="0.5"
                className="range-slider"
                value={existingLandShare}
                onChange={(e) => setExistingLandShare(e.target.value)}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>최소 5평</span>
                <input
                  type="number"
                  className="input-control"
                  style={{ width: '90px', padding: '6px 10px', fontSize: '0.85rem', textAlign: 'right' }}
                  value={existingLandShare}
                  onChange={(e) => setExistingLandShare(Math.max(1, Math.min(100, parseFloat(e.target.value) || 0)))}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>최대 30평</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. 신축 희망 평형 선택 (공통) */}
      {(inputMode === 'manual' || selectedApt) && (
        <>
          <h3 style={{ margin: '24px 0 16px 0', fontSize: '1.1rem', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ display: 'inline-block', width: '4px', height: '16px', background: 'var(--color-primary)', borderRadius: '2px' }}></span>
            신축 아파트 희망 평형
          </h3>

          <div className="input-group">
            <div style={{ display: 'flex', gap: '8px' }}>
              {[25, 34, 40].map((size) => (
                <button
                  key={size}
                  onClick={() => setTargetSize(size)}
                  style={{
                    flex: 1,
                    padding: '14px 0',
                    background: targetSize === size ? 'rgba(0, 242, 254, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                    border: targetSize === size ? '1px solid var(--color-primary)' : '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '8px',
                    color: targetSize === size ? 'var(--color-primary)' : 'var(--text-main)',
                    fontWeight: '600',
                    fontSize: '0.9rem',
                    transition: 'var(--transition-smooth)'
                  }}
                >
                  {size}평형
                </button>
              ))}
            </div>
          </div>

          {/* 4. 재건축 목표 용적률 직접 조작 (공통) */}
          <h3 style={{ margin: '24px 0 16px 0', fontSize: '1.1rem', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ display: 'inline-block', width: '4px', height: '16px', background: 'var(--color-primary)', borderRadius: '2px' }}></span>
            재건축 목표 용적률 조절
          </h3>

          <div className="input-group">
            <label className="input-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>현재 용적률: {curVolumetricRate > 0 ? `${curVolumetricRate}%` : '미상'}</span>
              <span className="badge" style={{ background: 'var(--color-warning)', color: '#000' }}>{targetFar}%</span>
            </label>
            <input
              type="range"
              min="100"
              max="500"
              step="1"
              className="range-slider"
              value={targetFar}
              onChange={(e) => setTargetFar(parseInt(e.target.value))}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>최소 100%</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <input
                  type="number"
                  className="input-control"
                  style={{ width: '80px', padding: '6px 10px', fontSize: '0.85rem', textAlign: 'right' }}
                  value={targetFar}
                  onChange={(e) => setTargetFar(Math.max(100, Math.min(800, parseInt(e.target.value) || 300)))}
                />
                <span style={{ fontSize: '0.85rem', color: 'var(--text-main)' }}>%</span>
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>용도제한: {ZONE_REGULATORY_LIMITS[zoneRegion]?.maxFar || 300}%</span>
            </div>
          </div>
        </>
      )}

      {/* 수동 모드이며 상세 모드일 때 추가 입력 필드 표출 */}
      {inputMode === 'manual' && isDetailMode && (
        <div className="animate-fade-in" style={{ marginTop: '20px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '20px' }}>
          <h3 style={{ marginBottom: '16px', fontSize: '1.1rem', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ display: 'inline-block', width: '4px', height: '16px', background: 'var(--color-primary)', borderRadius: '2px' }}></span>
            세부 사업 비용 조절
          </h3>

          {/* 기반시설 토지 기부채납 비율 */}
          <div className="input-group">
            <label className="input-label" style={{ marginBottom: '4px' }}>
              기반시설(공원/도로 등) 순수 토지 기부채납 비율
              <span className="badge">{donationRatio}%</span>
            </label>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '8px', lineHeight: '1.4' }}>
              ※ 용적률 초과에 따른 임대주택(50%) 의무 반납은 수식에서 별도로 자동 계산됩니다.
            </div>
            <input
              type="range"
              min="0"
              max="30"
              step="1"
              className="range-slider"
              value={donationRatio}
              onChange={(e) => setDonationRatio(e.target.value)}
            />
          </div>

          {/* 평당 공사비 */}
          <div className="input-group">
            <label className="input-label">
              평당 공사비 (순수 시공비 + 사업비)
              <span className="badge">{constructionCost.toLocaleString()} 만원</span>
            </label>
            <input
              type="range"
              min="500"
              max="1200"
              step="50"
              className="range-slider"
              value={constructionCost}
              onChange={(e) => setConstructionCost(e.target.value)}
            />
          </div>

          {/* 예상 일반분양가 */}
          <div className="input-group">
            <label className="input-label">
              예상 일반분양가 (평당 가격)
              <span className="badge">{generalSalesPrice.toLocaleString()} 만원</span>
            </label>
            <input
              type="range"
              min="1500"
              max="8000"
              step="100"
              className="range-slider"
              value={generalSalesPrice}
              onChange={(e) => setGeneralSalesPrice(e.target.value)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
