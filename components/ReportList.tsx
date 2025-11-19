
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { CheckCircle2, XCircle, Clock, MapPin, User, AlertTriangle, Trash2, ArrowRight, Sparkles, ShieldCheck, Download, Share2, Filter, LayoutList, ClipboardList, Map, CheckSquare, Square, Navigation, X, History } from 'lucide-react';
import { Report, ReportStatus, WasteReportData } from '../types';
import { CITIES, CITY_COORDINATES } from '../constants';

// Access global Leaflet instance
declare global {
  interface Window {
    L: any;
  }
}

interface ReportListProps {
  reports: Report[];
  userRole: WasteReportData['userRole'];
  onUpdateStatus: (id: string, status: ReportStatus) => void;
}

// --- Helper: Distance Calculation ---
function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
}

function deg2rad(deg: number) {
  return deg * (Math.PI / 180);
}

export const ReportList: React.FC<ReportListProps> = ({ reports, userRole, onUpdateStatus }) => {
  // Filters
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterCity, setFilterCity] = useState<string>('ALL');
  const [filterSeverity, setFilterSeverity] = useState<string>('ALL');
  const [filterWasteType, setFilterWasteType] = useState<string>('ALL');

  // Route Optimization State
  const [selectedReportIds, setSelectedReportIds] = useState<Set<string>>(new Set());
  const [showRouteModal, setShowRouteModal] = useState(false);
  const [optimizedRoute, setOptimizedRoute] = useState<Report[]>([]);

  // Map Refs for Route Modal
  const routeMapRef = useRef<any>(null);
  const routeMapContainerRef = useRef<HTMLDivElement>(null);

  // Reset state when role changes
  useEffect(() => {
    setFilterStatus(userRole === 'Volunteer' ? ReportStatus.VERIFIED : 'ALL');
    setSelectedReportIds(new Set());
    setShowRouteModal(false);
  }, [userRole]);

  // Get Unique Waste Types for Filter
  const uniqueWasteTypes = useMemo(() => {
    const types = new Set<string>();
    reports.forEach(r => {
      if (r.aiAnalysis?.wasteType) {
        types.add(r.aiAnalysis.wasteType);
      }
    });
    return Array.from(types).sort();
  }, [reports]);

  // 1. Filter Logic
  const visibleReports = reports.filter(r => {
    if (userRole === 'Volunteer') {
      if (r.status !== ReportStatus.VERIFIED && r.status !== ReportStatus.COLLECTED) {
        return false;
      }
    }
    // Citizen view typically sees whatever is passed to it, usually filtered by ID in parent, 
    // but we can add extra safety if needed. For now, assume parent filters for Citizen.

    if (filterStatus !== 'ALL' && r.status !== filterStatus) return false;
    if (filterCity !== 'ALL' && r.centerCity !== filterCity) return false;
    if (filterSeverity !== 'ALL' && r.aiAnalysis?.severity !== filterSeverity) return false;
    if (filterWasteType !== 'ALL' && (r.aiAnalysis?.wasteType || 'Unspecified') !== filterWasteType) return false;
    return true;
  });

  // 2. Selection Logic
  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedReportIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedReportIds(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedReportIds.size === visibleReports.length) {
      setSelectedReportIds(new Set());
    } else {
      // Only allow selecting Verified reports for routing
      const verifiedIds = visibleReports
        .filter(r => r.status === ReportStatus.VERIFIED)
        .map(r => r.id);
      setSelectedReportIds(new Set(verifiedIds));
    }
  };

  // Helper to safely get coordinates
  const getCoords = (r: Report) => {
    if (r.coordinates) return { lat: r.coordinates.latitude, lng: r.coordinates.longitude };
    const cityCoords = CITY_COORDINATES[r.centerCity];
    return cityCoords ? { lat: cityCoords.lat, lng: cityCoords.lng } : { lat: 0, lng: 0 };
  };

  // 3. Route Optimization Logic (Greedy Nearest Neighbor)
  const handleOptimizeRoute = () => {
    const selectedReports = reports.filter(r => selectedReportIds.has(r.id));
    if (selectedReports.length < 2) return;

    // Start with the first selected report as the "current" location (or could be closest to user)
    const route: Report[] = [selectedReports[0]];
    const unvisited = new Set<Report>(selectedReports.slice(1));

    let current = selectedReports[0];

    while (unvisited.size > 0) {
      let nearest: Report | null = null;
      let minDist = Infinity;

      const c1 = getCoords(current);

      unvisited.forEach(candidate => {
        const c2 = getCoords(candidate);
        const dist = getDistanceFromLatLonInKm(c1.lat, c1.lng, c2.lat, c2.lng);
        if (dist < minDist) {
          minDist = dist;
          nearest = candidate;
        }
      });

      if (nearest) {
        route.push(nearest);
        unvisited.delete(nearest);
        current = nearest as Report; // Type assertion for safety
      } else {
        break;
      }
    }

    setOptimizedRoute(route);
    setShowRouteModal(true);
  };

  // 4. Initialize Route Map
  useEffect(() => {
    if (showRouteModal && optimizedRoute.length > 0 && routeMapContainerRef.current && window.L) {
      // Small delay to ensure modal renders
      const timer = setTimeout(() => {
        if (!routeMapContainerRef.current) return;

        // Cleanup existing map
        if (routeMapRef.current) {
          routeMapRef.current.remove();
          routeMapRef.current = null;
        }

        // Init Map
        const startCoords = getCoords(optimizedRoute[0]);
        const map = window.L.map(routeMapContainerRef.current).setView([startCoords.lat, startCoords.lng], 13);
        routeMapRef.current = map;

        window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap'
        }).addTo(map);

        const latLngs: [number, number][] = [];

        // Add Markers and Paths
        optimizedRoute.forEach((report, index) => {
          const coords = getCoords(report);
          latLngs.push([coords.lat, coords.lng]);

          // Custom Numbered Marker
          const numberIcon = window.L.divIcon({
            className: 'custom-route-marker',
            html: `<div style="
              background-color: ${index === 0 ? '#10b981' : '#3b82f6'}; 
              color: white; 
              width: 24px; 
              height: 24px; 
              border-radius: 50%; 
              display: flex; 
              align-items: center; 
              justify-content: center; 
              font-weight: bold; 
              font-size: 12px;
              border: 2px solid white; 
              box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            ">${index + 1}</div>`,
            iconSize: [24, 24],
            iconAnchor: [12, 12]
          });

          window.L.marker([coords.lat, coords.lng], { icon: numberIcon })
            .addTo(map)
            .bindPopup(`
              <div class="text-xs">
                <strong class="block mb-1">Stop #${index + 1}</strong>
                <span class="text-slate-600">${report.centerCity}</span><br/>
                <span class="text-[10px] text-slate-400">${report.aiAnalysis?.wasteType}</span>
              </div>
            `);
        });

        // Draw connecting line
        if (latLngs.length > 1) {
          window.L.polyline(latLngs, { 
            color: '#6366f1', 
            weight: 4, 
            dashArray: '10, 10', 
            opacity: 0.8,
            lineCap: 'round'
          }).addTo(map);
          
          // Fit bounds to show all points
          map.fitBounds(latLngs, { padding: [50, 50] });
        }
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [showRouteModal, optimizedRoute]);


  // 5. Export CSV
  const handleExportCSV = () => {
    const headers = ["Report ID", "Date", "City", "Reporter", "Status", "Type", "Severity", "Est. Quantity"];
    const rows = visibleReports.map(r => [
      r.id,
      new Date(r.timestamp).toISOString().split('T')[0],
      `"${r.centerCity}"`,
      `"${r.reporterName}"`,
      r.status,
      `"${r.aiAnalysis?.wasteType || 'N/A'}"`,
      r.aiAnalysis?.severity || 'N/A',
      `"${r.aiAnalysis?.estimatedQuantity || 'N/A'}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `safai_sathi_${userRole.toLowerCase()}_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleShare = (id: string) => {
    const url = `${window.location.origin}/report/${id}`;
    navigator.clipboard.writeText(url).then(() => {
      alert(`Report URL copied: ${url}`);
    });
  };

  // --- Render ---
  return (
    <div className="space-y-6 animate-fade-in relative">
      
      {/* Role Context Header */}
      <div className={`rounded-xl p-6 border ${
        userRole === 'Admin' ? 'bg-purple-50 border-purple-100' : 
        userRole === 'Volunteer' ? 'bg-blue-50 border-blue-100' :
        'bg-emerald-50 border-emerald-100'
      }`}>
        <div className="flex items-center gap-3 mb-2">
          <div className={`p-2 rounded-lg ${
            userRole === 'Admin' ? 'bg-purple-100 text-purple-700' : 
            userRole === 'Volunteer' ? 'bg-blue-100 text-blue-700' :
            'bg-emerald-100 text-emerald-700'
          }`}>
            {userRole === 'Admin' ? <LayoutList className="w-5 h-5" /> : 
             userRole === 'Volunteer' ? <ClipboardList className="w-5 h-5" /> :
             <History className="w-5 h-5" />}
          </div>
          <h2 className={`text-lg font-bold ${
            userRole === 'Admin' ? 'text-purple-900' : 
            userRole === 'Volunteer' ? 'text-blue-900' :
            'text-emerald-900'
          }`}>
            {userRole === 'Admin' ? 'Master Admin Overview' : 
             userRole === 'Volunteer' ? 'Volunteer Task List' :
             'My Submission History'}
          </h2>
        </div>
        <p className={`text-sm ${
            userRole === 'Admin' ? 'text-purple-700' : 
            userRole === 'Volunteer' ? 'text-blue-700' :
            'text-emerald-700'
        }`}>
          {userRole === 'Admin'
            ? 'Manage all incoming reports, verify AI results, and assign cleanup tasks.'
            : userRole === 'Volunteer' 
            ? 'View verified waste reports assigned for cleanup in your sector.'
            : 'Track the status of your waste reports and verification results.'}
        </p>
      </div>

      {/* Toolbar */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 sticky top-20 z-30">
        <div className="flex flex-wrap gap-2 w-full lg:w-auto items-center">
          
          {/* Select All (Volunteer Only) */}
          {userRole === 'Volunteer' && filterStatus === ReportStatus.VERIFIED && (
            <button 
              onClick={toggleSelectAll}
              className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition mr-2"
              title="Select All Visible"
            >
               {selectedReportIds.size > 0 && selectedReportIds.size === visibleReports.filter(r => r.status === ReportStatus.VERIFIED).length 
                 ? <CheckSquare className="w-5 h-5 text-emerald-600" /> 
                 : <Square className="w-5 h-5" />
               }
            </button>
          )}

          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <select 
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="pl-9 pr-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 bg-slate-50 focus:ring-2 focus:ring-emerald-500 outline-none appearance-none cursor-pointer hover:bg-white transition shadow-sm"
            >
              {userRole === 'Admin' ? (
                <>
                  <option value="ALL">All Statuses</option>
                  <option value={ReportStatus.PENDING}>Pending Review</option>
                  <option value={ReportStatus.VERIFIED}>Verified</option>
                  <option value={ReportStatus.COLLECTED}>Collected</option>
                  <option value={ReportStatus.REJECTED}>Rejected</option>
                </>
              ) : userRole === 'Volunteer' ? (
                <>
                  <option value={ReportStatus.VERIFIED}>To Be Cleaned</option>
                  <option value={ReportStatus.COLLECTED}>History (Collected)</option>
                  <option value="ALL">All My Tasks</option>
                </>
              ) : (
                <>
                  <option value="ALL">All My Reports</option>
                  <option value={ReportStatus.PENDING}>Pending</option>
                  <option value={ReportStatus.VERIFIED}>Verified</option>
                  <option value={ReportStatus.COLLECTED}>Cleaned</option>
                </>
              )}
            </select>
          </div>

          <select 
            value={filterCity}
            onChange={(e) => setFilterCity(e.target.value)}
            className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 bg-slate-50 focus:ring-2 focus:ring-emerald-500 outline-none cursor-pointer hover:bg-white transition shadow-sm"
          >
            <option value="ALL">All Cities</option>
            {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          <select 
            value={filterWasteType}
            onChange={(e) => setFilterWasteType(e.target.value)}
            className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 bg-slate-50 focus:ring-2 focus:ring-emerald-500 outline-none cursor-pointer hover:bg-white transition shadow-sm"
          >
            <option value="ALL">All Waste Types</option>
            {uniqueWasteTypes.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>

          <select 
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 bg-slate-50 focus:ring-2 focus:ring-emerald-500 outline-none cursor-pointer hover:bg-white transition shadow-sm"
          >
            <option value="ALL">All Severities</option>
            <option value="Critical">Critical</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
        </div>

        <div className="flex items-center gap-2 w-full lg:w-auto">
           {/* Route Optimization Button */}
           {userRole === 'Volunteer' && selectedReportIds.size >= 2 && (
             <button
                onClick={handleOptimizeRoute}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 transition shadow-md animate-fade-in"
             >
                <Map className="w-4 h-4" /> Generate Route ({selectedReportIds.size})
             </button>
           )}

           <button 
            onClick={handleExportCSV}
            disabled={visibleReports.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-900 transition shadow-md disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
           >
            <Download className="w-4 h-4" /> Export CSV
           </button>
        </div>
      </div>

      {/* --- Empty State --- */}
      {visibleReports.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl border border-slate-200 shadow-sm border-dashed">
          <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <Clock className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-medium text-slate-900">No Reports Found</h3>
          <p className="text-slate-500 mt-1">
            {userRole === 'Volunteer' 
                ? "Great job! No pending cleanup tasks in this view." 
                : userRole === 'Citizen'
                ? "You haven't submitted any reports matching these filters yet."
                : "Try adjusting your filters or check back later."}
          </p>
        </div>
      )}

      {/* --- Report Cards --- */}
      <div className="grid grid-cols-1 gap-6">
        {visibleReports.map((report) => {
          const isSelected = selectedReportIds.has(report.id);
          const canSelect = userRole === 'Volunteer' && report.status === ReportStatus.VERIFIED;

          return (
            <div 
              key={report.id} 
              className={`bg-white rounded-xl shadow-md border overflow-hidden hover:shadow-lg transition-all duration-300 group relative ${
                isSelected ? 'border-indigo-500 ring-1 ring-indigo-500 bg-indigo-50/10' : 'border-slate-200'
              }`}
            >
              {/* Selection Checkbox Overlay */}
              {canSelect && (
                <div className="absolute top-3 right-3 z-20">
                    <button 
                        onClick={() => toggleSelection(report.id)}
                        className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all shadow-sm ${
                            isSelected ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-slate-300 hover:border-indigo-400'
                        }`}
                    >
                        {isSelected && <CheckSquare className="w-3.5 h-3.5 text-white" />}
                    </button>
                </div>
              )}

              <div className="flex flex-col md:flex-row h-full">
                
                {/* Image Section */}
                <div className="md:w-72 lg:w-80 relative h-56 md:h-auto shrink-0 bg-slate-100">
                  {report.photoBase64 ? (
                    <img 
                      src={report.photoBase64} 
                      alt="Report Evidence" 
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400">No Image</div>
                  )}
                  
                  {/* Status Overlay Badge */}
                  <div className="absolute top-3 left-3">
                    <span className={`px-3 py-1.5 rounded-lg text-xs font-bold shadow-md border flex items-center gap-1.5 backdrop-blur-sm ${
                      report.status === ReportStatus.PENDING ? 'bg-yellow-100/90 text-yellow-800 border-yellow-200' :
                      report.status === ReportStatus.VERIFIED ? 'bg-emerald-100/90 text-emerald-800 border-emerald-200' :
                      report.status === ReportStatus.COLLECTED ? 'bg-blue-100/90 text-blue-800 border-blue-200' :
                      'bg-red-100/90 text-red-800 border-red-200'
                    }`}>
                      {report.status === ReportStatus.VERIFIED && <ShieldCheck className="w-3.5 h-3.5" />}
                      {report.status}
                    </span>
                  </div>
                </div>

                {/* Content Section */}
                <div className="p-5 flex-1 flex flex-col">
                  
                  {/* Header */}
                  <div className="flex justify-between items-start mb-3 pr-8">
                    <div>
                      <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                        {report.centerCity}
                      </h3>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">ID: #{report.id.slice(-6)}</span>
                        <span className="text-xs text-slate-400 flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(report.timestamp).toLocaleDateString()}</span>
                      </div>
                    </div>
                    
                    <button 
                        onClick={() => handleShare(report.id)}
                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition"
                        title="Share Report"
                    >
                        <Share2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Description */}
                  <p className="text-slate-600 text-sm mb-4 line-clamp-2 bg-slate-50/50 p-3 rounded-lg border border-slate-100">
                    <span className="font-semibold text-slate-700 block text-xs uppercase mb-1">Reporter Note:</span>
                    {report.description}
                  </p>

                  {/* AI Insights Badge Grid */}
                  {report.aiAnalysis && (
                    <div className="flex flex-wrap gap-2 mb-5">
                        <span className={`text-xs px-2.5 py-1 rounded-md border font-bold flex items-center gap-1 ${
                          report.aiAnalysis.severity === 'Critical' ? 'bg-red-50 border-red-200 text-red-700' :
                          report.aiAnalysis.severity === 'High' ? 'bg-orange-50 border-orange-200 text-orange-700' :
                          'bg-blue-50 border-blue-200 text-blue-700'
                        }`}>
                          <AlertTriangle className="w-3 h-3" /> {report.aiAnalysis.severity}
                        </span>
                        <span className="text-xs px-2.5 py-1 rounded-md border bg-slate-50 border-slate-200 text-slate-600 font-medium flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-purple-400" /> {report.aiAnalysis.wasteType}
                        </span>
                    </div>
                  )}

                  {/* Footer */}
                  <div className="mt-auto pt-4 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-3 text-xs text-slate-500 w-full sm:w-auto">
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-slate-400" /> 
                        <span className="font-medium">{report.reporterName}</span>
                      </div>
                      {report.coordinates && (
                        <div className="flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-slate-400" /> 
                            <span className="font-mono">{report.coordinates.latitude.toFixed(3)}, {report.coordinates.longitude.toFixed(3)}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2 w-full sm:w-auto justify-end">
                      {userRole === 'Admin' && report.status === ReportStatus.PENDING && (
                        <>
                          <button 
                            onClick={() => onUpdateStatus(report.id, ReportStatus.REJECTED)}
                            className="px-3 py-1.5 text-xs font-bold text-red-600 bg-white hover:bg-red-50 border border-red-200 hover:border-red-300 rounded-lg transition flex items-center gap-1"
                          >
                            <XCircle className="w-3.5 h-3.5" /> Reject
                          </button>
                          <button 
                            onClick={() => onUpdateStatus(report.id, ReportStatus.VERIFIED)}
                            className="px-4 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition flex items-center gap-1 shadow-sm hover:shadow-md"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" /> Verify & Assign
                          </button>
                        </>
                      )}

                      {userRole === 'Volunteer' && report.status === ReportStatus.VERIFIED && (
                        <button 
                          onClick={() => onUpdateStatus(report.id, ReportStatus.COLLECTED)}
                          className="w-full sm:w-auto px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition flex items-center justify-center gap-2 shadow-md hover:shadow-lg hover:-translate-y-0.5"
                        >
                          <Trash2 className="w-4 h-4" /> Mark As Collected
                        </button>
                      )}
                      
                      {report.status === ReportStatus.COLLECTED && (
                          <span className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100 flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Cleanup Completed
                          </span>
                      )}
                    </div>
                  </div>

                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* --- Route Optimization Modal --- */}
      {showRouteModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
                <div className="bg-slate-900 p-4 text-white flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-2">
                        <Navigation className="w-5 h-5 text-emerald-400" />
                        <h3 className="font-bold text-lg">Optimized Collection Route</h3>
                    </div>
                    <button onClick={() => setShowRouteModal(false)} className="p-1 hover:bg-white/10 rounded-full transition"><X className="w-5 h-5" /></button>
                </div>
                
                <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
                   {/* Map Side */}
                   <div className="w-full md:w-2/3 bg-slate-100 relative h-64 md:h-auto border-b md:border-b-0 md:border-r border-slate-200">
                      <div ref={routeMapContainerRef} className="absolute inset-0 w-full h-full z-0" />
                   </div>

                   {/* List Side */}
                   <div className="w-full md:w-1/3 p-6 bg-slate-50 overflow-y-auto">
                      <p className="text-sm text-slate-600 mb-4 font-medium">
                          Optimal path for {optimizedRoute.length} stops:
                      </p>
                      
                      <div className="space-y-0 relative">
                          {/* Connector Line */}
                          <div className="absolute left-[19px] top-4 bottom-4 w-0.5 bg-slate-300 z-0"></div>

                          {optimizedRoute.map((node, idx) => {
                              const nextNode = optimizedRoute[idx + 1];
                              let distToNext = 0;
                              
                              if (nextNode) {
                                  const c1 = getCoords(node);
                                  const c2 = getCoords(nextNode);
                                  distToNext = getDistanceFromLatLonInKm(c1.lat, c1.lng, c2.lat, c2.lng);
                              }

                              return (
                                  <div key={node.id} className="relative z-10 mb-4 last:mb-0">
                                      <div className="flex items-start gap-4">
                                          <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-sm border-2 ${
                                            idx === 0 ? 'bg-emerald-500 border-emerald-600 text-white' : 'bg-white border-slate-300 text-slate-700'
                                          }`}>
                                              <span className="font-bold text-sm">{idx + 1}</span>
                                          </div>
                                          <div className="flex-1 bg-white p-3 rounded-lg border border-slate-200 shadow-sm cursor-pointer hover:border-indigo-300 transition">
                                              <h4 className="font-bold text-slate-800 text-sm">{node.centerCity}</h4>
                                              <p className="text-xs text-slate-500 mt-0.5 truncate">{node.aiAnalysis?.wasteType || 'Waste'}</p>
                                              <p className="text-[10px] text-slate-400 mt-1">ID: #{node.id.slice(-4)}</p>
                                          </div>
                                      </div>
                                      
                                      {nextNode && (
                                          <div className="pl-14 py-2 flex items-center gap-2 text-xs text-slate-500 font-medium">
                                              <ArrowRight className="w-3 h-3 rotate-90 md:rotate-0 text-slate-400" /> 
                                              <span><span className="text-slate-900 font-bold">{distToNext.toFixed(2)} km</span> to next</span>
                                          </div>
                                      )}
                                  </div>
                              );
                          })}
                      </div>
                   </div>
                </div>

                <div className="p-4 border-t border-slate-200 bg-white flex justify-end gap-2 shrink-0">
                    <button onClick={() => setShowRouteModal(false)} className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition">Close</button>
                    <button onClick={() => window.print()} className="px-4 py-2 text-sm font-bold text-white bg-slate-800 hover:bg-slate-900 rounded-lg transition shadow-lg flex items-center gap-2">
                        <Download className="w-4 h-4" /> Print / Save
                    </button>
                </div>
            </div>
        </div>
      )}

    </div>
  );
};
