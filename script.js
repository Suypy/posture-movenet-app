window.addEventListener('DOMContentLoaded', () => {
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

  function todegrees(rad) {
    return rad * (180 / Math.PI);
  }

  function anglebetween(p1, p2) {
    return Math.atan2(p2[1] - p1[1], p2[0] - p1[0]);
  }

  function distance(p1, p2) {
    return Math.sqrt((p2[0] - p1[0]) ** 2 + (p2[1] - p1[1]) ** 2);
  }

  function midpoint(p1, p2) {
    return [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2];
  }

  function getcoords(keypoints, name) {
    const map = {
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
      right_ankle: 16
    };
    const index = map[name];
    if (index === undefined || !keypoints[index] || keypoints[index].score < 0.4) return null;
    return [keypoints[index].x * videowidth, keypoints[index].y * videoheight];
  }

  function drawcircle(p, color = 'lime', r = 6) {
    if (!p) return;
    ctx.beginPath();
    ctx.fillStyle = color;
    ctx.arc(p[0], p[1], r, 0, 2 * Math.PI);
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

  function calculateimbalance(keypoints) {
    const nose = getcoords(keypoints, 'nose');
    const leye = getcoords(keypoints, 'left_eye');
    const reye = getcoords(keypoints, 'right_eye');
    const lsh = getcoords(keypoints, 'left_shoulder');
    const rsh = getcoords(keypoints, 'right_shoulder');
    const lhip = getcoords(keypoints, 'left_hip');
    const rhip = getcoords(keypoints, 'right_hip');
    const lknee = getcoords(keypoints, 'left_knee');
    const rknee = getcoords(keypoints, 'right_knee');
    const lankle = getcoords(keypoints, 'left_ankle');
    const rankle = getcoords(keypoints, 'right_ankle');

    const shoulder_mid = lsh && rsh ? midpoint(lsh, rsh) : null;
    const hip_mid = lhip && rhip ? midpoint(lhip, rhip) : null;

    const headoffset = (nose && shoulder_mid) ? nose[0] - shoulder_mid[0] : null;
    const headtilt = (leye && reye) ? todegrees(anglebetween(leye, reye)) : null;
    const shouldertilt = (lsh && rsh) ? todegrees(anglebetween(lsh, rsh)) : null;
    const spinetilt = (shoulder_mid && hip_mid) ? todegrees(anglebetween(shoulder_mid, hip_mid)) : null;
    const hiptilt = (lhip && rhip) ? todegrees(anglebetween(lhip, rhip)) : null;

    let pelvictilt = null;
    if (lhip && lknee && rhip && rknee) {
      const langle = todegrees(anglebetween(lhip, lknee));
      const rangle = todegrees(anglebetween(rhip, rknee));
      pelvictilt = langle - rangle;
    }

    function kneeangle(hip, knee, ankle) {
      if (!hip || !knee || !ankle) return null;
      const a = distance(knee, ankle);
      const b = distance(hip, ankle);
      const c = distance(hip, knee);
      const num = a ** 2 + c ** 2 - b ** 2;
      const den = 2 * a * c;
      if (den === 0) return null;
      return todegrees(Math.acos(Math.min(Math.max(num / den, -1), 1)));
    }

    const kneeangleleft = kneeangle(lhip, lknee, lankle);
    const kneeangleright = kneeangle(rhip, rknee, rankle);

    return {
      headoffset,
      headtilt,
      shouldertilt,
      spinetilt,
      hiptilt,
      pelvictilt,
      kneeangleleft,
      kneeangleright,
      keypoints: { nose, leye, reye, lsh, rsh, lhip, rhip, lknee, rknee, lankle, rankle, shoulder_mid, hip_mid }
    };
  }

  function drawskeleton(kps, imbalances) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(video, 0, 0, videowidth, videoheight);

    const {
      nose, leye, reye, lsh, rsh, lhip, rhip,
      lknee, rknee, lankle, rankle,
      shoulder_mid, hip_mid
    } = imbalances.keypoints;

    const color = (val, th) => Math.abs(val) > th ? 'red' : 'lime';

    drawline(lsh, rsh, color(imbalances.shouldertilt, 5));
    drawline(lhip, rhip, color(imbalances.hiptilt, 5));
    if (shoulder_mid && hip_mid)
      drawline(shoulder_mid, hip_mid, color(imbalances.spinetilt, 5));
    drawline(lhip, lknee, color(imbalances.pelvictilt, 5));
    drawline(rhip, rknee, color(imbalances.pelvictilt, 5));
    drawline(lknee, lankle);
    drawline(rknee, rankle);

    [nose, leye, reye, lsh, rsh, lhip, rhip, lknee, rknee, lankle, rankle, shoulder_mid, hip_mid]
      .forEach(p => drawcircle(p));

    if (nose && shoulder_mid) {
      drawcircle(nose, color(imbalances.headoffset, 20), 8);
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

  async function setupcamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false
    });
    video.srcObject = stream;

    return new Promise(resolve => {
      video.onloadedmetadata = () => {
        console.log('✅ Camera stream loaded');
        resolve(video);
      };
    });
  } catch (error) {
    console.error('❌ Camera access failed:', error);
    alert('Camera access denied. Please allow camera and refresh.');
  }
}

  async function setup() {
  await setupcamera();
  video.play();
  videowidth = video.videoWidth;
  videoheight = video.videoHeight;
  canvas.width = videowidth;
  canvas.height = videoheight;

  const poseDetectionModule = await import('https://cdn.jsdelivr.net/npm/@tensorflow-models/pose-detection');
  const { SupportedModels, movenet } = poseDetectionModule;

  detector = await poseDetectionModule.createDetector(SupportedModels.MoveNet, {
    modelType: movenet.modelType.SINGLEPOSE_LIGHTNING
  });
}


  async function detectloop() {
    const poses = await detector.estimatePoses(video);
    if (poses.length > 0) {
      const pose = poses[0];
      const imbalances = calculateimbalance(pose.keypoints);
      drawskeleton(pose.keypoints, imbalances);
      updatemetricsui(imbalances);
    }
    requestAnimationFrame(detectloop);
  }

  document.getElementById('captureBtn').addEventListener('click', () => {
    ctx.font = '20px Arial';
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, canvas.width, 120);
    ctx.fillStyle = 'white';
    ctx.textAlign = 'left';

    const lines = [
      `Head Offset: ${metricsui.headoffset.textContent} px`,
      `Head Tilt: ${metricsui.headtilt.textContent} °`,
      `Shoulder Tilt: ${metricsui.shouldertilt.textContent} °`,
      `Spine Tilt: ${metricsui.spinetilt.textContent} °`,
      `Hip Tilt: ${metricsui.hiptilt.textContent} °`,
      `Pelvic Tilt: ${metricsui.pelvictilt.textContent} °`,
      `Knee Angles (L/R): ${metricsui.kneeangleleft.textContent}° / ${metricsui.kneeangleright.textContent}°`
    ];

    lines.forEach((line, i) => {
      ctx.fillText(line, 10, 30 + i * 20);
    });

    const dataurl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = 'posture_report.png';
    link.href = dataurl;
    link.click();
  });
  setup().then(detectloop);
});
