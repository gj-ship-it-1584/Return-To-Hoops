/* Builds the private one-time setup link into my-setup-link.txt from personal/baseline.json.
   Both files are git-ignored: personal health numbers never go into the public repo.
   personal/baseline.json shape: { "labs": [ { "date": "YYYY-MM-DD", "alt": 0, ... } ] }
   Usage: npx tsx scripts/make-setup-link.ts [site-url]                                     */
import { readFileSync, writeFileSync } from 'node:fs';
import { encodeSetup, type SetupData } from '../src/lib/backup';

const site = process.argv[2] ?? 'https://gj-ship-it-1584.github.io/Return-to-Hoops/';
const data = JSON.parse(readFileSync('personal/baseline.json', 'utf8')) as SetupData;
const link = `${site}#setup=${encodeSetup(data)}`;
writeFileSync('my-setup-link.txt', link + '\n');
console.log('wrote my-setup-link.txt');
