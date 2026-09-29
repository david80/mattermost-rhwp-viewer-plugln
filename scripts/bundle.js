const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const pluginJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../plugin.json'), 'utf8'));
const pluginId = pluginJson.id;
const version = pluginJson.version;
const distDir = path.join(__dirname, '../dist');
const bundleName = `${pluginId}-${version}.tar.gz`;
const bundlePath = path.join(distDir, bundleName);

if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

console.log(`Packaging plugin ${pluginId} v${version}...`);

const mainJsPath = path.join(__dirname, '../webapp/dist/main.js');
if (!fs.existsSync(mainJsPath)) {
  console.error(`Error: ${mainJsPath} does not exist. Please run 'npm --prefix webapp run build' first.`);
  process.exit(1);
}

// Stage files in a temporary structure
const stageDir = path.join(distDir, 'stage');
if (fs.existsSync(stageDir)) {
  fs.rmSync(stageDir, { recursive: true, force: true });
}
fs.mkdirSync(path.join(stageDir, 'webapp/dist'), { recursive: true });

// Copy plugin.json and webapp bundle
fs.copyFileSync(path.join(__dirname, '../plugin.json'), path.join(stageDir, 'plugin.json'));
fs.copyFileSync(mainJsPath, path.join(stageDir, 'webapp/dist/main.js'));


// Copy server executables and native rhwp binaries
const serverDistDir = path.join(__dirname, '../server/dist');
let hasServer = false;
if (fs.existsSync(serverDistDir)) {
  fs.mkdirSync(path.join(stageDir, 'server/dist'), { recursive: true });
  fs.cpSync(serverDistDir, path.join(stageDir, 'server/dist'), { recursive: true });
  hasServer = true;
  console.log('Included server executables and native rhwp binaries in stage');
}

// Use system tar to package directly at root of archive
try {
  const tarTargets = hasServer ? 'plugin.json webapp server' : 'plugin.json webapp';
  execSync(`tar -czf "${bundlePath}" -C "${stageDir}" ${tarTargets}`, { stdio: 'inherit' });
  console.log(`Successfully created plugin bundle: ${bundlePath}`);
} catch (e) {
  console.error('Failed to create tar bundle using system tar:', e.message);
  process.exit(1);
} finally {
  // Clean up stage dir
  fs.rmSync(stageDir, { recursive: true, force: true });
}
