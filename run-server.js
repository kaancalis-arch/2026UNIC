const { spawn } = require('child_process');
const path = require('path');

const server = spawn('npx', ['vite', '--host', '0.0.0.0', '--port', '5000'], {
  cwd: __dirname,
  stdio: 'inherit',
  shell: true
});

server.on('error', (err) => {
  console.error('Server error:', err);
});

console.log('Vite server started. Press Ctrl+C to stop.');