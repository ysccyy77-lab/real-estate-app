const https = require('https');
const fs = require('fs');
const path = require('path');

const serviceKey = '861650caaf89e02504e6a50ee864ec6c6ff3338b71a7fa0c9fe22f294e2dc99d';
const lawdCd = '41210'; // 광명시

// 테스트를 위해 거래가 많았던 2024년 1~6월만 수집
const targetMonths = ['202401', '202402', '202403', '202404', '202405', '202406'];

// 1. 아파트 DB 로드
const dbPath = path.join(__dirname, '../src/utils/apartmentDB.json');
let aptDB = [];
try {
  aptDB = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
} catch (e) {
  console.error("아파트 DB 읽기 실패:", e);
  process.exit(1);
}

// 본번 부번 포맷터
const formatCode = (val) => {
    if (!val) return '0000';
    const num = parseInt(val);
    if (isNaN(num)) return '0000';
    return num.toString().padStart(4, '0');
};

// 매핑 편의를 위해 포맷된 지번 정보 캐싱
const aptMapping = aptDB.map(apt => ({
    id: apt.id,
    bonbun: formatCode(apt.bonbun),
    bubun: formatCode(apt.bubun),
    name: apt.name
}));

// 결과를 저장할 객체: { [aptId]: [ transactions... ] }
const transactionsMap = {};

// 2. 저장 폴더 준비
const dataDir = path.join(__dirname, '../public/data');
const transDir = path.join(dataDir, 'transactions');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(transDir)) fs.mkdirSync(transDir, { recursive: true });

// HTTP GET Helper (Promise)
const fetchMolitAPI = (dealYmd) => {
    return new Promise((resolve, reject) => {
        const url = `https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev?serviceKey=${serviceKey}&LAWD_CD=${lawdCd}&DEAL_YMD=${dealYmd}&pageNo=1&numOfRows=1000`;
        
        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
};

const run = async () => {
    console.log("실거래가 수집 시작...");

    for (const ymd of targetMonths) {
        console.log(`[${ymd}] 데이터 수집 중...`);
        try {
            const xmlData = await fetchMolitAPI(ymd);
            const items = xmlData.split('<item>');
            
            let matchCount = 0;

            for (let i = 1; i < items.length; i++) {
                const item = items[i];
                const bonbunMatch = item.match(/<bonbun>(.*?)<\/bonbun>/);
                const bubunMatch = item.match(/<bubun>(.*?)<\/bubun>/);
                
                if (!bonbunMatch || !bubunMatch) continue;
                
                const bonbun = bonbunMatch[1].trim();
                const bubun = bubunMatch[1].trim();
                
                // 우리 DB에서 해당 지번의 아파트 찾기
                const matchedApt = aptMapping.find(a => a.bonbun === bonbun && a.bubun === bubun);
                
                if (matchedApt) {
                    const aptNm = (item.match(/<aptNm>(.*?)<\/aptNm>/) || [])[1];
                    const dealAmount = (item.match(/<dealAmount>(.*?)<\/dealAmount>/) || [])[1];
                    const dealYear = (item.match(/<dealYear>(.*?)<\/dealYear>/) || [])[1];
                    const dealMonth = (item.match(/<dealMonth>(.*?)<\/dealMonth>/) || [])[1];
                    const dealDay = (item.match(/<dealDay>(.*?)<\/dealDay>/) || [])[1];
                    const floor = (item.match(/<floor>(.*?)<\/floor>/) || [])[1];
                    const excluUseAr = (item.match(/<excluUseAr>(.*?)<\/excluUseAr>/) || [])[1];
                    
                    const transaction = {
                        aptNm,
                        dealAmount: dealAmount ? dealAmount.trim() : '0',
                        date: `${dealYear}-${dealMonth.padStart(2, '0')}-${dealDay.padStart(2, '0')}`,
                        floor: floor ? parseInt(floor) : 0,
                        area: excluUseAr ? parseFloat(excluUseAr) : 0
                    };

                    if (!transactionsMap[matchedApt.id]) {
                        transactionsMap[matchedApt.id] = [];
                    }
                    
                    transactionsMap[matchedApt.id].push(transaction);
                    matchCount++;
                }
            }
            console.log(` -> ${ymd} 수집 완료. 매칭된 거래: ${matchCount}건`);
            
            // API 부하 방지용 짧은 대기
            await new Promise(r => setTimeout(r, 1000));
            
        } catch (error) {
            console.error(`[${ymd}] 수집 에러:`, error);
        }
    }

    // 3. 파일로 저장
    let savedFilesCount = 0;
    for (const [aptId, transArr] of Object.entries(transactionsMap)) {
        // 날짜순 내림차순 정렬 (최신순)
        transArr.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        const filePath = path.join(transDir, `${aptId}.json`);
        
        // 기존 파일이 있다면 합치고 중복 제거(Upsert)하는 로직이 이상적이지만, 
        // 여기선 프로토타입이므로 단순 덮어쓰기.
        fs.writeFileSync(filePath, JSON.stringify(transArr, null, 2), 'utf8');
        savedFilesCount++;
    }

    console.log(`\n🎉 수집 및 분할 저장 완료! 총 ${savedFilesCount}개 단지의 JSON 파일이 생성되었습니다.`);
};

run();
