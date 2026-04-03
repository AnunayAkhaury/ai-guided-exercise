/**
 * generate-pose-data.mjs
 *
 * Extracts 3 frames per second from a video, runs each frame through
 * MediaPipe PoseLandmarker (via headless Chrome / Puppeteer), strips face (0-10)
 * and finger (17-22) landmarks, and writes the skeleton JSON alongside the video.
 *
 * Usage: node scripts/generate-pose-data.mjs <BaseName>
 *   e.g. node scripts/generate-pose-data.mjs BadFormCurls
 *        reads  src/assets/images/BadFormCurls.mp4
 *        writes src/assets/images/BadFormCurls-pose.json
 *
 * First run downloads the MediaPipe model (~11 MB) to scripts/.pose-model-cache.task
 * and Puppeteer's Chromium (one-time, handled by `npm install`).
 */

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join, resolve, extname } from 'path';
import {
  existsSync, mkdirSync, rmSync, readdirSync,
  writeFileSync, readFileSync,
} from 'fs';
import http from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const require    = createRequire(import.meta.url);

// paths
const BASE_NAME    = process.argv[2] ?? 'exercise-test';
const PROJECT_ROOT = resolve(__dirname, '..');
const ASSETS_DIR   = join(PROJECT_ROOT, 'src/assets/images');
const VIDEO_PATH   = join(ASSETS_DIR, `${BASE_NAME}.mp4`);
const OUTPUT_PATH  = join(ASSETS_DIR, `${BASE_NAME}-pose.json`);
const MODEL_CACHE  = join(__dirname, '.pose-model-cache.task');
const MEDIAPIPE_DIR = join(PROJECT_ROOT, 'node_modules/@mediapipe/tasks-vision');
const MODEL_URL       =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task';

// landmark definitions
const ALL_LANDMARKS = [
  'nose',             // 0  excluded (face)
  'left_eye_inner',   // 1  excluded (face)
  'left_eye',         // 2  excluded (face)
  'left_eye_outer',   // 3  excluded (face)
  'right_eye_inner',  // 4  excluded (face)
  'right_eye',        // 5  excluded (face)
  'right_eye_outer',  // 6  excluded (face)
  'left_ear',         // 7  excluded (face)
  'right_ear',        // 8  excluded (face)
  'mouth_left',       // 9  excluded (face)
  'mouth_right',      // 10 excluded (face)
  'left_shoulder',    // 11 kept
  'right_shoulder',   // 12 kept
  'left_elbow',       // 13 kept
  'right_elbow',      // 14 kept
  'left_wrist',       // 15 kept
  'right_wrist',      // 16 kept
  'left_pinky',       // 17 excluded (finger)
  'right_pinky',      // 18 excluded (finger)
  'left_index',       // 19 excluded (finger)
  'right_index',      // 20 excluded (finger)
  'left_thumb',       // 21 excluded (finger)
  'right_thumb',      // 22 excluded (finger)
  'left_hip',         // 23 kept
  'right_hip',        // 24 kept
  'left_knee',        // 25 kept
  'right_knee',       // 26 kept
  'left_ankle',       // 27 kept
  'right_ankle',      // 28 kept
  'left_heel',        // 29 kept
  'right_heel',       // 30 kept
  'left_foot_index',  // 31 kept
  'right_foot_index', // 32 kept
];

const KEEP_INDICES = new Set([11,12,13,14,15,16,23,24,25,26,27,28,29,30,31,32]);
const BODY_LANDMARK_NAMES = ALL_LANDMARKS.filter((_, i) => KEEP_INDICES.has(i));

// mime types
const MIME = {
  '.js':   'application/javascript',
  '.mjs':  'application/javascript',
  '.cjs':  'application/javascript',
  '.wasm': 'application/wasm',
  '.task': 'application/octet-stream',
  '.html': 'text/html',
  '.json': 'application/json',
};

// html page served to Puppeteer
function detectorHtml(port) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body>
<script type="module">
  import { FilesetResolver, PoseLandmarker }
    from 'http://localhost:${port}/@mediapipe/tasks-vision/vision_bundle.mjs';

  const vision = await FilesetResolver.forVisionTasks(
    'http://localhost:${port}/@mediapipe/tasks-vision/wasm'
  );

  window._poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: 'http://localhost:${port}/model.task',
      delegate: 'CPU',
    },
    runningMode: 'IMAGE',
    numPoses: 1,
  });

  window._poseReady = true;
</script>
</body>
</html>`;
}

// local http server
function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = decodeURIComponent(req.url);

      // serve cached model
      if (url === '/model.task') {
        const data = readFileSync(MODEL_CACHE);
        res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Access-Control-Allow-Origin': '*' });
        res.end(data);
        return;
      }

      // serve mediapipe package files: /@mediapipe/tasks-vision/...
      const mpPrefix = '/@mediapipe/tasks-vision/';
      if (url.startsWith(mpPrefix)) {
        const rel = url.slice(mpPrefix.length);
        const filePath = join(MEDIAPIPE_DIR, rel);
        if (!existsSync(filePath)) { res.writeHead(404); res.end('Not found'); return; }
        res.writeHead(200, {
          'Content-Type': MIME[extname(filePath)] || 'application/octet-stream',
          'Access-Control-Allow-Origin': '*',
        });
        res.end(readFileSync(filePath));
        return;
      }

      res.writeHead(404);
      res.end();
    });

    server.listen(0, '127.0.0.1', () => {
      resolve({ server, port: server.address().port });
    });
  });
}

// ffmpeg helpers
function extractFrames(videoPath, outDir, fps = 3) {
  return new Promise((resolve, reject) => {
    const ffmpeg     = require('fluent-ffmpeg');
    const ffmpegPath = require('ffmpeg-static');
    ffmpeg.setFfmpegPath(ffmpegPath);
    ffmpeg(videoPath)
      .outputOptions([`-vf fps=${fps}`, '-f image2'])
      .output(join(outDir, 'frame_%05d.png'))
      .on('end', resolve)
      .on('error', reject)
      .run();
  });
}

function getVideoDuration(videoPath) {
  return new Promise((resolve, reject) => {
    const ffmpeg      = require('fluent-ffmpeg');
    const ffmpegPath  = require('ffmpeg-static');
    const ffprobePath = require('ffprobe-static').path;
    ffmpeg.setFfmpegPath(ffmpegPath);
    ffmpeg.setFfprobePath(ffprobePath);
    ffmpeg.ffprobe(videoPath, (err, meta) => {
      if (err) return reject(err);
      resolve(meta.format.duration || 0);
    });
  });
}

// landmark filter
function filterPose(rawWorldLandmarks) {
  const worldLandmarks = [];
  rawWorldLandmarks.forEach((lm, i) => {
    if (!KEEP_INDICES.has(i)) return;
    worldLandmarks.push({
      name:       ALL_LANDMARKS[i],
      x:          +lm.x.toFixed(6),
      y:          +lm.y.toFixed(6),
      z:          +lm.z.toFixed(6),
      visibility: +lm.visibility.toFixed(6),
    });
  });
  return { worldLandmarks };
}

// main
async function main() {
  if (!existsSync(VIDEO_PATH)) {
    console.error(`Video not found: ${VIDEO_PATH}`);
    process.exit(1);
  }

  // download model if not cached
  if (!existsSync(MODEL_CACHE)) {
    console.log('Downloading MediaPipe model (~11 MB, first run only)...');
    const res = await fetch(MODEL_URL);
    if (!res.ok) throw new Error(`Model download failed: ${res.status}`);
    writeFileSync(MODEL_CACHE, Buffer.from(await res.arrayBuffer()));
    console.log('Model cached.');
  }

  // extract frames at 3 fps
  const tmpDir = join(require('os').tmpdir(), `pose_frames_${Date.now()}`);
  mkdirSync(tmpDir, { recursive: true });

  console.log('Extracting frames at 3 fps...');
  await extractFrames(VIDEO_PATH, tmpDir, 3);

  const framePaths = readdirSync(tmpDir)
    .filter(f => f.endsWith('.png'))
    .sort()
    .map(f => join(tmpDir, f));

  console.log(`Extracted ${framePaths.length} frames`);
  const duration = await getVideoDuration(VIDEO_PATH);

  // start local http server
  const { server, port } = await startServer();
  console.log(`HTTP server on port ${port}`);

  // launch Puppeteer
  const { default: puppeteer } = await import('puppeteer');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();

  // route console messages to terminal
  page.on('console', msg => {
    if (msg.type() === 'error') console.error('[browser]', msg.text());
  });

  // load the detector page
  await page.setContent(detectorHtml(port), { waitUntil: 'domcontentloaded' });

  // wait for MediaPipe to be ready 
  console.log('Initialising MediaPipe PoseLandmarker...');
  await page.waitForFunction(() => window._poseReady === true, { timeout: 60000 });
  console.log('MediaPipe ready. Processing frames...');

  // process each frame
  const { default: sharp } = await import('sharp');
  const frames = [];

  for (let i = 0; i < framePaths.length; i++) {
    process.stdout.write(`\r  Frame ${i + 1}/${framePaths.length}`);

    const base64 = (await sharp(framePaths[i]).toBuffer()).toString('base64');

    const raw = await page.evaluate(async (b64) => {
      const img = new Image();
      img.src = 'data:image/png;base64,' + b64;
      await new Promise(r => { img.onload = r; });
      const result = window._poseLandmarker.detect(img);
      // serialise to plain objects (Puppeteer can't transfer class instances)
      return {
        worldLandmarks: result.worldLandmarks.map(pose => pose.map(lm => ({ x: lm.x, y: lm.y, z: lm.z, visibility: lm.visibility }))),
      };
    }, base64);

    const poses = raw.worldLandmarks.length > 0
      ? [filterPose(raw.worldLandmarks[0])]
      : [];

    frames.push({
      frameIndex:  i,
      timestampMs: Math.round((i / 3) * 1000),
      poses,
    });
  }

  process.stdout.write('\n');

  // teardown
  await browser.close();
  server.close();

  // write JSON
  const output = {
    videoFile:       `${BASE_NAME}.mp4`,
    generatedAt:     new Date().toISOString(),
    captureRate:     3,
    durationSeconds: +duration.toFixed(3),
    totalFrames:     frames.length,
    landmarks:       BODY_LANDMARK_NAMES,
    frames,
  };

  writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), 'utf-8');
  console.log(`\nDone! -> ${OUTPUT_PATH}`);

  // clean up temp frames
  rmSync(tmpDir, { recursive: true, force: true });
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
