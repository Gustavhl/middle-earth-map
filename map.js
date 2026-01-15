// =======================
// CONFIGURATION
// =======================
let completedLine;
let remainingLine;
let displayedKm = 0;
let animationFrame = null;

const IMAGE_WIDTH = 5000;
const IMAGE_HEIGHT = 3000;

const TOTAL_KM = 2863;

const milestones = [
  { name: "Hobbiton", km: 0 },
  { name: "Bree", km: 220 },
  { name: "Weathertop", km: 300 },
  { name: "Rivendell", km: 740 },
  { name: "Redhorn Pass", km: 870 },
  { name: "Moria (East Gate)", km: 1000 },
  { name: "Lothlórien", km: 1060 },
  { name: "Amon Hen", km: 1350 },
  { name: "Dead Marshes", km: 1900 },
  { name: "Ithilien", km: 2250 },
  { name: "Cirith Ungol", km: 2600 },
  { name: "Mount Doom", km: 2863 }
];

// TEMP: simulated distance (replace later with Strava)
//let simulatedKm = 5; // try 740 = Rivendell

// =======================
// MAP SETUP
// =======================

const map = L.map('map', {
  crs: L.CRS.Simple,
  minZoom: -2,
  maxZoom: 2
});

const bounds = [[0, 0], [IMAGE_HEIGHT, IMAGE_WIDTH]];

L.imageOverlay('LOTR_complete_map.jpg', bounds).addTo(map);
map.fitBounds(bounds);

// =======================
// ROUTE (PIXEL COORDS)
// =======================

const route = [
  [610, 820],    // Hobbiton
  [640, 1100],   // Bree
  [680, 1400],   // Weathertop
  [720, 1750],   // Rivendell
  [800, 1900],   // Redhorn
  [900, 2000],   // Moria exit
  [950, 2100],   // Lothlorien
  [1200, 2400],  // Anduin
  [1600, 3000],  // Dead Marshes
  [1830, 4120]   // Mount Doom
];

// Draw route
//const routeLine = L.polyline(route, {
//  color: '#c2a35a',
//  weight: 4
//}).addTo(map);

milestones.forEach((m, i) => {
  const ratio = m.km / TOTAL_KM;
  const pos = getPointAtRatio(route, ratio);

  L.circleMarker(pos, {
    radius: 4,
    color: '#888',
    fillColor: '#888',
    fillOpacity: 1
  })
  .bindTooltip(m.name)
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

function getPointAtRatio(points, ratio) {
  const target = getPolylineLength(points) * ratio;
  let traveled = 0;

  for (let i = 1; i < points.length; i++) {
    const p1 = L.point(points[i - 1][1], points[i - 1][0]);
    const p2 = L.point(points[i][1], points[i][0]);
    const segLength = p1.distanceTo(p2);

    if (traveled + segLength >= target) {
      const remaining = target - traveled;
      const t = remaining / segLength;

      return [
        p1.y + (p2.y - p1.y) * t,
        p1.x + (p2.x - p1.x) * t
      ];
    }

    traveled += segLength;
  }

  return points[points.length - 1];
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

function splitRouteAtRatio(points, ratio) {
  const target = getPolylineLength(points) * ratio;

  let traveled = 0;
  const completed = [];
  const remaining = [];

  for (let i = 1; i < points.length; i++) {
    const p1 = L.point(points[i - 1][1], points[i - 1][0]);
    const p2 = L.point(points[i][1], points[i][0]);
    const segLength = p1.distanceTo(p2);

    if (traveled + segLength < target) {
      completed.push([p1.y, p1.x]);
      traveled += segLength;
    } else {
      const t = Math.max((target - traveled) / segLength, 0);
      const splitPoint = [
        p1.y + (p2.y - p1.y) * t,
        p1.x + (p2.x - p1.x) * t
      ];

      completed.push([p1.y, p1.x], splitPoint);
      remaining.push(splitPoint, [p2.y, p2.x]);

      for (let j = i + 1; j < points.length; j++) {
        remaining.push(points[j]);
      }
      break;
    }
  }

  return { completed, remaining };
}

// =======================
// UPDATE POSITION
// =======================

function renderJourney(km) {
  const ratio = Math.min(km / TOTAL_KM, 1);
  const pos = getPointAtRatio(route, ratio);
  marker.setLatLng(pos);

  const { completed, remaining } = splitRouteAtRatio(route, ratio);

  if (completedLine) map.removeLayer(completedLine);
  if (remainingLine) map.removeLayer(remainingLine);

  completedLine = L.polyline(completed, {
    color: '#4caf50',
    weight: 5
  }).addTo(map);

  remainingLine = L.polyline(remaining, {
    color: '#888',
    weight: 3,
    dashArray: '6,6'
  }).addTo(map);

  const { current, next } = getCurrentMilestone(km);

  let locationText;
  if (!next) {
    locationText = "Journey Complete — Mount Doom reached";
  } else if (km === current.km) {
    locationText = `Arrived at ${current.name}`;
  } else {
    locationText = `Between ${current.name} and ${next.name}`;
  }

  document.getElementById('status').innerHTML = `
    <div>${km.toFixed(1)} km walked (${(ratio * 100).toFixed(1)}%)</div>
    <div><em>${locationText}</em></div>
  `;
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

// Initial update
displayedKm = simulatedKm;
renderJourney(displayedKm);

// TEMP: test animation after load
setTimeout(() => {
  animateToKm(kmFromStrava);
}, 1500);

async function syncFromStrava() {
  try {
    const res = await fetch("https://middle-earth-strava.onrender.com/distance");
    const data = await res.json();

    const km = data.meters / 1000;
    animateToKm(km);
  } catch (err) {
    alert("Failed to sync from Strava");
  }
}
