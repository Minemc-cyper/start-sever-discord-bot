const { HttpsProxyAgent } = require('https-proxy-agent');
const axios = require('axios');

const proxy = 'http://duyne:dcom2008@166.0.152.222:24226';

const agent = new HttpsProxyAgent(proxy);

axios.get('https://icanhazip.com', {
  httpsAgent: agent,
  timeout: 7000
})
.then(res => console.log('✅ Proxy OK:', res.data.trim()))
.catch(err => console.error('❌ Proxy lỗi:', err.code || err.message));
