const CX = 100, CY = 100, R = 92;

const _fmtCache = {};

function getFmt(timezone, opts) {
  const key = timezone + '|' + JSON.stringify(opts);
  if (!_fmtCache[key]) {
    _fmtCache[key] = new Intl.DateTimeFormat('en', { timeZone: timezone, ...opts });
  }
  return _fmtCache[key];
}

function getTimeInTimezone(timezone, date) {
  const fmt = getFmt(timezone, {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
  const parts = fmt.formatToParts(date || new Date());
  const get = (t) => +parts.find(p => p.type === t).value;
  return { hour: get('hour'), minute: get('minute'), second: get('second') };
}

function getUTCOffset(timezone) {
  const now = new Date();
  const fmt = getFmt(timezone, {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
  const parts = fmt.formatToParts(now);
  const get = (t) => +parts.find(p => p.type === t).value;
  const tzEpoch = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return (tzEpoch - now.getTime()) / (1000 * 60 * 60);
}

function formatOffset(offset) {
  const h = Math.floor(Math.abs(offset));
  const m = Math.round((Math.abs(offset) - h) * 60);
  const sign = offset >= 0 ? '+' : '-';
  return `UTC${sign}${h}${m ? ':' + m.toString().padStart(2, '0') : ''}`;
}

function getDayPhase(hour) {
  return (hour >= 6 && hour < 18) ? 'day' : 'night';
}

function createClockSVG(container) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 200 200');
  svg.classList.add('clock-svg');

  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  defs.innerHTML = `<filter id="g"><feGaussianBlur stdDeviation="1.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;
  svg.appendChild(defs);

  const face = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  face.setAttribute('cx', CX); face.setAttribute('cy', CY);
  face.setAttribute('r', R);
  face.setAttribute('fill', 'none');
  face.setAttribute('stroke', 'rgba(255,255,255,0.06)');
  face.setAttribute('stroke-width', '0.5');
  svg.appendChild(face);

  const markersG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  for (let i = 0; i < 60; i++) {
    const angle = i * 6;
    const isHour = i % 5 === 0;
    const r1 = isHour ? 82 : 86;
    const r2 = isHour ? 88 : 89.5;
    const rad = angle * Math.PI / 180;
    const x1 = CX + r1 * Math.sin(rad);
    const y1 = CY - r1 * Math.cos(rad);
    const x2 = CX + r2 * Math.sin(rad);
    const y2 = CY - r2 * Math.cos(rad);
    const marker = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    marker.setAttribute('x1', x1); marker.setAttribute('y1', y1);
    marker.setAttribute('x2', x2); marker.setAttribute('y2', y2);
    if (isHour) {
      marker.setAttribute('stroke', 'rgba(255,255,255,0.7)');
      marker.setAttribute('stroke-width', '2');
      marker.setAttribute('stroke-linecap', 'round');
    } else {
      marker.setAttribute('stroke', 'rgba(255,255,255,0.15)');
      marker.setAttribute('stroke-width', '1');
    }
    markersG.appendChild(marker);
  }
  svg.appendChild(markersG);

  const handsG = document.createElementNS('http://www.w3.org/2000/svg', 'g');

  const hourHand = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  hourHand.setAttribute('class', 'hand hour-hand');
  const hh = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  hh.setAttribute('x', '96'); hh.setAttribute('y', '52');
  hh.setAttribute('width', '8'); hh.setAttribute('height', '50');
  hh.setAttribute('rx', '4'); hh.setAttribute('fill', 'white');
  hourHand.appendChild(hh);
  handsG.appendChild(hourHand);

  const minuteHand = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  minuteHand.setAttribute('class', 'hand minute-hand');
  const mh = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  mh.setAttribute('x', '97.5'); mh.setAttribute('y', '35');
  mh.setAttribute('width', '5'); mh.setAttribute('height', '67');
  mh.setAttribute('rx', '2.5'); mh.setAttribute('fill', 'white');
  minuteHand.appendChild(mh);
  handsG.appendChild(minuteHand);

  const secondHand = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  secondHand.setAttribute('class', 'hand second-hand');
  const sl = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  sl.setAttribute('x1', '100'); sl.setAttribute('y1', '115');
  sl.setAttribute('x2', '100'); sl.setAttribute('y2', '22');
  sl.setAttribute('stroke', '#007AFF');
  sl.setAttribute('stroke-width', '1.5');
  sl.setAttribute('stroke-linecap', 'round');
  secondHand.appendChild(sl);
  const cw = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  cw.setAttribute('cx', '100'); cw.setAttribute('cy', '108');
  cw.setAttribute('r', '2.5'); cw.setAttribute('fill', '#007AFF');
  cw.setAttribute('opacity', '0.4');
  secondHand.appendChild(cw);
  const sc = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  sc.setAttribute('cx', '100'); sc.setAttribute('cy', '100');
  sc.setAttribute('r', '3'); sc.setAttribute('fill', '#007AFF');
  secondHand.appendChild(sc);
  handsG.appendChild(secondHand);

  const cd = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  cd.setAttribute('cx', '100'); cd.setAttribute('cy', '100');
  cd.setAttribute('r', '5'); cd.setAttribute('fill', 'rgba(255,255,255,0.1)');
  handsG.appendChild(cd);

  svg.appendChild(handsG);
  container.appendChild(svg);

  return { svg, hourHand, minuteHand, secondHand };
}

let _lastTime = {};
let _lastUpdate = {};

function invalidateTimeCache() {
  _lastUpdate = {};
}

function updateClock(handElements, timezone, date) {
  const now = Date.now();

  if (!_lastUpdate[timezone] || now - _lastUpdate[timezone] >= 1000) {
    _lastTime[timezone] = getTimeInTimezone(timezone, date);
    _lastUpdate[timezone] = now;
  }

  const t = _lastTime[timezone];
  const ms = now - _lastUpdate[timezone];
  const frac = ms / 1000;

  const smoothSec = t.second + frac;
  const smoothMin = t.minute + smoothSec / 60;
  const smoothHour = (t.hour % 12) + smoothMin / 60;

  if (handElements.hourHand) {
    handElements.hourHand.setAttribute('transform', `rotate(${smoothHour * 30}, ${CX}, ${CY})`);
  }
  if (handElements.minuteHand) {
    handElements.minuteHand.setAttribute('transform', `rotate(${smoothMin * 6}, ${CX}, ${CY})`);
  }
  if (handElements.secondHand) {
    handElements.secondHand.setAttribute('transform', `rotate(${smoothSec * 6}, ${CX}, ${CY})`);
  }
}
