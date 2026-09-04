export interface PeaRecord {
  [key: string]: string;
}

export interface CompactFields {
  fullName: string;
  address: string;
  ca: string;
  meter: string;
  phone: string;
  route: string;
  otherFields: { key: string; val: string }[];
}

export interface IndexedRecord {
  record: PeaRecord;
  rowMeterLower: string;
  rowCaLower: string;
  rowNameAddrNorm: string;
  rowAddressNorm: string;
  rowAddressSkel: string;
  rawSearchStr: string;
  pureMeterDigits: string;
  pureCaDigits: string;
  fullNameSkel: string;
  rowNameAddrSkel: string;
  lat: string | null;
  lon: string | null;
  compactFields: CompactFields;
  matchScore?: number;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
  results?: IndexedRecord[];
  extractedSummary?: string;
}

export interface HouseQueryParams {
  rawHouseNumber?: string; // e.g. "12/3", "5", "105/2"
  rawMooNumber?: string;   // e.g. "1", "10"
  textTerms: string[];     // other words e.g. ["ต.ท่าทอง"]
  hasAnyCriteria: boolean;
}

export interface PresetRecloser {
  id: string;
  name: string;
  substation?: string;
}

export interface RecloserLog {
  id: string;
  recloserId: string;        // เช่น "STT6R-31", "STT2R-31", ...
  recloserName: string;      // เช่น "ปั้มน้ำมัน ตัว 2", "4 แยกนาหมู", ...
  recordDate: string;        // "YYYY-MM-DD"
  recordTime: string;        // "HH:MM"
  
  // 1. Counter
  counterBR?: number;        // B/R
  counterA?: number;         // A
  counterB?: number;         // B
  counterC?: number;         // C
  counterG?: number;         // G
  
  // 2. Current (Ampere)
  currentA?: number;         // A (Ia)
  currentB?: number;         // B (Ib)
  currentC?: number;         // C (Ic)
  currentG?: number;         // G (Ig)
  
  notes?: string;
  createdAt: number;
}

export type ActiveTab = 'home' | 'search' | 'streetlight' | 'recloser';
