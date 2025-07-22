window.addEventListener('DOMContentLoaded', () => {

// elements
const video = document.getElementById('video');
const canvas = document.getElementById('output');
const ctx = canvas.getContext('2d');

const metricsui = {
  headoffset: document.getElementById('headOffset'),
  headtilt: document.getElementById('headTilt'),
  shouldertilt: document.getElementById('shoulderTilt'),
  spinetilt: document.getElementById('spineTilt'),
  hiptilt: document.getElementById('hipTilt'),
  pelvictilt: document.getElementById('pelvicTilt'),
  kneeangleleft: document.getElementById('kneeAngleLeft'),
  kneeangleright: document.getElementById('kneeAngleRight'),
};

let detector;
let videowidth, videoheight;

// utility functions
function todegrees(rad) {
  return rad * (180 / Math.PI);
}

function anglebetweenpoints(p1, p2) {
  return Math.atan2(p2[1] - p1[1], p2[0] - p1[0]);
}

function distancebetweenpoints(p1, p2) {
  return Math.sqrt((p2[0] - p1[0]) ** 2 + (p2[1] - p1[1]) ** 2);
}

function midpoint(p1, p2) {
  return [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2];
}

function getkeypointcoords(keypoints, name) {
  const keypointmap = {
    nose: 0,
    left_eye: 1,
    right_eye: 2,
    left_ear: 3,
    right_ear: 4,
    left_shoulder: 5,
    right_shoulder: 6,
    left_elbow: 7,
    right_elbow: 8,
    left_wrist: 9,
    right_wrist: 10,
    left_hip: 11,
    right_hip: 12,
    left_knee: 13,
    right_knee: 14,
    left_ankle: 15,
    right_ankle: 16,
  };

  const index = keypointmap[name];
  if (index === undefined) return null;

  const point = keypoints[index];
  if (!point || point.score < 0.4) return null;

  return [point.x * videowidth, point.y * videoheight];
}

// drawing utilities
function drawcircle(point, color = 'lime', radius = 6) {
  if (!point) return;
  ctx.beginPath();
  ctx.fillStyle = color;
  ctx.arc(point[0], point[1], radius, 0, 2 * Math.PI);
  ctx.fill();
}

function drawline(p1, p2, color = 'lime', width = 4) {
  if (!p1 || !p2) return;
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.moveTo(p1[0], p1[1]);
  ctx.lineTo(p2[0], p2[1]);
  ctx.stroke();
}

// calculate posture imbalances
function calculateimbalance(keypoints) {
  const nose = getkeypointcoords(keypoints, 'nose');
  const lefteye = getkeypointcoords(keypoints, 'left_eye');
  const righteye = getkeypointcoords(keypoints, 'right_eye');
  const leftshoulder = getkeypointcoords(keypoints, 'left_shoulder');
  const rightshoulder = getkeypointcoords(keypoints, 'right_shoulder');
  const lefthip = getkeypointcoords(keypoints, 'left_hip');
  const righthip = getkeypointcoords(keypoints, 'right_hip');
  const leftknee = getkeypointcoords(keypoints, 'left_knee');
  const rightknee = getkeypointcoords(keypoints, 'right_knee');
  const leftankle = getkeypointcoords(keypoints, 'left_ankle');
  const rightankle = getkeypointcoords(keypoints, 'right_ankle');

  const shouldermid = (leftshoulder && rightshoulder) ? midpoint(leftshoulder, rightshoulder) : null;
  const hipmid = (lefthip && righthip) ? midpoint(lefthip, righthip) : null;

  const headoffset = (nose && shouldermid) ? nose[0] - shouldermid[0] : null;

  let headtilt = null;
  if (lefteye && righteye) {
    headtilt = todegrees(anglebetweenpoints(lefteye, righteye));
  }

  const shouldertilt = (leftshoulder && rightshoulder) ? todegrees(anglebetweenpoints(leftshoulder, rightshoulder)) : null;
  const spinetilt = (shouldermid && hipmid) ? todegrees(anglebetweenpoints(shouldermid, hipmid)) : null;
  const hiptilt = (lefthip && righthip) ? todegrees(anglebetweenpoints(lefthip, righthip)) : null;

  let pelvictilt = null;
  if (lefthip && leftknee && righthip && rightknee) {
    const leftlegangle = todegrees(anglebetweenpoints(lefthip, leftknee));
    const rightlegangle = todegrees(anglebetweenpoints(righthip, rightknee));
    pelvictilt = leftlegangle - rightlegangle;
  }

  function kneeangle(hip, knee, ankle) {
    if (!hip || !knee || !ankle) return null;
    const a = distancebetweenpoints(knee, ankle);
    const b = distancebetweenpoints(hip, ankle);
    const c = distancebetweenpoints(hip, knee);
    const numerator = a ** 2 + c ** 2 - b ** 2;
    const denominator = 2 * a * c;
    if (denominator === 0) return null;
    const angleRad = Math.acos(Math.min(Math.max(numerator / denominator, -1), 1));
    return todegrees(angleRad);
  }

  const kneeangleleft = kneeangle(lefthip, leftknee, leftankle);
  const kneeangleright = kneeangle(righthip, rightknee, rightankle);

  return {
    headoffset,
    headtilt,
    shouldertilt,
    spinetilt,
    hiptilt,
    pelvictilt,
    kneeangleleft,
    kneeangleright,
    keypoints: {
      nose, lefteye, righteye,
      leftshoulder, rightshoulder,
      lefthip, righthip,
      leftknee, rightknee,
      leftankle, rightankle,
      shouldermid, hipmid
    }
  };
}

function drawskeleton(kps, imbalances) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(video, 0, 0, videowidth, videoheight);

  const {
    nose, lefteye, righteye,
    leftshoulder, rightshoulder,
    lefthip, righthip,
    leftknee, rightknee,
    leftankle, rightankle,
    shouldermid, hipmid
  } = imbalances.keypoints;

  const tiltthreshold = 5;
  const offsetthreshold = 20;

  const colorbythreshold = (val, threshold) => (Math.abs(val) > threshold ? 'red' : 'lime');

  drawline(leftshoulder, rightshoulder, colorbythreshold(imbalances.shouldertilt, tiltthreshold));
  drawline(lefthip, righthip, colorbythreshold(imbalances.hiptilt, tiltthreshold));
  if (shouldermid && hipmid) {
    drawline(shouldermid, hipmid, colorbythreshold(imbalances.spinetilt, tiltthreshold));
  }
  drawline(lefthip, leftknee, colorbythreshold(imbalances.pelvictilt, tiltthreshold));
  drawline(righthip, rightknee, colorbythreshold(imbalances.pelvictilt, tiltthreshold));
  drawline(leftknee, leftankle, 'lime');
  drawline(rightknee, rightankle, 'lime');

  const keypointstodraw = [
    nose, lefteye, righteye,
    leftshoulder, rightshoulder,
    lefthip, righthip,
    leftknee, rightknee,
    leftankle, rightankle,
    shouldermid, hipmid
  ];
  keypointstodraw.forEach(point => drawcircle(point));

  if (nose && shouldermid) {
    drawcircle(nose, colorbythreshold(imbalances.headoffset, offsetthreshold), 8);
  }
}

function updatemetricsui(imbalances) {
  metricsui.headoffset.textContent = imbalances.headoffset !== null ? imbalances.headoffset.toFixed(1) : '—';
  metricsui.headtilt.textContent = imbalances.headtilt !== null ? imbalances.headtilt.toFixed(1) : '—';
  metricsui.shouldertilt.textContent = imbalances.shouldertilt !== null ? imbalances.shouldertilt.toFixed(1) : '—';
  metricsui.spinetilt.textContent = imbalances.spinetilt !== null ? imbalances.spinetilt.toFixed(1) : '—';
  metricsui.hiptilt.textContent = imbalances.hiptilt !== null ? imbalances.hiptilt.toFixed(1) : '—';
  metricsui.pelvictilt.textContent = imbalances.pelvictilt !== null ? imbalances.pelvictilt.toFixed(1) : '—';
  metricsui.kneeangleleft.textContent = imbalances.kneeangleleft !== null ? imbalances.kneeangleleft.toFixed(1) : '—';
  metricsui.kneeangleright.textContent = imbalances.kneeangleright !== null ? imbalances.kneeangleright.toFixed(1) : '—';
}

// load model and setup camera
async function setup() {
  detector = await window.movenet.createDetector(window.movenet.SINGLEPOSE_LIGHTNING);
  const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: false });
  video.srcObject = stream;

  return new Promise(resolve => {
    video.onloadedmetadata = () => {
      videowidth = video.videoWidth;
      videoheight = video.videoHeight;
      canvas.width = videowidth;
      canvas.height = videoheight;
      resolve();
    };
  });
}

// main loop
async function detectloop() {
  if (!detector) return;

  const poses = await detector.estimatePoses(video);
  if (poses && poses.length > 0) {
    const pose = poses[0];
    const imbalances = calculateimbalance(pose.keypoints);
    drawskeleton(pose.keypoints, imbalances);
    updatemetricsui(imbalances);
  } else {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(video, 0, 0, videowidth, videoheight);
  }
  requestAnimationFrame(detectloop);
}

async function main() {
  await setup();
  detectloop();
}

main();
});
  
