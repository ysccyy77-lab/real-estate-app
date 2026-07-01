const https = require('https');
const fs = require('fs');
const path = require('path');

const serviceKey = '861650caaf89e02504e6a50ee864ec6c6ff3338b71a7fa0c9fe22f294e2dc99d';

// 최근 6개월의 YYYYMM 배열 생성
const getRecentMonths = () => {
    const months = [];
    const today = new Date();
    for (let i = 0; i < 6; i++) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        months.push(`${yyyy}${mm}`);
    }
    return months;
};
const targetMonths = getRecentMonths();

// 1. 아파트 DB 로드
const dbPath = path.join(__dirname, '../src/utils/apartmentDB.json');
let aptDB = [];
try {
  aptDB = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
} catch (e) {
  console.error("아파트 DB 읽기 실패:", e);
  process.exit(1);
}

// DB에서 고유 시군구 코드(LAWD_CD, 5자리) 자동 추출
const allLawdCds = [...new Set(
    aptDB.map(a => a.dongCode ? a.dongCode.substring(0, 5) : null).filter(Boolean)
)];
console.log(`📍 수집 대상 시군구 수: ${allLawdCds.length}개`);
console.log(`📅 수집 대상 기간: ${targetMonths[targetMonths.length-1]} ~ ${targetMonths[0]}`);
console.log(`📡 총 예상 API 호출 수: ${allLawdCds.length * targetMonths.length}회\n`);

// 본번/부번 포맷터 (4자리 패딩)
const formatCode = (val) => {
    if (!val) return '0000';
    const num = parseInt(val);
    if (isNaN(num)) return '0000';
    return num.toString().padStart(4, '0');
};

// 빠른 매핑을 위해 (bonbun+bubun) → aptId 해시맵 구성
const aptMappingHash = {};
aptDB.forEach(apt => {
    const key = `${formatCode(apt.bonbun)}_${formatCode(apt.bubun)}`;
    // 같은 지번에 여러 단지가 있을 수 있으므로 배열로 관리
    if (!aptMappingHash[key]) aptMappingHash[key] = [];
    aptMappingHash[key].push(apt.id);
});

// 결과를 저장할 객체: { [aptId]: Set<거래 key> } + 실제 데이터
const transactionsMap = {};

// 저장 폴더 준비
const dataDir = path.join(__dirname, '../public/data');
const transDir = path.join(dataDir, 'transactions');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(transDir)) fs.mkdirSync(transDir, { recursive: true });

// HTTP GET Helper (Promise)
const fetchMolitAPI = (lawdCd, dealYmd) => {
    return new Promise((resolve, reject) => {
        const url = `https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev?serviceKey=${serviceKey}&LAWD_CD=${lawdCd}&DEAL_YMD=${dealYmd}&pageNo=1&numOfRows=1000`;
        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
};

// XML에서 태그 값 추출 헬퍼
const getTag = (xml, tag) => {
    const m = xml.match(new RegExp(`<${tag}>(.*?)</${tag}>`));
    return m ? m[1].trim() : '';
};

const run = async () => {
    console.log("🚀 전국 실거래가 수집 시작...\n");

    let totalMatched = 0;
    let totalApiCalls = 0;

    for (const lawdCd of allLawdCds) {
        for (const ymd of targetMonths) {
            totalApiCalls++;
            try {
                const xmlData = await fetchMolitAPI(lawdCd, ymd);

                // 서버 에러 응답 감지
                if (xmlData.includes('<resultCode>')) {
                    const codeMatch = xmlData.match(/<resultCode>(.*?)<\/resultCode>/);
                    if (codeMatch && codeMatch[1] !== '000') {
                        console.warn(`  ⚠ [${lawdCd}/${ymd}] API 에러: ${codeMatch[1]}`);
                        continue;
                    }
                }

                const items = xmlData.split('<item>');
                let matchCount = 0;

                for (let i = 1; i < items.length; i++) {
                    const item = items[i];
                    const bonbun = formatCode(getTag(item, 'bonbun'));
                    const bubun = formatCode(getTag(item, 'bubun'));
                    const key = `${bonbun}_${bubun}`;

                    const matchedIds = aptMappingHash[key];
                    if (!matchedIds) continue;

                    const dealAmount = getTag(item, 'dealAmount');
                    const dealYear  = getTag(item, 'dealYear');
                    const dealMonth = getTag(item, 'dealMonth');
                    const dealDay   = getTag(item, 'dealDay');
                    const floor     = getTag(item, 'floor');
                    const area      = getTag(item, 'excluUseAr');
                    const aptNm     = getTag(item, 'aptNm');

                    if (!dealAmount || !dealYear) continue;

                    const transaction = {
                        aptNm,
                        dealAmount: dealAmount,
                        date: `${dealYear}-${dealMonth.padStart(2, '0')}-${dealDay.padStart(2, '0')}`,
                        floor: floor ? parseInt(floor) : 0,
                        area: area ? parseFloat(area) : 0
                    };

                    // 같은 지번에 매칭된 모든 단지에 추가
                    for (const aptId of matchedIds) {
                        if (!transactionsMap[aptId]) transactionsMap[aptId] = [];
                        transactionsMap[aptId].push(transaction);
                        matchCount++;
                    }
                }

                if (matchCount > 0) {
                    console.log(`  ✅ [${lawdCd}/${ymd}] ${matchCount}건 매칭`);
                    totalMatched += matchCount;
                }

                // API 부하 방지 (0.5초 대기)
                await new Promise(r => setTimeout(r, 500));

            } catch (error) {
                console.error(`  ❌ [${lawdCd}/${ymd}] 에러:`, error.message);
            }
        }
    }

    console.log(`\n📊 수집 완료: ${totalApiCalls}회 호출, 총 ${totalMatched}건 매칭\n`);

    // 기존 파일과 병합(Upsert) 후 저장
    let savedFilesCount = 0;
    for (const [aptId, newTransArr] of Object.entries(transactionsMap)) {
        const filePath = path.join(transDir, `${aptId}.json`);

        // 기존 파일이 있으면 로드 후 병합, 중복 제거
        let existing = [];
        if (fs.existsSync(filePath)) {
            try { existing = JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch {}
        }

        // 중복 제거 키: date + area + floor
        const seen = new Set(existing.map(t => `${t.date}_${t.area}_${t.floor}`));
        for (const t of newTransArr) {
            const k = `${t.date}_${t.area}_${t.floor}`;
            if (!seen.has(k)) {
                existing.push(t);
                seen.add(k);
            }
        }

        // 최신순 정렬
        existing.sort((a, b) => new Date(b.date) - new Date(a.date));

        fs.writeFileSync(filePath, JSON.stringify(existing, null, 2), 'utf8');
        savedFilesCount++;
    }

    console.log(`🎉 저장 완료! ${savedFilesCount}개 단지의 JSON 파일이 업데이트되었습니다.`);
};

run();
