import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const requiredFiles = [
  { path: 'deliverables/AI喵搭-OnePager-正式版.pdf', kind: 'pdf', minBytes: 100_000 },
  { path: 'deliverables/AI喵搭-OnePager-半决赛版.pdf', kind: 'pdf', minBytes: 100_000 },
  { path: 'deliverables/AI喵搭-路演Deck-评审版.pdf', kind: 'pdf', minBytes: 100_000 },
  { path: 'deliverables/半决赛展示与提交手册.md', kind: 'text', minBytes: 2_000 },
  { path: 'docs/internal/video-production/video/喵街AI今日角色-比赛Demo-v1.mp4', kind: 'mp4', minBytes: 1_000_000 },
  { path: 'public/qr/ai-meow-h5.png', kind: 'png', minBytes: 500 },
];

function hasExpectedSignature(buffer, kind) {
  if (kind === 'pdf') return buffer.subarray(0, 4).toString() === '%PDF';
  if (kind === 'png') return buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (kind === 'mp4') return buffer.subarray(4, 8).toString() === 'ftyp';
  return buffer.toString('utf8').trim().length > 0;
}

const verified = [];
for (const file of requiredFiles) {
  const absolutePath = path.resolve(file.path);
  const buffer = await fs.readFile(absolutePath);
  if (buffer.length < file.minBytes) {
    throw new Error(`${file.path} is unexpectedly small: ${buffer.length} bytes`);
  }
  if (!hasExpectedSignature(buffer, file.kind)) {
    throw new Error(`${file.path} does not match the expected ${file.kind} signature`);
  }
  verified.push({
    path: file.path,
    bytes: buffer.length,
    sha256: crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 12),
  });
}

console.log(JSON.stringify({ ok: true, verified }, null, 2));
