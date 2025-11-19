import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Navigation, Check, Loader2, AlertTriangle, Trash2 } from 'lucide-react';
import { CITIES, CITY_COORDINATES } from '../constants';
import { GeoCoordinates } from '../types';

// Define Leaflet type for global access (injected via CDN)
declare global {
  interface Window {
    L: any;
  }
}

interface LocationInputProps {
  selectedCity: string;
  onCityChange: (city: string) => void;
  selectedWasteType: string;
  onWasteTypeChange: (type: string) => void;
  coordinates: GeoCoordinates | null;
  onLocationFound: (coords: GeoCoordinates) => void;
}

export const LocationInput: React.FC<LocationInputProps> = ({ 
  selectedCity, 
  onCityChange, 
  selectedWasteType,
  onWasteTypeChange,
  coordinates, 
  onLocationFound 
}) => {
  const [loadingGeo, setLoadingGeo] = useState(false);
  const [geoError, setGeoError] = useState<string>("");
  
  // Map Refs
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  // Initialize and Update Map
  useEffect(() => {
    if (!mapRef.current || !window.L) return;

    // 1. Initialize Map if not exists
    if (!mapInstanceRef.current) {
      // Default to India center if nothing selected
      mapInstanceRef.current = window.L.map(mapRef.current).setView([20.5937, 78.9629], 5);
      
      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(mapInstanceRef.current);
    }

    const map = mapInstanceRef.current;

    // 2. Handle View Updates
    let lat, lng, zoom;

    if (coordinates) {
      // Priority 1: Live GPS Coordinates
      lat = coordinates.latitude;
      lng = coordinates.longitude;
      zoom = 16; // Close zoom for precision
    } else if (selectedCity && CITY_COORDINATES[selectedCity]) {
      // Priority 2: Selected City Center
      lat = CITY_COORDINATES[selectedCity].lat;
      lng = CITY_COORDINATES[selectedCity].lng;
      zoom = 12; // City level zoom
    }

    // 3. Update Marker and Pan
    if (lat && lng) {
      map.setView([lat, lng], zoom);

      // Remove existing marker
      if (markerRef.current) {
        map.removeLayer(markerRef.current);
      }

      // Add new marker
      const customIcon = window.L.divIcon({
        className: 'custom-pin',
        html: `<div style="background-color: #10b981; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      });

      markerRef.current = window.L.marker([lat, lng], { icon: customIcon })
        .addTo(map)
        .bindPopup(coordinates ? "Verified Live Location" : `Center of ${selectedCity}`)
        .openPopup();
    }

    // Cleanup on unmount
    return () => {
      // We generally keep the map instance alive during component lifecycle for performance, 
      // but could destroy here if strict cleanup needed.
    };

  }, [selectedCity, coordinates]);

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      setGeoError("Geolocation is not supported by your browser.");
      return;
    }

    setLoadingGeo(true);
    setGeoError("");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        onLocationFound({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        });
        setLoadingGeo(false);
      },
      (err) => {
        console.error(err);
        setGeoError("Permission denied or location unavailable.");
        setLoadingGeo(false);
      }
    );
  };

  return (
    <div className="space-y-4">
      {/* City Selection */}
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-2">
          Center City <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
          <select 
            value={selectedCity}
            onChange={(e) => onCityChange(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all appearance-none cursor-pointer text-black"
          >
            <option value="">-- Select Nearest City --</option>
            {CITIES.map(city => (
              <option key={city} value={city}>{city}</option>
            ))}
          </select>
        </div>
        
        {selectedCity && (
           <div className="mt-3 p-3 bg-emerald-50 border border-emerald-100 rounded-lg flex items-center justify-between animate-fade-in">
               <span className="text-sm text-slate-500 font-medium">Selected Zone:</span>
               <span className="text-lg font-bold text-black tracking-wide uppercase">{selectedCity}</span>
           </div>
        )}
      </div>

      {/* Waste Type Selection */}
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-2">
          Waste Type (Estimated)
        </label>
        <div className="relative">
          <Trash2 className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
          <select 
            value={selectedWasteType}
            onChange={(e) => onWasteTypeChange(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all appearance-none cursor-pointer text-black"
          >
            <option value="">-- Select Waste Category --</option>
            <option value="Plastic">Plastic / Polythene</option>
            <option value="Organic">Organic / Food Waste</option>
            <option value="Construction">Construction Debris</option>
            <option value="Hazardous">Hazardous / Chemical</option>
            <option value="E-Waste">Electronic Waste</option>
            <option value="Mixed">Mixed Garbage Dump</option>
            <option value="Liquid">Liquid / Sewage</option>
            <option value="Other">Other</option>
          </select>
        </div>
      </div>

      {/* GPS Location */}
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-2">
          Exact Coordinates (Optional)
        </label>
        <button
          type="button"
          onClick={handleGetLocation}
          disabled={loadingGeo || !!coordinates}
          className={`w-full py-3 px-4 rounded-lg border-2 font-medium flex items-center justify-center gap-2 transition-all ${
            coordinates 
              ? "border-emerald-500 bg-emerald-50 text-emerald-700 cursor-default" 
              : "border-emerald-500 text-emerald-600 hover:bg-emerald-50"
          }`}
        >
          {loadingGeo ? (
            <><Loader2 className="animate-spin w-5 h-5" /> Locating...</>
          ) : coordinates ? (
            <><Check className="w-5 h-5" /> Location Captured ({coordinates.latitude.toFixed(4)}, {coordinates.longitude.toFixed(4)})</>
          ) : (
            <><Navigation className="w-5 h-5" /> Get Current GPS Location</>
          )}
        </button>
        
        {geoError && (
          <p className="mt-2 text-sm text-red-500 flex items-center gap-1">
            <AlertTriangle className="w-4 h-4" /> {geoError}
          </p>
        )}
      </div>

      {/* Live Leaflet Map */}
      <div className="relative rounded-xl overflow-hidden border-2 border-slate-200 shadow-inner h-64 bg-slate-100 z-0">
         <div ref={mapRef} id="map" className="w-full h-full relative z-0" />
         
         {/* Overlay hint if no location selected yet */}
         {(!coordinates && !selectedCity) && (
             <div className="absolute inset-0 bg-black/10 flex items-center justify-center pointer-events-none z-[400]">
                 <span className="bg-white/90 px-3 py-1 rounded-full text-xs font-semibold text-slate-600 shadow">
                    Select a city or get GPS to view map
                 </span>
             </div>
         )}
      </div>
    </div>
  );
};