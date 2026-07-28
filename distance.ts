/**
 * Suburb coordinate mappings for Bangalore
 */
export const SUBURB_COORDS: Record<string, { lat: number; lng: number }> = {
  // Bengaluru
  koramangala: { lat: 12.9345, lng: 77.6266 },
  hsr: { lat: 12.9121, lng: 77.6446 },
  indiranagar: { lat: 12.9784, lng: 77.6408 },
  jayanagar: { lat: 12.9250, lng: 77.5938 },
  whitefield: { lat: 12.9698, lng: 77.7499 },
  malleswaram: { lat: 13.0031, lng: 77.5700 },
  shivaji: { lat: 12.9822, lng: 77.6083 },
  "jp nagar": { lat: 12.9063, lng: 77.5950 },
  "ashok nagar": { lat: 12.9736, lng: 77.6074 },
  bellandur: { lat: 12.9304, lng: 77.6784 },
  marathahalli: { lat: 12.9569, lng: 77.7011 },
  binnipete: { lat: 12.9710, lng: 77.5590 },
  "magadi road": { lat: 12.9780, lng: 77.5550 },

  // Mumbai
  bandra: { lat: 19.0596, lng: 72.8295 },
  andheri: { lat: 19.1136, lng: 72.8697 },
  colaba: { lat: 18.9067, lng: 72.8147 },
  powai: { lat: 19.1176, lng: 72.9060 },
  borivali: { lat: 19.2307, lng: 72.8567 },
  dadar: { lat: 19.0178, lng: 72.8478 },
  juhu: { lat: 19.1026, lng: 72.8242 },
  worli: { lat: 19.0117, lng: 72.8147 },
  chembur: { lat: 19.0622, lng: 72.8974 },
  thane: { lat: 19.2183, lng: 72.9781 },

  // Delhi
  "connaught place": { lat: 28.6304, lng: 77.2177 },
  dwarka: { lat: 28.5921, lng: 77.0460 },
  saket: { lat: 28.5244, lng: 77.2066 },
  "karol bagh": { lat: 28.6514, lng: 77.1907 },
  "vasant kunj": { lat: 28.5362, lng: 77.1451 },
  "lajpat nagar": { lat: 28.5684, lng: 77.2435 },
  rohini: { lat: 28.7041, lng: 77.1025 },
  "hauz khas": { lat: 28.5494, lng: 77.2001 },
  noida: { lat: 28.5355, lng: 77.3910 },
  gurugram: { lat: 28.4595, lng: 77.0266 },

  // Chennai
  adyar: { lat: 13.0012, lng: 80.2565 },
  nungambakkam: { lat: 13.0569, lng: 80.2425 },
  "t nagar": { lat: 13.0418, lng: 80.2341 },
  velachery: { lat: 12.9801, lng: 80.2228 },
  mylapore: { lat: 13.0334, lng: 80.2674 },
  guindy: { lat: 13.0067, lng: 80.2206 },
  anna: { lat: 13.0850, lng: 80.2101 },

  // Kolkata
  "salt lake": { lat: 22.5804, lng: 88.4215 },
  ballygunge: { lat: 22.5280, lng: 88.3659 },
  "park street": { lat: 22.5531, lng: 88.3541 },
  howrah: { lat: 22.5958, lng: 88.2636 },
  "new town": { lat: 22.5726, lng: 88.4639 },
  tollygunge: { lat: 22.4930, lng: 88.3483 },

  // Hyderabad
  gachibowli: { lat: 17.4401, lng: 78.3489 },
  madhapur: { lat: 17.4483, lng: 78.3741 },
  "banjara hills": { lat: 17.4174, lng: 78.4415 },
  "jubilee hills": { lat: 17.4325, lng: 78.4071 },
  secunderabad: { lat: 17.4399, lng: 78.4983 },
  kondapur: { lat: 17.4622, lng: 78.3568 },

  // Pune
  kothrud: { lat: 18.5074, lng: 73.8077 },
  "viman nagar": { lat: 18.5679, lng: 73.9143 },
  hinjewadi: { lat: 18.5913, lng: 73.7389 },
  baner: { lat: 18.5590, lng: 73.7787 },
  "koregaon park": { lat: 18.5362, lng: 73.8940 },
};

/**
 * Mapping from suburb keys to their respective major cities
 */
export const SUBURB_TO_CITY: Record<string, string> = {
  // Bengaluru
  koramangala: "Bengaluru",
  hsr: "Bengaluru",
  indiranagar: "Bengaluru",
  jayanagar: "Bengaluru",
  whitefield: "Bengaluru",
  malleswaram: "Bengaluru",
  shivaji: "Bengaluru",
  "jp nagar": "Bengaluru",
  "ashok nagar": "Bengaluru",
  bellandur: "Bengaluru",
  marathahalli: "Bengaluru",
  binnipete: "Bengaluru",
  "magadi road": "Bengaluru",

  // Mumbai
  bandra: "Mumbai",
  andheri: "Mumbai",
  colaba: "Mumbai",
  powai: "Mumbai",
  borivali: "Mumbai",
  dadar: "Mumbai",
  juhu: "Mumbai",
  worli: "Mumbai",
  chembur: "Mumbai",
  thane: "Mumbai",

  // Delhi
  "connaught place": "Delhi",
  dwarka: "Delhi",
  saket: "Delhi",
  "karol bagh": "Delhi",
  "vasant kunj": "Delhi",
  "lajpat nagar": "Delhi",
  rohini: "Delhi",
  "hauz khas": "Delhi",
  noida: "Delhi",
  gurugram: "Delhi",

  // Chennai
  adyar: "Chennai",
  nungambakkam: "Chennai",
  "t nagar": "Chennai",
  velachery: "Chennai",
  mylapore: "Chennai",
  guindy: "Chennai",
  anna: "Chennai",

  // Kolkata
  "salt lake": "Kolkata",
  ballygunge: "Kolkata",
  "park street": "Kolkata",
  howrah: "Kolkata",
  "new town": "Kolkata",
  tollygunge: "Kolkata",

  // Hyderabad
  gachibowli: "Hyderabad",
  madhapur: "Hyderabad",
  "banjara hills": "Hyderabad",
  "jubilee hills": "Hyderabad",
  secunderabad: "Hyderabad",
  kondapur: "Hyderabad",

  // Pune
  kothrud: "Pune",
  "viman nagar": "Pune",
  hinjewadi: "Pune",
  baner: "Pune",
  "koregaon park": "Pune",
};

/**
 * Resolves a correct major Indian city and coordinate pair for an address/suburb string.
 * It ensures the gig is assigned a valid, supported city and coordinates so it is
 * properly visible and located on maps without relying on unreliable external APIs.
 */
export function resolveCityAndCoordinates(
  address: string,
  suburb: string,
  fallbackCity?: string
): { city: string; lat: number; lng: number } {
  const normAddress = (address || "").toLowerCase().trim();
  const normSuburb = (suburb || "").toLowerCase().trim();
  
  // Get active current city selection as primary default fallback
  const activeCity = fallbackCity || localStorage.getItem("qwick_currentCity") || "Bengaluru";

  let matchedCity = "";
  let matchedCoords: { lat: number; lng: number } | null = null;

  // 1. Scan for any known suburb in either field to get exact coords and city
  for (const [subKey, coords] of Object.entries(SUBURB_COORDS)) {
    if (normSuburb.includes(subKey) || normAddress.includes(subKey)) {
      matchedCoords = coords;
      matchedCity = SUBURB_TO_CITY[subKey] || activeCity;
      break;
    }
  }

  // 2. If suburb was not found, check if address or suburb contains any major city name
  if (!matchedCity) {
    for (const city of INDIAN_CITIES) {
      const cityLower = city.name.toLowerCase();
      if (normAddress.includes(cityLower) || normSuburb.includes(cityLower)) {
        matchedCity = city.name;
        break;
      }
    }
  }

  // 3. Fallback to activeCity if no city matched
  if (!matchedCity) {
    matchedCity = activeCity;
  }

  // 4. Resolve coords using matchedSuburb, or default to city center
  if (!matchedCoords) {
    matchedCoords = getCoordsForSuburb(suburb || address, matchedCity);
  }

  return {
    city: matchedCity,
    lat: matchedCoords.lat,
    lng: matchedCoords.lng,
  };
}

/**
 * Returns latitude and longitude coordinates for a given suburb name.
 * @param suburb Suburb name
 * @param cityName Optional city name
 * @returns Lat/lng coordinates object
 */
export function getCoordsForSuburb(suburb: string, cityName?: string): { lat: number; lng: number } {
  // If a city name is provided, find its default coordinates
  let defaultCoords = { lat: 12.9716, lng: 77.5946 }; // Default to Bangalore Center
  if (cityName) {
    const matchedCity = INDIAN_CITIES.find(
      c => c.name.toLowerCase() === cityName.toLowerCase()
    );
    if (matchedCity) {
      defaultCoords = { lat: matchedCity.lat, lng: matchedCity.lng };
    }
  }

  if (!suburb) return defaultCoords;
  const s = suburb.toLowerCase().trim();
  for (const [key, value] of Object.entries(SUBURB_COORDS)) {
    if (s.includes(key)) {
      return value;
    }
  }
  return defaultCoords;
}

/**
 * Finds the closest suburb for a given set of latitude/longitude coordinates.
 * @param lat Latitude
 * @param lng Longitude
 * @returns Name of the closest suburb
 */
export function getClosestSuburb(lat: number, lng: number): string {
  let closestName = "Koramangala";
  let minDistance = Infinity;
  for (const [key, value] of Object.entries(SUBURB_COORDS)) {
    const dist = calculateHaversineDistance(lat, lng, value.lat, value.lng);
    if (dist < minDistance) {
      minDistance = dist;
      closestName = key.charAt(0).toUpperCase() + key.slice(1);
    }
  }
  return closestName;
}

/**
 * Checks localStorage for user's saved home/work/other suburbs to resolve a fallback coordinate,
 * defaulting to Koramangala center if none are found.
 */
export function getUserFallbackLocation(): { lat: number; lng: number } {
  try {
    const homeSuburb = localStorage.getItem("qwick_saved_Home_suburb");
    if (homeSuburb) return getCoordsForSuburb(homeSuburb);

    const workSuburb = localStorage.getItem("qwick_saved_Work_suburb");
    if (workSuburb) return getCoordsForSuburb(workSuburb);

    const otherSuburb = localStorage.getItem("qwick_saved_Other_suburb");
    if (otherSuburb) return getCoordsForSuburb(otherSuburb);
  } catch (e) {
    console.error("Error reading saved suburb from localStorage:", e);
  }
  return SUBURB_COORDS.koramangala; // Return Koramangala for user default
}

/**
 * Calculates the distance between two points on the Earth's surface using the Haversine formula.
 * Accurately casts any inputs to float to handle string coordinate values gracefully.
 * @param lat1 Latitude of point 1
 * @param lng1 Longitude of point 1
 * @param lat2 Latitude of point 2
 * @param lng2 Longitude of point 2
 * @returns Distance in kilometers (rounded to 1 decimal place)
 */
export function calculateHaversineDistance(
  lat1: any,
  lng1: any,
  lat2: any,
  lng2: any
): number {
  const l1 = parseFloat(String(lat1));
  const ln1 = parseFloat(String(lng1));
  const l2 = parseFloat(String(lat2));
  const ln2 = parseFloat(String(lng2));

  if (isNaN(l1) || isNaN(ln1) || isNaN(l2) || isNaN(ln2)) {
    return 0;
  }

  const R = 6371; // Earth's radius in kilometers
  const dLat = (l2 - l1) * (Math.PI / 180);
  const dLon = (ln2 - ln1) * (Math.PI / 180);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(l1 * (Math.PI / 180)) *
      Math.cos(l2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
      
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return parseFloat(distance.toFixed(1));
}

/**
 * Curated list of major Indian cities with their central coordinates
 */
export const INDIAN_CITIES = [
  { name: "Bengaluru", lat: 12.9716, lng: 77.5946 },
  { name: "Mumbai", lat: 19.0760, lng: 72.8777 },
  { name: "Delhi", lat: 28.6139, lng: 77.2090 },
  { name: "Chennai", lat: 13.0827, lng: 80.2707 },
  { name: "Kolkata", lat: 22.5726, lng: 88.3639 },
  { name: "Hyderabad", lat: 17.3850, lng: 78.4867 },
  { name: "Pune", lat: 18.5204, lng: 73.8567 },
  { name: "Ahmedabad", lat: 23.0225, lng: 72.5714 },
  { name: "Jaipur", lat: 26.9124, lng: 75.7873 },
  { name: "Lucknow", lat: 26.8467, lng: 80.9462 },
  { name: "Chandigarh", lat: 30.7333, lng: 76.7794 },
  { name: "Kochi", lat: 9.9312, lng: 76.2673 },
];

/**
 * Extracts the city name from a full address string.
 * Uses a reverse-traversal strategy from right to left to isolate the city
 * from pin codes, states, and the country segment.
 */
export function extractCityFromAddress(fullAddress: string): string {
  if (!fullAddress) return "Bengaluru";
  
  const parts = fullAddress.split(",").map(p => p.trim()).filter(Boolean);
  
  const isBroadStateOrCountry = (segment: string): boolean => {
    const s = segment.toLowerCase();
    if (s === "india") return true;
    
    // Indian States & Union Territories
    const states = [
      "karnataka", "maharashtra", "delhi", "tamil nadu", "telangana", "west bengal", 
      "uttar pradesh", "gujarat", "andhra pradesh", "madhya pradesh", "haryana", 
      "punjab", "rajasthan", "bihar", "odisha", "kerala", "assam", "jharkhand", 
      "chhattisgarh", "uttarakhand", "himachal pradesh", "tripura", "meghalaya", 
      "manipur", "nagaland", "goa", "arunachal pradesh", "mizoram", "sikkim", 
      "jammu and kashmir", "puducherry", "chandigarh", "ladakh", "lakshadweep", 
      "andaman and nicobar islands", "dadra and nagar haveli and daman and diu"
    ];
    if (states.includes(s)) return true;
    
    // Pin Codes / Postal Codes
    if (/^\d{6}$/.test(s) || /^\d{3}\s?\d{3}$/.test(s)) return true;
    
    return false;
  };

  // Traverse right-to-left to find the city
  for (let i = parts.length - 1; i >= 0; i--) {
    const segment = parts[i];
    if (!isBroadStateOrCountry(segment)) {
      const s = segment.toLowerCase();
      // Normalize common synonyms
      if (s === "bengaluru" || s === "bangalore") return "Bengaluru";
      if (s === "bombay" || s === "mumbai") return "Mumbai";
      if (s === "new delhi" || s === "delhi") return "Delhi";
      if (s === "madras" || s === "chennai") return "Chennai";
      if (s === "calcutta" || s === "kolkata") return "Kolkata";
      if (s === "secunderabad") return "Hyderabad";
      
      // Capitalize first letter of each word
      return segment
        .split(" ")
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(" ");
    }
  }
  
  return "Bengaluru";
}

/**
 * Returns the closest major city from the coordinate, or empty string if too far (> 150 km).
 */
export function getClosestMajorCity(lat: number, lng: number): string {
  let closestName = "Bengaluru";
  let minDistance = Infinity;
  
  for (const city of INDIAN_CITIES) {
    const dist = calculateHaversineDistance(lat, lng, city.lat, city.lng);
    if (dist < minDistance) {
      minDistance = dist;
      closestName = city.name;
    }
  }
  
  if (minDistance <= 150) {
    return closestName;
  }
  
  return "";
}

/**
 * Returns an effective, correct, and localized coordinate for the user depending on their 
 * GPS geolocation and selected city context. It resolves geographic mismatch issues.
 */
export function getEffectiveUserLocation(
  userLoc: { lat: number; lng: number } | null,
  currentCity: string
): { lat: number; lng: number } {
  const cityObj = INDIAN_CITIES.find(c => c.name.toLowerCase() === currentCity.toLowerCase());
  const cityCenter = cityObj ? { lat: cityObj.lat, lng: cityObj.lng } : { lat: 12.9716, lng: 77.5946 };

  // If GPS coordinates are available, make sure they are within the same general region
  // (within 150 km of the city center). If yes, we can use the high-precision user GPS.
  if (userLoc) {
    const dist = calculateHaversineDistance(userLoc.lat, userLoc.lng, cityCenter.lat, cityCenter.lng);
    if (dist <= 150) {
      return userLoc;
    }
  }

  // Otherwise, fall back to user's saved home/work suburb in localStorage
  try {
    const homeSuburb = localStorage.getItem("qwick_saved_Home_suburb");
    if (homeSuburb) {
      const coords = getCoordsForSuburb(homeSuburb, currentCity);
      const d = calculateHaversineDistance(coords.lat, coords.lng, cityCenter.lat, cityCenter.lng);
      if (d <= 150) return coords;
    }
    const workSuburb = localStorage.getItem("qwick_saved_Work_suburb");
    if (workSuburb) {
      const coords = getCoordsForSuburb(workSuburb, currentCity);
      const d = calculateHaversineDistance(coords.lat, coords.lng, cityCenter.lat, cityCenter.lng);
      if (d <= 150) return coords;
    }
  } catch (e) {
    console.error("Error reading saved suburb from localStorage:", e);
  }

  return cityCenter;
}

