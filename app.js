// ===== FeFET SIMULATOR - app.js =====

// ---- STATE ----
let polDir = 'up';
let events = [];
let eventCount = 0;

// ---- PHYSICS ENGINE ----
function getVth(pr, dir, temp) {
  const q = 1.6e-19;
  const eps0 = 8.85e-12;
  const epsFe = 25;
  const tFe = 10e-9; // 10nm HZO
  const cox = (eps0 * 3.9) / (5e-9); // SiO2 5nm
  const prC = pr * 1e-6 * 1e4; // µC/cm² to C/m²
  const deltaVth = (prC * epsFe * eps0) / (cox * cox * tFe);
  const baseVth = 0.3 + (temp - 300) * 0.002;
  const shift = (pr / 15) * 1.2;
  return dir === 'up' ? baseVth + shift : baseVth - shift;
}

function calcId(vg, vd, vth, mu, temp) {
  const muEff = mu * Math.pow(300 / temp, 1.5) * 1e-4; // cm²/Vs → m²/Vs
  const cox = (8.85e-12 * 3.9) / 5e-9;
  const WL = 10;
  const vgs = vg;
  const vds = Math.min(vd, vg - vth); // saturation clamp
  if (vgs <= vth) return 0;
  const vdsLin = Math.min(vd, vgs - vth);
  const id = muEff * cox * WL * ((vgs - vth) * vdsLin - 0.5 * vdsLin * vdsLin);
  return Math.max(0, id) * 1e6; // to µA
}

// ---- MAIN UPDATE ----
function update() {
  const vg  = parseFloat(document.getElementById('vg').value);
  const vd  = parseFloat(document.getElementById('vd').value);
  const pr  = parseFloat(document.getElementById('pr').value);
  const mu  = parseFloat(document.getElementById('mu').value);
  const temp = parseFloat(document.getElementById('temp').value);

  // Update display labels
  document.getElementById('vg-out').textContent   = vg.toFixed(2) + ' V';
  document.getElementById('vd-out').textContent   = vd.toFixed(2) + ' V';
  document.getElementById('pr-out').textContent   = pr.toFixed(1) + ' µC/cm²';
  document.getElementById('mu-out').textContent   = mu + ' cm²/Vs';
  document.getElementById('temp-out').textContent = temp + ' K';

  const vth = getVth(pr, polDir, temp);
  const vthOther = getVth(pr, polDir === 'up' ? 'down' : 'up', temp);
  const memWin = Math.abs(vth - vthOther);
  const id = calcId(vg, vd, vth, mu, temp);
  const isOn = id > 0.005;

  // Overdrive
  const od = vg - vth;

  // On/off ratio
  const idOn  = calcId(3, vd, vth, mu, temp);
  const idOff = calcId(-1, vd, vth, mu, temp);
  const ratio = idOff > 0.0001 ? Math.round(idOn / idOff) : null;

  // ---- Update metrics ----
  document.getElementById('m-id').innerHTML    = id.toFixed(3) + ' <small>µA</small>';
  document.getElementById('m-vth').innerHTML   = (vth >= 0 ? '+' : '') + vth.toFixed(2) + ' <small>V</small>';
  document.getElementById('m-win').innerHTML   = memWin.toFixed(2) + ' <small>V</small>';
  document.getElementById('m-od').innerHTML    = (od >= 0 ? '+' : '') + od.toFixed(2) + ' <small>V</small>';
  document.getElementById('m-ratio').textContent = ratio ? '10^' + Math.round(Math.log10(ratio)) : '∞';

  const stateEl = document.getElementById('m-state');
  const scardEl = document.getElementById('mcard-state');
  stateEl.textContent = isOn ? 'ON  ●' : 'OFF ○';
  scardEl.className = 'mcard mcard-state ' + (isOn ? 'state-on' : 'state-off');

  // ---- Update SVG device ----
  updateDeviceSVG(vth, isOn);

  // ---- Update charts ----
  updateTransferChart(vg, vd, pr, mu, temp);
  updateOutputChart(vd, vth, mu, temp);
}

function updateDeviceSVG(vth, isOn) {
  // FE layer color
  const feRect = document.getElementById('fe-rect');
  if (polDir === 'up') {
    feRect.style.fill = '#0d1530';
    feRect.style.stroke = '#5050c8';
  } else {
    feRect.style.fill = '#1a1205';
    feRect.style.stroke = '#a07020';
  }

  // Dipole arrows
  const dipoles = document.querySelectorAll('.dipole');
  dipoles.forEach(d => {
    if (polDir === 'up') {
      d.setAttribute('y1', '70'); d.setAttribute('y2', '52');
      d.style.stroke = '#6868d8';
    } else {
      d.setAttribute('y1', '52'); d.setAttribute('y2', '70');
      d.style.stroke = '#c08020';
    }
  });

  // Channel
  const ch = document.getElementById('channel-rect');
  const cht = document.getElementById('channel-txt');
  if (isOn) {
    ch.style.fill = '#041a10';
    ch.style.stroke = '#00c070';
    cht.style.fill = '#00e5a0';
    cht.textContent = 'INVERSION CHANNEL (ON)';
  } else {
    ch.style.fill = '#061220';
    ch.style.stroke = '#1a4a7a';
    cht.style.fill = '#3a6aaa';
    cht.textContent = 'CHANNEL DEPLETED (OFF)';
  }

  // Current flow
  document.getElementById('current-group').style.opacity = isOn ? 1 : 0;

  // State dot
  const dot = document.getElementById('state-dot');
  const dotInner = document.getElementById('state-dot-inner');
  if (isOn) {
    dot.style.fill = '#00e5a0'; dotInner.style.fill = '#00e5a0';
  } else {
    dot.style.fill = '#ff3a5c'; dotInner.style.fill = '#ff3a5c';
  }

  // Pol label
  const polLbl = document.getElementById('pol-label');
  const vthSvg = document.getElementById('vth-svg');
  const stateSvg = document.getElementById('state-svg');

  if (polDir === 'up') {
    polLbl.textContent = 'P↑  UP  —  Write "0"';
    polLbl.style.fill = '#8888e8';
  } else {
    polLbl.textContent = 'P↓  DOWN  —  Write "1"';
    polLbl.style.fill = '#c08020';
  }

  vthSvg.textContent = 'V_th = ' + (vth >= 0 ? '+' : '') + vth.toFixed(2) + ' V';
  stateSvg.textContent = isOn ? '● ON — Channel Formed' : '○ OFF — No Channel';
  stateSvg.style.fill = isOn ? '#00e5a0' : '#ff3a5c';
}

// ---- POLARIZATION ----
function setPol(dir) {
  const prev = polDir;
  polDir = dir;

  document.getElementById('btn-up').className = 'write-btn write-p-up' + (dir === 'up' ? ' active' : '');
  document.getElementById('btn-dn').className = 'write-btn write-p-dn' + (dir === 'down' ? ' active' : '');

  if (prev !== dir) {
    addEvent(dir === 'up' ? 'WRITE "0" — P switched UP' : 'WRITE "1" — P switched DOWN', dir === 'up' ? 'up' : 'dn');
  }
  update();
}

function doRead() {
  const vg = parseFloat(document.getElementById('vg').value);
  const vd = parseFloat(document.getElementById('vd').value);
  const pr = parseFloat(document.getElementById('pr').value);
  const mu = parseFloat(document.getElementById('mu').value);
  const temp = parseFloat(document.getElementById('temp').value);
  const vth = getVth(pr, polDir, temp);
  const id = calcId(vg, vd, vth, mu, temp);
  const isOn = id > 0.005;
  addEvent(`READ at V_G=${vg.toFixed(1)}V → ${isOn ? 'High current (State 1)' : 'Low current (State 0)'}`, 'read');
}

function addEvent(text, type) {
  eventCount++;
  const time = new Date().toLocaleTimeString();
  events.unshift({ text, type, time, n: eventCount });
  renderEvents();
}

function renderEvents() {
  const log = document.getElementById('event-log');
  if (!events.length) return;
  log.innerHTML = events.slice(0, 20).map(e => `
    <div class="event-item">
      <div class="event-dot event-dot-${e.type === 'read' ? 'up' : e.type}" style="${e.type === 'read' ? 'background:#1a7ae0' : ''}"></div>
      <span class="event-text">#${e.n} — ${e.text}</span>
      <span class="event-time">${e.time}</span>
    </div>
  `).join('');
}

// ---- CHARTS ----
const vgPoints = [];
for (let v = -2.5; v <= 3.5; v += 0.1) vgPoints.push(parseFloat(v.toFixed(1)));

function getTransferCurve(dir, pr, vd, mu, temp) {
  return vgPoints.map(vg => {
    const vth = getVth(pr, dir, temp);
    return calcId(vg, vd, vth, mu, temp);
  });
}

// Transfer Chart
const tcCtx = document.getElementById('tc-chart').getContext('2d');
const tcChart = new Chart(tcCtx, {
  type: 'line',
  data: {
    labels: vgPoints,
    datasets: [
      {
        label: 'P↑ Write "0" — High V_th',
        data: getTransferCurve('up', 15, 0.5, 400, 300),
        borderColor: '#6868d8',
        backgroundColor: 'rgba(104,104,216,0.06)',
        fill: true, tension: 0.3, pointRadius: 0, borderWidth: 2
      },
      {
        label: 'P↓ Write "1" — Low V_th',
        data: getTransferCurve('down', 15, 0.5, 400, 300),
        borderColor: '#f0a020',
        backgroundColor: 'rgba(240,160,32,0.06)',
        fill: true, tension: 0.3, pointRadius: 0, borderWidth: 2
      },
      {
        label: 'Operating point',
        data: [],
        type: 'scatter',
        borderColor: '#00e5a0',
        backgroundColor: '#00e5a0',
        pointRadius: 6, pointStyle: 'circle', showLine: false
      }
    ]
  },
  options: {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: '#7aa8cc', font: { family: 'Space Mono', size: 10 }, boxWidth: 12 } }
    },
    scales: {
      x: {
        title: { display: true, text: 'V_G (V)', color: '#3a6a9a', font: { size: 10, family: 'Space Mono' } },
        ticks: { color: '#3a6a9a', font: { size: 9 }, maxTicksLimit: 7, callback: (v) => vgPoints[v]?.toFixed(1) },
        grid: { color: 'rgba(30,58,95,0.4)' }
      },
      y: {
        title: { display: true, text: 'I_D (µA)', color: '#3a6a9a', font: { size: 10, family: 'Space Mono' } },
        ticks: { color: '#3a6a9a', font: { size: 9 }, callback: v => v.toFixed(2) },
        grid: { color: 'rgba(30,58,95,0.4)' }, min: 0
      }
    }
  }
});

function updateTransferChart(vg, vd, pr, mu, temp) {
  tcChart.data.datasets[0].data = getTransferCurve('up', pr, vd, mu, temp);
  tcChart.data.datasets[1].data = getTransferCurve('down', pr, vd, mu, temp);
  const vth = getVth(pr, polDir, temp);
  const id = calcId(vg, vd, vth, mu, temp);
  const xIdx = vgPoints.findIndex(v => Math.abs(v - vg) < 0.06);
  tcChart.data.datasets[2].data = xIdx >= 0 ? [{ x: xIdx, y: id }] : [];
  tcChart.update('none');
}

// P-E Hysteresis Chart
const pePoints = [];
for (let e = -5; e <= 5; e += 0.1) pePoints.push(parseFloat(e.toFixed(1)));

function getPEBranch(pr, forward) {
  const ec = 1.8;
  const ps = pr * 1.05;
  return pePoints.map(e => {
    if (forward) {
      return Math.tanh(2.2 * (e - ec)) * ps;
    } else {
      return Math.tanh(2.2 * (e + ec)) * ps;
    }
  });
}

const peCtx = document.getElementById('pe-chart').getContext('2d');
new Chart(peCtx, {
  type: 'line',
  data: {
    labels: pePoints,
    datasets: [
      {
        label: 'Forward sweep',
        data: getPEBranch(15, true),
        borderColor: '#6868d8',
        backgroundColor: 'transparent',
        tension: 0.4, pointRadius: 0, borderWidth: 2
      },
      {
        label: 'Reverse sweep',
        data: getPEBranch(15, false),
        borderColor: '#f0a020',
        backgroundColor: 'transparent',
        tension: 0.4, pointRadius: 0, borderWidth: 2, borderDash: [5, 3]
      },
      {
        label: '±P_r states',
        data: [
          { x: pePoints.indexOf(0), y: 15 },
          { x: pePoints.indexOf(0), y: -15 }
        ],
        type: 'scatter',
        backgroundColor: '#00e5a0',
        borderColor: '#00e5a0',
        pointRadius: 6, showLine: false
      }
    ]
  },
  options: {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: '#7aa8cc', font: { family: 'Space Mono', size: 10 }, boxWidth: 12 } }
    },
    scales: {
      x: {
        title: { display: true, text: 'E (MV/cm)', color: '#3a6a9a', font: { size: 10, family: 'Space Mono' } },
        ticks: { color: '#3a6a9a', font: { size: 9 }, maxTicksLimit: 11, callback: (v) => pePoints[v]?.toFixed(0) },
        grid: { color: 'rgba(30,58,95,0.4)' }
      },
      y: {
        title: { display: true, text: 'P (µC/cm²)', color: '#3a6a9a', font: { size: 10, family: 'Space Mono' } },
        ticks: { color: '#3a6a9a', font: { size: 9 } },
        grid: { color: 'rgba(30,58,95,0.4)' }
      }
    }
  }
});

// Output Curves Chart (I_D vs V_DS for multiple V_GS)
const vdPoints = [];
for (let v = 0; v <= 3; v += 0.05) vdPoints.push(parseFloat(v.toFixed(2)));

function getOutputCurve(vgs, vth, mu, temp) {
  return vdPoints.map(vds => {
    if (vgs <= vth) return 0;
    const vdsSat = vgs - vth;
    if (vds < vdsSat) {
      const muEff = mu * Math.pow(300 / temp, 1.5) * 1e-4;
      const cox = (8.85e-12 * 3.9) / 5e-9;
      return Math.max(0, muEff * cox * 10 * ((vgs - vth) * vds - 0.5 * vds * vds) * 1e6);
    } else {
      const muEff = mu * Math.pow(300 / temp, 1.5) * 1e-4;
      const cox = (8.85e-12 * 3.9) / 5e-9;
      return Math.max(0, 0.5 * muEff * cox * 10 * (vgs - vth) ** 2 * 1e6);
    }
  });
}

const ocCtx = document.getElementById('oc-chart').getContext('2d');
const ocChart = new Chart(ocCtx, {
  type: 'line',
  data: {
    labels: vdPoints,
    datasets: [
      { label: 'V_GS = 2.5V', data: [], borderColor: '#00e5a0', tension: 0.3, pointRadius: 0, borderWidth: 1.5 },
      { label: 'V_GS = 2.0V', data: [], borderColor: '#6868d8', tension: 0.3, pointRadius: 0, borderWidth: 1.5 },
      { label: 'V_GS = 1.5V', data: [], borderColor: '#1a7ae0', tension: 0.3, pointRadius: 0, borderWidth: 1.5 },
      { label: 'V_GS = 1.0V', data: [], borderColor: '#f0a020', tension: 0.3, pointRadius: 0, borderWidth: 1.5 },
    ]
  },
  options: {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: '#7aa8cc', font: { family: 'Space Mono', size: 10 }, boxWidth: 12 } }
    },
    scales: {
      x: {
        title: { display: true, text: 'V_DS (V)', color: '#3a6a9a', font: { size: 10, family: 'Space Mono' } },
        ticks: { color: '#3a6a9a', font: { size: 9 }, maxTicksLimit: 7, callback: (v) => vdPoints[v]?.toFixed(1) },
        grid: { color: 'rgba(30,58,95,0.4)' }
      },
      y: {
        title: { display: true, text: 'I_D (µA)', color: '#3a6a9a', font: { size: 10, family: 'Space Mono' } },
        ticks: { color: '#3a6a9a', font: { size: 9 }, callback: v => v.toFixed(1) },
        grid: { color: 'rgba(30,58,95,0.4)' }, min: 0
      }
    }
  }
});

function updateOutputChart(vd, vth, mu, temp) {
  const levels = [2.5, 2.0, 1.5, 1.0];
  levels.forEach((vgs, i) => {
    ocChart.data.datasets[i].data = getOutputCurve(vgs, vth, mu, temp);
  });
  ocChart.update('none');
}

// ---- PARTICLE BACKGROUND ----
(function() {
  const canvas = document.getElementById('particle-canvas');
  const ctx = canvas.getContext('2d');
  let W, H, particles = [];

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  class Particle {
    constructor() { this.reset(); }
    reset() {
      this.x = Math.random() * W;
      this.y = Math.random() * H;
      this.vx = (Math.random() - 0.5) * 0.3;
      this.vy = -Math.random() * 0.4 - 0.1;
      this.r = Math.random() * 1.5 + 0.3;
      this.life = 0;
      this.maxLife = Math.random() * 400 + 200;
      this.hue = Math.random() < 0.5 ? 220 : 260;
    }
    update() {
      this.x += this.vx;
      this.y += this.vy;
      this.life++;
      if (this.life > this.maxLife || this.y < -10) this.reset();
    }
    draw() {
      const alpha = Math.sin((this.life / this.maxLife) * Math.PI) * 0.6;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${this.hue}, 70%, 70%, ${alpha})`;
      ctx.fill();
    }
  }

  function init() {
    resize();
    particles = Array.from({ length: 120 }, () => new Particle());
  }

  function loop() {
    ctx.clearRect(0, 0, W, H);
    particles.forEach(p => { p.update(); p.draw(); });
    requestAnimationFrame(loop);
  }

  window.addEventListener('resize', resize);
  init();
  loop();
})();

// ---- INIT ----
document.querySelectorAll('input[type="range"]').forEach(input => {
  input.addEventListener('input', update);
});

setPol('up');
update();
