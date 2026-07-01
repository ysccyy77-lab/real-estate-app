const fs = require('fs');
const path = require('path');
const https = require('https');

const jsonPath = path.join(__dirname, '..', 'src', 'utils', 'apartmentDB.json');
const progressPath = path.join(__dirname, '..', 'src', 'utils', 'progress.json');

const SERVICE_KEY = '861650caaf89e02504e6a50ee864ec6c6ff3338b71a7fa0c9fe22f294e2dc99d';
const LIMIT_COUNT = 9000;
const CONCURRENCY_LIMIT = 1; // 1개 순차 수집 (초당 호출 제한 초과 방지)
const CHUNK_DELAY_MS = 1500; // 1.5초 간격으로 조절하여 안전성 확보

function formatCode(val) {
  if (!val) return '0000';
  const num = parseInt(val);
  if (isNaN(num)) return '0000';
  return num.toString().padStart(4, '0');
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        const trimmedData = data.trim();
        
        // API 한도 초과 및 권한 에러 감지 시 즉시 안전 종료
        if (res.statusCode === 429 || 
            trimmedData.includes('LIMITED_NUMBER_OF_SERVICE_REQUESTS_EXCEEDED') || 
            trimmedData.includes('quota exceeded') || 
            trimmedData.includes('SERVICE_KEY_IS_NOT_REGISTERED_ERROR') ||
            trimmedData.includes('OpenAPI_ServiceResponse')) {
          console.error(`\n❌ [API 오류 감지] 할당량 초과 또는 인증서 오류로 배치를 중단합니다. (상태코드: ${res.statusCode})`);
          console.error(`응답 내용: ${trimmedData.substring(0, 200)}`);
          process.exit(0);
        }
        
        // 점검 시간대 (응답의 내용이 아예 없는 200 OK) 감지 시 null 반환
        if (res.statusCode === 200 && trimmedData.length === 0) {
          resolve(null);
          return;
        }
        
        try {
          if (!trimmedData || trimmedData.startsWith('<') || trimmedData.includes('<?xml')) {
            resolve(null);
            return;
          }
          resolve(JSON.parse(trimmedData));
        } catch (e) {
          resolve(null);
        }
      });
    }).on('error', (err) => {
      console.error(`⚠️ [네트워크 에러] ${err.message}`);
      resolve(null);
    });
  });
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchExposInfo(sigunguCd, bjdongCd, bun, ji, targetArea, targetAptName) {
  const formattedBun = formatCode(bun);
  const formattedJi = formatCode(ji);
  const getUrl = (bubun) => `https://apis.data.go.kr/1613000/BldRgstHubService/getBrExposInfo?serviceKey=${encodeURIComponent(SERVICE_KEY)}&sigunguCd=${sigunguCd}&bjdongCd=${bjdongCd}&platGbCd=0&bun=${formattedBun}&ji=${bubun}&_type=json&numOfRows=100`;

  try {
    let res = await fetchJson(getUrl(formattedJi));
    let items = res?.response?.body?.items?.item;
    
    if (!items && formattedJi !== '0000') {
      res = await fetchJson(getUrl('0000'));
      items = res?.response?.body?.items?.item;
    }
    
    if (!items) return null;
    const itemList = Array.isArray(items) ? items : [items];
    
    const cleanTargetApt = targetAptName.replace(/\s+/g, '').replace(/아파트$/, '');
    
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
      const cleanBldNm = bldNm.replace(/\s+/g, '');
      const isNameMatch = cleanBldNm.includes(cleanTargetApt) || cleanTargetApt.includes(cleanBldNm);
      if (!isNameMatch) continue;
      
      // 4. 오차 최소화 매칭 (±0.5㎡)
      const diff = Math.abs(area - targetArea);
      if (diff <= 0.5 && diff < minDiff) {
        let binArea = parseFloat(item.binArea || item.binGbArea);
        if (!isNaN(binArea) && binArea > 0) {
          minDiff = diff;
          bestMatch = binArea;
        }
      }
    }
    
    if (bestMatch !== null) {
      // ㎡ 단위를 평으로 변환
      const pyung = bestMatch * 0.3025;
      return Math.round(pyung * 100) / 100;
    }
    return null;
  } catch (error) {
    return null;
  }
}

async function fetchTitleInfo(sigunguCd, bjdongCd, bun, ji) {
  const formattedBun = formatCode(bun);
  const formattedJi = formatCode(ji);
  const getUrl = (bubun) => `https://apis.data.go.kr/1613000/BldRgstHubService/getBrTitleInfo?serviceKey=${encodeURIComponent(SERVICE_KEY)}&sigunguCd=${sigunguCd}&bjdongCd=${bjdongCd}&platGbCd=0&bun=${formattedBun}&ji=${bubun}&_type=json&numOfRows=10`;

  try {
    let res = await fetchJson(getUrl(formattedJi));
    let items = res?.response?.body?.items?.item;
    
    if (!items && formattedJi !== '0000') {
      res = await fetchJson(getUrl('0000'));
      items = res?.response?.body?.items?.item;
    }
    
    if (!items) return null;
    const itemList = Array.isArray(items) ? items : [items];
    let buildYear = null;
    let curVolumetricRate = null;

    for (const item of itemList) {
      // 주건축물 (mainAtchGbCd: 0) 필터링
      if (item.mainAtchGbCd === '0' && item.useAprvDe) {
         const year = parseInt(item.useAprvDe.substring(0, 4));
         if (!isNaN(year) && year > 1900 && year < 2100) buildYear = year;
      }
      if (item.vlRat && parseFloat(item.vlRat) > 0) {
         curVolumetricRate = Math.round(parseFloat(item.vlRat));
      }
    }
    return { buildYear, curVolumetricRate };
  } catch (e) {
    return null;
  }
}

async function processApt(apt) {
  if ((apt.isLandShareUpdated && apt.buildYear && apt.curVolumetricRate) || apt.apiFetchFailed) {
    return 'SKIP';
  }
  
  if (!apt.dongCode || apt.dongCode.length < 10) {
    return 'SKIP';
  }
  
  const sigunguCd = apt.dongCode.substring(0, 5);
  const bjdongCd = apt.dongCode.substring(5, 10);
  
  let anyTypeUpdated = false;
  let titleInfoUpdated = false;
  
  // 1. 대지지분 병렬 수집
  if (!apt.isLandShareUpdated && apt.types && apt.types.length > 0) {
    const typePromises = apt.types.map(async (type) => {
      const realLandShare = await fetchExposInfo(sigunguCd, bjdongCd, apt.bonbun, apt.bubun, type.area, apt.name);
      if (realLandShare && realLandShare > 0) {
        type.landShare = realLandShare;
        anyTypeUpdated = true;
      }
    });
    await Promise.all(typePromises);
    if (anyTypeUpdated) apt.isLandShareUpdated = true;
  }
  
  // 2. 표제부(준공연도 및 현재 용적률) 수집
  if (!apt.buildYear || !apt.curVolumetricRate) {
    const titleRes = await fetchTitleInfo(sigunguCd, bjdongCd, apt.bonbun, apt.bubun);
    if (titleRes) {
      if (titleRes.buildYear && !apt.buildYear) {
        apt.buildYear = titleRes.buildYear;
        titleInfoUpdated = true;
      }
      if (titleRes.curVolumetricRate && !apt.curVolumetricRate) {
        apt.curVolumetricRate = titleRes.curVolumetricRate;
        titleInfoUpdated = true;
      }
    }
  }
  
  if (anyTypeUpdated || titleInfoUpdated) {
    if (apt.apiFetchFailed) delete apt.apiFetchFailed;
    return 'SUCCESS';
  } else {
    // 수집에 완전히 실패한 경우 마킹
    if (!apt.isLandShareUpdated && !apt.buildYear) {
      apt.apiFetchFailed = true;
      return 'FAIL';
    } else {
      return 'SKIP';
    }
  }
}

async function run() {
  console.log('\n======================================================');
  console.log('🚀 [순차 지분 및 용적률 수집 가동 - 제한: 9000건, 병렬: 1]');
  console.log('======================================================\n');
  
  if (!fs.existsSync(jsonPath)) return;
  
  const dbContent = fs.readFileSync(jsonPath, 'utf-8');
  let db = JSON.parse(dbContent);
  
  // 수집 상태 리셋 (잘못된 수집값과 플래그 복구)
  db.forEach(apt => {
    if (!apt.isLandShareUpdated) {
      delete apt.apiFetchFailed;
    }
  });
  
  const totalCount = db.length;
  
  let successCount = 0;
  let failCount = 0;
  let skipCount = 0;
  
  const updateProgress = () => {
    const processed = successCount + failCount + skipCount;
    const percentage = ((processed / totalCount) * 100).toFixed(2);
    fs.writeFileSync(progressPath, JSON.stringify({
      progress: parseFloat(percentage),
      success: successCount,
      fail: failCount,
      skip: skipCount,
      total: totalCount
    }, null, 2), 'utf-8');
  };
  
  updateProgress();
  
  // 병렬 청크 처리
  for (let i = 0; i < db.length; i += CONCURRENCY_LIMIT) {
    if (successCount >= LIMIT_COUNT) {
      console.log(`\n🛑 일일 갱신 한도(${LIMIT_COUNT}건) 도달. 종료.`);
      break;
    }
    
    const chunk = db.slice(i, i + CONCURRENCY_LIMIT);
    const promises = chunk.map(apt => processApt(apt));
    
    const results = await Promise.all(promises);
    
    for (let j = 0; j < results.length; j++) {
      const res = results[j];
      if (res === 'SUCCESS') successCount++;
      else if (res === 'FAIL') failCount++;
      else skipCount++;
      
      const apt = chunk[j];
      if (res !== 'SKIP') {
        console.log(`[처리] ${apt.name} - 지분:${apt.isLandShareUpdated ? 'O' : 'X'}, 용적률:${apt.curVolumetricRate || 'X'}`);
      }
    }
    
    updateProgress();
    if (i % 60 === 0) {
      fs.writeFileSync(jsonPath, JSON.stringify(db, null, 2), 'utf-8');
    }
    
    await sleep(CHUNK_DELAY_MS);
  }
  
  updateProgress();
  fs.writeFileSync(jsonPath, JSON.stringify(db, null, 2), 'utf-8');
  console.log(`🎉 갱신 완료! 총 ${db.length}건 중 | 성공: ${successCount}건 | 실패: ${failCount}건 | 스킵: ${skipCount}건`);
}

run();
