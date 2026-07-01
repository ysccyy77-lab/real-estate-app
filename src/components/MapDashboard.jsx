import React, { useEffect, useState, useRef } from 'react';
import { APARTMENT_DATABASE } from '../utils/apartmentDB';
import { calculateReconstruction, ZONE_REGULATORY_LIMITS } from '../utils/calculator';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import AptDetailModal from './AptDetailModal';

export default function MapDashboard({ onAptSelect }) {
  const mapRef = useRef(null);
  const leafletMap = useRef(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [selectedApt, setSelectedApt] = useState(null);
  const [calcResult, setCalcResult] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // 부모 컴포넌트에 선택 단지 정보 전달 동기화
  useEffect(() => {
    if (onAptSelect) {
      onAptSelect(selectedApt);
    }
  }, [selectedApt, onAptSelect]);

  // 지도 렌더링 및 마커 표시 (Leaflet + OpenStreetMap)
  useEffect(() => {
    if (!mapRef.current || leafletMap.current) return;

    // 초기 중심좌표 (서울시청) 및 줌 레벨
    const map = L.map(mapRef.current).setView([37.5665, 126.9780], 12);
    leafletMap.current = map;

    // 100% 무료 OpenStreetMap 타일 레이어 적용
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    
    setMapLoaded(true);

    // 마커 렌더링
    const currentYear = 2026;

    APARTMENT_DATABASE.forEach(apt => {
      let isOld = false;
      if (apt.buildYear && apt.buildYear > 0) {
        if (currentYear - apt.buildYear >= 25) isOld = true;
      } else {
        if (/(주공|시영|맨션|우성|한양|진주|미성|장미)/.test(apt.name)) isOld = true;
      }

      if (!isOld) return; 
      if (!apt.lat || !apt.lng) return; 

      // 단지 평균 대지지분 및 평수 계산 (동적 가상 모델 연동)
      let complexAvgLandShare = 15.0;
      let complexAvgPyung = 25.0;
      
      let repType = apt.types && apt.types.length > 0 ? apt.types[0] : null;
      let existingLandShare = repType && repType.landShare ? repType.landShare : 12;
      
      if (apt.types && apt.types.length > 0) {
        let totalLand = 0;
        let totalArea = 0;
        apt.types.forEach(t => {
          totalLand += (t.landShare || 10);
          totalArea += (t.area || 84);
        });
        complexAvgLandShare = totalLand / apt.types.length;
        complexAvgPyung = (totalArea / apt.types.length) / 3.3;
      }

      const determinedZone = apt.zoneRegion || '제3종일반주거지역';
      const limits = ZONE_REGULATORY_LIMITS[determinedZone] || ZONE_REGULATORY_LIMITS['제3종일반주거지역'];
      const targetFar = apt.expectedTargetFar || limits.maxFar;

      // 사업성(Score) 사전 시뮬레이션 계산
      const result = calculateReconstruction({
        existingLandShare: existingLandShare,
        targetSize: 34,
        donationRatio: apt.defaultDonationRatio || 13,
        constructionCost: 950, // 2026년형 950만 고정
        generalSalesPrice: apt.nearNewPricePerPyung || 4000,
        extraCostRatio: 30,
        recentPrice: 0,
        nearNewPricePerPyung: apt.nearNewPricePerPyung || 4000,
        zoneRegion: determinedZone,
        targetFar: targetFar,
        complexAvgLandShare: complexAvgLandShare,
        complexAvgPyung: complexAvgPyung
      });

      // 비례율(Score)별 색상 분류
      let markerColor = '#dc3545'; // 빨간색 (위험)
      if (result.score >= 120) markerColor = '#a8c6fa'; // 플래티넘 (최우수)
      else if (result.score >= 100) markerColor = '#198754'; // 녹색 (우수)
      else if (result.score >= 80) markerColor = '#fd7e14'; // 주황색 (보통)

      // SVG 마커 커스텀
      const svgString = `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="40" viewBox="0 0 24 36"><path fill="${markerColor}" d="M12 0C7.58 0 4 3.58 4 8c0 5.25 8 13 8 13s8-7.75 8-13c0-4.42-3.58-8-8-8z"/><circle cx="12" cy="8" r="4" fill="#fff"/></svg>`;
      
      const customIcon = L.icon({
        iconUrl: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svgString),
        iconSize: [30, 40],
        iconAnchor: [15, 40]
      });

      const marker = L.marker([apt.lat, apt.lng], { icon: customIcon }).addTo(map);
      
      marker.on('click', () => {
        setSelectedApt(apt);
        setCalcResult(result);
      });
    });

    // 컴포넌트 마운트 해제 시 지도 인스턴스 파괴
    return () => {
      if (leafletMap.current) {
        leafletMap.current.remove();
        leafletMap.current = null;
      }
    };
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%', height: 'calc(100vh - 120px)', borderRadius: '12px', overflow: 'hidden' }} className="animate-fade-in">
      {!mapLoaded && (
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'rgba(0,0,0,0.5)', color: '#fff', zIndex: 10 }}>
          <span>🗺️ 오픈소스 지도 로딩 중...</span>
        </div>
      )}
      
      <div ref={mapRef} style={{ width: '100%', height: '100%', zIndex: 1 }} />

      {/* 오버레이 팝업 모달 */}
      {selectedApt && calcResult && (
        <div style={{
          position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)',
          width: '90%', maxWidth: '400px', background: 'rgba(20, 24, 34, 0.95)',
          border: `2px solid ${calcResult.gradeColor}`, borderRadius: '16px', padding: '20px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.5)', zIndex: 1000 /* Leaflet 위에 뜨도록 zIndex 상향 */, backdropFilter: 'blur(10px)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#fff' }}>{selectedApt.name}</h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{selectedApt.address} | 준공: {selectedApt.buildYear ? `${selectedApt.buildYear}년` : '미상'}</p>
            </div>
            <button onClick={() => setSelectedApt(null)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '15px' }}>
            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>현재 용적률</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>{selectedApt.curVolumetricRate ? `${selectedApt.curVolumetricRate}%` : '미상'}</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>사업성 등급</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: calcResult.gradeColor }}>{calcResult.businessGrade}</div>
            </div>
          </div>
          
          <div style={{ marginTop: '15px', fontSize: '0.85rem', lineHeight: '1.4', color: '#ccc' }}>
            {calcResult.summaryText}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-primary)' }}>
              Score: {calcResult.score} 점
            </div>
            <button onClick={() => setIsDetailOpen(true)} style={{
              background: 'var(--color-primary)', color: '#000', border: 'none', borderRadius: '8px',
              padding: '8px 16px', fontSize: '0.85rem', fontWeight: '700', cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0,242,254,0.3)'
            }}>
              상세 정보 및 실거래가 〉
            </button>
          </div>
        </div>
      )}

      {/* 실거래가 및 상세 정보 풀스크린 모달 */}
      {isDetailOpen && selectedApt && (
        <AptDetailModal 
          apt={selectedApt} 
          calcResult={calcResult} 
          onClose={() => setIsDetailOpen(false)} 
        />
      )}
    </div>
  );
}
