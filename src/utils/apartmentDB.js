import apartmentData from './apartmentDB.json';

export const APARTMENT_DATABASE = apartmentData;

export function searchApartments(keyword) {
  if (!keyword || keyword.trim() === '') return [];
  const cleanKeyword = keyword.toLowerCase().replace(/\s+/g, '');
  
  return APARTMENT_DATABASE.filter(apt => {
    const cleanName = apt.name.toLowerCase().replace(/\s+/g, '');
    const cleanAddress = apt.address.toLowerCase().replace(/\s+/g, '');
    const matchesAlias = apt.aliases && apt.aliases.some(alias => 
      alias.toLowerCase().replace(/\s+/g, '').includes(cleanKeyword)
    );
    return cleanName.includes(cleanKeyword) || cleanAddress.includes(cleanKeyword) || matchesAlias;
  }).slice(0, 30);
}

/**
 * 국토교통부 아파트매매 실거래 상세 자료 API 실시간 호출
 */
export async function fetchRealPriceFromMolit({
  lawdCd,
  dealYmd,
  aptName,
  bonbun,
  bubun,
  serviceKey = '861650caaf89e02504e6a50ee864ec6c6ff3338b71a7fa0c9fe22f294e2dc99d'
}) {
  if (!serviceKey) return null;

  const formatCode = (val) => {
    if (!val) return '0000';
    const num = parseInt(val);
    if (isNaN(num)) return '0000';
    return num.toString().padStart(4, '0');
  };

  const formattedBonbun = formatCode(bonbun);
  const formattedBubun = formatCode(bubun);
  
  const url = `/api-molit/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev`;
  
  const queryParams = new URLSearchParams({
    serviceKey: decodeURIComponent(serviceKey),
    LAWD_CD: lawdCd,
    DEAL_YMD: dealYmd,
    pageNo: '1',
    numOfRows: '100'
  });

  try {
    const response = await fetch(`${url}?${queryParams.toString()}`, {
      method: 'GET',
      headers: { 'Accept': 'application/xml, text/xml, */*' }
    });

    if (!response.ok) {
      console.warn(`[국토부 API 경고] ${dealYmd} 조회 실패 (HTTP 상태코드: ${response.status})`);
      return null;
    }
    
    const xmlText = await response.text();
    
    if (xmlText.includes('<returnAuthMsg>') || xmlText.includes('<resultCode>')) {
      const resultCodeMatch = xmlText.match(/<resultCode>(.*?)<\/resultCode>/);
      const resultMsgMatch = xmlText.match(/<resultMsg>(.*?)<\/resultMsg>/);
      
      const code = resultCodeMatch ? resultCodeMatch[1] : '';
      const msg = resultMsgMatch ? resultMsgMatch[1] : '';
      
      if (code !== '00' && code !== '000') {
        console.warn(`[국토부 API 미정상 응답] 코드: ${code}, 메시지: ${msg}`);
        return null;
      }
    }
    
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
    const items = xmlDoc.getElementsByTagName('item');
    
    const matchedTransactions = [];
    const cleanTargetApt = aptName.replace(/\(.*?\)/g, '').replace(/\s+/g, '').toLowerCase();
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const itemAptName = item.getElementsByTagName('aptNm')[0]?.textContent?.trim() || '';
      const cleanItemApt = itemAptName.replace(/\(.*?\)/g, '').replace(/\s+/g, '').toLowerCase();
      
      const itemBonbun = item.getElementsByTagName('bonbun')[0]?.textContent?.trim() || '';
      const itemBubun = item.getElementsByTagName('bubun')[0]?.textContent?.trim() || '';
      const itemPriceStr = item.getElementsByTagName('dealAmount')[0]?.textContent?.trim() || '';
      
      const isJibunMatch = formatCode(itemBonbun) === formattedBonbun && formatCode(itemBubun) === formattedBubun;
      const isNameMatch = cleanItemApt.includes(cleanTargetApt) || cleanTargetApt.includes(cleanItemApt);
      
      if (isJibunMatch || (isNameMatch && itemBonbun === formattedBonbun)) {
        const price = parseInt(itemPriceStr.replace(/,/g, ''));
        const dealYear = item.getElementsByTagName('dealYear')[0]?.textContent || '';
        const dealMonth = item.getElementsByTagName('dealMonth')[0]?.textContent || '';
        const dealDay = item.getElementsByTagName('dealDay')[0]?.textContent || '';
        
        matchedTransactions.push({
          price,
          date: `${dealYear}-${dealMonth.padStart(2, '0')}-${dealDay.padStart(2, '0')}`
        });
      }
    }
    
    if (matchedTransactions.length === 0) return null;
    matchedTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));
    return matchedTransactions[0];
    
  } catch (error) {
    console.error('국토부 실거래가 API 호출 오류:', error);
    return null;
  }
}

/**
 * 동일 법정동 내 5년 이내 준공된 신축 아파트들의 최신 실거래 평당가를 동적으로 수집
 */
export async function fetchDongNewPrice({
  dongCode,
  serviceKey = '861650caaf89e02504e6a50ee864ec6c6ff3338b71a7fa0c9fe22f294e2dc99d'
}) {
  if (!dongCode || dongCode.length < 5) return null;
  const lawdCd = dongCode.substring(0, 5);
  
  const neighborhoodApts = APARTMENT_DATABASE.filter(apt => apt.dongCode === dongCode);
  if (neighborhoodApts.length === 0) return null;
  
  const targetMonths = ['202604', '202603', '202512', '202412'];
  const url = `/api-molit/1613000/RTMSOBJSvc/getRTMSOBJListAptVM`;
  let allTransactions = [];
  
  for (const dealYmd of targetMonths) {
    const queryParams = new URLSearchParams({
      serviceKey: decodeURIComponent(serviceKey),
      LAWD_CD: lawdCd,
      DEAL_YMD: dealYmd,
      pageNo: '1',
      numOfRows: '150'
    });
    
    try {
      const response = await fetch(`${url}?${queryParams.toString()}`);
      if (!response.ok) continue;
      const xmlText = await response.text();
      
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
      const items = xmlDoc.getElementsByTagName('item');
      
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const itemPriceStr = item.getElementsByTagName('dealAmount')[0]?.textContent?.trim() || '';
        const itemArea = parseFloat(item.getElementsByTagName('excluUseAr')[0]?.textContent || item.excluUseAr?.[0]?.textContent) || 0;
        const buildYear = parseInt(item.getElementsByTagName('buildYear')[0]?.textContent || item.buildYear?.[0]?.textContent) || 0;
        
        // 2026년 기준 5년 이내 초신축 단지만 정밀 필터링하여 구축의 시세 깎아먹기 왜곡 방지
        if (buildYear >= 2021 && itemArea > 0) {
          const price = parseInt(itemPriceStr.replace(/,/g, ''));
          const pyung = itemArea * 0.3025 * 1.3;
          const pricePerPyung = Math.round(price / pyung);
          allTransactions.push(pricePerPyung);
        }
      }
    } catch (e) {
      console.warn('동적 신축 가격 조회 루프 오류:', e.message);
    }
  }
  
  if (allTransactions.length === 0) return null;
  const sum = allTransactions.reduce((acc, val) => acc + val, 0);
  return Math.round(sum / allTransactions.length);
}

/**
 * 국토교통부 건축물대장 전유부 API 실시간 호출하여 특정 전용면적의 대지지분(평) 추출
 */
export async function fetchRealLandShare({
  sigunguCd,
  bjdongCd,
  bonbun,
  bubun,
  targetArea,
  aptName,
  serviceKey = '861650caaf89e02504e6a50ee864ec6c6ff3338b71a7fa0c9fe22f294e2dc99d'
}) {
  if (!sigunguCd || !bjdongCd || !bonbun || !targetArea) return null;

  const formatCode = (val) => {
    if (!val) return '0000';
    const num = parseInt(val);
    if (isNaN(num)) return '0000';
    return num.toString().padStart(4, '0');
  };

  const formattedBun = formatCode(bonbun);
  const formattedJi = formatCode(bubun);
  
  // Vite 프록시를 활용한 건축물대장 API 호출 (CORS 회피)
  const url = `/api-molit/1613000/BldRgstHubService/getBrExposInfo`;
  
  const runQuery = async (jiVal) => {
    const queryParams = new URLSearchParams({
      serviceKey: decodeURIComponent(serviceKey),
      sigunguCd: sigunguCd,
      bjdongCd: bjdongCd,
      platGbCd: '0',
      bun: formattedBun,
      ji: jiVal,
      pageNo: '1',
      numOfRows: '100',
      _type: 'json' // JSON으로 쿼리 시도
    });
    
    try {
      const response = await fetch(`${url}?${queryParams.toString()}`);
      if (!response.ok) return null;
      
      const text = await response.text();
      // 에러 메시지나 XML이 반환되었을 경우 거름
      if (text.trim().startsWith('<') || text.includes('<?xml')) {
        return null;
      }
      
      const resData = JSON.parse(text);
      return resData?.response?.body?.items?.item || null;
    } catch (e) {
      console.warn('전유부 API 내부 파싱 오류:', e.message);
      return null;
    }
  };

  try {
    // 1차: 본래의 부번(ji)으로 전유부 쿼리 실행
    let items = await runQuery(formattedJi);
    
    // 2차: 조회 결과가 없을 시 대표지번(ji=0000)으로 폴백 실행
    if (!items && formattedJi !== '0000') {
      items = await runQuery('0000');
    }
    
    if (!items) return null;
    
    const itemList = Array.isArray(items) ? items : [items];
    
    const cleanTargetApt = aptName ? aptName.replace(/\s+/g, '').replace(/아파트$/, '') : '';
    
    let bestMatch = null;
    let minDiff = Infinity;
    
    for (const item of itemList) {
      const area = parseFloat(item.exposPubArea || item.objArea) || 0;
      const mainAtchGbCd = item.mainAtchGbCd;
      const etcPurps = item.etcPurps || '';
      const mainPurpsCdNm = item.mainPurpsCdNm || '';
      const bldNm = item.bldNm || '';
      
      // 1. 주건축물 여부 필터 (0 = 주건축물)
      if (mainAtchGbCd !== '0') continue;
      
      // 2. 아파트 용도 필터
      const isResidential = etcPurps.includes('아파트') || mainPurpsCdNm.includes('공동주택');
      if (!isResidential) continue;
      
      // 3. 단지명 매칭 검증 (동일 필지 내 타 단지 유입 방지)
      if (cleanTargetApt) {
        const cleanBldNm = bldNm.replace(/\s+/g, '');
        const isNameMatch = cleanBldNm.includes(cleanTargetApt) || cleanTargetApt.includes(cleanBldNm);
        if (!isNameMatch) continue;
      }
      
      // 4. 오차 최소화 매칭 (±0.5㎡)
      const diff = Math.abs(area - targetArea);
      if (diff <= 0.5 && diff < minDiff) {
        const binArea = parseFloat(item.binArea || item.binGbArea); // 대지권 지분 면적(㎡)
        if (!isNaN(binArea) && binArea > 0) {
          minDiff = diff;
          bestMatch = binArea;
        }
      }
    }
    
    if (bestMatch !== null) {
      // ㎡ 수치를 평 단위로 안전하게 변환하여 반환!
      const landSharePyung = bestMatch * 0.3025;
      console.log(`[실시간 대장 연동] 매칭 성공! 대지권 면적: ${bestMatch}㎡ -> 환산 대지지분: ${landSharePyung.toFixed(2)}평`);
      return Math.round(landSharePyung * 100) / 100;
    }
    return null;
  } catch (error) {
    console.error('실시간 대지지분 수집 오류:', error);
    return null;
  }
}

/**
 * 건축물대장 표제부 API를 호출하여 해당 단지의 현재 용적률(vlRat)을 수집
 */
export async function fetchCurrentFar({
  sigunguCd,
  bjdongCd,
  bonbun,
  bubun,
  serviceKey = '861650caaf89e02504e6a50ee864ec6c6ff3338b71a7fa0c9fe22f294e2dc99d'
}) {
  const formatCode = (val) => {
    if (!val) return '0000';
    const num = parseInt(val);
    if (isNaN(num)) return '0000';
    return num.toString().padStart(4, '0');
  };

  const formattedBun = formatCode(bonbun);
  const formattedJi = formatCode(bubun);

  const url = `/api-molit/1613000/BldRgstHubService/getBrTitleInfo`;
  
  const queryParams = new URLSearchParams({
    serviceKey: decodeURIComponent(serviceKey),
    sigunguCd: sigunguCd,
    bjdongCd: bjdongCd,
    platGbCd: '0',
    bun: formattedBun,
    ji: formattedJi,
    pageNo: '1',
    numOfRows: '10',
    _type: 'json'
  });

  try {
    const response = await fetch(`${url}?${queryParams.toString()}`);
    if (!response.ok) return null;
    const text = await response.text();
    if (text.trim().startsWith('<') || text.includes('<?xml')) return null;
    
    const resData = JSON.parse(text);
    const items = resData?.response?.body?.items?.item;
    if (!items) return null;

    const itemList = Array.isArray(items) ? items : [items];
    for (const item of itemList) {
      if (item.vlRat && parseFloat(item.vlRat) > 0) {
        return Math.round(parseFloat(item.vlRat));
      }
    }
    return null;
  } catch (e) {
    return null;
  }
}
