// =======================
// CONFIGURATION
// =======================
let completedLine;
let remainingLine;
let displayedKm = 0;
let animationFrame = null;

const BACKEND_URL = "https://middle-earth-strava.onrender.com";

function getStoredToken() {
  return localStorage.getItem("authToken");
}

function setToken(token) {
  localStorage.setItem("authToken", token);
}

function clearToken() {
  localStorage.removeItem("authToken");
}

async function validateToken(token) {
  const res = await fetch(`${BACKEND_URL}/auth-check`, {
    headers: {
      "x-auth-token": token
    }
  });

  return res.ok;
}

async function loginFlow() {
  const overlay = document.getElementById("login-overlay");
  const btn = document.getElementById("login-btn");
  const input = document.getElementById("password");
  const error = document.getElementById("login-error");

  async function attemptLogin(token) {
    const ok = await validateToken(token);
    if (!ok) {
      error.textContent = "Invalid password";
      clearToken();
      return;
    }

    overlay.style.display = "none";
    initApp(); // 🚀 ONLY NOW load the map
  }

  btn.onclick = async () => {
    const token = input.value.trim();
    if (!token) return;
    setToken(token);
    await attemptLogin(token);
  };

  const existing = getStoredToken();
  if (existing) {
    await attemptLogin(existing);
  }
}

const IMAGE_WIDTH = 2048;
const IMAGE_HEIGHT = 1536;

const TOTAL_KM = 2863;

const milestones = [
  { name: "Hobbiton", km: 0, coord: [1113, 525] },
  { name: "Bree", km: 220, coord: [1105, 666] },
  { name: "Weathertop", km: 300, coord: [1111, 772] },
  { name: "Rivendell", km: 740, coord: [1129, 990] },
  { name: "Redhorn Pass", km: 870, coord: [1029, 1002] },
  { name: "Moria (East Gate)", km: 1000, coord: [945, 990] },
  { name: "Lothlórien", km: 1060, coord: [884, 1060] },
  { name: "Amon Hen", km: 1350, coord: [595, 1204] },
  { name: "Dead Marshes", km: 1900, coord: [606, 1306] },
  { name: "Ithilien", km: 2250, coord: [544, 1344] },
  { name: "Cirith Ungol", km: 2600, coord: [464, 1364] },
  { name: "Mount Doom", km: 2863, coord: [507, 1451] }
];

// =======================
// MAP SETUP
// =======================
function initApp() {
  // EVERYTHING map-related goes here

const map = L.map('map', {
  crs: L.CRS.Simple,
  minZoom: -2,
  maxZoom: 2
});
console.log("map exists:", !!map);

map.createPane("milestones");
map.getPane("milestones").style.zIndex = 650;

const bounds = [[0, 0], [IMAGE_HEIGHT, IMAGE_WIDTH]];

L.imageOverlay('LOTR_complete_map.jpg', bounds).addTo(map);
map.fitBounds(bounds);

map.on("click", (e) => {
  const x = e.latlng.lng;
  const y = e.latlng.lat;

  L.circleMarker([y, x], {
    radius: 4,
    color: "red"
  }).addTo(map);

  console.log(`[${Math.round(y)}, ${Math.round(x)}],`);
});

// =======================
// ROUTE (PIXEL COORDS)
// =======================

const route = [
  [1113, 525],  // Hobbiton (Shire)
  [1124, 580],  // Brandywine Bridge
  [1105, 666],  // Bree
  [1111, 772],  // Weather Hills / Weathertop
  [1125, 930],  // Trollshaws
  [1129, 990],  // Rivendell

  [1113, 1010],  // East of Rivendell
  [1029, 1002],  // Redhorn Pass (Caradhras)
  [943, 967],  // West-gate of Moria
  [945, 990],  // East-gate of Moria

  [884, 1060],  // Lothlórien (Caras Galadhon)
  [878, 1096],  // Anduin south
  [625, 1208],  // Sarn Gebir
  [595, 1204],  // Rauros / Amon Hen

  [672, 1238], // Emyn Muil
  [606, 1306], // Dead Marshes
  [544, 1344], // Ithilien

  [463, 1347], // Crossroads
  [435, 1352],   // Osgiliath (east bank)

  [451, 1357], // Morgul Vale
  [464, 1364], // Cirith Ungol
  [470, 1439], // Plateau of Gorgoroth

  [517, 1443], // North of Mount Doom
  [507, 1451]  // Mount Doom (Orodruin)
];
console.log("route length:", route.length);

// Draw route
function buildRouteGeometry(route) {
  let totalLength = 0;
  const segments = [];

  for (let i = 0; i < route.length - 1; i++) {
    const [y1, x1] = route[i];
    const [y2, x2] = route[i + 1];

    const length = Math.hypot(y2 - y1, x2 - x1);
    segments.push({
      from: route[i],
      to: route[i + 1],
      length
    });

    totalLength += length;
  }

  return { segments, totalLength };
}

const routeGeom = buildRouteGeometry(route);
console.log("routeGeom is:", routeGeom);
console.log("segments:", routeGeom.segments);
console.log("is array:", Array.isArray(routeGeom.segments));

milestones.forEach(m => {
  L.circleMarker(m.coord, {
    pane: "milestones",
    radius: 5,
    color: "#222",
    fillColor: "#ffd54f",
    fillOpacity: 1,
    weight: 2
  })
  .bindTooltip(
    `<strong>${m.name}</strong><br>${m.km} km`,
    {
      direction: "top",
      offset: [0, -6],
      opacity: 0.95,
      sticky: true
    }
  )
  .addTo(map);
});

// =======================
// MARKER
// =======================

const marker = L.circleMarker(route[0], {
  radius: 8,
  color: '#ffdd88',
  fillColor: '#ffdd88',
  fillOpacity: 1
}).addTo(map);

// =======================
// DISTANCE INTERPOLATION
// =======================

function getPolylineLength(points) {
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    length += L.point(points[i][1], points[i][0])
      .distanceTo(L.point(points[i - 1][1], points[i - 1][0]));
  }
  return length;
}

function getCurrentMilestone(km) {
  let current = milestones[0];
  let next = milestones[milestones.length - 1];

  for (let i = 0; i < milestones.length; i++) {
    if (km >= milestones[i].km) {
      current = milestones[i];
      next = milestones[i + 1] || null;
    }
  }

  return { current, next };
}

// =======================
// UPDATE POSITION
// =======================

function renderJourney(km) {
  const ratio = Math.min(km / TOTAL_KM, 1);

  // 🟢 START-OF-JOURNEY GUARD (CRITICAL)
  if (km <= 0.01) {
    marker.setLatLng(route[0]);

    if (completedLine) map.removeLayer(completedLine);
    if (remainingLine) map.removeLayer(remainingLine);

    // Draw full route as dashed "remaining"
    remainingLine = L.polyline(route, {
      color: '#888',
      weight: 3,
      dashArray: '6,6'
    }).addTo(map);

    document.getElementById('status').innerHTML = `
      <div>0.0 km walked (0.0%)</div>
      <div><em>At Hobbiton — the journey begins</em></div>
    `;
    return;
  }

  // 🟢 NORMAL CASE
  const pos = getPointAtRatio(routeGeom, ratio);
  marker.setLatLng(pos);

  const { completed, remaining } = splitRouteAtRatio(routeGeom, ratio);

  if (completedLine) map.removeLayer(completedLine);
  if (remainingLine) map.removeLayer(remainingLine);

  // Draw completed part
  if (completed.length >= 2) {
    completedLine = L.polyline(completed, {
      color: '#4caf50',
      weight: 5
    }).addTo(map);
  }

  // Draw remaining part
  if (remaining.length >= 2) {
    remainingLine = L.polyline(remaining, {
      color: '#888',
      weight: 3,
      dashArray: '6,6'
    }).addTo(map);
  }

  const { current, next } = getCurrentMilestone(km);

  let locationText;
  if (!next) {
    locationText = "Journey Complete — Mount Doom reached";
  } else if (Math.abs(km - current.km) < 0.01) {
    locationText = `Arrived at ${current.name}`;
  } else {
    locationText = `Between ${current.name} and ${next.name}`;
  }

  document.getElementById('status').innerHTML = `
    <div>${km.toFixed(1)} km walked (${(ratio * 100).toFixed(1)}%)</div>
    <div><em>${locationText}</em></div>
  `;
}


function getPointAtRatio(routeGeom, ratio) {
  let target = routeGeom.totalLength * ratio;

  for (const seg of routeGeom.segments) {
    if (target <= seg.length) {
      const t = target / seg.length;
      return [
        seg.from[0] + (seg.to[0] - seg.from[0]) * t,
        seg.from[1] + (seg.to[1] - seg.from[1]) * t
      ];
    }
    target -= seg.length;
  }

  return routeGeom.segments.at(-1).to;
}

function splitRouteAtRatio(routeGeom, ratio) {
  let target = routeGeom.totalLength * ratio;

  const completed = [];
  const remaining = [];

  completed.push(routeGeom.segments[0].from);

  for (let i = 0; i < routeGeom.segments.length; i++) {
    const seg = routeGeom.segments[i];

    if (target >= seg.length) {
      completed.push(seg.to);
      target -= seg.length;
    } else {
      const t = target / seg.length;
      const splitPoint = [
        seg.from[0] + (seg.to[0] - seg.from[0]) * t,
        seg.from[1] + (seg.to[1] - seg.from[1]) * t
      ];

      completed.push(splitPoint);
      remaining.push(splitPoint);

      // 🔑 ADD ALL REMAINING SEGMENT ENDS
      for (let j = i; j < routeGeom.segments.length; j++) {
        remaining.push(routeGeom.segments[j].to);
      }
      break;
    }
  }

  return { completed, remaining };
}


function animateToKm(targetKm) {
  if (animationFrame) {
    cancelAnimationFrame(animationFrame);
  }

  const startKm = displayedKm;
  const delta = targetKm - startKm;
  const duration = Math.min(Math.abs(delta) * 10, 2000); // max 2s

  const startTime = performance.now();

  function step(now) {
    const elapsed = now - startTime;
    const t = Math.min(elapsed / duration, 1);
    const eased = t * t * (3 - 2 * t); // smoothstep

    displayedKm = startKm + delta * eased;
    renderJourney(displayedKm);

    if (t < 1) {
      animationFrame = requestAnimationFrame(step);
    } else {
      displayedKm = targetKm;
      renderJourney(displayedKm);
    }
  }

  animationFrame = requestAnimationFrame(step);
}

renderJourney(displayedKm);
}
// TEMP: test animation after load
//setTimeout(() => {
//  animateToKm(kmFromStrava);
//}, 1500);

async function syncFromStrava() {
  const token = localStorage.getItem("authToken");

  const res = await fetch(`${BACKEND_URL}/distance`, {
    headers: {
      "x-auth-token": token
    }
  });

  if (res.status === 401) {
    alert("Unauthorized — please log in again");
    return;
  }

  const data = await res.json();
  animateToKm(data.meters / 1000);
}

loginFlow();