let detector;
const video = document.getElementById('video');
const canvas = document.getElementById('output');
const ctx = canvas.getContext('2d');

// Load MoveNet
async function loadModel() {
  const model = await tf.loadGraphModel(
    'https://tfhub.dev/google/tfjs-model/movenet/singlepose/lightning/4',
    { fromTFHub: true }
  );
  return model;
}

// Set up the camera
async function setupCamera() {
  console.log('📸 Requesting camera access...');
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480 },
      audio: false,
    });
    video.srcObject = stream;
    return new Promise((resolve) => {
      video.onloadedmetadata = () => {
        console.log('✅ Camera is ready');
        resolve(video);
      };
    });
  } catch (err) {
    console.error('❌ Camera access failed:', err);
    alert('Camera access failed. Please allow camera permissions.');
  }
}

// Function to start detection
async function startDetection() {
  await setupCamera();
  await video.play();

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  detector = await loadModel();
  detectLoop();
}

// Draw skeleton and update metrics
function detectLoop() {
  tf.engine().startScope();
  detector
    .executeAsync(tf.browser.fromPixels(video).expandDims(0))
    .then((result) => {
      const keypoints = result[0].arraySync()[0];
      tf.engine().endScope();
      drawSkeleton(keypoints);
      updateMetrics(keypoints);
      requestAnimationFrame(detectLoop);
    })
    .catch((err) => {
      console.error('❌ Detection error:', err);
      tf.engine().endScope();
    });
}

// Draw skeleton on canvas
function drawSkeleton(keypoints) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#00ff00';
  ctx.lineWidth = 2;

  keypoints.forEach((kp) => {
    if (kp[2] > 0.5) {
      ctx.beginPath();
      ctx.arc(kp[1], kp[0], 5, 0, 2 * Math.PI);
      ctx.fillStyle = 'red';
      ctx.fill();
    }
  });
}

// Dummy function to calculate and update metrics
function updateMetrics(keypoints) {
  // Placeholder calculations
  document.getElementById('headOffset').textContent = Math.round(Math.random() * 20 - 10);
  document.getElementById('headTilt').textContent = Math.round(Math.random() * 10 - 5);
  document.getElementById('shoulderTilt').textContent = Math.round(Math.random() * 10 - 5);
  document.getElementById('spineTilt').textContent = Math.round(Math.random() * 10 - 5);
  document.getElementById('hipTilt').textContent = Math.round(Math.random() * 10 - 5);
  document.getElementById('pelvicTilt').textContent = Math.round(Math.random() * 10 - 5);
  document.getElementById('kneeAngleLeft').textContent = Math.round(Math.random() * 20 + 160);
  document.getElementById('kneeAngleRight').textContent = Math.round(Math.random() * 20 + 160);
}

// Hook up Start button
document.addEventListener('DOMContentLoaded', () => {
  const startBtn = document.createElement('button');
  startBtn.id = 'startBtn';
  startBtn.textContent = 'Start Camera';
  startBtn.style.marginBottom = '10px';
  startBtn.style.padding = '10px 20px';
  startBtn.style.fontSize = '1.1rem';
  startBtn.style.cursor = 'pointer';
  document.body.insertBefore(startBtn, document.getElementById('container'));

  startBtn.addEventListener('click', async () => {
    startBtn.disabled = true;
    startBtn.textContent = 'Starting...';
    await startDetection();
    startBtn.remove();
  });
});
