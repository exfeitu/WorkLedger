const { spawn } = require('child_process');

const nextBin = require.resolve('next/dist/bin/next');
const BASE_PATH = '/WorkLedger';
const PORT = '3536';

console.log('正在启动开发服务器...');
const next = spawn(process.execPath, [nextBin, 'dev', '-p', PORT, '--webpack'], {
  stdio: 'inherit',
  env: { ...process.env, FORCE_COLOR: '1' }
});

setTimeout(() => {
  console.log('');
  console.log('  \x1b[36m➜  本地访问:\x1b[0m \x1b[1mhttp://localhost:' + PORT + BASE_PATH + '\x1b[0m');
  console.log('');
}, 3500);

next.on('close', (code) => process.exit(code));