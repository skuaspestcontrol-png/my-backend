'use strict';
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const source = path.join(__dirname, 'src');
const csp = "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'none'; font-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'none'; worker-src 'none'; media-src 'none'";
const files = ['index.html','styles.css','preview.js','model.js','.htaccess','robots.txt','assets/logo.png','assets/sample-site.svg','assets/site-diagram.svg','assets/signature.svg'];
function inspect(name, bytes) {
  if (name.endsWith('.png')) return;
  const text = bytes.toString('utf8');
  if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{25,}|github_pat_[A-Za-z0-9_]{30,}|AIza[A-Za-z0-9_-]{30,}/.test(text)) throw Error('Credential pattern in static output');
  const urls = text.match(/https?:\/\/[^\s"'<>]+/g) || [];
  if (urls.some(url => url !== 'http://www.w3.org/2000/svg')) throw Error('Remote URL in static output');
  if (/\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon|importScripts|Worker|SharedWorker)\s*\(|\b(?:localStorage|sessionStorage|indexedDB|serviceWorker)\b|document\.cookie|\beval\s*\(|new\s+Function\b|\bimport\s*\(/.test(text)) throw Error('Network, persistence or dynamic-code primitive in static output');
  if (/\bon(?:click|load|error|submit)\s*=|<form\b|<iframe\b|type=["']file["']|\/api\//i.test(text)) throw Error('Unsafe active markup or endpoint in static output');
}
function build(output) {
  output = path.resolve(output);
  if (output === __dirname || output === source || __dirname.startsWith(output + path.sep)) throw Error('Unsafe output root');
  if (fs.existsSync(output) && fs.readdirSync(output).length) throw Error('Use an empty output directory; never overwrite an existing site');
  fs.mkdirSync(output, { recursive:true });
  const inventory = [];
  for (const name of files) {
    const bytes = fs.readFileSync(path.join(source,name)); inspect(name,bytes);
    const file = path.join(output,name); fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,bytes);
    inventory.push({path:name,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')});
  }
  const schema = JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../backend/serviceReports/schema.json'),'utf8'));
  if (schema.sections.length !== 10) throw Error('Expected canonical ten-section schema');
  const bytes = Buffer.from('globalThis.SKUAS_PREVIEW_SCHEMA = '+JSON.stringify(schema)+';\n'); inspect('schema.js',bytes);fs.writeFileSync(path.join(output,'schema.js'),bytes);
  inventory.push({path:'schema.js',bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')});
  const manifest = {format:1,syntheticOnly:true,backendIncluded:false,externalConnections:false,persistentBrowserStorage:false,canonicalSectionCount:10,contentSecurityPolicy:csp,files:inventory};
  fs.writeFileSync(path.join(output,'preview-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  return manifest;
}
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length && !(args.length === 2 && args[0] === '--out')) throw Error('Use node build.cjs [--out EMPTY_DIRECTORY]');
  const out = args[1] || path.join(__dirname,'dist');const manifest = build(out);console.log(JSON.stringify({output:path.resolve(out),files:manifest.files.length+1,syntheticOnly:true,backendIncluded:false}));
}
module.exports = { build, inspect, files, csp };
