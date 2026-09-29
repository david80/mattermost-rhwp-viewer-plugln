const fs = require('fs');
const path = require('path');
const pako = require(path.join(__dirname, '../webapp/node_modules/pako'));

const wasmPath = path.join(__dirname, '../webapp/node_modules/@rhwp/core/rhwp_bg.wasm');
const outPath = path.join(__dirname, '../webapp/src/vendor/rhwp_wasm_compressed.ts');

console.log('Reading WASM binary:', wasmPath);
const wasm = fs.readFileSync(wasmPath);

console.log('Deflating WASM binary...');
const deflated = pako.deflate(wasm, { level: 9 });

console.log('Converting to base64...');
const b64 = Buffer.from(deflated).toString('base64');

console.log(`Writing compressed WASM (${b64.length} chars) to ${outPath}...`);
fs.writeFileSync(outPath, `// Auto-generated compressed WASM binary
export const RHWP_WASM_BASE64 = "${b64}";
`);

console.log('Done!');
