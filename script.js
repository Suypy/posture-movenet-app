// Elements
Const video = document.getElementById(‘video’);
Const canvas = document.getElementById(‘output’);
Const ctx = canvas.getContext(‘2d’);

Const metricsUI = {
  headOffset: document.getElementById(‘headOffset’),
  headTilt: document.getElementById(‘headTilt’),
  shoulderTilt: document.getElementById(‘shoulderTilt’),
  spineTilt: document.getElementById(‘spineTilt’),
  hipTilt: document.getElementById(‘hipTilt’),
  pelvicTilt: document.getElementById(‘pelvicTilt’),
  kneeAngleLeft: document.getElementById(‘kneeAngleLeft’),
  kneeAngleRight: document.getElementById(‘kneeAngleRight’),
};

Let detector;
Let videoWidth, videoHeight;

// Utility Functions

Function toDegrees(rad) {
  Return rad * (180 / Math.PI);
}

Function angleBetweenPoints(p1, p2) {
  Return Math.atan2(p2[1] – p1[1], p2[0] – p1[0]);
}

Function distanceBetweenPoints(p1, p2) {
  Return Math.sqrt((p2[0] – p1[0]) * 2 + (p2[1] – p1[1]) * 2);
}

Function midpoint(p1, p2) {
  Return [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2];
}

// Extract keypoint coordinates scaled to canvas
Function getKeypointCoords(keypoints, name) {
  Const keypointMap = {
    ‘nose’: 0,
    ‘left_eye’: 1,
    ‘right_eye’: 2,
    ‘left_ear’: 3,
    ‘right_ear’: 4,
    ‘left_shoulder’: 5,
    ‘right_shoulder’: 6,
    ‘left_elbow’: 7,
    ‘right_elbow’: 8,
    ‘left_wrist’: 9,
    ‘right_wrist’: 10,
    ‘left_hip’: 11,
    ‘right_hip’: 12,
    ‘left_knee’: 13,
    ‘right_knee’: 14,
    ‘left_ankle’: 15,
    ‘right_ankle’: 16,
  };

  Const index = keypointMap[name];
  If (index === undefined) return null;

  Const point = keypoints[index];
  If (!point || point.score < 0.4) return null; // low confidence

  Return [point.x * videoWidth, point.y * videoHeight];
}

// Draw utilities

Function drawCircle(point, color = ‘lime’, radius = 6) {
  If (!point) return;
  Ctx.beginPath();
  Ctx.fillStyle = color;
  Ctx.arc(point[0], point[1], radius, 0, 2 * Math.PI);
  Ctx.fill();
}

Function drawLine(p1, p2, color = ‘lime’, width = 4) {
  If (!p1 || !p2) return;
  Ctx.beginPath();
  Ctx.strokeStyle = color;
  Ctx.lineWidth = width;
  Ctx.moveTo(p1[0], p1[1]);
  Ctx.lineTo(p2[0], p2[1]);
  Ctx.stroke();
}

// Calculate angles and imbalances

Function calculateImbalance(keypoints) {
  // Key body points needed
  Const nose = getKeypointCoords(keypoints, ‘nose’);
  Const leftEye = getKeypointCoords(keypoints, ‘left_eye’);
  Const rightEye = getKeypointCoords(keypoints, ‘right_eye’);
  Const leftShoulder = getKeypointCoords(keypoints, ‘left_shoulder’);
  Const rightShoulder = getKeypointCoords(keypoints, ‘right_shoulder’);
  Const leftHip = getKeypointCoords(keypoints, ‘left_hip’);
  Const rightHip = getKeypointCoords(keypoints, ‘right_hip’);
  Const leftKnee = getKeypointCoords(keypoints, ‘left_knee’);
  Const rightKnee = getKeypointCoords(keypoints, ‘right_knee’);
  Const leftAnkle = getKeypointCoords(keypoints, ‘left_ankle’);
  Const rightAnkle = getKeypointCoords(keypoints, ‘right_ankle’);

  // Midpoints
  Const shoulderMid = (leftShoulder && rightShoulder) ? midpoint(leftShoulder, rightShoulder) : null;
  Const hipMid = (leftHip && rightHip) ? midpoint(leftHip, rightHip) : null;

  // Head horizontal offset from shoulder midline (px)
  Const headOffset = (nose && shoulderMid) ? nose[0] – shoulderMid[0] : null;

  // Head tilt (angle between eyes)
  Let headTilt = null;
  If (leftEye && rightEye) {
    headTilt = toDegrees(angleBetweenPoints(leftEye, rightEye));
  }

  // Shoulder tilt (angle between shoulders)
  Const shoulderTilt = (leftShoulder && rightShoulder) ? toDegrees(angleBetweenPoints(leftShoulder, rightShoulder)) : null;

  // Spine tilt (angle between shoulder mid and hip mid)
  Const spineTilt = (shoulderMid && hipMid) ? toDegrees(angleBetweenPoints(shoulderMid, hipMid)) : null;

  // Hip tilt (angle between hips)
  Const hipTilt = (leftHip && rightHip) ? toDegrees(angleBetweenPoints(leftHip, rightHip)) : null;

  // Pelvic tilt (difference between hip-knee angles left and right)
  Let pelvicTilt = null;
  If (leftHip && leftKnee && rightHip && rightKnee) {
    Const leftLegAngle = toDegrees(angleBetweenPoints(leftHip, leftKnee));
    Const rightLegAngle = toDegrees(angleBetweenPoints(rightHip, rightKnee));
    pelvicTilt = leftLegAngle – rightLegAngle;
  }

  // Knee valgus/varus (angle between hip-knee-ankle) left and right
  Function kneeAngle(hip, knee, ankle) {
    If (!hip || !knee || !ankle) return null;
    // Calculate angle at knee joint using cosine rule
    Const a = distanceBetweenPoints(knee, ankle);
    Const b = distanceBetweenPoints(hip, ankle);
    Const c = distanceBetweenPoints(hip, knee);
    // angle at knee = arccos((a² + c² - b²) / 2ac)
    Const numerator = a * 2 + c * 2 – b ** 2;
    Const denominator = 2 * a * c;
    If (denominator === 0) return null;
    Const angleRad = Math.acos(Math.min(Math.max(numerator / denominator, -1), 1));
    Return toDegrees(angleRad);
  }
  Const kneeAngleLeft = kneeAngle(leftHip, leftKnee, leftAnkle);
  Const kneeAngleRight = kneeAngle(rightHip, rightKnee, rightAnkle);

  Return {
    headOffset,
    headTilt,
    shoulderTilt,
    spineTilt,
    hipTilt,
    pelvicTilt,
    kneeAngleLeft,
    kneeAngleRight,
    keypoints: {
      nose, leftEye, rightEye,
      leftShoulder, rightShoulder,
      leftHip, rightHip,
      leftKnee, rightKnee,
      leftAnkle, rightAnkle,
      shoulderMid, hipMid
    }
  };
}

// Draw skeleton and highlights

Function drawSkeleton(kps, imbalances) {
  Ctx.clearRect(0, 0, canvas.width, canvas.height);
  Ctx.drawImage(video, 0, 0, videoWidth, videoHeight);

  Const {
    Nose, leftEye, rightEye,
    leftShoulder, rightShoulder,
    leftHip, rightHip,
    leftKnee, rightKnee,
    leftAnkle, rightAnkle,
    shoulderMid, hipMid
  } = imbalances.keypoints;

  // Thresholds for coloring
  Const tiltThreshold = 5; // degrees
  Const offsetThreshold = 20; // px

  // Helper to color code lines/circles
  Const colorByThreshold = (val, threshold) => (Math.abs(val) > threshold ? ‘red’ : ‘lime’);

  // Draw lines between key joints (shoulders, hips, spine, legs)
  drawLine(leftShoulder, rightShoulder, colorByThreshold(imbalances.shoulderTilt, tiltThreshold));
  drawLine(leftHip, rightHip, colorByThreshold(imbalances.hipTilt, tiltThreshold));
  if (shoulderMid && hipMid) {
    drawLine(shoulderMid, hipMid, colorByThreshold(imbalances.spineTilt, tiltThreshold));
  }
  drawLine(leftHip, leftKnee, colorByThreshold(imbalances.pelvicTilt, tiltThreshold));
  drawLine(rightHip, rightKnee, colorByThreshold(imbalances.pelvicTilt, tiltThreshold));
  drawLine(leftKnee, leftAnkle, ‘lime’);
  drawLine(rightKnee, rightAnkle, ‘lime’);

  // Draw keypoints
  Const keypointsToDraw = [
    Nose, leftEye, rightEye,
    leftShoulder, rightShoulder,
    leftHip, rightHip,
    leftKnee, rightKnee,
    leftAnkle, rightAnkle,
    shoulderMid, hipMid
  ];
  keypointsToDraw.forEach(point => drawCircle(point));

  // Highlight nose position color-coded for offset
  If (nose && shoulderMid) {
    drawCircle(nose, colorByThreshold(imbalances.headOffset, offsetThreshold), 8);
  }
}

// Update metrics UI

Function updateMetricsUI(imbalances) {
  metricsUI.headOffset.textContent = imbalances.headOffset !== null ? imbalances.headOffset.toFixed(1) : ‘—‘;
  metricsUI.headTilt.textContent = imbalances.headTilt !== null ? imbalances.headTilt.toFixed(1) : ‘—‘;
  metricsUI.shoulderTilt.textContent = imbalances.shoulderTilt !== null ? imbalances.shoulderTilt.toFixed(1) : ‘—‘;
  metricsUI.spineTilt.textContent = imbalances.spineTilt !== null ? imbalances.spineTilt.toFixed(1) : ‘—‘;
  metricsUI.hipTilt.textContent = imbalances.hipTilt !== null ? imbalances.hipTilt.toFixed(1) : ‘—‘;
  metricsUI.pelvicTilt.textContent = imbalances.pelvicTilt !== null ? imbalances.pelvicTilt.toFixed(1) : ‘—‘;
  metricsUI.kneeAngleLeft.textContent = imbalances.kneeAngleLeft !== null ? imbalances.kneeAngleLeft.toFixed(1) : ‘—‘;
  metricsUI.kneeAngleRight.textContent = imbalances.kneeAngleRight !== null ? imbalances.kneeAngleRight.toFixed(1) : ‘—‘;
}

// Setup camera

Async function setupCamera() {
  If (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    Alert(‘Camera API not supported in this browser.’);
    Throw new Error(‘Camera API not supported’);
  }
  Const stream = await navigator.mediaDevices.getUserMedia({
    ‘audio’: false,
    ‘video’: {
      facingMode: ‘user’,
      width: { ideal: 640 },
      height: { ideal: 480 },
    },
  });
  Video.srcObject = stream;

  Return new Promise((resolve) => {
    Video.onloadedmetadata = () => {
      Resolve(video);
    };
  });
}

// Main loop for pose detection & rendering

Async function run() {
  Await setupCamera();
  Video.play();

  videoWidth = video.videoWidth;
  videoHeight = video.videoHeight;

  canvas.width = videoWidth;
  canvas.height = videoHeight;

  // Load MoveNet detector
  Detector = await poseDetection.createDetector(poseDetection.SupportedModels.MoveNet, {
    modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
  });

  Async function detectFrame() {
    Const poses = await detector.estimatePoses(video);
    If (poses.length > 0) {
      Const pose = poses[0];
      Const imbalances = calculateImbalance(pose.keypoints);
      drawSkeleton(pose.keypoints, imbalances);
      updateMetricsUI(imbalances);
    } else {
      Ctx.clearRect(0, 0, canvas.width, canvas.height);
      Ctx.drawImage(video, 0, 0, videoWidth, videoHeight);
      // Reset metrics
      For (const key in metricsUI) {
        metricsUI[key].textContent = ‘—‘;
      }
    }
    requestAnimationFrame(detectFrame);
  }

  detectFrame();
}

// Capture posture report image + overlay text

Document.getElementById(‘captureBtn’).addEventListener(‘click’, () => {
  // Overlay the metrics on canvas
  Ctx.font = ‘20px Arial’;
  Ctx.fillStyle = ‘rgba(0,0,0,0.6)’;
  Ctx.fillRect(0, 0, canvas.width, 120);
  Ctx.fillStyle = ‘white’;
  Ctx.textAlign = ‘left’;

  Const lines = [
    Head Offset: ${metricsUI.headOffset.textContent} px,
    Head Tilt: ${metricsUI.headTilt.textContent} °,
    Shoulder Tilt: ${metricsUI.shoulderTilt.textContent} °,
    Spine Tilt: ${metricsUI.spineTilt.textContent} °,
    Hip Tilt: ${metricsUI.hipTilt.textContent} °,
    Pelvic Tilt: ${metricsUI.pelvicTilt.textContent} °,
    Knee Angles (L / R): ${metricsUI.kneeAngleLeft.textContent}° / ${metricsUI.kneeAngleRight.textContent}°
  ];

  Lines.forEach((line, i) => {
    Ctx.fillText(line, 10, 30 + I * 25);
  });

  // Save canvas image
  Const dataURL = canvas.toDataURL(‘image/png’);

  // Create download link and click it
  Const link = document.createElement(‘a’);
  Link.download = ‘posture_report.png’;
  Link.href = dataURL;
  Link.click();
});

Run();