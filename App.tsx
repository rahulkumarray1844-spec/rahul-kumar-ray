
import React, { useState, useEffect } from 'react';
import { 
  Recycle, 
  MapPinned, 
  Camera as CameraIcon, 
  UserCircle, 
  FileText, 
  Send, 
  CheckCircle,
  AlertOctagon,
  Sparkles,
  CheckCircle2,
  ShieldCheck,
  Upload,
  Video,
  Activity,
  Bot,
  User,
  LayoutDashboard,
  History,
  Menu,
  LogOut,
  ListFilter,
  Leaf,
  Trash,
  Scale,
  Wrench,
  X,
  BellRing,
  Plus
} from 'lucide-react';

import { CameraCapture } from './components/CameraCapture';
import { LocationInput } from './components/LocationInput';
import { ReportList } from './components/ReportList';
import { analyzeWasteImage } from './services/geminiService';
import { WasteReportData, AppStatus, AnalysisResult, Report, ReportStatus } from './types';

// --- Simple Toast Component ---
interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

const ToastNotification: React.FC<{ toast: Toast; onClose: () => void }> = ({ toast, onClose }) => (
  <div className={`fixed bottom-5 right-5 z-[200] flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl transform transition-all duration-300 hover:scale-105 animate-fade-in border ${
    toast.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 
    toast.type === 'error' ? 'bg-red-50 border-red-200 text-red-900' : 'bg-slate-800 border-slate-700 text-white'
  }`}>
    {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <BellRing className="w-5 h-5" />}
    <span className="font-medium text-sm">{toast.message}</span>
    <button onClick={onClose} className="opacity-50 hover:opacity-100"><X className="w-4 h-4" /></button>
  </div>
);

const App: React.FC = () => {
  // --- State Management ---
  
  // 1. Submitted Reports (Persisted in LocalStorage)
  const [reports, setReports] = useState<Report[]>(() => {
    const saved = localStorage.getItem('safai_reports');
    return saved ? JSON.parse(saved) : [];
  });

  // 2. Form Data
  const [formData, setFormData] = useState<WasteReportData>({
    userRole: 'Citizen',
    centerCity: '',
    manualWasteType: '', // Initialize manualWasteType
    coordinates: null,
    photoBase64: null,
    additionalImage: null,
    evidenceVideo: null,
    description: '',
    reporterName: '',
    reporterContact: '',
    isAware: 'Yes'
  });

  // 3. UI Status
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [aiAnalysis, setAiAnalysis] = useState<AnalysisResult | null>(null);
  const [activeView, setActiveView] = useState<'FORM' | 'DASHBOARD'>('FORM');
  // const [citizenView, setCitizenView] = useState<'SUBMIT' | 'HISTORY'>('SUBMIT'); // Removed history toggle
  const [toasts, setToasts] = useState<Toast[]>([]);
  
  // Persistent User ID for Citizen History
  const [userId] = useState(() => {
      const saved = localStorage.getItem('safai_user_id');
      if (saved) return saved;
      const newId = `USR-${Math.floor(Math.random() * 9000) + 1000}`;
      localStorage.setItem('safai_user_id', newId);
      return newId;
  });

  // --- Effects ---

  // Persist reports
  useEffect(() => {
    localStorage.setItem('safai_reports', JSON.stringify(reports));
  }, [reports]);

  // Role-based navigation
  useEffect(() => {
    if (formData.userRole === 'Admin' || formData.userRole === 'Volunteer') {
      setActiveView('DASHBOARD');
    } else {
      setActiveView('FORM');
    }
  }, [formData.userRole]);

  // --- Helper Functions ---

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  const handleInputChange = (field: keyof WasteReportData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFileChange = (field: 'additionalImage' | 'evidenceVideo', e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFormData(prev => ({ ...prev, [field]: e.target.files![0] }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.photoBase64) { showToast("Please capture a live photo", "error"); return; }
    if (!formData.centerCity) { showToast("Please select a city", "error"); return; }
    if (!formData.description.trim()) { showToast("Description is required", "error"); return; }
    if (!formData.reporterName.trim()) { showToast("Reporter name is required", "error"); return; }

    // Start Analysis
    setStatus(AppStatus.ANALYZING);
    
    // Include manual waste type in description for better AI context if provided
    const descriptionContext = formData.manualWasteType 
        ? `[User Selected Type: ${formData.manualWasteType}] ${formData.description}`
        : formData.description;

    const analysis = await analyzeWasteImage(formData.photoBase64, descriptionContext);
    setAiAnalysis(analysis);
    
    setStatus(AppStatus.SUBMITTING);
    
    setTimeout(() => {
      const newReport: Report = {
        ...formData,
        id: Date.now().toString(),
        userId: userId, // Attach current User ID
        timestamp: Date.now(),
        status: ReportStatus.PENDING,
        aiAnalysis: analysis
      };

      setReports(prev => [newReport, ...prev]);
      setStatus(AppStatus.SUCCESS);
      showToast("Report verified and submitted!", "success");
    }, 1500);
  };

  const handleUpdateStatus = (id: string, newStatus: ReportStatus) => {
    setReports(prev => prev.map(r => r.id === id ? { ...r, status: newStatus } : r));
    showToast(`Report status updated to ${newStatus}`, "success");
  };

  const resetForm = () => {
    setFormData(prev => ({
      ...prev,
      centerCity: '',
      manualWasteType: '',
      coordinates: null,
      photoBase64: null,
      additionalImage: null,
      evidenceVideo: null,
      description: '',
      isAware: 'Yes'
    }));
    setStatus(AppStatus.IDLE);
    setAiAnalysis(null);
  };

  // --- Render Views ---

  // 1. Success View
  if (status === AppStatus.SUCCESS && aiAnalysis) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4 animate-fade-in relative">
        <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden text-center p-8 relative z-10">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500"></div>
          
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg ring-4 ring-white">
            <CheckCircle className="w-10 h-10 text-emerald-600" />
          </div>
          
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Submission Verified!</h2>
          <p className="text-slate-500 mb-6 text-sm">Your report ID #{Date.now().toString().slice(-6)} has been logged.</p>
          
          {/* AI Verification Card */}
          <div className="bg-slate-50 rounded-xl overflow-hidden border border-slate-200 mb-6 text-left shadow-sm">
            <div className="bg-slate-100 px-4 py-2 border-b border-slate-200 flex justify-between items-center">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                    <Sparkles className="w-3 h-3 text-indigo-500" /> AI Analysis
                </h3>
                <span className="text-[10px] bg-white text-slate-600 px-2 py-0.5 rounded font-semibold border border-slate-200 shadow-sm">Gemini Pro</span>
            </div>
            
            <div className="p-4 space-y-4">
                {/* Location & Type Row */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
                        <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Location</span>
                        <span className="text-black font-bold text-sm tracking-tight truncate block">
                            {formData.centerCity}
                        </span>
                    </div>
                    <div className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
                        <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Waste Category</span>
                        <span className="text-slate-900 font-bold text-sm truncate block">
                            {aiAnalysis.wasteType || "Unspecified"}
                        </span>
                    </div>
                </div>

                {/* Severity & Status Row */}
                <div className="grid grid-cols-2 gap-3">
                    <div className={`p-3 rounded-lg border flex flex-col justify-center ${aiAnalysis.isWaste ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                        <p className="text-[10px] uppercase font-bold tracking-wide mb-1 opacity-70">AI Verdict</p>
                        <div className={`font-bold text-sm flex items-center gap-1 ${aiAnalysis.isWaste ? 'text-green-700' : 'text-red-700'}`}>
                             {aiAnalysis.isWaste ? <CheckCircle2 className="w-4 h-4" /> : <AlertOctagon className="w-4 h-4" />}
                             {aiAnalysis.isWaste ? "Confirmed" : "Not Waste"}
                        </div>
                    </div>
                    <div className={`p-3 rounded-lg border flex flex-col justify-center ${
                           aiAnalysis.severity === 'Critical' ? 'bg-red-50 border-red-200 text-red-800' : 
                           aiAnalysis.severity === 'High' ? 'bg-orange-50 border-orange-200 text-orange-800' : 
                           'bg-blue-50 border-blue-200 text-blue-800'
                    }`}>
                        <p className="text-[10px] uppercase font-bold tracking-wide mb-1 opacity-70">Severity Level</p>
                        <p className="font-bold text-lg leading-none">{aiAnalysis.severity}</p>
                    </div>
                </div>

                {/* Detailed Breakdown */}
                <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                    <div className="flex justify-between items-center mb-2">
                        <p className="text-[10px] text-slate-400 uppercase tracking-wide font-bold">Composition</p>
                        <span className="text-[10px] text-slate-500 font-mono bg-slate-100 px-2 py-0.5 rounded">{aiAnalysis.estimatedQuantity}</span>
                    </div>
                    
                    <div className="flex flex-wrap gap-2 mb-3">
                        {aiAnalysis.materials && aiAnalysis.materials.length > 0 ? (
                           aiAnalysis.materials.map((mat, idx) => (
                             <span key={idx} className="px-2 py-1 bg-slate-50 text-slate-600 text-[10px] rounded border border-slate-200 font-medium uppercase">
                                {mat}
                             </span>
                           ))
                        ) : (
                            <span className="text-xs text-slate-400 italic">No specific materials identified</span>
                        )}
                    </div>
                    
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                        <span className={`text-xs font-bold px-2 py-1 rounded-md flex items-center gap-1 ${aiAnalysis.isRecyclable ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                            {aiAnalysis.isRecyclable ? <Recycle className="w-3 h-3" /> : <Trash className="w-3 h-3" />}
                            {aiAnalysis.isRecyclable ? "Recyclable" : "Non-Recyclable"}
                        </span>
                        {aiAnalysis.confidenceScore > 0 && (
                             <span className="text-[10px] text-slate-400">AI Confidence: {(aiAnalysis.confidenceScore * 100).toFixed(0)}%</span>
                        )}
                    </div>
                </div>

                {/* Recommendation */}
                <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-3 rounded-lg border border-slate-700 text-white">
                    <p className="text-[10px] font-bold text-slate-400 mb-1 flex items-center gap-1 uppercase tracking-wider">
                        <Wrench className="w-3 h-3" /> Action Plan
                    </p>
                    <p className="text-xs text-slate-200 leading-relaxed">
                        {aiAnalysis.cleanupRecommendation}
                    </p>
                </div>
            </div>
          </div>
          
          <div className="flex flex-col gap-3">
             <button onClick={resetForm} className="w-full bg-slate-900 text-white py-3.5 rounded-xl font-bold hover:bg-slate-800 transition shadow-xl hover:shadow-2xl transform hover:-translate-y-0.5">
                Submit Another Report
             </button>
             {/* Removed View History button from Success view since we simplified the flow */}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f172a] relative">
      
      {/* Background Media */}
      <div className="fixed inset-0 z-0 opacity-20 pointer-events-none">
         <video autoPlay muted loop playsInline className="w-full h-full object-cover">
             <source src="https://assets.mixkit.co/videos/preview/mixkit-aerial-view-of-city-traffic-at-night-11-large.mp4" type="video/mp4" />
         </video>
         <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-[1px]"></div>
      </div>

      {/* Toast Container */}
      <div className="fixed bottom-0 right-0 p-4 z-[100] flex flex-col gap-2 pointer-events-none">
         {toasts.map(toast => (
             <div key={toast.id} className="pointer-events-auto">
                 <ToastNotification toast={toast} onClose={() => setToasts(prev => prev.filter(t => t.id !== toast.id))} />
             </div>
         ))}
      </div>

      {/* --- Sticky Top Navigation Bar --- */}
      <nav className="bg-slate-900/90 text-white sticky top-0 z-50 shadow-xl border-b border-slate-800 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 py-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                
                {/* Brand Section */}
                <div className="flex items-center justify-between w-full md:w-auto">
                    <div className="flex items-center gap-3 cursor-pointer group" onClick={() => { setActiveView('FORM'); handleInputChange('userRole', 'Citizen'); }}>
                        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-2.5 rounded-xl shadow-lg shadow-emerald-500/20 group-hover:shadow-emerald-500/40 transition-all">
                            <Recycle className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="font-bold text-xl leading-none tracking-tight">Safai Sathi</h1>
                            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold mt-0.5">EcoGuard AI</p>
                        </div>
                    </div>
                </div>

                {/* Role Switcher - Center */}
                <div className="flex bg-slate-950 rounded-lg p-1 border border-slate-800 shadow-inner overflow-hidden">
                  {['Citizen', 'Admin', 'Volunteer'].map((role) => (
                    <button
                      key={role}
                      onClick={() => handleInputChange('userRole', role)}
                      className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all duration-200 ${
                        formData.userRole === role 
                        ? role === 'Admin' ? 'bg-purple-600 text-white shadow-lg' 
                        : role === 'Volunteer' ? 'bg-blue-600 text-white shadow-lg'
                        : 'bg-emerald-600 text-white shadow-lg'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                      }`}
                    >
                      {role}
                    </button>
                  ))}
                </div>

                {/* User Profile - Right */}
                <div className="hidden md:flex items-center gap-3 pl-4 border-l border-slate-800">
                    <div className="text-right">
                        <p className={`text-xs font-bold leading-none mb-1 ${
                             formData.userRole === 'Admin' ? 'text-purple-400' : 
                             formData.userRole === 'Volunteer' ? 'text-blue-400' : 'text-emerald-400'
                        }`}>
                             {formData.userRole} Portal
                        </p>
                        <p className="text-[10px] text-slate-500 font-mono">{userId}</p>
                    </div>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 shadow-lg ${
                         formData.userRole === 'Admin' ? 'bg-purple-900/50 border-purple-500/50' : 
                         formData.userRole === 'Volunteer' ? 'bg-blue-900/50 border-blue-500/50' : 
                         'bg-emerald-900/50 border-emerald-500/50'
                    }`}>
                        <User className={`w-5 h-5 ${
                             formData.userRole === 'Admin' ? 'text-purple-300' : 
                             formData.userRole === 'Volunteer' ? 'text-blue-300' : 'text-emerald-300'
                        }`} />
                    </div>
                </div>
            </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <div className="py-8 px-4 md:px-6 lg:px-8 max-w-7xl mx-auto relative z-10">
        
        {activeView === 'DASHBOARD' ? (
          // --- ADMIN/VOLUNTEER DASHBOARD ---
          <div className="animate-fade-in">
            <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white/5 p-6 rounded-2xl border border-white/10 backdrop-blur-sm">
                <div>
                  <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">
                      {formData.userRole === 'Admin' ? 'Control Center' : 'Field Operations'}
                  </h1>
                  <p className="text-slate-400">
                      {formData.userRole === 'Admin' 
                        ? "Real-time verification and task assignment dashboard." 
                        : "Track assigned routes and report collection status."}
                  </p>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => { setActiveView('FORM'); handleInputChange('userRole', 'Citizen'); }} className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/10 text-white font-medium rounded-lg transition flex items-center gap-2 backdrop-blur-md">
                       <LayoutDashboard className="w-4 h-4" /> Public Form
                    </button>
                </div>
            </header>
            
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
               <div className="bg-white/10 backdrop-blur-md p-5 rounded-2xl border border-white/5 flex items-center justify-between group hover:bg-white/15 transition">
                  <div>
                    <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">Pending Review</p>
                    <p className="text-3xl font-bold text-yellow-400">{reports.filter(r => r.status === ReportStatus.PENDING).length}</p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-yellow-500/20 flex items-center justify-center group-hover:scale-110 transition">
                    <Activity className="w-6 h-6 text-yellow-400" />
                  </div>
               </div>
               <div className="bg-white/10 backdrop-blur-md p-5 rounded-2xl border border-white/5 flex items-center justify-between group hover:bg-white/15 transition">
                  <div>
                    <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">Actionable Issues</p>
                    <p className="text-3xl font-bold text-emerald-400">{reports.filter(r => r.status === ReportStatus.VERIFIED).length}</p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center group-hover:scale-110 transition">
                    <ShieldCheck className="w-6 h-6 text-emerald-400" />
                  </div>
               </div>
               <div className="bg-white/10 backdrop-blur-md p-5 rounded-2xl border border-white/5 flex items-center justify-between group hover:bg-white/15 transition">
                  <div>
                    <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">Total Cleared</p>
                    <p className="text-3xl font-bold text-blue-400">{reports.filter(r => r.status === ReportStatus.COLLECTED).length}</p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center group-hover:scale-110 transition">
                    <CheckCircle2 className="w-6 h-6 text-blue-400" />
                  </div>
               </div>
            </div>

            <ReportList 
              reports={reports} 
              userRole={formData.userRole} 
              onUpdateStatus={handleUpdateStatus} 
            />
          </div>
        ) : (
          // --- CITIZEN VIEW (Form Only - simplified) ---
          <div className="animate-fade-in max-w-3xl mx-auto">
            
            {/* Removed View Toggle, defaulting to SUBMIT view style */}
            
            <header className="mb-8 text-center">
                <h1 className="text-4xl font-bold text-white mb-3 drop-shadow-sm">Submit Waste Report</h1>
                <p className="text-slate-300 max-w-lg mx-auto text-lg">Help us keep the city clean by reporting waste with AI verification.</p>
            </header>

            <form onSubmit={handleSubmit} className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 overflow-hidden">
                
                {/* Section 1: Location */}
                <div className="p-6 md:p-8 border-b border-slate-200">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
                    <MapPinned className="text-white w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-slate-900">Location Data</h2>
                        <p className="text-xs text-slate-500">Geo-tagging ensures accurate cleanup.</p>
                    </div>
                </div>
                <LocationInput 
                    selectedCity={formData.centerCity}
                    onCityChange={(city) => handleInputChange('centerCity', city)}
                    selectedWasteType={formData.manualWasteType}
                    onWasteTypeChange={(type) => handleInputChange('manualWasteType', type)}
                    coordinates={formData.coordinates}
                    onLocationFound={(coords) => {
                        handleInputChange('coordinates', coords);
                        showToast("GPS Coordinates captured successfully!", "success");
                    }}
                />
                </div>

                {/* Section 2: Evidence */}
                <div className="p-6 md:p-8 border-b border-slate-200 bg-slate-50/50">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/30">
                    <CameraIcon className="text-white w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-slate-900">Visual Evidence</h2>
                        <p className="text-xs text-slate-500">AI will verify validity of the waste.</p>
                    </div>
                </div>
                
                <div className="mb-6">
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                    1. Live Video Capture (Mandatory) <span className="text-red-500">*</span>
                    </label>
                    <CameraCapture 
                    onCapture={(base64) => handleInputChange('photoBase64', base64)}
                    onRetake={() => handleInputChange('photoBase64', null)}
                    imageData={formData.photoBase64}
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2 flex items-center gap-2">
                        <Upload className="w-3 h-3" /> 2. Additional Photo (Optional)
                        </label>
                        <input 
                        type="file" 
                        accept="image/*" 
                        onChange={(e) => handleFileChange('additionalImage', e)}
                        className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:uppercase file:bg-emerald-100 file:text-emerald-700 hover:file:bg-emerald-200 transition cursor-pointer bg-white border border-slate-200 rounded-xl p-1"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2 flex items-center gap-2">
                        <Video className="w-3 h-3" /> 3. Video Evidence (Optional)
                        </label>
                        <input 
                        type="file" 
                        accept="video/*" 
                        onChange={(e) => handleFileChange('evidenceVideo', e)}
                        className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:uppercase file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200 transition cursor-pointer bg-white border border-slate-200 rounded-xl p-1"
                        />
                    </div>
                </div>
                </div>

                {/* Section 3: Reporter */}
                <div className="p-6 md:p-8 border-b border-slate-200">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/30">
                    <UserCircle className="text-white w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-slate-900">Reporter Profile</h2>
                        <p className="text-xs text-slate-500">Contact info for verification purposes.</p>
                    </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                        Full Name <span className="text-red-500">*</span>
                    </label>
                    <input 
                        type="text" 
                        required
                        value={formData.reporterName}
                        onChange={(e) => handleInputChange('reporterName', e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition bg-slate-50 focus:bg-white font-medium text-black"
                        placeholder="Your Name"
                    />
                    </div>
                    <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Contact Number</label>
                    <input 
                        type="tel" 
                        value={formData.reporterContact}
                        onChange={(e) => handleInputChange('reporterContact', e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition bg-slate-50 focus:bg-white font-medium text-black"
                        placeholder="+91 00000 00000"
                    />
                    </div>
                </div>
                
                <div className="mt-6 bg-amber-50 p-4 rounded-xl border border-amber-100">
                    <label className="block text-sm font-bold text-amber-900 mb-2">Is this an active hazard? (Verifier check)</label>
                    <div className="relative">
                        <select 
                            value={formData.isAware}
                            onChange={(e) => handleInputChange('isAware', e.target.value)}
                            className="w-full md:w-1/2 px-4 py-2 rounded-lg border border-amber-200 bg-white focus:ring-2 focus:ring-amber-500 outline-none cursor-pointer text-amber-900 font-medium"
                        >
                            <option value="Yes">Yes, I am aware</option>
                            <option value="No">No / Unsure</option>
                        </select>
                    </div>
                </div>
                </div>

                {/* Section 4: Description */}
                <div className="p-6 md:p-8 bg-slate-50">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-pink-600 flex items-center justify-center shadow-lg shadow-pink-500/30">
                    <FileText className="text-white w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-slate-900">Details</h2>
                        <p className="text-xs text-slate-500">Provide context for the cleanup team.</p>
                    </div>
                </div>
                <textarea 
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    rows={4}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-pink-500 focus:border-transparent outline-none transition resize-none bg-white font-medium text-black"
                    placeholder="Describe waste type, estimated volume, and accessibility..."
                />
                </div>

                {/* Footer Actions */}
                <div className="p-6 md:p-8 bg-white border-t border-slate-200 sticky bottom-0 z-10 shadow-[0_-8px_30px_rgba(0,0,0,0.04)]">
                <button 
                    type="submit" 
                    disabled={status === AppStatus.ANALYZING || status === AppStatus.SUBMITTING}
                    className={`w-full py-4 rounded-xl font-bold text-lg shadow-xl hover:shadow-2xl transition-all transform hover:-translate-y-1 flex items-center justify-center gap-2 ${
                        status === AppStatus.ANALYZING ? 'bg-slate-800 text-slate-300 cursor-wait' : 
                        'bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-500 hover:to-teal-500'
                    }`}
                >
                    {status === AppStatus.ANALYZING ? (
                        <>
                            <Sparkles className="w-5 h-5 animate-spin" /> Analyzing Evidence...
                        </>
                    ) : status === AppStatus.SUBMITTING ? (
                        <>Uploading Secure Report...</>
                    ) : (
                        <>
                            <Send className="w-5 h-5" /> Submit for Verification
                        </>
                    )}
                </button>
                </div>

            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
