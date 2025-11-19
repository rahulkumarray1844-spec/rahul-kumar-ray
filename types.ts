
export interface GeoCoordinates {
  latitude: number;
  longitude: number;
}

export interface WasteReportData {
  userRole: 'Citizen' | 'Volunteer' | 'Admin';
  centerCity: string;
  manualWasteType: string; // Added user selected waste type
  coordinates: GeoCoordinates | null;
  photoBase64: string | null;
  additionalImage: File | null;
  evidenceVideo: File | null;
  description: string;
  reporterName: string;
  reporterContact: string;
  isAware: string;
}

export interface AnalysisResult {
  isWaste: boolean;
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  wasteType: string;
  summary: string;
  // New detailed analysis fields
  materials: string[];
  isRecyclable: boolean;
  estimatedQuantity: string;
  cleanupRecommendation: string;
  confidenceScore: number;
}

export enum AppStatus {
  IDLE = 'IDLE',
  ANALYZING = 'ANALYZING',
  SUBMITTING = 'SUBMITTING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR'
}

export enum ReportStatus {
  PENDING = 'PENDING',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
  COLLECTED = 'COLLECTED'
}

export interface Report extends WasteReportData {
  id: string;
  userId: string; // Added to track who created the report
  status: ReportStatus;
  timestamp: number;
  aiAnalysis?: AnalysisResult;
}