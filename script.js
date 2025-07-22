let model, video, canvas, ctx;

async function loadModel() {
  model = await tf.loadGraphModel(
    "https://tfhub.dev/google/tfjs-model/movenet/singlepose/lightning/4",
    { fromTFHub: true }
  );
  console.log("MoveNet model loaded.");
}

async function setupCamera() {
  video = document.getElementById("video");
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: 640, height: 480 },
    audio: false
  });
  video.srcObject = stream;

  return new Promise(resolve => {
    video.onloadedmetadata = () => {
      video.play();
      resolve();
    };
  });
}

function drawSkeleton(keypoints) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw circles for each keypoint
  keypoints.forEach(([y, x, confidence]) => {
    if (confidence > 0.4) {
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, 2 * Math.PI);
      ctx.fillStyle = "red";
      ctx.fill();
    }
  });

  // You can connect keypoints with lines for limbs
  function drawLine(p1, p2) {
    const [y1, x1, c1] = keypoints[p1];
    const [y2, x2, c2] = keypoints[p2];
    if (c1 > 0.4 && c2 > 0.4) {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.lineWidth = 2;
      ctx.strokeStyle = "lime";
      ctx.stroke();
    }
  }

  const connections = [
    [0, 1], [1, 3], [0, 2], [2, 4], // head
    [5, 7], [7, 9], [6, 8], [8, 10], // arms
    [5, 6], [5, 11], [6, 12], // upper body
    [11, 12], [11, 13], [13, 15], [12, 14], [14, 16] // legs
  ];

  connections.forEach(pair => drawLine(...pair));
}

function calculateAngle(p1, p2, p3) {
  const angle =
    Math.atan2(p3[1] - p2[1], p3[0] - p2[0]) -
    Math.atan2(p1[1] - p2[1], p1[0] - p2[0]);
  return Math.abs((angle * 180) / Math.PI);
}

function updateMetrics(keypoints) {
  const getPoint = idx => keypoints[idx];

  const leftShoulder = getPoint(5);
  const rightShoulder = getPoint(6);
  const leftHip = getPoint(11);
  const rightHip = getPoint(12);
  const leftEar = getPoint(3);
  const rightEar = getPoint(4);
  const leftKnee = getPoint(13);
  const rightKnee = getPoint(14);
  const leftAnkle = getPoint(15);
  const rightAnkle = getPoint(16);

  const shoulderTilt = Math.atan2(
    rightShoulder[0] - leftShoulder[0],
    rightShoulder[1] - leftShoulder[1]
  );
  const hipTilt = Math.atan2(
    rightHip[0] - leftHip[0],
    rightHip[1] - leftHip[1]
  );
  const headTilt = Math.atan2(
    rightEar[0] - leftEar[0],
    rightEar[1] - leftEar[1]
  );
  const spineTilt = Math.atan2(
    (rightHip[0] + leftHip[0]) / 2 - (rightShoulder[0] + leftShoulder[0]) / 2,
    (rightHip[1] + leftHip[1]) / 2 - (rightShoulder[1] + leftShoulder[1]) / 2
  );

  // Angle at knees (valgus/varus)
  const leftKneeAngle = calculateAngle(leftHip, leftKnee, leftAnkle);
  const rightKneeAngle = calculateAngle(rightHip, rightKnee, rightAnkle);

  // Head horizontal offset
  const headOffset = ((leftEar[1] + rightEar[1]) / 2) - ((leftShoulder[1] + rightShoulder[1]) / 2);

  // Update HTML elements
  document.getElementById("headOffset").innerText = headOffset.toFixed(1);
  document.getElementById("headTilt").innerText = (headTilt * 57.3).toFixed(1);
  document.getElementById("shoulderTilt").innerText = (shoulderTilt * 57.3).toFixed(1);
  document.getElementById("spineTilt").innerText = (spineTilt * 57.3).toFixed(1);
  document.getElementById("hipTilt").innerText = (hipTilt * 57.3).toFixed(1);
  document.getElementById("pelvicTilt").innerText = (hipTilt * 57.3).toFixed(1); // same as hip tilt here
  document.getElementById("kneeAngleLeft").innerText = leftKneeAngle.toFixed(1);
  document.getElementById("kneeAngleRight").innerText = rightKneeAngle.toFixed(1);
}

async function detectPose() {
  if (!model) return requestAnimationFrame(detectPose);

  const input = tf.browser.fromPixels(video)
    .resizeBilinear([192, 192])
    .expandDims(0)
    .toInt();

  const res = await model.executeAsync(input);
  const keypoints = res.arraySync()[0][0];

  drawSkeleton(keypoints);
  updateMetrics(keypoints);

  tf.dispose([input, res]);
  requestAnimationFrame(detectPose);
}

async function init() {
  await setupCamera();

  canvas = document.getElementById("output");
  ctx = canvas.getContext("2d");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  await loadModel();
  detectPose();
}

document.getElementById("captureBtn").addEventListener("click", () => {
  const link = document.createElement("a");
  link.download = `posture_report_${Date.now()}.png`;
  link.href = canvas.toDataURL();
  link.click();
});

window.onload = () => {
  init();
};
