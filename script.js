let video = null;
let canvas = null;
let ctx = null;
let detector = null;
let images = [];
let currentPose = null;

const startBtn = document.getElementById('start-camera');
const clickBtn = document.getElementById('click-photo');
const analyzeBtn = document.getElementById('analyze');
const resetBtn = document.getElementById('reset');
const photoCountText = document.getElementById('photo-count');

async function initCamera() {
  video = document.getElementById('video');
  canvas = document.getElementById('canvas');
  ctx = canvas.getContext('2d');

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' },
      audio: false
    });
    video.srcObject = stream;
    video.onloadedmetadata = () => {
      fitVideoToScreen();
      video.play();
    };
    clickBtn.disabled = false;
    analyzeBtn.disabled = false;
  } catch (error) {
    alert('Camera access denied or not supported');
    console.error(error);
  }
}

function fitVideoToScreen() {
  const container = document.getElementById('camera-container');
  video.width = container.clientWidth;
  video.height = container.clientHeight;
}

async function loadModel() {
  await tf.setBackend('webgl');
  await tf.ready();
  detector = await poseDetection.createDetector(poseDetection.SupportedModels.MoveNet);
  console.log("Pose detector ready");
}

async function detectPose(image) {
  const poses = await detector.estimatePoses(image);
  return poses[0];
}

function calculateDistance(p1, p2) {
  return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
}

function calculateAngle(a, b, c) {
  const ab = { x: b.x - a.x, y: b.y - a.y };
  const cb = { x: b.x - c.x, y: b.y - c.y };
  const dot = ab.x * cb.x + ab.y * cb.y;
  const magAB = Math.sqrt(ab.x * ab.x + ab.y * ab.y);
  const magCB = Math.sqrt(cb.x * cb.x + cb.y * cb.y);
  const angle = Math.acos(dot / (magAB * magCB));
  return (angle * 180) / Math.PI;
}

function drawPoseOnCanvas(pose, image) {
  canvas.width = image.width;
  canvas.height = image.height;
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  if (!pose || !pose.keypoints) return;

  pose.keypoints.forEach((kpt) => {
    if (kpt.score > 0.4) {
      ctx.beginPath();
      ctx.arc(kpt.x, kpt.y, 5, 0, 2 * Math.PI);
      ctx.fillStyle = 'red';
      ctx.fill();
      ctx.fillStyle = 'yellow';
      ctx.fillText(kpt.name || '', kpt.x + 6, kpt.y + 6);
    }
  });

  const connect = (a, b) => {
    if (pose.keypoints[a].score > 0.4 && pose.keypoints[b].score > 0.4) {
      ctx.beginPath();
      ctx.moveTo(pose.keypoints[a].x, pose.keypoints[a].y);
      ctx.lineTo(pose.keypoints[b].x, pose.keypoints[b].y);
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'blue';
      ctx.stroke();
    }
  };

  const pairs = [
    [0, 1], [1, 3], [0, 2], [2, 4],
    [5, 7], [7, 9], [6, 8], [8, 10],
    [5, 6], [5, 11], [6, 12],
    [11, 12], [11, 13], [13, 15],
    [12, 14], [14, 16]
  ];
  pairs.forEach(([a, b]) => connect(a, b));
}

function getPostureRating(angles) {
  let score = 0;
  if (angles.shoulder && angles.shoulder >= 170) score++;
  if (angles.neck && angles.neck <= 30) score++;
  if (angles.spine && angles.spine >= 160) score++;
  if (angles.knee && angles.knee >= 160) score++;
  if (score >= 3) return "Good";
  if (score === 2) return "Average";
  return "Poor";
}

startBtn.addEventListener('click', async () => {
  await loadModel();
  initCamera();
});

clickBtn.addEventListener('click', async () => {
  if (video) {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = video.videoWidth;
    tempCanvas.height = video.videoHeight;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height);

    const img = new Image();
    img.src = tempCanvas.toDataURL('image/png');
    await new Promise((resolve) => (img.onload = resolve));
    images.push(img);
    photoCountText.textContent = `Photos Taken: ${images.length}/3`;

    if (images.length >= 3) clickBtn.disabled = true;
  }
});

analyzeBtn.addEventListener('click', async () => {
  if (images.length === 0) return alert("No images to analyze");

  if (video && video.srcObject) {
    video.srcObject.getTracks().forEach(track => track.stop());
    video.srcObject = null;
  }

  const report = document.getElementById('report');
  report.innerHTML = '';

  const patientName = document.getElementById('patient-name').value || "Unknown";
  const date = document.getElementById('date').value || new Date().toISOString().split('T')[0];
  const remarks = document.getElementById('remarks').value || "";

  for (let i = 0; i < images.length; i++) {
    const pose = await detectPose(images[i]);
    drawPoseOnCanvas(pose, images[i]);
    const dataUrl = canvas.toDataURL('image/png');

    let explanation = "Keypoints detected.";
    let metrics = "";
    let rating = "N/A";
    let angles = {};

    const kp = pose.keypoints;

    if (kp) {
      const valid = (i) => kp[i] && kp[i].score > 0.4;

      if (valid(5) && valid(6)) {
        const shoulderWidth = Math.round(calculateDistance(kp[5], kp[6]));
        metrics += `<p>Shoulder Width: ${shoulderWidth}px</p>`;
      }

      if (valid(5) && valid(11) && valid(6) && valid(12)) {
        const leftAngle = calculateAngle(kp[11], kp[5], kp[6]);
        const rightAngle = calculateAngle(kp[12], kp[6], kp[5]);
        angles.shoulder = Math.round((leftAngle + rightAngle) / 2);
        metrics += `<p>Shoulder Angle: ${angles.shoulder}°</p>`;
      }

      if (valid(0) && valid(1) && valid(2)) {
        angles.neck = Math.round(calculateAngle(kp[0], kp[1], kp[2]));
        metrics += `<p>Neck Angle: ${angles.neck}°</p>`;
      }

      if (valid(5) && valid(11) && valid(6) && valid(12)) {
        const spineLeft = calculateAngle(kp[5], kp[11], kp[12]);
        const spineRight = calculateAngle(kp[6], kp[12], kp[11]);
        angles.spine = Math.round((spineLeft + spineRight) / 2);
        metrics += `<p>Spine Angle: ${angles.spine}°</p>`;
      }

      if (valid(11) && valid(13) && valid(15)) {
        angles.knee = Math.round(calculateAngle(kp[11], kp[13], kp[15]));
        metrics += `<p>Knee Angle: ${angles.knee}°</p>`;
      }

      rating = getPostureRating(angles);
      explanation += ` Shoulder: ${angles.shoulder}°, Neck: ${angles.neck}°, Spine: ${angles.spine}°, Knee: ${angles.knee}°.`;
    }

    const imgReport = document.createElement('div');
    imgReport.className = 'report-section';
    imgReport.innerHTML = `
      <h3>Posture Image ${i + 1} <span style="color:green;">[${rating}]</span></h3>
      <img src="${dataUrl}" style="max-width:100%; border:1px solid #ccc;"/>
      ${metrics}
      <p>Explanation: ${explanation}</p>
    `;
    report.appendChild(imgReport);
  }

  const meta = document.createElement('div');
  meta.innerHTML = `
    <h2>Patient: ${patientName}</h2>
    <p>Date: ${date}</p>
    <p>Remarks: ${remarks}</p>
  `;
  report.prepend(meta);
  report.style.display = 'block';

  const opt = {
    margin: 0.5,
    filename: `${patientName}_Posture_Report.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2 },
    jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
  };

  html2pdf().from(report).set(opt).save();
});

resetBtn.addEventListener('click', () => {
  images = [];
  clickBtn.disabled = false;
  analyzeBtn.disabled = false;
  document.getElementById('report').style.display = 'none';
  document.getElementById('report').innerHTML = '';
  photoCountText.textContent = 'Photos Taken: 0/3';
  document.getElementById('patient-name').value = '';
  document.getElementById('date').value = '';
  document.getElementById('remarks').value = '';
});
