/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import {
  Camera,
  Calendar,
  Clock,
  DollarSign,
  ShieldCheck,
  Rocket,
  AlertTriangle,
  MapPin,
  Save,
  Map,
  Navigation,
} from "lucide-react";
import { ActiveView, Gig, User } from "../types";
import { APIProvider, useMapsLibrary } from "@vis.gl/react-google-maps";
import { calculateHaversineDistance, getCoordsForSuburb, getClosestSuburb, extractCityFromAddress, INDIAN_CITIES, resolveCityAndCoordinates } from "../utils/distance";
import { getCategoryGraphic } from "../utils/graphic";

const API_KEY =
  import.meta.env.GOOGLE_MAPS_API_KEY ||
  import.meta.env.GOOGLE_MAPS_PLATFORM_KEY ||
  import.meta.env.VITE_GOOGLE_MAPS_API_KEY ||
  import.meta.env.VITE_GOOGLE_MAPS_PLATFORM_KEY ||
  (globalThis as any).GOOGLE_MAPS_PLATFORM_KEY ||
  "YOUR_API_KEY";
const hasValidKey = Boolean(API_KEY) && API_KEY !== "YOUR_API_KEY";

interface PostGigViewProps {
  onPostGig: (gig: Partial<Gig>) => Promise<void> | any;
  onNavigate: (view: ActiveView) => void;
  currentUser?: User | null;
  currentCity?: string;
  onRequireLogin?: (intendedAction: {
    type: 'express_interest' | 'negotiate' | 'publish_gig' | 'go_to_inbox' | 'go_to_profile';
    gigId?: string;
    proposedPrice?: number;
  }) => void;
}

export default function PostGigView({
  onPostGig,
  onNavigate,
  currentUser,
  currentCity,
  onRequireLogin,
}: PostGigViewProps) {
  return (
    <APIProvider apiKey={API_KEY} version="weekly">
      <PostGigForm
        onPostGig={onPostGig}
        onNavigate={onNavigate}
        currentUser={currentUser}
        currentCity={currentCity}
        onRequireLogin={onRequireLogin}
      />
    </APIProvider>
  );
}

const TIME_SLOTS = (() => {
  const options = [];
  for (let h = 0; h < 24; h++) {
    const ampm = h >= 12 ? "PM" : "AM";
    const displayHour = h % 12 === 0 ? 12 : h % 12;
    const padHour = h.toString().padStart(2, "0");
    options.push({
      value: `${padHour}:00`,
      label: `${displayHour}:00 ${ampm}`,
    });
    options.push({
      value: `${padHour}:30`,
      label: `${displayHour}:30 ${ampm}`,
    });
  }
  return options;
})();

const extractSuburbFromAddress = (fullAddress: string, mainText?: string): string => {
  if (!fullAddress) return "My Location";

  // Split by commas and trim each part
  const parts = fullAddress.split(",").map(p => p.trim()).filter(Boolean);

  // We want to filter out broad regional and structural segments.
  const isBroadSegment = (segment: string): boolean => {
    const s = segment.toLowerCase();
    
    // Country
    if (s === "india") return true;
    
    // States
    if (s === "karnataka") return true;
    
    // Cities / Metros
    if (s === "bengaluru" || s === "bangalore") return true;
    
    // Pin Codes / Postal Codes (6 digits, or e.g. 560023, 560 023)
    if (/^\d{6}$/.test(s) || /^\d{3}\s?\d{3}$/.test(s)) return true;
    
    // Broad Districts/Urban definitions
    if (s.includes("urban") || s.includes("rural") || s.includes("north") || s.includes("south") || s.includes("east") || s.includes("west")) {
      if (s.includes("bengaluru") || s.includes("bangalore") || s.includes("district")) {
        return true;
      }
    }
    
    // Municipal / Admin zones or words that aren't specific suburbs
    if (s.includes("zone") || s.includes("ward") || s.includes("taluk") || s.includes("hobli")) {
      return true;
    }
    
    return false;
  };

  // Find the rightmost segment that is NOT broad or too generic
  // Going from right to left starting from the end of the parts array
  for (let i = parts.length - 1; i >= 0; i--) {
    const segment = parts[i];
    if (!isBroadSegment(segment)) {
      return segment;
    }
  }

  // Fallback: If we couldn't find anything this way, try mainText
  if (mainText) {
    const mainParts = mainText.split(",").map(p => p.trim()).filter(Boolean);
    for (let i = mainParts.length - 1; i >= 0; i--) {
      const segment = mainParts[i];
      if (!isBroadSegment(segment)) {
        return segment;
      }
    }
  }

  return "My Location";
};

const getISTDate = (): Date => {
  const now = new Date();
  const istTime = now.getTime() + (now.getTimezoneOffset() + 330) * 60000;
  return new Date(istTime);
};

const formatToYYYYMMDD = (dateObj: Date): string => {
  const yyyy = dateObj.getFullYear();
  const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
  const dd = String(dateObj.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const isTimeSlotPassed = (dateStr: string, slotValue: string): boolean => {
  if (!dateStr) return false;
  
  const now = getISTDate();
  const todayStr = formatToYYYYMMDD(now);
  
  if (dateStr < todayStr) return true;
  if (dateStr > todayStr) return false;
  
  const [slotHour, slotMin] = slotValue.split(":").map(Number);
  const currentHour = now.getHours();
  const currentMin = now.getMinutes();
  
  if (slotHour < currentHour) return true;
  if (slotHour === currentHour && slotMin <= currentMin) return true;
  
  return false;
};

let isGoogleMapsBillingDisabled = (() => {
  try {
    return localStorage.getItem("google_maps_billing_disabled") === "true";
  } catch (e) {
    return false;
  }
})();

function PostGigForm({ onPostGig, onNavigate, currentUser, currentCity, onRequireLogin }: PostGigViewProps) {
  // IST Date values
  const istToday = getISTDate();
  const todayStr = formatToYYYYMMDD(istToday);

  const istTomorrow = new Date(istToday.getTime() + 24 * 60 * 60 * 1000);
  const tomorrowStr = formatToYYYYMMDD(istTomorrow);

  const istDay3 = new Date(istToday.getTime() + 2 * 24 * 60 * 60 * 1000);
  const day3Str = formatToYYYYMMDD(istDay3);

  const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const day3Name = weekdays[istDay3.getDay()];
  const allSlotsPassedToday = TIME_SLOTS.every(slot => isTimeSlotPassed(todayStr, slot.value));

  // Controlled fields
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState("");
  const [time, setTime] = useState("09:00");
  const [price, setPrice] = useState("");
  const [phone, setPhone] = useState(currentUser?.phoneNumber || "");
  const [pledgeChecked, setPledgeChecked] = useState(false);
  const [uploadedPhotoUrl, setUploadedPhotoUrl] = useState<string>("");
  const [showPermissionPrompt, setShowPermissionPrompt] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Address and Google Map state
  const [address, setAddress] = useState("");
  const [suburb, setSuburb] = useState("");

  const [doorNumber, setDoorNumber] = useState("");
  const [selectedCoords, setSelectedCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Load draft from localStorage on mount
  useEffect(() => {
    const savedDraft = localStorage.getItem("qwick_draft_gig");
    if (savedDraft) {
      try {
        const draft = JSON.parse(savedDraft);
        if (draft.title) setTitle(draft.title);
        if (draft.description) setDescription(draft.description);
        if (draft.price) setPrice(draft.price);
        if (draft.phone) setPhone(draft.phone);
        if (draft.pledgeChecked !== undefined) setPledgeChecked(draft.pledgeChecked);
        if (draft.startDate) setStartDate(draft.startDate);
        if (draft.endDate) setEndDate(draft.endDate);
        if (draft.time) setTime(draft.time);
        if (draft.address) setAddress(draft.address);
        if (draft.suburb) setSuburb(draft.suburb);
        if (draft.selectedCoords) setSelectedCoords(draft.selectedCoords);
        if (draft.uploadedPhotoUrl) setUploadedPhotoUrl(draft.uploadedPhotoUrl);
      } catch (e) {
        console.error("Error restoring gig draft:", e);
      }
    }
  }, []);

  const triggerWithPermission = (action: () => void) => {
    const hasPermission = localStorage.getItem("qwick_camera_gallery_permission") === "granted";
    if (hasPermission) {
      action();
    } else {
      setPendingAction(() => action);
      setShowPermissionPrompt(true);
    }
  };

  useEffect(() => {
    if (currentUser?.phoneNumber) {
      setPhone(currentUser.phoneNumber);
    }
  }, [currentUser?.phoneNumber]);

  useEffect(() => {
    if (isTimeSlotPassed(startDate, time)) {
      const firstAvailable = TIME_SLOTS.find(slot => !isTimeSlotPassed(startDate, slot.value));
      if (firstAvailable) {
        setTime(firstAvailable.value);
      } else {
        // If all slots are in the past for today, automatically change the selected date to tomorrow
        const istTomorrow = new Date(getISTDate().getTime() + 24 * 60 * 60 * 1000);
        const tomorrowStr = formatToYYYYMMDD(istTomorrow);
        setStartDate(tomorrowStr);
        setTime("09:00");
      }
    }
  }, [startDate, time]);

  const handleFile = (file: File) => {
    if (!file.type.startsWith("image/")) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        // Max dimension for preview and storage optimization
        const MAX_WIDTH = 400;
        const MAX_HEIGHT = 400;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL("image/jpeg", 0.7);
          setUploadedPhotoUrl(compressed);
        } else {
          setUploadedPhotoUrl(e.target?.result as string);
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Real browser coordinates if available
  const [currentLoc, setCurrentLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCurrentLoc({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.log("Error getting location on form load:", error);
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    }
  }, []);

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }
    setIsLocating(true);

    const onSuccess = (position: GeolocationPosition) => {
      setIsLocating(false);
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      
      setCurrentLoc({ lat, lng });
      setSelectedCoords({ lat, lng });
      
      // Try Google Maps Geocoder directly for genuine coordinates reverse lookup
      tryGoogleGeocoder(lat, lng);
    };

    const tryGoogleGeocoder = (lat: number, lng: number) => {
      if (hasValidKey && geocodingLib && !isGoogleMapsBillingDisabled) {
        try {
          const geocoder = new (geocodingLib as any).Geocoder();
          geocoder.geocode({ location: { lat, lng } }, (results: any, status: any) => {
            if (status === "OK" && results && results[0]) {
              const formattedAddress = results[0].formatted_address;
              setAddress(formattedAddress);
              
              // Extract suburb dynamically
              let detectedSuburb = extractSuburbFromAddress(formattedAddress);
              if (!detectedSuburb || detectedSuburb === "My Location") {
                const components = results[0].address_components || [];
                const types = ["sublocality_level_1", "sublocality", "neighborhood", "locality"];
                for (const type of types) {
                  const comp = components.find((c: any) => c.types.includes(type));
                  if (comp && !/^(bengaluru|bangalore)$/i.test(comp.long_name)) {
                    detectedSuburb = comp.long_name;
                    break;
                  }
                }
              }
              setSuburb(detectedSuburb);
              console.log("Successfully reverse geocoded via Google Geocoder:", formattedAddress, "and suburb:", detectedSuburb);
            } else {
              console.warn("Google Geocoder status is not OK, falling back to Nominatim:", status);
              if (status === "REQUEST_DENIED" || status === "OVER_QUERY_LIMIT") {
                isGoogleMapsBillingDisabled = true;
                try { localStorage.setItem("google_maps_billing_disabled", "true"); } catch (e) {}
              }
              tryNominatimReverseGeocoder(lat, lng);
            }
          });
        } catch (e) {
          console.warn("Google Geocoding error, falling back to Nominatim:", e);
          tryNominatimReverseGeocoder(lat, lng);
        }
      } else {
        tryNominatimReverseGeocoder(lat, lng);
      }
    };

    const tryNominatimReverseGeocoder = (lat: number, lng: number) => {
      fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, {
        headers: {
          "Accept-Language": "en"
        }
      })
        .then((res) => res.json())
        .then((data) => {
          if (data && data.display_name) {
            const formattedAddress = data.display_name;
            setAddress(formattedAddress);
            
            // Extract suburb
            let detectedSuburb = extractSuburbFromAddress(formattedAddress);
            if (!detectedSuburb || detectedSuburb === "My Location") {
              const addr = data.address || {};
              detectedSuburb = addr.suburb || addr.neighbourhood || addr.sublocality || addr.city_district || addr.quarter || "";
            }
            if (detectedSuburb) {
              setSuburb(detectedSuburb);
            } else {
              setSuburb(getClosestSuburb(lat, lng) || "My Location");
            }
            console.log("Successfully reverse geocoded via OSM Nominatim:", formattedAddress);
          } else {
            simpleCoordinateFallback(lat, lng);
          }
        })
        .catch((err) => {
          console.warn("OSM Nominatim reverse geocoding failed, using simple fallback:", err);
          simpleCoordinateFallback(lat, lng);
        });
    };

    const simpleCoordinateFallback = (lat: number, lng: number) => {
      setAddress(`Location: ${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      const distToCenter = calculateHaversineDistance(lat, lng, 12.9716, 77.5946);
      if (distToCenter <= 80.0) {
        setSuburb(getClosestSuburb(lat, lng) || "My Location");
      } else {
        setSuburb("My Location");
      }
    };

    const onError = (error: GeolocationPositionError) => {
      // If high accuracy timed out or was unavailable, retry with low accuracy
      if (error.code === error.TIMEOUT || error.code === error.POSITION_UNAVAILABLE) {
        console.log("High accuracy location failed. Retrying with low accuracy...");
        navigator.geolocation.getCurrentPosition(
          onSuccess,
          (err) => {
            setIsLocating(false);
            console.warn("Error getting location on retry:", err);
            let errMsg = "Failed to get your location. ";
            if (err.code === err.PERMISSION_DENIED) {
              errMsg += "Please grant location access/permission in your browser settings.";
            } else {
              errMsg += "Please check your device's GPS status and browser permissions.";
            }
            alert(errMsg);
          },
          { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
        );
      } else {
        setIsLocating(false);
        console.warn("Error getting location:", error);
        let errMsg = "Failed to get your location. ";
        if (error.code === error.PERMISSION_DENIED) {
          errMsg += "Please grant location access/permission in your browser settings.";
        } else {
          errMsg += "Please check your browser permissions.";
        }
        alert(errMsg);
      }
    };

    // First try with high accuracy
    navigator.geolocation.getCurrentPosition(onSuccess, onError, {
      enableHighAccuracy: true,
      timeout: 5000,
      maximumAge: 0
    });
  };

  // Saved locations state
  const [savedHome, setSavedHome] = useState(
    () => localStorage.getItem("qwick_saved_Home") || "",
  );
  const [savedWork, setSavedWork] = useState(
    () => localStorage.getItem("qwick_saved_Work") || "",
  );
  const [savedOther, setSavedOther] = useState(
    () => localStorage.getItem("qwick_saved_Other") || "",
  );

  const [savedHomeSuburb, setSavedHomeSuburb] = useState(
    () => localStorage.getItem("qwick_saved_Home_suburb") || "",
  );
  const [savedWorkSuburb, setSavedWorkSuburb] = useState(
    () => localStorage.getItem("qwick_saved_Work_suburb") || "",
  );
  const [savedOtherSuburb, setSavedOtherSuburb] = useState(
    () => localStorage.getItem("qwick_saved_Other_suburb") || "",
  );

  const [savedHomeDoor, setSavedHomeDoor] = useState(
    () => localStorage.getItem("qwick_saved_Home_door") || "",
  );
  const [savedWorkDoor, setSavedWorkDoor] = useState(
    () => localStorage.getItem("qwick_saved_Work_door") || "",
  );
  const [savedOtherDoor, setSavedOtherDoor] = useState(
    () => localStorage.getItem("qwick_saved_Other_door") || "",
  );
  const [savedOtherName, setSavedOtherName] = useState(
    () => localStorage.getItem("qwick_saved_Other_name") || "Other",
  );

  const [showSuggestions, setShowSuggestions] = useState(false);
  const [predictions, setPredictions] = useState<
    { address: string; suburb: string }[]
  >([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasAuthError, setHasAuthError] = useState(false);

  useEffect(() => {
    // Gracefully catch Google Maps API Key auth failures (e.g., RefererNotAllowedMapError)
    (window as any).gm_authFailure = () => {
      console.warn("Google Maps Auth failed. Falling back to Nominatim.");
      setHasAuthError(true);
    };
    return () => {
      try {
        delete (window as any).gm_authFailure;
      } catch (e) {}
    };
  }, []);

  // Google Maps Places library hook
  const placesLib = useMapsLibrary("places");
  const geocodingLib = useMapsLibrary("geocoding");
  const [sessionToken, setSessionToken] = useState<any>(null);

  useEffect(() => {
    if (!placesLib) return;
    try {
      if ((placesLib as any).AutocompleteSessionToken) {
        setSessionToken(new (placesLib as any).AutocompleteSessionToken());
      }
    } catch (e) {
      console.error("Error instantiating AutocompleteSessionToken:", e);
    }
  }, [placesLib]);

  // Autocomplete prediction querying supporting standard Google Places API (New) directly
  useEffect(() => {
    if (!address.trim()) {
      setPredictions([]);
      return;
    }

    const fetchNominatimSuggestions = (query: string) => {
      setIsSearching(true);
      fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=in&limit=5&addressdetails=1`, {
        headers: { "Accept-Language": "en" }
      })
        .then((res) => res.json())
        .then((data) => {
          setIsSearching(false);
          if (Array.isArray(data)) {
            const items = data.map((item: any) => {
              const textVal = item.display_name;
              const addr = item.address || {};
              let suburbVal = addr.suburb || addr.neighbourhood || addr.sublocality || addr.city_district || addr.quarter || "";
              if (!suburbVal) {
                suburbVal = extractSuburbFromAddress(textVal);
              }
              return {
                address: textVal,
                suburb: suburbVal || "My Location",
                lat: parseFloat(item.lat),
                lng: parseFloat(item.lon),
              };
            });
            setPredictions(items);
          } else {
            setPredictions([]);
          }
        })
        .catch((err) => {
          console.warn("OSM Nominatim suggestions failed:", err);
          setIsSearching(false);
          setPredictions([]);
        });
    };

    const timer = setTimeout(() => {
      if (!hasValidKey || hasAuthError || !placesLib || !(placesLib as any).AutocompleteSuggestion) {
        fetchNominatimSuggestions(address);
        return;
      }

      setIsSearching(true);
      (placesLib as any).AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input: address,
        sessionToken: sessionToken || undefined,
        region: "in", // Biased towards India
      })
        .then((res: any) => {
          setIsSearching(false);
          const suggestions = res?.suggestions || [];
          const items = suggestions
            .map((s: any) => {
              const pred = s.placePrediction;
              if (!pred) return null;

              const textVal =
                pred.text?.text ||
                (typeof pred.text === "string" ? pred.text : "") ||
                "";
              
              const mainText = pred.structuredFormat?.mainText?.text ||
                (typeof pred.structuredFormat?.mainText === "string" ? pred.structuredFormat.mainText : "");

              const suburbVal = extractSuburbFromAddress(textVal, mainText);

              return {
                address: textVal,
                suburb: suburbVal,
                placePrediction: pred,
              };
            })
            .filter(Boolean);
          setPredictions(items);
        })
        .catch((err: any) => {
          console.warn("Google Autocomplete failed. Switching to Nominatim:", err);
          fetchNominatimSuggestions(address);
        });
    }, 280);

    return () => clearTimeout(timer);
  }, [address, placesLib, sessionToken, hasAuthError]);

  const handleSelectSuggestion = async (item: {
    address: string;
    suburb: string;
    placePrediction?: any;
    lat?: number;
    lng?: number;
  }) => {
    setAddress(item.address);
    const cleanSuburb = item.suburb.endsWith(", Blr")
      ? item.suburb.slice(0, -5)
      : item.suburb;
    setSuburb(cleanSuburb);
    setShowSuggestions(false);

    if (item.lat !== undefined && item.lng !== undefined) {
      setSelectedCoords({ lat: item.lat, lng: item.lng });
    } else if (item.placePrediction) {
      try {
        const place = item.placePrediction.toPlace();
        await place.fetchFields({
          fields: ['location'],
        });
        if (place.location) {
          const lat = place.location.lat();
          const lng = place.location.lng();
          setSelectedCoords({ lat, lng });
          console.log("Selected autocomplete coordinates:", lat, lng);
        }
      } catch (err) {
        console.error("Error fetching place location:", err);
      }
    }
  };

  const handleSaveLocationPreset = (type: "Home" | "Work" | "Other") => {
    if (!address.trim()) {
      alert("Please select or type an address first to save!");
      return;
    }
    const finalSuburb = suburb.trim() || "Koramangala";
    const finalDoor = doorNumber.trim();
    let finalOtherName = savedOtherName;

    if (type === "Other") {
      let name = null;
      try {
        name = prompt(
          "Enter a name for this address (e.g. Gym, Partner's place):",
          savedOtherName,
        );
      } catch (err) {
        console.warn("Native prompt was blocked by browser sandbox.", err);
      }
      
      const finalName = name ? name.trim() : "Custom Gym / Other";
      finalOtherName = finalName;
      setSavedOtherName(finalName);
      localStorage.setItem("qwick_saved_Other_name", finalName);
    }

    localStorage.setItem(`qwick_saved_${type}`, address);
    localStorage.setItem(`qwick_saved_${type}_suburb`, finalSuburb);
    localStorage.setItem(`qwick_saved_${type}_door`, finalDoor);

    if (type === "Home") {
      setSavedHome(address);
      setSavedHomeSuburb(finalSuburb);
      setSavedHomeDoor(finalDoor);
    } else if (type === "Work") {
      setSavedWork(address);
      setSavedWorkSuburb(finalSuburb);
      setSavedWorkDoor(finalDoor);
    } else {
      setSavedOther(address);
      setSavedOtherSuburb(finalSuburb);
      setSavedOtherDoor(finalDoor);
    }

    alert(
      `Success! Successfully saved as ${type === "Other" ? finalOtherName : type} location.`,
    );
  };

  const handleUsePreset = (type: "Home" | "Work" | "Other") => {
    setSelectedCoords(null);
    if (type === "Home" && savedHome) {
      setAddress(savedHome);
      setSuburb(savedHomeSuburb || "Koramangala");
      setDoorNumber(savedHomeDoor || "");
    } else if (type === "Work" && savedWork) {
      setAddress(savedWork);
      setSuburb(savedWorkSuburb || "Indiranagar");
      setDoorNumber(savedWorkDoor || "");
    } else if (type === "Other" && savedOther) {
      setAddress(savedOther);
      setSuburb(savedOtherSuburb || "HSR Layout");
      setDoorNumber(savedOtherDoor || "");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSubmitting) return;

    if (
      !title.trim() ||
      !description.trim() ||
      !price ||
      !phone.trim() ||
      !pledgeChecked ||
      !address.trim()
    ) {
      alert(
        "Please fill in all core fields including contact phone number and address, and accept the Commitment Pledge.",
      );
      return;
    }

    const priceNum = parseInt(price.replace(/[^0-9]/g, ""), 10);
    if (isNaN(priceNum) || priceNum <= 0) {
      alert("Please enter a valid price greater than zero.");
      return;
    }

    if (startDate && startDate < todayStr) {
      alert("Please select a date in the present or future.");
      return;
    }

    if (startDate && isTimeSlotPassed(startDate, time)) {
      alert("The selected time has already passed today. Please select a valid future time option.");
      return;
    }

    let dateStr = "Flexible Date";
    if (startDate) {
      dateStr = startDate;
    }

    const finalSuburb = suburb.trim() || "My Location";
    
    // Determine the finalized city, latitude, and longitude
    let finalCity = "";
    let finalLat = selectedCoords?.lat;
    let finalLng = selectedCoords?.lng;

    // Use our ultra-robust local resolver to find standard city and coordinates
    const localResolution = resolveCityAndCoordinates(address, finalSuburb, currentCity);

    if (finalLat === undefined || finalLng === undefined) {
      // If we don't have selected coords, try the Google geocoding API
      try {
        if (hasValidKey && geocodingLib && !isGoogleMapsBillingDisabled) {
          const geocoder = new (geocodingLib as any).Geocoder();
          const results = await new Promise<any[]>((resolve, reject) => {
            geocoder.geocode({ address: address.trim() + ", " + finalSuburb + ", " + (localResolution.city || "Bengaluru") }, (results: any, status: any) => {
              if (status === "OK") resolve(results);
              else {
                if (status === "REQUEST_DENIED" || status === "OVER_QUERY_LIMIT") {
                  isGoogleMapsBillingDisabled = true;
                  try { localStorage.setItem("google_maps_billing_disabled", "true"); } catch (e) {}
                }
                reject(status);
              }
            });
          });
          if (results && results[0]) {
            finalLat = results[0].geometry.location.lat();
            finalLng = results[0].geometry.location.lng();
            console.log("Geocoded via Google Maps:", finalLat, finalLng);
          }
        }
      } catch (err) {
        console.warn("Google forward geocoding unavailable:", err);
      }

      // Fall back to OSM Nominatim forward geocoding if Google fails or is bypassed
      if (finalLat === undefined || finalLng === undefined) {
        try {
          const q = encodeURIComponent(address.trim() + ", " + finalSuburb + ", " + (localResolution.city || "Bengaluru"));
          const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${q}&limit=1`, {
            headers: { "Accept-Language": "en" }
          });
          const osmResults = await response.json();
          if (osmResults && osmResults[0]) {
            finalLat = parseFloat(osmResults[0].lat);
            finalLng = parseFloat(osmResults[0].lon);
            console.log("Geocoded via OSM Nominatim forward geocoding:", finalLat, finalLng);
          }
        } catch (err) {
          console.warn("OSM Nominatim forward geocoding failed/unavailable:", err);
        }
      }

      // If geocoding fails, use the matched local resolution coordinates based on user input city
      if (finalLat === undefined || finalLng === undefined) {
        finalLat = localResolution.lat;
        finalLng = localResolution.lng;
        console.log("Geocoding failed. Using robust local coordinate match:", finalLat, finalLng);
      }
    }

    // Standardize city:
    // Extract from address, but validate if it's a known city. If not, match using our local resolver
    const extractedCity = extractCityFromAddress(address.trim() || finalSuburb);
    const isValidCity = INDIAN_CITIES.some(c => c.name.toLowerCase() === extractedCity.toLowerCase());
    
    finalCity = isValidCity ? extractedCity : localResolution.city;
    console.log("Finalized standard city for gig:", finalCity);

    setIsSubmitting(true);

    try {
      const finalImageUrl = uploadedPhotoUrl || "";

      const resolvedCategory = (() => {
        const t = title.toLowerCase();
        if (
          t.includes("garden") ||
          t.includes("grass") ||
          t.includes("yard") ||
          t.includes("plant") ||
          t.includes("mow") ||
          t.includes("lawn") ||
          t.includes("shrub") ||
          t.includes("weed") ||
          t.includes("trim") ||
          t.includes("flower")
        ) {
          return "Yard Work";
        } else if (
          t.includes("dog") ||
          t.includes("cat") ||
          t.includes("pet") ||
          t.includes("walk") ||
          t.includes("animal") ||
          t.includes("puppy") ||
          t.includes("kitten") ||
          t.includes("feed") ||
          t.includes("sitting")
        ) {
          return "Pet Care";
        } else if (
          t.includes("mov") ||
          t.includes("shift") ||
          t.includes("lift") ||
          t.includes("carry") ||
          t.includes("pack") ||
          t.includes("truck") ||
          t.includes("box") ||
          t.includes("unload") ||
          t.includes("load") ||
          t.includes("heavy")
        ) {
          return "Moving Help";
        } else if (
          t.includes("assembl") ||
          t.includes("furnitur") ||
          t.includes("ikea") ||
          t.includes("table") ||
          t.includes("fix") ||
          t.includes("repair") ||
          t.includes("sofa") ||
          t.includes("chair") ||
          t.includes("desk") ||
          t.includes("handyman") ||
          t.includes("shelf") ||
          t.includes("bed")
        ) {
          return "Furniture Assembly";
        } else {
          return "Specialized Task";
        }
      })();

      const draftData = {
        title,
        description,
        price: priceNum,
        startDate: dateStr,
        endDate: endDate || null,
        time: time ? time : "Flexible timing",
        uploadedPhotoUrl: finalImageUrl,
        address: address.trim(),
        suburb: finalSuburb,
        selectedCoords: { lat: finalLat, lng: finalLng },
        city: finalCity,
        phone: phone.trim(),
        pledgeChecked,
        category: resolvedCategory,
      };

      if (!currentUser) {
        localStorage.setItem("qwick_draft_gig", JSON.stringify(draftData));
        if (onRequireLogin) {
          onRequireLogin({
            type: 'publish_gig'
          });
        } else {
          alert("Please sign in or create an account to publish this gig.");
          onNavigate(ActiveView.PROFILE);
        }
        setIsSubmitting(false);
        return;
      }

      const postGigPromise = onPostGig({
        title,
        description,
        price: priceNum,
        date: dateStr,
        startTime: time ? time : "Flexible timing",
        imageUrl: finalImageUrl,
        locationName: address.trim(),
        suburb: finalSuburb,
        lat: finalLat,
        lng: finalLng,
        city: finalCity,
        posterPhone: phone.trim(),
        category: resolvedCategory,
      });
      await Promise.resolve(postGigPromise);
      setIsSubmitting(false);
    } catch (err) {
      console.error("Error posting gig:", err);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full min-h-screen bg-brand-bg pt-3 pb-32">
      <div className="max-w-md mx-auto px-4 flex flex-col gap-6 text-left">
        {/* Title elements */}
        <div>
          <h2 className="text-2xl font-extrabold text-brand-dark tracking-tight">
            Post a New Gig
          </h2>
          <p className="text-xs text-brand-gray mt-1 font-medium">
            Describe what you need help with in the neighborhood.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Title Field */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-brand-gray px-1">
              Gig Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Help assembling a bookshelf"
              className="w-full h-14 bg-white border border-brand-outline rounded-xl px-4 font-semibold text-brand-dark focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20 placeholder:text-brand-gray/40 transition-all text-xs"
              required
            />
          </div>

          {/* Description Field */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-brand-gray px-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detail what needs to be done, any tools required, etc."
              rows={4}
              className="w-full bg-white border border-brand-outline rounded-xl p-4 font-medium text-brand-dark focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20 placeholder:text-brand-gray/40 transition-all resize-none text-xs"
              required
            />
          </div>

          {/* Contact Field */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-brand-gray px-1">
              Contact Phone Number
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g., +91 90000 00000"
              className="w-full h-14 bg-white border border-brand-outline rounded-xl px-4 font-semibold text-brand-dark focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20 placeholder:text-brand-gray/40 transition-all text-xs"
              required
            />
          </div>

          {/* Google Maps / Set Location Frame Integration */}
          <div className="flex flex-col gap-2.5 bg-white border border-brand-outline p-4 rounded-2xl shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <MapPin className="w-4 h-4 text-brand-primary" />
                <label className="text-xs font-extrabold text-[#0f172a]">
                  Set Job Location
                </label>
              </div>
            </div>

            {/* Saved Locations Quick Selection Chips */}
            {(savedHome || savedWork || savedOther) && (
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-brand-gray px-1">
                  Use Saved Location:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {savedHome && (
                    <button
                      type="button"
                      onClick={() => handleUsePreset("Home")}
                      className="px-2.5 py-1.5 bg-brand-primary/5 hover:bg-brand-primary/10 text-brand-primary border border-brand-primary/10 text-[10px] font-extrabold rounded-full flex items-center gap-1 active:scale-95 transition-all"
                    >
                      <span>🏠 Home</span>
                    </button>
                  )}
                  {savedWork && (
                    <button
                      type="button"
                      onClick={() => handleUsePreset("Work")}
                      className="px-2.5 py-1.5 bg-brand-primary/5 hover:bg-brand-primary/10 text-brand-primary border border-brand-primary/10 text-[10px] font-extrabold rounded-full flex items-center gap-1 active:scale-95 transition-all"
                    >
                      <span>💼 Work</span>
                    </button>
                  )}
                  {savedOther && (
                    <button
                      type="button"
                      onClick={() => handleUsePreset("Other")}
                      className="px-2.5 py-1.5 bg-brand-primary/5 hover:bg-brand-primary/10 text-brand-primary border border-brand-primary/10 text-[10px] font-extrabold rounded-full flex items-center gap-1 active:scale-95 transition-all"
                    >
                      <span>📍 {savedOtherName}</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Manual Address Bar with Autocomplete suggestions */}
            <div className="flex flex-col gap-1 relative">
              <span className="text-[10px] font-bold text-brand-gray px-1">
                Address / Specific Landmark
              </span>
              <div className="relative flex items-center">
                <MapPin className="absolute left-3 w-4 h-4 text-brand-primary" />
                <input
                  id="gig-address-input"
                  type="text"
                  value={address}
                  onChange={(e) => {
                    const val = e.target.value;
                    setAddress(val);
                    setSelectedCoords(null);
                    setShowSuggestions(true);
                    if (!hasValidKey && val.includes(",")) {
                      const parts = val.split(",");
                      if (parts.length > 1) {
                        const subVal = parts[1].trim();
                        if (subVal) {
                          setSuburb(
                            subVal
                              .replace(" Bengaluru", "")
                              .replace(" Karnataka", ""),
                          );
                        }
                      }
                    }
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  placeholder="Search real-world addresses with Google Maps..."
                  className="w-full h-11 bg-white border border-brand-outline rounded-xl pl-9 pr-10 font-semibold text-brand-dark focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/10 placeholder:text-brand-gray/40 transition-all text-xs"
                  required
                />
                {isSearching ? (
                  <div className="absolute right-3 flex items-center justify-center">
                    <span className="w-4 h-4 border-2 border-brand-primary border-t-transparent rounded-full animate-spin"></span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleUseCurrentLocation}
                    title="Use My Current Location"
                    className="absolute right-2.5 p-1.5 hover:bg-slate-100 rounded-lg text-brand-primary active:scale-95 transition-all cursor-pointer flex items-center justify-center"
                  >
                    {isLocating ? (
                      <span className="w-4 h-4 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Navigation className="w-4 h-4 text-brand-primary fill-brand-primary/15" />
                    )}
                  </button>
                )}
              </div>
 
              {/* Autocomplete suggestions dropdown supporting genuine lists */}
              {showSuggestions && (
                <div className="absolute top-[58px] left-0 right-0 bg-white border border-brand-outline rounded-xl mt-1 shadow-lg z-30 max-h-56 overflow-y-auto divide-y divide-slate-100">
                  <div className="p-2 bg-slate-50 text-[10px] font-bold text-brand-primary flex items-center justify-between">
                    <span>
                      {hasAuthError ? "Suggestions (OpenStreetMap Fallback)" : "Google Maps Autocomplete Suggestions"}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowSuggestions(false)}
                      className="text-brand-gray hover:text-brand-dark text-[10px]"
                    >
                      Close×
                    </button>
                  </div>
                  
                  {/* Persistent Use Current Location suggestion */}
                  <button
                    type="button"
                    onClick={() => {
                      handleUseCurrentLocation();
                      setShowSuggestions(false);
                    }}
                    className="w-full px-3.5 py-3 text-left bg-brand-primary/5 hover:bg-brand-primary/10 active:bg-brand-primary/15 flex items-start gap-3 transition-all border-l-3 border-brand-accent cursor-pointer text-xs font-bold text-brand-accent leading-tight"
                  >
                    <Navigation className="w-3.5 h-3.5 text-brand-accent shrink-0 mt-0.5 fill-brand-accent/20" />
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-brand-accent leading-tight">
                        Use My Current Location 📍
                      </span>
                      <span className="text-[10px] text-brand-gray font-semibold mt-0.5">
                        {isLocating ? "Retrieving GPS coordinates..." : "Populate with high-accuracy GPS coordinates"}
                      </span>
                    </div>
                  </button>

                  {predictions.length > 0 && 
                    predictions.map(
                      (item, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => handleSelectSuggestion(item)}
                          className="w-full px-3.5 py-3 text-left hover:bg-brand-primary/5 active:bg-brand-primary/10 flex items-start gap-3 transition-all border-l-3 border-transparent hover:border-brand-primary cursor-pointer group/item text-xs font-bold text-brand-dark leading-tight"
                        >
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5 group-hover/item:text-brand-primary transition-colors" />
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-brand-dark leading-tight group-hover/item:text-brand-primary transition-colors">
                              {item.address}
                            </span>
                            <span className="text-[10px] text-brand-gray font-semibold mt-0.5">
                              {item.suburb}
                            </span>
                          </div>
                        </button>
                      ),
                    )}
                  </div>
                )}
            </div>

            {/* Suburb Name */}
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-brand-gray px-1">
                Suburb / Neighbourhood Area (Auto-filled on selection)
              </span>
              <input
                type="text"
                value={suburb}
                onChange={(e) => {
                  setSuburb(e.target.value);
                  setSelectedCoords(null);
                }}
                placeholder="e.g. Koramangala or Indiranagar"
                className="w-full h-11 bg-white border border-brand-outline rounded-xl px-4 font-semibold text-brand-dark focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/10 placeholder:text-brand-gray/40 transition-all text-xs"
                required
              />
            </div>

            {/* Door Number */}
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-brand-gray px-1">
                Door / Flat No. & Building Building/Apartment
              </span>
              <input
                type="text"
                value={doorNumber}
                onChange={(e) => setDoorNumber(e.target.value)}
                placeholder="e.g. Flat 101, A Block"
                className="w-full h-11 bg-white border border-brand-outline rounded-xl px-4 font-semibold text-brand-dark focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/10 placeholder:text-brand-gray/40 transition-all text-xs"
              />
            </div>

            {/* Quick Save Location Buttons */}
            <div className="border-t border-brand-light-gray/55 pt-2.5 mt-1 flex flex-col gap-1.5">
              <span className="text-[9px] font-bold text-brand-gray uppercase tracking-wider px-1">
                Save current location as preset:
              </span>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => handleSaveLocationPreset("Home")}
                  className="py-2 bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100 font-bold text-[9px] rounded-lg tracking-tight flex items-center justify-center gap-1 active:scale-95 transition-all cursor-pointer"
                >
                  <Save className="w-3 h-3 text-slate-500" />
                  <span>As Home 🏠</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveLocationPreset("Work")}
                  className="py-2 bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100 font-bold text-[9px] rounded-lg tracking-tight flex items-center justify-center gap-1 active:scale-95 transition-all cursor-pointer"
                >
                  <Save className="w-3 h-3 text-slate-500" />
                  <span>As Work 💼</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveLocationPreset("Other")}
                  className="py-2 bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100 font-bold text-[9px] rounded-lg tracking-tight flex items-center justify-center gap-1 active:scale-95 transition-all cursor-pointer"
                >
                  <Save className="w-3 h-3 text-slate-500" />
                  <span>
                    As {savedOtherName !== "Other" ? savedOtherName : "Other"}{" "}
                    📍
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Date & Time Row */}
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-brand-gray px-1 flex justify-between items-center">
                <span>When? (Date)</span>
                <span className="text-[10px] text-brand-gray/60 font-medium">Short term gigs only</span>
              </label>
              <div className="relative flex items-center">
                <Calendar className="absolute left-3 w-4 h-4 text-brand-primary pointer-events-none" />
                <input
                  type="date"
                  value={startDate}
                  min={todayStr}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full h-14 bg-white border border-brand-outline rounded-xl pl-9 pr-3 text-brand-dark font-medium focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20 transition-all text-sm cursor-pointer"
                />
              </div>
              
              {/* Date Presets */}
              <div className="flex flex-wrap gap-1.5 mt-1">
                <button
                  type="button"
                  disabled={allSlotsPassedToday}
                  onClick={() => setStartDate(todayStr)}
                  className={`px-2.5 py-1 text-[10px] font-bold rounded-lg border transition-all cursor-pointer ${
                    startDate === todayStr
                      ? "bg-brand-primary border-brand-primary text-white"
                      : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  }`}
                >
                  Today {allSlotsPassedToday ? "(Passed)" : ""}
                </button>
                <button
                  type="button"
                  onClick={() => setStartDate(tomorrowStr)}
                  className={`px-2.5 py-1 text-[10px] font-bold rounded-lg border transition-all cursor-pointer ${
                    startDate === tomorrowStr
                      ? "bg-brand-primary border-brand-primary text-white"
                      : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  Tomorrow
                </button>
                <button
                  type="button"
                  onClick={() => setStartDate(day3Str)}
                  className={`px-2.5 py-1 text-[10px] font-bold rounded-lg border transition-all cursor-pointer ${
                    startDate === day3Str
                      ? "bg-brand-primary border-brand-primary text-white"
                      : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  This {day3Name}
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-brand-gray px-1 flex justify-between items-center">
                <span>Time Selection</span>
                <span className="text-[10px] text-brand-gray/60 font-medium">Device friendly picker</span>
              </label>

              {/* Single elegant, modern time dropdown select */}
              <div className="relative flex items-center">
                <Clock className="absolute left-3 w-4 h-4 text-brand-primary pointer-events-none z-10" />
                <select
                  value={time || "09:00"}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full h-14 bg-white border border-brand-outline rounded-xl pl-9 pr-10 text-brand-dark font-medium focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20 transition-all text-sm cursor-pointer appearance-none relative"
                  style={{
                    backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%237C8087' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 16px center',
                    backgroundSize: '16px'
                  }}
                >
                  {TIME_SLOTS.map((slot) => {
                    const isPassed = isTimeSlotPassed(startDate, slot.value);
                    return (
                      <option key={slot.value} value={slot.value} disabled={isPassed}>
                        {slot.label} {isPassed ? "(Passed)" : ""}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Time Presets */}
              <div className="flex flex-wrap gap-1.5 mt-1">
                <button
                  type="button"
                  disabled={isTimeSlotPassed(startDate, "09:00")}
                  onClick={() => setTime("09:00")}
                  className={`px-2.5 py-1 text-[10px] font-bold rounded-lg border transition-all cursor-pointer ${
                    time === "09:00"
                      ? "bg-brand-primary border-brand-primary text-white"
                      : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  }`}
                >
                  Morning (9 AM)
                </button>
                <button
                  type="button"
                  disabled={isTimeSlotPassed(startDate, "13:00")}
                  onClick={() => setTime("13:00")}
                  className={`px-2.5 py-1 text-[10px] font-bold rounded-lg border transition-all cursor-pointer ${
                    time === "13:00"
                      ? "bg-brand-primary border-brand-primary text-white"
                      : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  }`}
                >
                  Afternoon (1 PM)
                </button>
                <button
                  type="button"
                  disabled={isTimeSlotPassed(startDate, "17:00")}
                  onClick={() => setTime("17:00")}
                  className={`px-2.5 py-1 text-[10px] font-bold rounded-lg border transition-all cursor-pointer ${
                    time === "17:00"
                      ? "bg-brand-primary border-brand-primary text-white"
                      : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  }`}
                >
                  Evening (5 PM)
                </button>
                <button
                  type="button"
                  disabled={isTimeSlotPassed(startDate, "20:00")}
                  onClick={() => setTime("20:00")}
                  className={`px-2.5 py-1 text-[10px] font-bold rounded-lg border transition-all cursor-pointer ${
                    time === "20:00"
                      ? "bg-brand-primary border-brand-primary text-white"
                      : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  }`}
                >
                  Night (8 PM)
                </button>
              </div>
            </div>
          </div>

          {/* Add a Photo Selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-brand-gray px-1">
              Add a Photo (Optional)
            </label>

            {uploadedPhotoUrl ? (
              <div className="relative rounded-xl overflow-hidden border border-brand-light-gray h-36">
                <img
                  src={uploadedPhotoUrl}
                  alt="Selected upload"
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
                <button
                  type="button"
                  onClick={() => {
                    setUploadedPhotoUrl("");
                  }}
                  className="absolute top-2 right-2 bg-brand-dark/70 text-white rounded-full px-3 py-1 hover:bg-brand-primary active:scale-95 transition-all text-xs cursor-pointer font-bold"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      triggerWithPermission(() => handleFile(file));
                    }
                  }}
                />
                <div 
                  onClick={() => {
                    triggerWithPermission(() => {
                      fileInputRef.current?.click();
                    });
                  }}
                  className="w-full h-32 bg-white border-2 border-dashed border-brand-primary/30 rounded-xl flex flex-col items-center justify-center gap-2 hover:bg-brand-light-gray/20 hover:border-brand-primary transition-all active:scale-[0.99] cursor-pointer"
                  onDragOver={(e) => {
                    e.preventDefault();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files?.[0];
                    if (file) {
                      triggerWithPermission(() => handleFile(file));
                    }
                  }}
                >
                  <div className="w-10 h-10 bg-brand-primary/10 rounded-full flex items-center justify-center text-brand-primary pointer-events-none">
                    <Camera className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold text-brand-primary pointer-events-none">
                    Click or drag photo here to upload
                  </span>
                  <span className="text-[10px] text-brand-gray font-medium pointer-events-none">
                    Supports PNG, JPG, JPEG
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Price setting */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-brand-gray px-1">
              Set your Price (₹)
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-4 font-bold text-lg text-brand-primary">
                ₹
              </span>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9,]*"
                value={price}
                onChange={(e) => {
                  const rawVal = e.target.value;
                  const cleanVal = rawVal.replace(/[^0-9]/g, "");
                  if (cleanVal === "") {
                    setPrice("");
                    return;
                  }
                  const numVal = parseInt(cleanVal, 10);
                  if (numVal < 0 || numVal > 10000000) return;
                  setPrice(numVal.toLocaleString("en-IN"));
                }}
                placeholder="0"
                className="w-full h-16 bg-white border border-brand-outline rounded-xl pl-8 pr-4 font-extrabold text-right text-base text-brand-dark focus:outline-none focus:border-brand-primary transition-all"
                required
              />
            </div>
          </div>

          {/* Commitment Pledge Block (CHECKBOX MUST BE COMPLETED) */}
          <div
            onClick={() => setPledgeChecked(!pledgeChecked)}
            className="mt-2 p-4 bg-brand-mint/10 border border-brand-mint/30 rounded-2xl flex items-start gap-3 cursor-pointer hover:bg-brand-mint/20 transition-all shadow-sm"
          >
            <div className="relative flex items-center justify-center mt-0.5">
              <input
                type="checkbox"
                checked={pledgeChecked}
                onChange={() => {}} // Swallowed: handled by parent container click
                required
                className="appearance-none w-5 h-5 border-2 border-brand-primary/40 rounded-md bg-white checked:bg-brand-primary checked:border-brand-primary focus:outline-none cursor-pointer flex items-center justify-center text-white"
              />
              {pledgeChecked && (
                <ShieldCheck className="absolute w-4 h-4 text-white fill-brand-primary" />
              )}
            </div>
            <div className="flex flex-col text-left">
              <span className="text-xs font-bold text-brand-primary">
                Commitment Pledge
              </span>
              <span className="text-[10px] text-brand-gray mt-0.5 leading-relaxed">
                No cancellation after mutual acceptance to keep our community
                reliable.
              </span>
            </div>
          </div>

          {/* Sticky Bottom post action */}
          <div className="fixed bottom-0 left-0 right-0 py-4 px-4 sm:px-6 md:px-8 bg-white/95 backdrop-blur-md border-t border-brand-light-gray/50 z-40">
            <div className="max-w-md mx-auto">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-14 bg-brand-primary disabled:bg-brand-primary/60 text-white font-extrabold text-sm rounded-xl shadow-lg shadow-brand-primary/20 hover:scale-[1.01] active:scale-95 disabled:active:scale-100 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    <span>Publishing Gig...</span>
                  </>
                ) : (
                  <>
                    <span>Publish Gig</span>
                    <Rocket className="w-4 h-4 animate-bounce" />
                  </>
                )}
              </button>
            </div>
          </div>

          {showPermissionPrompt && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
              <div className="bg-white rounded-[24px] overflow-hidden shadow-2xl max-w-sm w-full p-6 text-center border border-brand-light-gray flex flex-col gap-4">
                <div className="w-14 h-14 bg-brand-primary/10 text-brand-primary rounded-full flex items-center justify-center mx-auto animate-pulse">
                  <Camera className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-brand-dark font-black text-lg">Allow Photos Access?</h3>
                  <p className="text-xs text-brand-gray mt-2 font-medium leading-relaxed">
                    Qwick Gig requires permission to access your Camera & Photo Gallery to let you upload gig reference pictures and document attachments.
                  </p>
                </div>
                <div className="flex flex-col gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => {
                      localStorage.setItem("qwick_camera_gallery_permission", "granted");
                      setShowPermissionPrompt(false);
                      if (pendingAction) {
                        pendingAction();
                        setPendingAction(null);
                      }
                    }}
                    className="w-full py-3 bg-brand-primary text-white font-extrabold text-xs rounded-xl shadow-md shadow-brand-primary/20 hover:bg-brand-primary-hover active:scale-95 transition-all cursor-pointer"
                  >
                    Allow Access
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowPermissionPrompt(false);
                      setPendingAction(null);
                      alert("Access is required to upload files.");
                    }}
                    className="w-full py-3 bg-slate-50 hover:bg-slate-100 text-brand-gray font-bold text-xs rounded-xl transition-all cursor-pointer border border-brand-light-gray/60"
                  >
                    Don't Allow
                  </button>
                </div>
              </div>
            </div>
          )}
        </form>


      </div>
    </div>
  );
}
