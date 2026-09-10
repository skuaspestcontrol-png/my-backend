const dns = require('dns').promises;
const https = require('https');
const net = require('net');
function publicIp(address) {
  if (net.isIP(address) === 6) return /^[23][0-9a-f]{0,3}:/i.test(address);
  if (net.isIP(address) !== 4) return false;
  const [a,b] = address.split('.').map(Number);
  return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && [0,168].includes(b)) || (a === 100 && b >= 64 && b <= 127) || (a === 198 && [18,19].includes(b)));
}
async function safeFetch(input, options = {}) {
  const url = new URL(input);
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) throw new Error('Remote URL is not allowed');
  if (options.allowedHosts && !options.allowedHosts.has(url.hostname)) throw new Error('Remote host is not allowed');
  const records = await dns.lookup(url.hostname, { all: true });
  if (!records.length || records.some(record => !publicIp(record.address))) throw new Error('Remote address is not allowed');
  const record = records[0];
  // Pin the validated DNS result to this connection; do not follow redirects.
  return new Promise((resolve, reject) => {
    const request = https.request(url, {
      method: options.method || 'GET', headers: options.headers,
      lookup: (_host, lookupOptions, callback) => lookupOptions.all ? callback(null, [record]) : callback(null, record.address, record.family)
    }, response => {
      const chunks = []; let size = 0;
      response.on('data', chunk => {
        size += chunk.length;
        if (size > (options.maxBytes || 8 * 1024 * 1024)) request.destroy(new Error('Remote response too large'));
        else chunks.push(chunk);
      });
      response.on('error', reject);
      response.on('end', () => {
        const data = Buffer.concat(chunks);
        resolve({ ok: response.statusCode >= 200 && response.statusCode < 300, status: response.statusCode, url: url.toString(), headers: { get: name => response.headers[name.toLowerCase()] || null }, arrayBuffer: async () => data, text: async () => data.toString('utf8'), json: async () => JSON.parse(data.toString('utf8')) });
      });
    });
    const deadline = setTimeout(() => request.destroy(new Error('Remote request timed out')), 10000);
    request.on('close', () => clearTimeout(deadline));
    request.on('error', reject);
    if (options.body) request.write(options.body);
    request.end();
  });
}
module.exports = { safeFetch, publicIp };
