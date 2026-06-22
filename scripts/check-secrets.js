const fs = require('fs');
const path = require('path');

const SECRET_NAMES = ['BOT_TOKEN', 'ADMIN_TOKEN', 'ADMIN_TELEGRAM_ID', 'DATABASE_URL', 'WEBHOOK_SECRET_PATH'];
const CLIENT_SRC = path.join(__dirname, '..', 'client', 'src');

let hasError = false;

const scanFile = (filePath) => {
  const content = fs.readFileSync(filePath, 'utf8');
  for (const secret of SECRET_NAMES) {
    if (content.includes(secret)) {
      console.error(`ERROR: Found "${secret}" in ${filePath}`);
      hasError = true;
    }
  }
};

const scanDir = (dir) => {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanDir(fullPath);
    } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.ts') || entry.name.endsWith('.jsx') || entry.name.endsWith('.tsx') || entry.name.endsWith('.json'))) {
      scanFile(fullPath);
    }
  }
};

console.log('Scanning client/src for secrets...');
scanDir(CLIENT_SRC);

if (hasError) {
  console.error('\nSecret check FAILED. Remove secrets from client/src before building.');
  process.exit(1);
} else {
  console.log('Secret check PASSED. No secrets found in client/src.');
  process.exit(0);
}
