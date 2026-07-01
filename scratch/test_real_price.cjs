const https = require('https');

const lawdCd = '41210'; // 광명시
const dealYmd = '202401'; // 거래가 많았던 24년 1월 (또는 202402, 202403 등)
const serviceKey = '861650caaf89e02504e6a50ee864ec6c6ff3338b71a7fa0c9fe22f294e2dc99d';

const url = `https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev?serviceKey=${serviceKey}&LAWD_CD=${lawdCd}&DEAL_YMD=${dealYmd}&pageNo=1&numOfRows=500`;

https.get(url, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    // 하안주공 4단지 관련 키워드로 검색
    const items = data.split('<item>');
    const results = [];
    
    for (let i = 1; i < items.length; i++) {
      const item = items[i];
      if (item.includes('하안') || item.includes('주공4') || item.includes('0651')) {
        const aptNm = (item.match(/<aptNm>(.*?)<\/aptNm>/) || [])[1];
        const bonbun = (item.match(/<bonbun>(.*?)<\/bonbun>/) || [])[1];
        const bubun = (item.match(/<bubun>(.*?)<\/bubun>/) || [])[1];
        const jibun = (item.match(/<jibun>(.*?)<\/jibun>/) || [])[1];
        const dealAmount = (item.match(/<dealAmount>(.*?)<\/dealAmount>/) || [])[1];
        
        results.push({ aptNm, bonbun, bubun, jibun, dealAmount });
      }
    }
    
    console.log("하안동/하안주공 관련 API 응답 파싱 결과:");
    console.table(results);
    
    if (results.length === 0) {
        console.log("해당 월에 하안 관련 데이터가 없거나 태그 파싱 실패.");
        console.log("전체 응답 샘플 (앞 1000자):", data.substring(0, 1000));
    }
  });
}).on('error', (err) => {
  console.error("Error:", err);
});
