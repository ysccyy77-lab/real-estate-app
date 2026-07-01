import React, { useState, useEffect, useRef } from 'react';
import { APARTMENT_DATABASE, searchApartments } from '../utils/apartmentDB';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// 가상 채팅방 목업 데이터 (선택 단지별 동적 대화 생성)
const getMockMessages = (aptName) => {
  const isHaan = aptName?.includes('하안주공11단지');
  const isGuro = aptName?.includes('구로주공');

  if (isHaan) {
    return [
      { id: 1, sender: '104동 소유주', text: '안녕하세요! 드디어 하안주공11단지 평균 대지지분이 11.22평으로 데이터베이스에 정밀 반영되었네요.', time: '오후 3:10', isUser: false },
      { id: 2, sender: '102동 소유주', text: '네! 제3종일반주거지역 한계치인 용적률 300% 적용하니까 사업성 평가가 녹색(우수)등급인 102.8점으로 제대로 나옵니다.', time: '오후 3:12', isUser: false },
      { id: 3, sender: '106동 대표', text: '맞습니다. 요즘 원자재값이 워낙 올라서 평당 공사비 950만 원 보수적으로 잡았는데도 비례율 102.8%면 엄청 선방한 수치예요.', time: '오후 3:15', isUser: false },
      { id: 4, sender: '101동 집주인', text: '등본 인증방이라 가짜 찌라시 글이나 광고 업자분들 없이 진짜 집주인들만 모여 정보 공유하니 신뢰감이 가고 정말 좋습니다.', time: '오후 3:16', isUser: false },
    ];
  }

  if (isGuro) {
    return [
      { id: 1, sender: '101동 소유주', text: '반갑습니다. 구로주공아파트 준공업지역 한계 용적률 400% 적용된 시뮬레이션 돌려봤는데 다들 점수 어떻게 나오시나요?', time: '오후 1:40', isUser: false },
      { id: 2, sender: '105동 대표', text: '네, 준공업지역 400% 대입 시 비례율 59.8% 나오네요. 일반분양가와 공사비 인상폭 감안하면 수동으로 보수적 튜닝을 해보며 목표를 잡아야겠어요.', time: '오후 1:44', isUser: false },
      { id: 3, sender: '103동 소유주', text: '그래도 PNU 지번 기반 정밀 그룹핑(685-222번지)으로 데이터가 개편되어서 엉뚱한 필지 정보 없이 깔끔하게 분석되니 한결 낫습니다.', time: '오후 1:48', isUser: false },
      { id: 4, sender: '110동 집주인', text: '맞아요. 이전에는 옆 단지랑 필지 매칭이 꼬였었는데, PNU로 매칭하니까 소유주 인증 절차도 정확하게 돌아가는 것 같네요.', time: '오후 1:52', isUser: false },
    ];
  }

  return [
    { id: 1, sender: '101동 소유주', text: '우리 단지도 소유주 소통 단체방이 개설되었네요. 다들 반갑습니다.', time: '오전 10:05', isUser: false },
    { id: 2, sender: '102동 소유주', text: '소유주 등기 등본 검증을 매주 백그라운드로 자동 실행해서 권리 관계 상실 시 실시간 강퇴되는 구조라 안심하고 대화할 수 있겠어요.', time: '오전 10:10', isUser: false },
    { id: 3, sender: '103동 대표', text: '네, 재건축 연한 30년 초과해서 조만간 정밀안전진단 추진 회의가 있을 예정인데 단톡방에서 의견들 편하게 나눠보시죠.', time: '오전 10:15', isUser: false },
  ];
};

export default function UnionChat({ selectedApt, onAptSelect }) {
  const [isVerified, setIsVerified] = useState(false);
  const [method, setMethod] = useState('file'); // 'file' 단일 방식
  const [step, setStep] = useState('form'); // 'form', 'camera_view', 'ocr_scanning', 'confirm_code', 'error_forged', 'error_moire', 'success'
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingText, setLoadingText] = useState('');
  
  // 본인인증 완료 여부
  const [isIdentityVerified, setIsIdentityVerified] = useState(false);
  
  // 인증 폼 데이터
  const [ownerName, setOwnerName] = useState('');
  const [rrnFront, setRrnFront] = useState('');
  const [dongHo, setDongHo] = useState('');
  
  // OCR 파일 검증 상태
  const [uploadedFile, setUploadedFile] = useState(null);
  const [ocrData, setOcrData] = useState(null);
  const [confirmCode, setConfirmCode] = useState('');

  // 카메라 작동 상태
  const [cameraFlash, setCameraFlash] = useState(false);
  
  // 채팅 메시지 상태
  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg] = useState('');
  const messagesEndRef = useRef(null);

  // 단지 검색용 상태
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  // 리프렛 미니 지도 바인딩 래퍼
  const miniMapRef = useRef(null);
  const miniLeafletMap = useRef(null);

  // 단지 변경 시 초기화 및 대화 목록 세팅
  useEffect(() => {
    setIsVerified(false);
    setIsIdentityVerified(false);
    setStep('form');
    setOwnerName('');
    setRrnFront('');
    setDongHo('');
    setUploadedFile(null);
    setOcrData(null);
    if (selectedApt) {
      setMessages(getMockMessages(selectedApt.name));
    }
  }, [selectedApt]);

  // 대화 추가 시 하단 스크롤
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

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

  // 미니 지도 렌더링
  useEffect(() => {
    if (selectedApt) {
      if (miniLeafletMap.current) {
        miniLeafletMap.current.remove();
        miniLeafletMap.current = null;
      }
      return;
    }

    if (!miniMapRef.current || miniLeafletMap.current) return;

    // 서울시청 중심으로 미니 지도 마운트
    const map = L.map(miniMapRef.current).setView([37.5256, 126.8963], 11);
    miniLeafletMap.current = map;

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CARTO',
      subdomains: 'abcd',
      maxZoom: 20
    }).addTo(map);

    // 노후 단지만 미니 지도에 마커 추가
    const currentYear = 2026;
    APARTMENT_DATABASE.forEach(apt => {
      let isOld = false;
      if (apt.buildYear && apt.buildYear > 0) {
        if (currentYear - apt.buildYear >= 25) isOld = true;
      } else {
        if (/(주공|시영|맨션|우성|한양|진주|미성|장미)/.test(apt.name)) isOld = true;
      }
      if (!isOld || !apt.lat || !apt.lng) return;

      const marker = L.marker([apt.lat, apt.lng]).addTo(map);
      
      const popupContent = `
        <div style="color:white; background:rgba(15,23,42,0.9); padding:8px; border-radius:6px; font-family:inherit;">
          <h4 style="margin:0 0 4px 0; font-size:0.85rem; font-weight:700;">${apt.name}</h4>
          <span style="font-size:0.7rem; color:#aaa; display:block; margin-bottom:8px;">${apt.address}</span>
          <button id="mini-btn-${apt.id}" style="
            width:100%; border:none; border-radius:4px;
            background:linear-gradient(135deg, #00f2fe, #4facfe);
            color:#0f172a; font-weight:bold; font-size:0.75rem;
            padding:6px 10px; cursor:pointer; text-align:center;
          ">이 단지 소통방 들어가기</button>
        </div>
      `;

      marker.bindPopup(popupContent, {
        closeButton: false,
        className: 'custom-leaflet-popup'
      });

      marker.on('popupopen', () => {
        const btn = document.getElementById(`mini-btn-${apt.id}`);
        if (btn) {
          btn.onclick = () => {
            map.closePopup();
            onAptSelect(apt);
          };
        }
      });
    });

    return () => {
      if (miniLeafletMap.current) {
        miniLeafletMap.current.remove();
        miniLeafletMap.current = null;
      }
    };
  }, [selectedApt, onAptSelect]);

  // 단지 검색어 처리
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

  // 포트원(아이엠포트) 실시간 본인인증 실행
  const handleRealCertification = () => {
    if (!ownerName) {
      alert('본인인증을 진행할 소유주 성명(실명)을 먼저 입력해 주세요.');
      return;
    }
    const { IMP } = window;
    if (!IMP) {
      alert('본인인증 모듈(PortOne SDK)이 아직 로드되지 않았습니다. 잠시 후 다시 시도해 주세요.');
      return;
    }

    // 포트원 정식 본인인증 테스트 가맹점 식별코드 (imp10399252)
    IMP.init('imp10399252'); 

    // 본인인증 팝업 호출
    IMP.certification({
      merchant_uid: `mid_${new Date().getTime()}`,
      popup: true
    }, function (rsp) {
      if (rsp.success) {
        // 인증 성공
        setIsIdentityVerified(true);
        alert(`실시간 본인인증 성공!\n인증고유키: ${rsp.imp_uid}\n소유자명이 '${ownerName}'(으)로 고정되어 등본 인증이 가능해집니다.`);
      } else {
        // 실패 시 데모용 모의 인증 진행 기회도 제공 (사용자가 팝업 차단 등으로 실패 시를 대비한 안전망)
        const forceMock = window.confirm(
          `본인인증 창이 차단되었거나 실패했습니다: ${rsp.error_msg}\n시연용 모의 본인인증(성공 케이스)으로 강제 통과시키겠습니까?`
        );
        if (forceMock) {
          setIsIdentityVerified(true);
          alert(`시연용 본인인증이 완료되었습니다!\n소유자명이 '${ownerName}'(으)로 고정되어 등본 인증이 가능해집니다.`);
        } else {
          alert(`본인인증 실패: ${rsp.error_msg}`);
        }
      }
    });
  };

  // 시연용 모의 본인인증 실행 (포트원 점검/PG 미설정 에러 대안)
  const handleMockCertification = () => {
    if (!ownerName) {
      alert('본인인증을 진행할 소유주 성명(실명)을 먼저 입력해 주세요.');
      return;
    }
    setIsIdentityVerified(true);
    alert(`시연용 모의 본인인증이 완료되었습니다!\n소유자명이 '${ownerName}'(으)로 고정되어 등본 인증이 가능해집니다.`);
  };

  // 등본 파일/사진 시뮬레이션 (정상 등본 vs 위조 의심 등본 vs 명의 불일치)
  const handleFileUploadSimulate = (isForgedCase) => {
    setStep('ocr_scanning');
    setUploadedFile({
      name: isForgedCase === 'mismatch' ? '등본_명의불일치_이영희.jpg' : isForgedCase ? '등기부등본_위조의심(2026).pdf' : '등본_소유주_홍길동(구로동).jpg',
      size: '1.2 MB'
    });
    setLoadingProgress(15);
    setLoadingText('이미지 필터링 및 2차원 바코드 블록 인식 중...');

    const runOcr = async () => {
      await sleep(1200);
      setLoadingProgress(55);
      setLoadingText('AI OCR 엔진 구동: 지번 주소(PNU) 및 구분소유 명의인 텍스트 분석 중...');
      
      await sleep(1200);
      setLoadingProgress(85);
      setLoadingText('문서 왜곡 보정 및 대법원 워터마크 변조 방지 패턴 검출 중...');

      await sleep(1000);
      if (isForgedCase === 'mismatch') {
        setOcrData({
          address: selectedApt.address + ` (PNU: ${selectedApt.pnu})`,
          owner: '이영희 (등기상 소유주)',
          issueDate: '2026-05-18 (명의 불일치)',
          verificationCode: '8574-0982-1102'
        });
        setStep('error_name_mismatch');
      } else if (isForgedCase) {
        setStep('error_forged');
      } else {
        setOcrData({
          address: selectedApt.address + ` (PNU: ${selectedApt.pnu})`,
          owner: ownerName || '홍길동',
          issueDate: '2026-05-18 (발급 2개월 이내)',
          verificationCode: '8574-0982-1102'
        });
        setConfirmCode('8574-0982-1102');
        setStep('confirm_code');
      }
    };

    runOcr();
  };

  // 카메라 셔터 촬영 시뮬레이션
  const handleCameraCapture = (isForgedCase) => {
    setCameraFlash(true);
    setTimeout(() => {
      setCameraFlash(false);
    }, 400);

    setTimeout(() => {
      setStep('ocr_scanning');
      setUploadedFile({
        name: isForgedCase === 'mismatch' ? '실시간촬영_명의불일치.jpg' : isForgedCase ? '실시간촬영_모니터재촬영본.jpg' : '실시간촬영_실물등본원본.jpg',
        size: '2.4 MB'
      });
      setLoadingProgress(20);
      setLoadingText('카메라 렌즈 왜곡 복원 및 촬영 조도 반사 제거 중...');

      const runOcr = async () => {
        await sleep(1200);
        setLoadingProgress(60);
        setLoadingText('AI 위조 스펙트럼 분석 및 격자 정밀 매치 검증 중...');
        
        await sleep(1200);
        setLoadingProgress(90);
        setLoadingText('인터넷등기소 12자리 발급서명번호 문자 해독 추출 중...');

        await sleep(1000);
        if (isForgedCase === 'mismatch') {
          setOcrData({
            address: selectedApt.address + ` (PNU: ${selectedApt.pnu})`,
            owner: '이영희 (등기상 소유주)',
            issueDate: '2026-06-30 (실시간 렌즈 촬영본)',
            verificationCode: '9180-4820-2273'
          });
          setStep('error_name_mismatch');
        } else if (isForgedCase) {
          // 모니터 재촬영 감지 차단
          setStep('error_moire');
        } else {
          setOcrData({
            address: selectedApt.address + ` (PNU: ${selectedApt.pnu})`,
            owner: ownerName || '홍길동',
            issueDate: '2026-06-30 (실시간 렌즈 촬영본)',
            verificationCode: '9180-4820-2273'
          });
          setConfirmCode('9180-4820-2273');
          setStep('confirm_code');
        }
      };
      runOcr();
    }, 500);
  };

  // 발급확인번호 최종 확인
  const handleConfirmVerificationCode = () => {
    if (confirmCode.length < 12) {
      alert('12자리 발급확인번호를 올바르게 입력해 주세요.');
      return;
    }
    setIsVerified(true);
    setStep('success');
  };

  // 메시지 전송
  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!newMsg.trim()) return;

    const userMessage = {
      id: messages.length + 1,
      sender: `${dongHo ? dongHo.split('동')[0] + '동' : '인증된'} 소유주`,
      text: newMsg,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isUser: true
    };

    setMessages([...messages, userMessage]);
    setNewMsg('');

    // 가상 조합원들의 자동 리액션 챗봇 응답 (딜레이 제공)
    setTimeout(() => {
      const reactions = [
        '소유주님 말씀에 공감합니다. 얼른 재건축 설명회 일정이 공지되면 좋겠네요.',
        '진짜 소유주들끼리 뭉치니 확실히 말이 잘 통하네요. 힘내서 빠르게 속도 내어 봅시다!',
        '계산기 시뮬레이션 돌려봤는데 기부채납 비율 1~2%만 아껴도 비례율 차이가 꽤 나더라고요.',
        '좋은 의견 감사합니다!'
      ];
      const randomReaction = reactions[Math.floor(Math.random() * reactions.length)];
      
      setMessages(prev => [...prev, {
        id: prev.length + 1,
        sender: '105동 소유주',
        text: randomReaction,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isUser: false
      }]);
    }, 1500);
  };

  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  /* ========================================================
     🏢 아파트 단지 미선택 상태: 자체 검색 및 Leaflet 미니 지도
     ======================================================== */
  if (!selectedApt) {
    return (
      <div className="glass-card animate-fade-in" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ textAlign: 'center', margin: '10px 0' }}>
          <span style={{ fontSize: '2.5rem' }}>💬</span>
          <h2 style={{ fontSize: '1.3rem', margin: '12px 0 6px 0', fontWeight: '700' }}>소유주 전용 소통 광장</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
            등본 인증을 통과한 진짜 소유자만 모여 소통하는 안전 보안방입니다.<br />
            아래에서 입장할 단지를 검색하거나 지도를 통해 직접 선택해 주세요.
          </p>
        </div>

        {/* 1. 소통 탭 내 아파트 검색바 */}
        <div style={{ position: 'relative', zIndex: 9999, maxWidth: '600px', width: '100%', margin: '0 auto' }} ref={dropdownRef}>
          <label className="input-label" style={{ fontWeight: '700' }}>🏢 아파트 단지 직접 검색</label>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <input
              type="text"
              className="input-control"
              placeholder="단지명을 입력해 주세요 (예: 하안주공11단지, 구로주공 등)"
              value={searchQuery}
              onChange={handleSearchChange}
              onFocus={() => searchQuery.trim() !== '' && setShowDropdown(true)}
              style={{ paddingLeft: '40px', background: 'rgba(0, 0, 0, 0.4)', borderColor: 'rgba(255,255,255,0.1)' }}
            />
            <span style={{ position: 'absolute', left: '16px', fontSize: '1rem', opacity: 0.6 }}>🔍</span>
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSearchResults([]);
                  setShowDropdown(false);
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
                ×
              </button>
            )}
          </div>

          {/* 검색 자동완성 드롭다운 */}
          {showDropdown && searchResults.length > 0 && (
            <div style={{
              position: 'absolute',
              top: 'calc(100% + 4px)',
              left: 0,
              right: 0,
              background: 'rgba(15, 23, 42, 0.98)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              maxHeight: '200px',
              overflowY: 'auto',
              boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
              zIndex: 99999
            }}>
              {searchResults.map((apt) => (
                <div
                  key={apt.id}
                  onClick={() => {
                    onAptSelect(apt);
                    setShowDropdown(false);
                    setSearchQuery('');
                  }}
                  style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    transition: 'var(--transition-smooth)'
                  }}
                  className="dropdown-item-hover"
                >
                  <div style={{ fontWeight: '700', color: 'white' }}>{apt.name}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>{apt.address}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 2. 소통 탭 내 미니 지도 선택기 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label className="input-label" style={{ fontWeight: '700' }}>📍 지도를 통해 단지 직접 선택</label>
          <div 
            ref={miniMapRef} 
            style={{ 
              width: '100%', 
              height: '350px', 
              borderRadius: '12px', 
              border: '1px solid rgba(255,255,255,0.08)',
              overflow: 'hidden',
              boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
              position: 'relative',
              zIndex: 1
            }} 
          />
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card animate-fade-in" style={{ padding: '0', overflow: 'hidden', minHeight: '600px', display: 'flex', flexDirection: 'column', border: '1px solid rgba(255,255,255,0.08)' }}>
      
      {/* 카메라 셔터 작동 플래시 화이트 아웃 오버레이 */}
      {cameraFlash && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'white', zIndex: 99999, pointerEvents: 'none',
          animation: 'flash-anim 0.4s forwards'
        }} />
      )}
      <style>{`
        @keyframes flash-anim {
          0% { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>

      {/* 1. 상단 채팅방 헤더 */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.02)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        padding: '16px 20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: isVerified ? 'var(--color-success)' : 'var(--color-primary)' }}>●</span>
            {selectedApt.name} 소유주 소통 광장
          </h2>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            주소: {selectedApt.address} | 준공일: {selectedApt.approvalDate || '정보 미상'}
          </p>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* 단지 변경 버튼 */}
          <button 
            onClick={() => onAptSelect(null)}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid rgba(255,255,255,0.15)',
              background: 'rgba(255,255,255,0.05)',
              color: 'var(--text-main)',
              fontSize: '0.75rem',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'var(--transition-smooth)'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
          >
            🔄 단지 변경
          </button>
          
          <div style={{
            fontSize: '0.7rem',
            background: isVerified ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
            color: isVerified ? 'var(--color-success)' : 'var(--color-danger)',
            padding: '6px 12px',
            borderRadius: '12px',
            fontWeight: '700',
            border: isVerified ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(239, 68, 68, 0.2)'
          }}>
            {isVerified ? '소유권 검증 완료' : '미인증 (입장 제한)'}
          </div>
        </div>
      </div>

      {/* 2. 바디 영역 (인증 절차 vs 채팅방 뷰) */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'rgba(10, 15, 30, 0.4)' }}>
        {!isVerified ? (
          
          /* ========================================================
             🔒 소유주 인증 절차 스크린
             ======================================================== */
          <div style={{ padding: '32px 20px', maxWidth: '600px', width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* 입력 폼 단계 */}
            {step === 'form' && (
              <div className="glass-card animate-fade-in" style={{ padding: '24px', background: 'rgba(255,255,255,0.02)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-main)' }}>
                    📸 등기부등본 사진/파일 업로드 및 실물 촬영 인증
                  </h3>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: '1.4', margin: 0 }}>
                  진짜 소유자 인증을 위해 <strong>1단계: 본인인증(실명 확인)</strong>을 거치고, <strong>2단계: 등본 제출(카메라 촬영 또는 파일 업로드)</strong>을 통해 소유 명의와 등본 진위를 대조 확인합니다.
                </p>

                {/* 1단계: 본인인증 섹션 */}
                <div style={{
                  padding: '16px',
                  borderRadius: '8px',
                  border: isIdentityVerified ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(0, 242, 254, 0.2)',
                  background: isIdentityVerified ? 'rgba(16, 185, 129, 0.04)' : 'rgba(0, 242, 254, 0.02)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: '700', color: isIdentityVerified ? 'var(--color-success)' : 'var(--color-primary)' }}>
                      {isIdentityVerified ? '✅ 1단계: 본인명의 인증 완료' : '🔒 1단계: 본인명의 실명인증 수행'}
                    </span>
                    {!isIdentityVerified && (
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>* 등본과 일치하는 명의여야 합니다.</span>
                    )}
                  </div>

                  <div>
                    <label className="input-label">소유주명(실명)</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="본인인증을 진행할 실명을 기입해 주세요"
                      value={ownerName}
                      onChange={(e) => setOwnerName(e.target.value)}
                      disabled={isIdentityVerified}
                      style={{
                        background: isIdentityVerified ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.3)',
                        color: isIdentityVerified ? 'var(--color-success)' : 'white',
                        fontWeight: isIdentityVerified ? 'bold' : 'normal'
                      }}
                    />
                  </div>

                  {!isIdentityVerified ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '4px' }}>
                      <button 
                        onClick={handleRealCertification}
                        className="submit-btn"
                        style={{
                          background: 'linear-gradient(135deg, #4facfe, #00f2fe)',
                          color: '#0f172a',
                          fontWeight: '700',
                          fontSize: '0.75rem',
                          marginBottom: 0
                        }}
                      >
                        📱 실시간 본인인증 (PortOne)
                      </button>
                      <button 
                        onClick={handleMockCertification}
                        className="submit-btn"
                        style={{
                          background: 'linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.15))',
                          border: '1px solid rgba(255,255,255,0.2)',
                          color: 'white',
                          fontWeight: '700',
                          fontSize: '0.75rem',
                          marginBottom: 0
                        }}
                      >
                        ⚙️ 시연용 모의인증 (우회)
                      </button>
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.7rem', color: 'var(--color-success)', fontWeight: '600' }}>
                      KCB 실명 확인 완료. 소유권 교차 대조 명의가 '{ownerName}'(으)로 최종 락(Lock)되었습니다.
                    </div>
                  )}
                </div>

                {/* 2단계: 등기부 등본 업로드 섹션 */}
                <div style={{
                  opacity: isIdentityVerified ? 1 : 0.4,
                  pointerEvents: isIdentityVerified ? 'auto' : 'none',
                  transition: 'var(--transition-smooth)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label className="input-label">주민등록번호 앞자리</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="900101"
                        maxLength={6}
                        value={rrnFront}
                        onChange={(e) => setRrnFront(e.target.value)}
                        disabled={!isIdentityVerified}
                      />
                    </div>
                    <div>
                      <label className="input-label">소유 주택 동/호수</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="102동 405호"
                        value={dongHo}
                        onChange={(e) => setDongHo(e.target.value)}
                        disabled={!isIdentityVerified}
                      />
                    </div>
                  </div>

                  {/* 두가지 루트: 카메라 직접 촬영 vs 갤러리 파일 업로드 */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '4px' }}>
                    <label className="input-label" style={{ marginBottom: 0 }}>2단계: 등본 제출 방식 선택</label>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      
                      {/* 루트 A: 카메라 직접 촬영 */}
                      <div 
                        onClick={() => {
                          if(!dongHo || !rrnFront) {
                            alert('동호수 및 주민등록번호를 올바르게 기입해 주세요.');
                            return;
                          }
                          setStep('camera_view');
                        }}
                        style={{
                          padding: '16px', border: '1px solid rgba(0, 242, 254, 0.2)',
                          background: 'rgba(0, 242, 254, 0.03)', borderRadius: '8px',
                          textAlign: 'center', cursor: 'pointer', transition: 'var(--transition-smooth)'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0, 242, 254, 0.08)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(0, 242, 254, 0.03)'}
                      >
                        <span style={{ fontSize: '1.5rem', display: 'block' }}>📸</span>
                        <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--color-primary)', display: 'block', marginTop: '6px' }}>카메라로 직접 촬영</span>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', marginTop: '2px' }}>실물 등본을 렌즈로 직접 촬영</span>
                      </div>

                      {/* 루트 B: 등기부 등본 갤러리 업로드 */}
                      <div 
                        onClick={() => {
                          if(!dongHo || !rrnFront) {
                            alert('동호수 및 주민등록번호를 올바르게 기입해 주세요.');
                            return;
                          }
                          setMethod('file');
                        }}
                        style={{
                          padding: '16px', border: '1px solid rgba(255, 255, 255, 0.1)',
                          background: method === 'file' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.01)',
                          borderRadius: '8px', textAlign: 'center', cursor: 'pointer', transition: 'var(--transition-smooth)'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = method === 'file' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.01)'}
                      >
                        <span style={{ fontSize: '1.5rem', display: 'block' }}>📁</span>
                        <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'white', display: 'block', marginTop: '6px' }}>파일/사진 업로드</span>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', marginTop: '2px' }}>이미 소지 중인 PDF/이미지 선택</span>
                      </div>
                    </div>
                  </div>

                  {/* 갤러리 파일 업로드 세부 드롭존 노출 */}
                  {method === 'file' && (
                    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '16px' }}>
                      <div style={{
                        border: '2px dashed rgba(255,255,255,0.1)',
                        borderRadius: '8px',
                        padding: '24px 16px',
                        textAlign: 'center',
                        background: 'rgba(0,0,0,0.15)',
                        color: 'var(--text-muted)'
                      }}>
                        <span style={{ fontSize: '1.5rem', display: 'block', marginBottom: '8px' }}>📁</span>
                        <span style={{ fontSize: '0.75rem' }}>여기에 등본 파일(PDF/JPG)을 드래그하거나 선택해 주세요</span>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: '600' }}>🔬 갤러리 업로드 모의 테스트</span>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                          <button 
                            onClick={() => handleFileUploadSimulate(false)}
                            style={{
                              padding: '10px', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.3)',
                              background: 'rgba(16, 185, 129, 0.1)', color: 'var(--color-success)',
                              fontWeight: '600', fontSize: '0.7rem', cursor: 'pointer'
                            }}
                          >
                            🟢 정상 업로드 (통과)
                          </button>
                          <button 
                            onClick={() => handleFileUploadSimulate(true)}
                            style={{
                              padding: '10px', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.3)',
                              background: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-danger)',
                              fontWeight: '600', fontSize: '0.7rem', cursor: 'pointer'
                            }}
                          >
                            🔴 위조 등본 업로드 (차단)
                          </button>
                          <button 
                            onClick={() => handleFileUploadSimulate('mismatch')}
                            style={{
                              padding: '10px', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.3)',
                              background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b',
                              fontWeight: '600', fontSize: '0.7rem', cursor: 'pointer'
                            }}
                          >
                            👤 명의 불일치 업로드 (반려)
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {!isIdentityVerified && (
                  <div style={{
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    borderRadius: '8px',
                    padding: '10px 12px',
                    fontSize: '0.75rem',
                    color: '#fca5a5',
                    textAlign: 'center',
                    marginTop: '8px'
                  }}>
                    ⚠️ 2단계 등본 제출을 활성화하려면 상단에서 <strong>1단계: 본인인증</strong>을 먼저 완료해 주세요.
                  </div>
                )}
              </div>
            )}

            {/* 📸 카메라 뷰파인더 직접 촬영 스크린 */}
            {step === 'camera_view' && (
              <div className="glass-card animate-fade-in" style={{ padding: '20px', background: 'rgba(0,0,0,0.9)', border: '1px solid rgba(255,255,255,0.15)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: '700', color: 'white', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '8px', height: '8px', background: '#ef4444', borderRadius: '50%', animation: 'blink 1s infinite' }}></span>
                    실시간 카메라 촬영 뷰파인더
                  </h4>
                  <button 
                    onClick={() => setStep('form')} 
                    style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontSize: '0.75rem' }}
                  >
                    촬영 취소
                  </button>
                </div>
                <style>{`
                  @keyframes blink {
                    0% { opacity: 0; }
                    50% { opacity: 1; }
                    100% { opacity: 0; }
                  }
                `}</style>

                {/* 격자 및 네온 가이드라인 탑재한 가상 카메라 창 */}
                <div style={{
                  position: 'relative',
                  width: '100%',
                  height: '300px',
                  background: 'rgba(15, 23, 42, 0.8)',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  border: '1px solid rgba(255,255,255,0.08)'
                }}>
                  {/* 모눈 격자 오버레이 */}
                  <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundImage: 'linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px)',
                    backgroundSize: '25% 25%',
                    pointerEvents: 'none'
                  }} />

                  {/* 문서 외곽선 가이드 (네온 크린) */}
                  <div style={{
                    position: 'absolute',
                    top: '15%', left: '10%', right: '10%', bottom: '15%',
                    border: '2px dashed var(--color-primary)',
                    borderRadius: '6px',
                    boxShadow: '0 0 15px rgba(0, 242, 254, 0.2)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    pointerEvents: 'none',
                    textAlign: 'center',
                    padding: '16px'
                  }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-primary)', fontWeight: '700', textShadow: '0 0 4px rgba(0,242,254,0.5)' }}>
                      [등기부등본 제 1면 정렬]
                    </span>
                    <span style={{ fontSize: '0.6rem', color: '#ccc', marginTop: '6px', lineHeight: 1.4 }}>
                      하단의 12자리 발급확인번호 및 바코드가<br/>
                      본 가이드라인 영역 내에 선명히 들어오도록 맞춰주세요.
                    </span>
                  </div>

                  {/* 가상 문서 오버레이 시각화 */}
                  <div style={{
                    position: 'absolute', top: '20%', left: '20%', right: '20%', bottom: '20%',
                    background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
                    borderRadius: '4px', opacity: 0.15, display: 'flex', flexDirection: 'column', gap: '6px', padding: '10px',
                    pointerEvents: 'none'
                  }}>
                    <div style={{ height: '6px', background: 'white', width: '30%' }} />
                    <div style={{ height: '4px', background: 'white', width: '80%' }} />
                    <div style={{ height: '4px', background: 'white', width: '70%' }} />
                    <div style={{ height: '4px', background: 'white', width: '90%' }} />
                    <div style={{ height: '8px', background: 'white', width: '20%', marginTop: 'auto', alignSelf: 'flex-end' }} />
                  </div>
                </div>

                {/* 셔터 동작 모의 단추 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', textAlign: 'center' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>📸 테스트할 촬영본 시나리오 단추를 클릭하여 셔터를 작동하세요.</span>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                    <button
                      onClick={() => handleCameraCapture(false)}
                      style={{
                        padding: '12px', borderRadius: '8px', border: 'none',
                        background: 'linear-gradient(135deg, #198754, #28a745)',
                        color: 'white', fontWeight: '700', cursor: 'pointer', fontSize: '0.75rem'
                      }}
                    >
                      📸 정상 촬영 (성공)
                    </button>
                    <button
                      onClick={() => handleCameraCapture(true)}
                      style={{
                        padding: '12px', borderRadius: '8px', border: 'none',
                        background: 'linear-gradient(135deg, #dc3545, #bd2130)',
                        color: 'white', fontWeight: '700', cursor: 'pointer', fontSize: '0.75rem'
                      }}
                    >
                      📸 모니터 촬영 (차단)
                    </button>
                    <button
                      onClick={() => handleCameraCapture('mismatch')}
                      style={{
                        padding: '12px', borderRadius: '8px', border: 'none',
                        background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                        color: 'white', fontWeight: '700', cursor: 'pointer', fontSize: '0.75rem'
                      }}
                    >
                      👤 명의 불일치 (반려)
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 로딩 및 OCR 스캐닝 화면 */}
            {step === 'ocr_scanning' && (
              <div className="glass-card animate-fade-in" style={{ padding: '32px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                /* 파일 모양 레이저 스캔 이펙트 */
                <div style={{ position: 'relative', width: '80px', height: '100px', border: '2px solid rgba(255,255,255,0.2)', borderRadius: '6px', background: 'rgba(255,255,255,0.03)', overflow: 'hidden', marginBottom: '10px' }}>
                  <div style={{
                    position: 'absolute',
                    left: 0,
                    width: '100%',
                    height: '4px',
                    background: 'linear-gradient(to right, transparent, var(--color-primary), transparent)',
                    boxShadow: '0 0 10px var(--color-primary)',
                    animation: 'scan 2s infinite ease-in-out'
                  }} />
                  <style>{`
                    @keyframes scan {
                      0% { top: 0%; }
                      50% { top: 95%; }
                      100% { top: 0%; }
                    }
                  `}</style>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px 8px', width: '100%', opacity: 0.3 }}>
                    <div style={{ height: '8px', background: 'white', borderRadius: '4px', width: '80%' }} />
                    <div style={{ height: '8px', background: 'white', borderRadius: '4px', width: '60%' }} />
                    <div style={{ height: '8px', background: 'white', borderRadius: '4px', width: '70%' }} />
                    <div style={{ height: '8px', background: 'white', borderRadius: '4px', width: '40%' }} />
                  </div>
                </div>

                <h4 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-main)' }}>AI 스냅샷 원본 분석 및 등기 권리 대조 중</h4>
                
                {/* 진행률 상태 바 */}
                <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden', marginTop: '6px' }}>
                  <div style={{ width: `${loadingProgress}%`, height: '100%', background: 'linear-gradient(90deg, var(--color-secondary), var(--color-primary))', transition: 'width 0.4s' }} />
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{loadingText}</span>
              </div>
            )}

            {/* 12자리 발급확인번호 최종 유효성 검증 단계 */}
            {step === 'confirm_code' && ocrData && (
              <div className="glass-card animate-fade-in" style={{ padding: '24px', background: 'rgba(255,255,255,0.02)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '10px' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--color-success)' }}>🛡️ AI 스캔/분석 완료 (소유권 유효성 통과)</h3>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    카메라 또는 이미지에서 추출된 소유 명의 정보입니다. 확인번호 검증 후 입장하세요.
                  </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: 'rgba(0,0,0,0.15)', padding: '12px 16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', fontSize: '0.75rem' }}>
                  <div><span style={{ color: 'var(--text-muted)', display: 'inline-block', width: '100px' }}>소유 아파트 PNU:</span> <span style={{ color: 'white', fontWeight: '600' }}>{ocrData.address}</span></div>
                  <div><span style={{ color: 'var(--text-muted)', display: 'inline-block', width: '100px' }}>명의 대조 소유주:</span> <span style={{ color: 'white', fontWeight: '600' }}>{ocrData.owner}</span></div>
                  <div><span style={{ color: 'var(--text-muted)', display: 'inline-block', width: '100px' }}>등본 발행/촬영:</span> <span style={{ color: 'var(--color-success)', fontWeight: '600' }}>{ocrData.issueDate}</span></div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <label className="input-label" style={{ marginBottom: 0 }}>발급확인번호 최종 입력 대조</label>
                    <span style={{ fontSize: '0.65rem', color: 'var(--color-primary)' }}>대법원 전산 진위 조회</span>
                  </div>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="1234-5678-9012"
                    value={confirmCode}
                    onChange={(e) => setConfirmCode(e.target.value)}
                    style={{ textAlign: 'center', fontSize: '1.1rem', letterSpacing: '0.1em', fontWeight: '700', color: 'var(--color-primary)' }}
                  />
                </div>

                <button 
                  onClick={handleConfirmVerificationCode}
                  className="submit-btn"
                  style={{ background: 'linear-gradient(135deg, var(--color-secondary), var(--color-primary))' }}
                >
                  2차 확인 및 최종 입장
                </button>
              </div>
            )}

            {/* ⚠️ 위조 탐지 경고 화면 (파일 업로드 실패 시) */}
            {step === 'error_forged' && (
              <div className="glass-card animate-fade-in" style={{ padding: '24px 20px', border: '1px solid rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.05)', display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'center' }}>
                <span style={{ fontSize: '3rem' }}>🚨</span>
                <h3 style={{ fontSize: '1.2rem', fontWeight: '700', color: 'var(--color-danger)' }}>AI 위조 / 변조 의심 문서 탐지</h3>
                
                <div style={{
                  textAlign: 'left',
                  fontSize: '0.75rem',
                  color: '#fca5a5',
                  background: 'rgba(0,0,0,0.2)',
                  padding: '16px',
                  borderRadius: '8px',
                  lineHeight: '1.6',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}>
                  <div>
                    <strong>● 2차원 바코드 스펙트럼 이상 감시</strong><br />
                    문서 상단의 인터넷등기소 정식 2차원 바코드 정렬 패턴 및 복사 방지 마크가 균일하지 않고 미세하게 뒤틀려 있어 AI 생성 또는 포토샵 합성 가능성이 발견되었습니다.
                  </div>
                  <div>
                    <strong>● 발급확인번호 조회 결과 부재</strong><br />
                    등기소 데이터베이스 크로스 체크 결과, 이미지 내에서 인식된 발급확인번호가 대법원 전산망에 등록되어 있지 않거나 기간이 만료된 거짓 번호입니다.
                  </div>
                </div>

                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  진짜 소유주만 모인 보안방 조성을 위해 가짜 문서 업로드 시 입장이 거부되며, 위조 문서 첨부 시 추후 서비스 이용이 전면 제한될 수 있습니다.
                </p>

                <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                  <button 
                    onClick={() => setStep('form')}
                    style={{
                      flex: 1, padding: '12px', borderRadius: '8px', border: 'none',
                      background: 'var(--color-danger)', color: 'white', fontWeight: '600', cursor: 'pointer'
                    }}
                  >
                    다른 문서 다시 업로드
                  </button>
                </div>
              </div>
            )}

            {/* ⚠️ 카메라 모니터 재촬영 감출 보안 차단 경고 화면 */}
            {step === 'error_moire' && (
              <div className="glass-card animate-fade-in" style={{ padding: '24px 20px', border: '1px solid rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.05)', display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'center' }}>
                <span style={{ fontSize: '3rem' }}>🖥️</span>
                <h3 style={{ fontSize: '1.2rem', fontWeight: '700', color: 'var(--color-danger)' }}>모니터 화면 촬영 의심 차단 (Anti-Spoofing)</h3>
                
                <div style={{
                  textAlign: 'left',
                  fontSize: '0.75rem',
                  color: '#fca5a5',
                  background: 'rgba(0,0,0,0.2)',
                  padding: '16px',
                  borderRadius: '8px',
                  lineHeight: '1.6',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}>
                  <div>
                    <strong>● 모아레(Moiré) 픽셀 패턴 검출</strong><br />
                    카메라 고주파 센서 렌즈 해독 결과, PC나 모니터 액정 화면의 미세한 픽셀 입자(모아레 무늬)가 화면 전체에 규칙적으로 검출되었습니다.
                  </div>
                  <div>
                    <strong>● 빛 반사광 및 플리커 간섭 분석</strong><br />
                    액정 표면에서 튕겨 나오는 정반사광의 분포와 LED 백라이트의 초고속 플리커(주파수 간섭) 파형이 포착되어, 종이 원본이 아닌 디지털 디스플레이의 재촬영본으로 확정 판정되었습니다.
                  </div>
                </div>

                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  남의 모니터 등기를 촬영하는 무단 인증 시도를 원천 차단하기 위해 **실물 인쇄 종이 원본**을 직접 대조 촬영하거나, 정식 PDF 파일을 갤러리 업로드 방식으로 인증해 주세요.
                </p>

                <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                  <button 
                    onClick={() => setStep('camera_view')}
                    style={{
                      flex: 1, padding: '12px', borderRadius: '8px', border: 'none',
                      background: 'var(--color-danger)', color: 'white', fontWeight: '600', cursor: 'pointer'
                    }}
                  >
                    카메라 열어 다시 촬영하기
                  </button>
                  <button 
                    onClick={() => { setStep('form'); setMethod('file'); }}
                    style={{
                      flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)',
                      background: 'rgba(255,255,255,0.05)', color: 'white', fontWeight: '600', cursor: 'pointer'
                    }}
                  >
                    갤러리 파일 업로드로 변경
                  </button>
                </div>
              </div>
            )}

            {/* ⚠️ 소유주 명의 불일치 경고 화면 */}
            {step === 'error_name_mismatch' && ocrData && (
              <div className="glass-card animate-fade-in" style={{ padding: '24px 20px', border: '1px solid rgba(245, 158, 11, 0.3)', background: 'rgba(245, 158, 11, 0.05)', display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'center' }}>
                <span style={{ fontSize: '3rem' }}>👤</span>
                <h3 style={{ fontSize: '1.2rem', fontWeight: '700', color: '#f59e0b' }}>소유자 명의 불일치 감지 (명의인 불일치)</h3>
                
                <div style={{
                  textAlign: 'left',
                  fontSize: '0.75rem',
                  color: '#fef3c7',
                  background: 'rgba(0,0,0,0.2)',
                  padding: '16px',
                  borderRadius: '8px',
                  lineHeight: '1.6',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}>
                  <div>
                    <strong>● 실인증 명의인:</strong> <span style={{ color: 'white', fontWeight: 'bold' }}>{ownerName} (KCB 본인인증 완료)</span>
                  </div>
                  <div>
                    <strong>● 등기소 구분소유자 명의:</strong> <span style={{ color: '#f59e0b', fontWeight: 'bold' }}>{ocrData.owner}</span>
                  </div>
                  <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.05)', margin: '4px 0' }} />
                  <div>
                    본인명의 실명인증을 통해 검증된 신청인의 이름과 등본 상의 소유자 명의가 일치하지 않습니다. 다른 사람 명의의 등기부등본으로는 해당 단지 소유주 소통방에 입장하실 수 없습니다.
                  </div>
                </div>

                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  부동산 매매 후 아직 등기부등본 명의 개서가 완료되지 않았거나 공동소유 관계인 경우, 등본 상에 표시된 정확한 본인 명의로 1단계 본인인증을 다시 시도해 주세요.
                </p>

                <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                  <button 
                    onClick={() => {
                      setIsIdentityVerified(false);
                      setStep('form');
                    }}
                    style={{
                      flex: 1, padding: '12px', borderRadius: '8px', border: 'none',
                      background: '#f59e0b', color: '#0f172a', fontWeight: '700', cursor: 'pointer'
                    }}
                  >
                    1단계 본인인증 초기화 후 다시 시도
                  </button>
                </div>
              </div>
            )}

          </div>
        ) : (
          
          /* ========================================================
             💬 조합원 전용 채팅방 본문 화면
             ======================================================== */
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', minHeight: '480px' }}>
            
            {/* 가상 공지사항 배너 */}
            <div style={{
              background: 'rgba(0, 242, 254, 0.04)',
              borderBottom: '1px solid rgba(0, 242, 254, 0.08)',
              padding: '10px 16px',
              fontSize: '0.75rem',
              color: 'var(--color-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span>📢</span>
              <span><strong>공지:</strong> 등기 소유 여부는 매주 월요일 새벽에 대법원 시스템과 연동되어 자동 갱신됩니다.</span>
            </div>

            {/* 메시지 리스트 */}
            <div style={{
              flex: 1,
              padding: '20px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              maxHeight: '380px'
            }}>
              {messages.map((msg) => (
                <div 
                  key={msg.id}
                  style={{
                    display: 'flex',
                    gap: '10px',
                    alignSelf: msg.isUser ? 'flex-end' : 'flex-start',
                    flexDirection: msg.isUser ? 'row-reverse' : 'row',
                    maxWidth: '85%'
                  }}
                >
                  {/* 프로필 이미지 아이콘 */}
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: msg.isUser ? 'linear-gradient(135deg, var(--color-secondary), var(--color-primary))' : 'rgba(255,255,255,0.06)',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    fontSize: '0.85rem',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: 'white'
                  }}>
                    {msg.isUser ? '나' : '👤'}
                  </div>

                  <div>
                    {/* 발신인 정보 */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '0.7rem',
                      color: 'var(--text-muted)',
                      justifyContent: msg.isUser ? 'flex-end' : 'flex-start'
                    }}>
                      <span>{msg.sender}</span>
                      <span style={{
                        fontSize: '0.55rem',
                        background: 'rgba(16, 185, 129, 0.1)',
                        color: 'var(--color-success)',
                        padding: '1px 4px',
                        borderRadius: '3px',
                        fontWeight: '700'
                      }}>인증완료</span>
                    </div>

                    {/* 말풍선 */}
                    <div style={{
                      background: msg.isUser ? 'rgba(0, 242, 254, 0.08)' : 'rgba(255,255,255,0.04)',
                      border: msg.isUser ? '1px solid rgba(0, 242, 254, 0.2)' : '1px solid rgba(255,255,255,0.06)',
                      color: 'var(--text-main)',
                      padding: '10px 14px',
                      borderRadius: msg.isUser ? '12px 0 12px 12px' : '0 12px 12px 12px',
                      marginTop: '4px',
                      fontSize: '0.85rem',
                      lineHeight: '1.4',
                      wordBreak: 'break-all'
                    }}>
                      {msg.text}
                    </div>

                    {/* 시간 표시 */}
                    <div style={{
                      fontSize: '0.6rem',
                      color: 'var(--text-muted)',
                      marginTop: '2px',
                      textAlign: msg.isUser ? 'right' : 'left'
                    }}>
                      {msg.time}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* 3. 하단 입력 바 */}
            <form 
              onSubmit={handleSendMessage}
              style={{
                borderTop: '1px solid rgba(255,255,255,0.06)',
                padding: '12px 16px',
                display: 'flex',
                gap: '10px',
                background: 'rgba(255,255,255,0.01)'
              }}
            >
              <input 
                type="text" 
                className="form-input" 
                placeholder="인증된 소유주들과 안전하게 의견을 교환해 보세요..."
                value={newMsg}
                onChange={(e) => setNewMsg(e.target.value)}
                style={{ flex: 1, marginBottom: 0 }}
              />
              <button 
                type="submit"
                style={{
                  background: 'linear-gradient(135deg, var(--color-secondary), var(--color-primary))',
                  border: 'none',
                  borderRadius: '8px',
                  color: 'var(--text-dark)',
                  padding: '0 20px',
                  fontWeight: '700',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  transition: 'var(--transition-smooth)'
                }}
              >
                전송
              </button>
            </form>

          </div>
        )}
      </div>

    </div>
  );
}
