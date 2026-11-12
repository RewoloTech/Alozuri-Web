import { cp, mkdir } from 'node:fs/promises';
const destination = new URL('../dist/apps/api/assets/', import.meta.url);
await mkdir(destination, { recursive: true });
await cp(new URL('../assets/', import.meta.url), destination, { recursive: true });
