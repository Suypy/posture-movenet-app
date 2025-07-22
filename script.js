let detector;
const video = document.getElementById('video');
const canvas = document.getElementById('output');
const ctx = canvas.getContext('2d');

async function setupCamera() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    alert('Camera API not supported in this browser.');
    return;
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'user' },
    audio: false
  });

  video.srcObject = stream;

  return new Promise((resolve) => {
    video.onloadedmetadata = () => {
      video.play();
      resolve();
    };
  });
}

async function loadMoveNet() {
  const movenet = await import('https://cdn.jsdelivr.net/npm/@tensorflow-models/pose-detection');
  detector = await movenet.createDetector(movenet.SupportedModels.MoveNet, {
    modelType: 'SinglePose.Lightning',
    enableSmoothing: true
  });
}

function drawKeypoints(keypoints) {
  keypoints.forEach((keypoint) => {
    if (keypoint.score > 0.4) {
      ctx.beginPath();
      ctx.arc(keypoint.x, keypoint.y, 5, 0, 2 * Math.PI);
      ctx.fillStyle = 'lime';
      ctx.fill();
    }
  });
}

async function detectPose() {
  if (!detector) return;

  const poses = await detector.estimatePoses(video);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  if (poses.length > 0) {
    const keypoints = poses[0].keypoints;
    drawKeypoints(keypoints);
    updateMetrics(keypoints);
  }

  requestAnimationFrame(detectPose);
}

function updateMetrics(keypoints) {
  // Placeholder for actual metrics (angles, tilt)
  document.getElementById('headTilt').innerText = '0';
  document.getElementById('shoulderTilt').innerText = '0';
  // Add more as needed...
}

async function init() {
  await setupCamera();
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  await loadMoveNet();
  detectPose();
}

window.onload = init;
