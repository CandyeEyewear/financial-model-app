const https = require('https');

const data = JSON.stringify({
  model: "deepseek-chat",
  messages: [
    { role: "user", content: "Say hello! Just respond with 'API is working' if you receive this." }
  ],
  max_tokens: 50
});

const options = {
  hostname: 'api.deepseek.com',
  path: '/v1/chat/completions',
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.REACT_APP_DEEPSEEK_API_KEY}`,
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = https.request(options, (res) => {
  console.log('Status Code:', res.statusCode);
  
  let response = '';
  res.on('data', (chunk) => {
    response += chunk;
  });
  
  res.on('end', () => {
    console.log('Response:', response);
    try {
      const parsed = JSON.parse(response);
      if (parsed.choices && parsed.choices[0]) {
        console.log('✅ API is working! Message:', parsed.choices[0].message.content);
      } else {
        console.log('❌ Unexpected response format');
      }
    } catch (e) {
      console.log('❌ Failed to parse response');
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Request failed:', error);
});

req.write(data);
req.end();