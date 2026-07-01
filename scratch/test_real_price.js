const https = require('https');

const lawdCd = '41210'; // 광명시
const dealYmd = '202603'; // 2026년 3월 (또는 202601)
const serviceKey = '861650caaf89e02504e6a50ee864ec6c6ff3338b71a7fa0c9fe22f294e2dc99d';

const queryParams = new URLSearchParams({
  serviceKey: decodeURIComponent(serviceKey),
  LAWD_CD: lawdCd,
  DEAL_YMD: dealYmd,
  pageNo: '1',
  numOfRows: '100'
});

const url = `https://apis.data.go.kr/1613000/RTMSOBJSvc/getRTMSOBJListAptVM?${queryParams.toString()}`;

https.get(url, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log("Status Code:", res.statusCode);
    console.log("Raw Output (First 2000 chars):");
    console.log(data.substring(0, 2000));
  });
}).on('error', (err) => {
  console.error("Error:", err);
});
