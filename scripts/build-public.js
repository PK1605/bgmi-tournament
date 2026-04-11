const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const pub = path.join(root, 'public');

function rmrf(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const name of fs.readdirSync(src)) {
      copyRecursive(path.join(src, name), path.join(dest, name));
    }
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

rmrf(pub);
fs.mkdirSync(pub, { recursive: true });

for (const name of fs.readdirSync(root)) {
  if (!name.endsWith('.html')) continue;
  copyRecursive(path.join(root, name), path.join(pub, name));
}

const extra = ['styles.css', 'assets'];
for (const name of extra) {
  const src = path.join(root, name);
  if (fs.existsSync(src)) copyRecursive(src, path.join(pub, name));
}

console.log('Built public/ for Vercel static output.');
