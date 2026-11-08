const { spawnSync } = require('node:child_process');
const path = require('node:path');

const profile = process.argv[2];
if (!['preview', 'production'].includes(profile) || !process.env.npm_execpath) {
  console.error('Run npm run build:android or npm run build:android:store.');
  process.exit(1);
}

// Build from this app folder even when a parent folder has a Git repository.
const projectRoot = path.resolve(__dirname, '..');
const result = spawnSync(
  process.execPath,
  [
    process.env.npm_execpath,
    'exec',
    '--yes',
    '--package=eas-cli@24.10.0',
    '--',
    'eas',
    'build',
    '--platform',
    'android',
    '--profile',
    profile,
    ...process.argv.slice(3),
  ],
  {
    cwd: projectRoot,
    env: { ...process.env, EAS_NO_VCS: '1', EAS_PROJECT_ROOT: projectRoot },
    stdio: 'inherit',
  },
);

if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
