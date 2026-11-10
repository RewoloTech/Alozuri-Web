import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const env = { ...process.env };
// Editor/agent processes can inherit this flag; Cypress needs Electron's browser runtime.
delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(process.execPath, [require.resolve('cypress/bin'), ...process.argv.slice(2)], {
  env,
  stdio: 'inherit',
});
child.on('error', (error) => {
  console.error('Unable to start Cypress: ' + error.message);
  process.exitCode = 1;
});
child.on('exit', (code) => {
  process.exitCode = code ?? 1;
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
