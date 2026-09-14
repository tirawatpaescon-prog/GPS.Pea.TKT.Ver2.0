import { StreetlightTransformer } from '../data/streetlightSurveyData';

export type RouteSortMode =
  | 'nearest_gps' // ใกล้ฉันที่สุด (Nearest Neighbor จากตำแหน่งปัจจุบัน)
  | 'north_south' // เหนือ ➔ ใต้ (ตาม Latitude จากมากไปน้อย)
  | 'south_north' // ใต้ ➔ เหนือ (ตาม Latitude จากน้อยไปมาก)
  | 'west_east'   // ตะวันตก ➔ ออก (ตาม Longitude จากน้อยไปมาก)
  | 'east_west';  // ตะวันออก ➔ ตก (ตาม Longitude จากมากไปน้อย)

export interface TransformerCoord {
  lat: number;
  lng: number;
}

export interface RouteStop {
  transformer: StreetlightTransformer;
  coords: TransformerCoord | null;
  stopNumber: number;
  distanceFromPrevMeters: number | null;
  distanceFromUserMeters: number | null;
  cumulativeDistanceMeters: number;
}

export interface RoutePlan {
  stops: RouteStop[];
  totalDistanceMeters: number;
  validStopsCount: number;
  missingCoordsCount: number;
  googleMapsUrl: string | null;
}

/**
 * Extracts and validates geographic coordinates from a StreetlightTransformer
 */
export function getTransformerCoords(item: StreetlightTransformer): TransformerCoord | null {
  if (
    typeof item.latitude === 'number' &&
    typeof item.longitude === 'number' &&
    !isNaN(item.latitude) &&
    !isNaN(item.longitude) &&
    (item.latitude !== 0 || item.longitude !== 0)
  ) {
    return { lat: item.latitude, lng: item.longitude };
  }

  if (item.latlong) {
    const parts = item.latlong.split(',').map((p) => parseFloat(p.trim()));
    if (
      parts.length >= 2 &&
      !isNaN(parts[0]) &&
      !isNaN(parts[1]) &&
      (parts[0] !== 0 || parts[1] !== 0)
    ) {
      return { lat: parts[0], lng: parts[1] };
    }
  }

  return null;
}

/**
 * Calculates straight-line distance in meters between two coordinates using Haversine formula
 */
export function calculateHaversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * Format distance in meters into human-readable Thai string
 */
export function formatDistance(meters: number | null | undefined): string {
  if (meters === null || meters === undefined || isNaN(meters)) return '-';
  if (meters < 1000) {
    return `${meters} ม.`;
  }
  return `${(meters / 1000).toFixed(1)} กม.`;
}

/**
 * Sequences a list of in-progress transformers based on their Latitude and Longitude
 */
export function sequenceRoute(
  items: StreetlightTransformer[],
  sortMode: RouteSortMode,
  userLocation: TransformerCoord | null
): RoutePlan {
  if (!items || items.length === 0) {
    return {
      stops: [],
      totalDistanceMeters: 0,
      validStopsCount: 0,
      missingCoordsCount: 0,
      googleMapsUrl: null
    };
  }

  // Separate items with valid coordinates from items without
  const withCoords: { item: StreetlightTransformer; coords: TransformerCoord }[] = [];
  const withoutCoords: StreetlightTransformer[] = [];

  for (const item of items) {
    const coords = getTransformerCoords(item);
    if (coords) {
      withCoords.push({ item, coords });
    } else {
      withoutCoords.push(item);
    }
  }

  let orderedWithCoords: { item: StreetlightTransformer; coords: TransformerCoord }[] = [];

  switch (sortMode) {
    case 'north_south':
      // Latitude descending (north to south)
      orderedWithCoords = [...withCoords].sort((a, b) => b.coords.lat - a.coords.lat);
      break;

    case 'south_north':
      // Latitude ascending (south to north)
      orderedWithCoords = [...withCoords].sort((a, b) => a.coords.lat - b.coords.lat);
      break;

    case 'west_east':
      // Longitude ascending (west to east)
      orderedWithCoords = [...withCoords].sort((a, b) => a.coords.lng - b.coords.lng);
      break;

    case 'east_west':
      // Longitude descending (east to west)
      orderedWithCoords = [...withCoords].sort((a, b) => b.coords.lng - a.coords.lng);
      break;

    case 'nearest_gps':
    default: {
      // Nearest Neighbor TSP heuristic chain
      const unvisited = [...withCoords];
      orderedWithCoords = [];

      let currentPoint: TransformerCoord | null = userLocation;

      // If no user location, start from the first element (or northernmost)
      if (!currentPoint && unvisited.length > 0) {
        // Find northernmost as anchor
        let anchorIdx = 0;
        let maxLat = -Infinity;
        for (let i = 0; i < unvisited.length; i++) {
          if (unvisited[i].coords.lat > maxLat) {
            maxLat = unvisited[i].coords.lat;
            anchorIdx = i;
          }
        }
        const first = unvisited.splice(anchorIdx, 1)[0];
        orderedWithCoords.push(first);
        currentPoint = first.coords;
      }

      while (unvisited.length > 0 && currentPoint) {
        let nearestIdx = 0;
        let minDistance = Infinity;

        for (let i = 0; i < unvisited.length; i++) {
          const dist = calculateHaversineDistanceMeters(
            currentPoint.lat,
            currentPoint.lng,
            unvisited[i].coords.lat,
            unvisited[i].coords.lng
          );
          if (dist < minDistance) {
            minDistance = dist;
            nearestIdx = i;
          }
        }

        const next = unvisited.splice(nearestIdx, 1)[0];
        orderedWithCoords.push(next);
        currentPoint = next.coords;
      }
      break;
    }
  }

  // Build RouteStops with distance calculations
  const stops: RouteStop[] = [];
  let cumulativeDistance = 0;

  for (let i = 0; i < orderedWithCoords.length; i++) {
    const { item, coords } = orderedWithCoords[i];
    const stopNumber = i + 1;

    let distanceFromPrev: number | null = null;
    let distanceFromUser: number | null = null;

    if (userLocation) {
      distanceFromUser = calculateHaversineDistanceMeters(
        userLocation.lat,
        userLocation.lng,
        coords.lat,
        coords.lng
      );
    }

    if (i === 0) {
      if (userLocation) {
        distanceFromPrev = distanceFromUser;
        cumulativeDistance += distanceFromUser || 0;
      }
    } else {
      const prevCoords = orderedWithCoords[i - 1].coords;
      distanceFromPrev = calculateHaversineDistanceMeters(
        prevCoords.lat,
        prevCoords.lng,
        coords.lat,
        coords.lng
      );
      cumulativeDistance += distanceFromPrev;
    }

    stops.push({
      transformer: item,
      coords,
      stopNumber,
      distanceFromPrevMeters: distanceFromPrev,
      distanceFromUserMeters: distanceFromUser,
      cumulativeDistanceMeters: cumulativeDistance
    });
  }

  // Append items without coords at the end
  for (let j = 0; j < withoutCoords.length; j++) {
    stops.push({
      transformer: withoutCoords[j],
      coords: null,
      stopNumber: stops.length + 1,
      distanceFromPrevMeters: null,
      distanceFromUserMeters: null,
      cumulativeDistanceMeters: cumulativeDistance
    });
  }

  // Generate Google Maps Multi-stop directions URL
  let googleMapsUrl: string | null = null;
  const validStops = stops.filter((s) => s.coords !== null);

  if (validStops.length > 0) {
    if (validStops.length === 1) {
      const single = validStops[0].coords!;
      googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${single.lat},${single.lng}&travelmode=driving`;
    } else {
      let originStr = '';
      if (userLocation) {
        originStr = `${userLocation.lat},${userLocation.lng}`;
      } else {
        const first = validStops[0].coords!;
        originStr = `${first.lat},${first.lng}`;
      }

      const last = validStops[validStops.length - 1].coords!;
      const destStr = `${last.lat},${last.lng}`;

      // Waypoints are in-between stops
      const startIdx = userLocation ? 0 : 1;
      const endIdx = validStops.length - 1;
      const waypointsSlice = validStops.slice(startIdx, endIdx);

      googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${originStr}&destination=${destStr}&travelmode=driving`;

      if (waypointsSlice.length > 0) {
        // Google Maps supports up to 9 waypoints in URL parameter
        const waypointsParam = waypointsSlice
          .slice(0, 9)
          .map((s) => `${s.coords!.lat},${s.coords!.lng}`)
          .join('|');
        googleMapsUrl += `&waypoints=${encodeURIComponent(waypointsParam)}`;
      }
    }
  }

  return {
    stops,
    totalDistanceMeters: cumulativeDistance,
    validStopsCount: withCoords.length,
    missingCoordsCount: withoutCoords.length,
    googleMapsUrl
  };
}

/**
 * Generates a formatted text summary for sharing in LINE or field chats
 */
export function generateRouteSummaryText(
  plan: RoutePlan,
  villageName: string,
  sortMode: RouteSortMode
): string {
  const modeNames: Record<RouteSortMode, string> = {
    nearest_gps: 'ระยะทางใกล้สุด (GPS Nearest)',
    north_south: 'เหนือ ➔ ใต้ (ตามละติจูด)',
    south_north: 'ใต้ ➔ เหนือ (ตามละติจูด)',
    west_east: 'ตะวันตก ➔ ออก (ตามลองจิจูด)',
    east_west: 'ตะวันออก ➔ ตก (ตามลองจิจูด)'
  };

  const now = new Date();
  const dateStr = now.toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  let text = `⚡ ลำดับเส้นทางสำรวจโคมไฟ (กำลังทำ) ⚡\n`;
  text += `📅 วันที่: ${dateStr}\n`;
  if (villageName && villageName !== 'all') {
    text += `🏘️ หมู่บ้าน: ${villageName}\n`;
  }
  text += `🧭 จัดลำดับ: ${modeNames[sortMode]}\n`;
  text += `🔢 รวมหม้อแปลง: ${plan.stops.length} เครื่อง`;
  if (plan.totalDistanceMeters > 0) {
    text += ` (ระยะทางรวม ~${formatDistance(plan.totalDistanceMeters)})`;
  }
  text += `\n─────────────────────\n`;

  plan.stops.forEach((stop) => {
    const tr = stop.transformer;
    const isFirst = stop.stopNumber === 1;
    const prefix = isFirst ? '🚩 จุดที่ 1 (เริ่มต้น)' : `➡️ จุดที่ ${stop.stopNumber}`;

    text += `${prefix}: ${tr.peano} (${tr.kva} kVA)\n`;
    text += `   📍 ${tr.location}\n`;
    if (stop.distanceFromPrevMeters !== null) {
      const label = isFirst ? 'ห่างจากจุดคุณ' : 'ระยะจากจุดก่อน';
      text += `   📏 ${label}: ${formatDistance(stop.distanceFromPrevMeters)}\n`;
    }
    if (stop.coords) {
      text += `   🗺️ พิกัด: ${stop.coords.lat.toFixed(6)}, ${stop.coords.lng.toFixed(6)}\n`;
    }
    text += `\n`;
  });

  if (plan.googleMapsUrl) {
    text += `─────────────────────\n`;
    text += `🗺️ แผนที่นำทางทั้งเส้นทาง:\n${plan.googleMapsUrl}`;
  }

  return text;
}
