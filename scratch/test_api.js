const https = require('https');

const SERVICE_KEY = '861650caaf89e02504e6a50ee864ec6c6ff3338b71a7fa0c9fe22f294e2dc99d';
const url = `https://apis.data.go.kr/1613000/BldRgstHubService/getBrExposInfo?serviceKey=${encodeURIComponent(SERVICE_KEY)}&sigunguCd=41210&bjdongCd=10300&platGbCd=0&bun=0013&ji=0000&_type=json&numOfRows=10`;

https.get(url, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log(data);
  });
}).on('error', (err) => {
  console.error(err);
});
