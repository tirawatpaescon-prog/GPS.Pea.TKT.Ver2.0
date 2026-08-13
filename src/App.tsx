import React, { useState, useEffect, useRef, useMemo } from 'react';
import Papa from 'papaparse';
import { SplashScreen } from './components/SplashScreen';
import { 
  User, 
  MapPin, 
  Zap, 
  Home, 
  Phone, 
  Compass, 
  Share2, 
  Check, 
  WifiOff, 
  Database, 
  Map, 
  Copy, 
  Sun, 
  Moon, 
  CloudDownload, 
  CheckCircle2, 
  Bot, 
  Send, 
  Sparkles, 
  Trash2,
  RefreshCw,
  Search,
  History,
  X
} from 'lucide-react';

import peaBotMascotImg from './assets/images/pea_bot_mascot_1786454271309.jpg';

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
  rawSearchStr: string;
  pureMeterDigits: string;
  pureCaDigits: string;
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

const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTsS3z2NT8lcdKRYE40bo1rPVIyc7EGJ0Hz5GkpWBD8STIpNzQS13sZAXSXn-1S90TWahJWLN2C_7Uj/pub?gid=1960280238&single=true&output=csv';

// Normalize Thai text for smart address matching
const normalizeThaiAddress = (text: string): string => {
  if (!text) return '';
  let s = text.toLowerCase();

  s = s.replace(/(หมู่บ้าน|หมู่ที่|หมู่|ม\.|ม)\s*0*(\d+)/g, 'ม.$2');
  s = s.replace(/ตำบล\s*/g, 'ต.');
  s = s.replace(/อำเภอ\s*/g, 'อ.');
  s = s.replace(/จังหวัด\s*/g, 'จ.');
  s = s.replace(/ถนน\s*/g, 'ถ.');
  s = s.replace(/ซอย\s*/g, 'ซ.');

  s = s.replace(/\s+/g, ' ').trim();
  return s;
};

// Phonetic & Vowel-insensitive Thai skeleton generator
const getThaiPhoneticSkeleton = (text: string): string => {
  if (!text) return '';
  let s = text.toLowerCase();
  
  // Remove tone marks and garun (่ ้ ๊ ๋ ็ ์)
  s = s.replace(/[\u0E48-\u0E4C]/g, '');
  
  // Unify interchangeable Thai vowels (ิ ี ึ ื -> ิ, ุ ู -> ุ, ะ า ำ -> ะ, เ แ โ ใ ไ -> เ)
  s = s.replace(/[ิีึื]/g, 'ิ');
  s = s.replace(/[ุู]/g, 'ุ');
  s = s.replace(/[ะาำ]/g, 'ะ');
  s = s.replace(/[เแโใไ]/g, 'เ');
  
  return s;
};

// Optimized Levenshtein distance calculation for fuzzy matching (1D array allocation for maximum speed)
const getLevenshteinDistance = (a: string, b: string): number => {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  let row = Array.from({ length: n + 1 }, (_, i) => i);
  let nextRow = new Array(n + 1);

  for (let i = 1; i <= m; i++) {
    nextRow[0] = i;
    const charA = a[i - 1];
    for (let j = 1; j <= n; j++) {
      const cost = charA === b[j - 1] ? 0 : 1;
      nextRow[j] = Math.min(
        row[j] + 1,        // deletion
        nextRow[j - 1] + 1,// insertion
        row[j - 1] + cost  // substitution
      );
    }
    for (let k = 0; k <= n; k++) {
      row[k] = nextRow[k];
    }
  }

  return row[n];
};

// Calculate Thai name / string similarity percentage (85% - 100%)
const calculateThaiSimilarity = (query: string, fullName: string, normRowText: string): number => {
  if (!query) return 0;
  const qNorm = query.toLowerCase().trim();
  const fNorm = (fullName || '').toLowerCase().trim();
  const rowNorm = (normRowText || '').toLowerCase().trim();

  // 1. Direct exact substring match -> 100%
  if (fNorm.includes(qNorm) || rowNorm.includes(qNorm)) {
    return 100;
  }

  // Fast pre-check: if query first character is completely absent from both fields, skip heavy Levenshtein
  const firstChar = qNorm.charAt(0);
  if (firstChar && !fNorm.includes(firstChar) && !rowNorm.includes(firstChar)) {
    return 0;
  }

  // 2. Thai Phonetic / Vowel Skeleton Comparison (e.g. วิรัช vs วีรัช, วึรัช, วืรัช)
  const qSkel = getThaiPhoneticSkeleton(qNorm);
  const fSkel = getThaiPhoneticSkeleton(fNorm);

  if (qSkel.length >= 2 && fSkel.length >= 2) {
    if (fSkel.includes(qSkel)) {
      const ratio = qSkel.length / Math.max(qSkel.length, fSkel.length);
      return Math.round(95 + ratio * 5); // 95% - 100%
    }
  }

  // 3. Word token comparison with Levenshtein Distance
  const qTokens = qNorm.split(/\s+/).filter(Boolean);
  const fTokens = fNorm.split(/\s+/).filter(Boolean);

  let bestMatch = 0;

  for (const qTok of qTokens) {
    const qTokSkel = getThaiPhoneticSkeleton(qTok);
    if (qTokSkel.length < 2) continue;

    for (const fTok of fTokens) {
      const fTokSkel = getThaiPhoneticSkeleton(fTok);
      if (fTokSkel.length < 2) continue;

      // Skip Levenshtein if length difference is too large (> 3 chars)
      if (Math.abs(qTokSkel.length - fTokSkel.length) > 3) continue;

      if (fTokSkel === qTokSkel) {
        if (98 > bestMatch) bestMatch = 98;
      } else if (fTokSkel.includes(qTokSkel) || qTokSkel.includes(fTokSkel)) {
        const lenDiff = Math.abs(fTokSkel.length - qTokSkel.length);
        const score = Math.max(95, 99 - lenDiff * 2);
        if (score > bestMatch) bestMatch = score;
      } else {
        const dist = getLevenshteinDistance(qTokSkel, fTokSkel);
        const maxLen = Math.max(qTokSkel.length, fTokSkel.length);
        if (maxLen > 0) {
          const sim = Math.round((1 - dist / maxLen) * 100);
          if (sim >= 95 && sim > bestMatch) {
            bestMatch = sim;
          }
        }
      }
    }
  }

  return bestMatch;
};

// Resolve latitude & longitude from dynamic CSV headers
const resolveCoordinates = (record: PeaRecord) => {
  let lat: string | null = null;
  let lon: string | null = null;

  for (const [key, value] of Object.entries(record)) {
    const normKey = key.toLowerCase().trim();
    const valStr = value?.toString().trim();
    if (!valStr) continue;

    if (
      normKey === 'lat' ||
      normKey === 'latitude' ||
      normKey.includes('ละติจูด') ||
      normKey === 'y' ||
      normKey.includes('พิกัด y') ||
      normKey.includes('latitude_y')
    ) {
      if (!isNaN(parseFloat(valStr))) lat = valStr;
    }

    if (
      normKey === 'lon' ||
      normKey === 'lng' ||
      normKey === 'longitude' ||
      normKey.includes('ลองจิจูด') ||
      normKey === 'x' ||
      normKey.includes('พิกัด x') ||
      normKey.includes('longitude_x')
    ) {
      if (!isNaN(parseFloat(valStr))) lon = valStr;
    }
  }

  if (!lat || !lon) {
    for (const [key, value] of Object.entries(record)) {
      const normKey = key.toLowerCase().trim();
      const valStr = value?.toString().trim();
      if (!valStr) continue;

      if (!lat && (normKey.includes('lat') || normKey.includes('ละติ'))) {
        if (!isNaN(parseFloat(valStr))) lat = valStr;
      }
      if (!lon && (normKey.includes('lon') || normKey.includes('lng') || normKey.includes('ลองจิ'))) {
        if (!isNaN(parseFloat(valStr))) lon = valStr;
      }
    }
  }

  return { lat, lon };
};

const getPrimaryTitle = (record: PeaRecord): string => {
  const titleKeys = ['ชื่อ', 'ชื่อ-นามสกุล', 'ชื่อ - นามสกุล', 'ผู้ใช้ไฟ', 'name', 'customer', 'ชื่อผู้ใช้ไฟ', 'รายละเอียด'];
  for (const key of titleKeys) {
    const foundKey = Object.keys(record).find(k => k.toLowerCase().trim().includes(key));
    if (foundKey && record[foundKey]) {
      return record[foundKey];
    }
  }
  return Object.values(record)[0] || 'ข้อมูลผู้ใช้ไฟฟ้า PEA';
};

const extractCompactFields = (record: PeaRecord): CompactFields => {
  let fullName = '';
  let firstName = '';
  let lastName = '';
  let addressParts: string[] = [];
  let ca = '';
  let meter = '';
  let phone = '';
  let route = '';
  let otherFields: { key: string; val: string }[] = [];

  for (const [key, val] of Object.entries(record)) {
    if (!val) continue;
    const v = String(val).trim();
    if (!v) continue;
    const kNorm = key.toLowerCase().trim();

    if (
      kNorm.includes('ชื่อ-นามสกุล') ||
      kNorm.includes('ชื่อนามสกุล') ||
      kNorm.includes('ชื่อผู้ใช้ไฟ') ||
      kNorm === 'name' ||
      kNorm === 'fullname'
    ) {
      fullName = v;
    } else if (kNorm === 'ชื่อ' || kNorm.includes('first name') || kNorm === 'fname') {
      firstName = v;
    } else if (kNorm === 'นามสกุล' || kNorm.includes('last name') || kNorm === 'lname') {
      lastName = v;
    } else if (
      kNorm.includes('ที่อยู่') ||
      kNorm.includes('บ้านเลขที่') ||
      kNorm.includes('หมู่') ||
      kNorm.includes('ตำบล') ||
      kNorm.includes('อำเภอ') ||
      kNorm.includes('address')
    ) {
      addressParts.push(v);
    } else if (
      kNorm.includes('ca') ||
      kNorm.includes('บัญชี') ||
      kNorm.includes('contract') ||
      kNorm.includes('เลขผู้ใช้ไฟ') ||
      kNorm.includes('รหัสคู่ค้า') ||
      kNorm === 'bp' ||
      kNorm === 'account'
    ) {
      if (!ca) ca = v;
    } else if (
      kNorm.includes('meter') ||
      kNorm.includes('เครื่องวัด') ||
      kNorm.includes('มิเตอร์') ||
      kNorm === 'pea meter'
    ) {
      if (!meter) meter = v;
    } else if (
      kNorm.includes('เบอร์') ||
      kNorm.includes('โทร') ||
      kNorm.includes('phone') ||
      kNorm.includes('tel') ||
      kNorm.includes('mobile')
    ) {
      if (!phone) phone = v;
    } else if (
      kNorm.includes('สาย') ||
      kNorm.includes('เส้นทาง') ||
      kNorm.includes('route') ||
      kNorm.includes('สายการอ่าน') ||
      kNorm.includes('mr')
    ) {
      if (!route) route = v;
    } else if (
      kNorm !== 'lat' &&
      kNorm !== 'latitude' &&
      !kNorm.includes('ละติจูด') &&
      kNorm !== 'lon' &&
      kNorm !== 'lng' &&
      kNorm !== 'longitude' &&
      !kNorm.includes('ลองจิจูด') &&
      kNorm !== 'x' &&
      kNorm !== 'y'
    ) {
      otherFields.push({ key, val: v });
    }
  }

  const uniqueAddressParts = Array.from(new Set(addressParts));
  // Filter out shorter address parts that are already substrings of longer address parts
  const cleanedParts = uniqueAddressParts.filter((part) => {
    return !uniqueAddressParts.some((other) => other !== part && other.length > part.length && other.includes(part));
  });

  let address = cleanedParts.join(' ');

  // Clean trailing house numbers or duplicate digits appended after Province name (e.g. จ.xxx 123/4)
  if (/จ\.|จังหวัด|อ\.|อำเภอ/.test(address)) {
    address = address.replace(/(จ\.[^\s\d]+|จังหวัด[^\s\d]+)(\s+[\d\/\-\.\w]+)+$/, '$1');
  }

  const finalFullName = lastName ? `${firstName} ${lastName}` : firstName;

  return {
    fullName: fullName || finalFullName || getPrimaryTitle(record),
    address,
    ca,
    meter,
    phone,
    route,
    otherFields
  };
};

// 3D Mascot Banner Component
const PeaBot3DMascot = ({ isThinking }: { isThinking: boolean }) => {
  return (
    <div className="bg-gradient-to-r from-purple-900/60 via-slate-900 to-indigo-900/60 border border-purple-500/30 rounded-2xl p-2.5 mb-2 flex items-center gap-3 relative overflow-hidden shadow-lg backdrop-blur-sm group">
      {/* Background Animated Glow */}
      <div className={`absolute -right-6 -bottom-6 w-24 h-24 rounded-full blur-xl transition-all duration-500 ${isThinking ? 'bg-amber-500/40 animate-pulse scale-125' : 'bg-sky-500/20'}`} />
      
      {/* 3D Mascot Character Frame */}
      <div className="relative shrink-0">
        <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl overflow-hidden border-2 transition-all duration-300 shadow-lg ${isThinking ? 'border-amber-400 animate-bounce scale-105' : 'border-sky-400 group-hover:scale-105'}`}>
          <img 
            src={peaBotMascotImg} 
            alt="3D PEA Bot Mascot" 
            className={`w-full h-full object-cover transition-all duration-300 ${isThinking ? 'brightness-110 contrast-125' : ''}`}
          />
        </div>
        {/* Animated Status Lightning Badge */}
        <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center border text-[10px] shadow-sm ${isThinking ? 'bg-amber-400 border-yellow-200 text-slate-950 animate-spin' : 'bg-emerald-400 border-emerald-200 text-slate-950 animate-pulse'}`}>
          ⚡
        </div>
      </div>

      {/* Mascot Animated Speech Bubble */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-xs font-black text-amber-300 font-display">น้อง PEA Bot 3D</span>
          <span className={`text-[8px] px-1.5 py-0.2 rounded-full font-bold ${isThinking ? 'bg-amber-400/30 text-amber-300 animate-pulse border border-amber-400/50' : 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/30'}`}>
            {isThinking ? 'กำลังค้นหา...' : 'พร้อมลุย!'}
          </span>
        </div>
        <p className="text-[11px] font-medium text-slate-200 leading-snug truncate">
          {isThinking ? 'กำลังสแกนหาพิกัดให้อยู่คร้าบ แป๊บเดียวนะ! ⚡' : 'พิมพ์ CA, Meter หรือชื่อบ้านเลขที่ส่งมาเลยครับ! 😎'}
        </p>
      </div>
    </div>
  );
};

export default function App() {
  const [chatInputText, setChatInputText] = useState('');
  const [isAiThinking, setIsAiThinking] = useState(false);
  const WELCOME_MSG_TEXT = 'หวัดดีครับ! น้อง PEA Bot พร้อมลุยแล้วจ้า ⚡\n\nพิมพ์ **เลข CA** (ขึ้นต้นด้วย 200), **เลข PEA Meter**, หรือ **ชื่อ/บ้านเลขที่** ส่งมาได้เลย เดี๋ยวผมสแกนหาพิกัดให้อย่างจ๊าบเลยครับ! 😎';

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-msg',
      sender: 'ai',
      text: WELCOME_MSG_TEXT,
      timestamp: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allRecords, setAllRecords] = useState<PeaRecord[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<'live' | 'cached' | 'error'>('cached');
  const [lastSyncFullDate, setLastSyncFullDate] = useState<string | null>(() => {
    try {
      return localStorage.getItem('pea_records_cache_fulldate');
    } catch {
      return null;
    }
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [copiedIndex, setCopiedIndex] = useState<string | number | null>(null);
  const [showSplash, setShowSplash] = useState<boolean>(true);

  // Theme state
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('pea_theme') === 'dark';
    } catch {
      return true; // Default to sleek dark mode for high readability in field work
    }
  });

  // Search History state backed by localStorage
  const [searchHistory, setSearchHistory] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('pea_search_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const addToSearchHistory = (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    setSearchHistory((prev) => {
      const filtered = prev.filter((item) => item.toLowerCase() !== trimmed.toLowerCase());
      const updated = [trimmed, ...filtered].slice(0, 10);
      try {
        localStorage.setItem('pea_search_history', JSON.stringify(updated));
      } catch (err) {
        console.error(err);
      }
      return updated;
    });
  };

  const clearSearchHistory = () => {
    setSearchHistory([]);
    try {
      localStorage.removeItem('pea_search_history');
    } catch (err) {
      console.error(err);
    }
  };

  const removeSearchHistoryItem = (itemToRemove: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSearchHistory((prev) => {
      const updated = prev.filter((item) => item !== itemToRemove);
      try {
        localStorage.setItem('pea_search_history', JSON.stringify(updated));
      } catch (err) {
        console.error(err);
      }
      return updated;
    });
  };

  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      try {
        localStorage.setItem('pea_theme', 'dark');
      } catch (e) {
        console.warn('Could not save theme:', e);
      }
    } else {
      document.documentElement.classList.remove('dark');
      try {
        localStorage.setItem('pea_theme', 'light');
      } catch (e) {
        console.warn('Could not save theme:', e);
      }
    }
  }, [isDarkMode]);

  const toggleTheme = () => setIsDarkMode((prev) => !prev);

  // Pre-index records for fast client search
  const indexedRecords = useMemo<IndexedRecord[]>(() => {
    return allRecords.map((row) => {
      let rowMeterStr = '';
      let rowCaStr = '';
      let rowNameAddrStr = '';

      for (const [key, val] of Object.entries(row)) {
        if (!val) continue;
        const v = String(val).trim();
        if (!v) continue;
        const kNorm = key.toLowerCase().trim();

        if (
          kNorm === 'lat' || kNorm === 'latitude' || kNorm.includes('ละติจูด') ||
          kNorm === 'lon' || kNorm === 'lng' || kNorm === 'longitude' || kNorm.includes('ลองจิจูด') ||
          kNorm === 'x' || kNorm === 'y'
        ) {
          continue;
        }

        if (
          kNorm.includes('meter') || kNorm.includes('เครื่องวัด') || kNorm.includes('มิเตอร์') ||
          kNorm.includes('amp') || kNorm.includes('แอมป์') || kNorm.includes('serial') || kNorm.includes('มต') ||
          kNorm === 'pea meter' || kNorm.includes('pea')
        ) {
          rowMeterStr += ` ${v}`;
        } else if (
          kNorm.includes('ca') || kNorm.includes('บัญชี') || kNorm.includes('contract') ||
          kNorm.includes('เลขผู้ใช้ไฟ') || kNorm.includes('รหัสคู่ค้า') || kNorm.includes('เลขคู่ค้า') ||
          kNorm === 'bp' || kNorm === 'account'
        ) {
          rowCaStr += ` ${v}`;
        } else {
          rowNameAddrStr += ` ${v}`;
        }
      }

      const coords = resolveCoordinates(row);
      const compactFields = extractCompactFields(row);

      if (compactFields.meter) rowMeterStr += ` ${compactFields.meter}`;
      if (compactFields.ca) rowCaStr += ` ${compactFields.ca}`;

      const rawSearchStr = Object.values(row)
        .map((v) => (v ? String(v).trim().toLowerCase() : ''))
        .filter(Boolean)
        .join(' ');

      return {
        record: row,
        rowMeterLower: rowMeterStr.toLowerCase(),
        rowCaLower: rowCaStr.toLowerCase(),
        rowNameAddrNorm: normalizeThaiAddress(rowNameAddrStr).toLowerCase(),
        rawSearchStr,
        pureMeterDigits: rowMeterStr.replace(/[^0-9a-zA-Z]/g, '').toLowerCase(),
        pureCaDigits: rowCaStr.replace(/[^0-9a-zA-Z]/g, '').toLowerCase(),
        lat: coords.lat,
        lon: coords.lon,
        compactFields
      };
    });
  }, [allRecords]);

  // Scroll to bottom when new chat messages arrive
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages, isAiThinking]);

  // Listen for network status
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Fetch Google Sheets Database
  const fetchDatabase = async (forceRefresh = false): Promise<PeaRecord[]> => {
    const localCacheStr = localStorage.getItem('pea_records_cache');
    const localCacheTime = localStorage.getItem('pea_records_cache_time');
    const localCacheFullDate = localStorage.getItem('pea_records_cache_fulldate');

    try {
      let csvText = '';
      const targetUrl = forceRefresh ? `${CSV_URL}&_t=${Date.now()}` : CSV_URL;
      
      try {
        const response = await fetch(targetUrl, { cache: forceRefresh ? 'no-cache' : 'default' });
        if (!response.ok) throw new Error(`HTTP Error ${response.status}`);
        csvText = await response.text();
      } catch (directErr) {
        csvText = await new Promise<string>((resolve, reject) => {
          Papa.parse(targetUrl, {
            download: true,
            complete: (results) => {
              if (results.data && Array.isArray(results.data) && results.data.length > 0) {
                resolve(Papa.unparse(results.data));
              } else {
                reject(new Error('ไม่สามารถดึงข้อมูลได้'));
              }
            },
            error: (err) => reject(err)
          });
        });
      }

      return new Promise<PeaRecord[]>((resolve, reject) => {
        Papa.parse(csvText, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            const data = (results.data as PeaRecord[]).filter(
              (r) => r && Object.values(r).some((v) => v && String(v).trim() !== '')
            );

            if (data && data.length > 0) {
              setAllRecords(data);
              const nowShort = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
              const nowFull = new Date().toLocaleDateString('th-TH', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              });

              setLastUpdated(nowShort);
              setLastSyncFullDate(nowFull);
              setSyncStatus('live');

              try {
                localStorage.setItem('pea_records_cache', JSON.stringify(data));
                localStorage.setItem('pea_records_cache_time', nowShort);
                localStorage.setItem('pea_records_cache_fulldate', nowFull);
              } catch (e) {
                console.warn('LocalStorage Cache warning:', e);
              }
              resolve(data);
            } else {
              reject(new Error('ข้อมูล CSV ว่างเปล่า'));
            }
          },
          error: () => reject(new Error('อ่านไฟล์ CSV ล้มเหลว'))
        });
      });
    } catch (err: any) {
      if (localCacheStr) {
        try {
          const cachedData = JSON.parse(localCacheStr) as PeaRecord[];
          if (cachedData && cachedData.length > 0) {
            setAllRecords(cachedData);
            if (localCacheTime) setLastUpdated(localCacheTime);
            if (localCacheFullDate) setLastSyncFullDate(localCacheFullDate);
            setSyncStatus('cached');
            return cachedData;
          }
        } catch (e) {
          console.error('Parsed cache error:', e);
        }
      }

      setSyncStatus('error');
      throw err;
    }
  };

  const handleForceSync = async () => {
    setIsSyncing(true);
    setLoading(true);
    try {
      const data = await fetchDatabase(true);
      setError(null);
    } catch (err: any) {
      setError(`ซิงก์ข้อมูลขัดข้อง: ${err?.message || 'โปรดตรวจสอบการเชื่อมต่อ'}`);
    } finally {
      setIsSyncing(false);
      setLoading(false);
    }
  };

  // Launch initial load
  useEffect(() => {
    const localCacheStr = localStorage.getItem('pea_records_cache');
    if (localCacheStr) {
      try {
        const cached = JSON.parse(localCacheStr) as PeaRecord[];
        if (cached && cached.length > 0) setAllRecords(cached);
      } catch (e) {}
    }

    setLoading(true);
    fetchDatabase(true)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Smart Filtering Engine with Unified Search across CA, PEA Meter, Name, Surname, House No., and Address
  const smartFilterRecords = (queryText: string, meter?: string | null, ca?: string | null, addressName?: string | null): { matched: IndexedRecord[]; summaryLabel: string; detectedType: string } => {
    const raw = queryText.trim().toLowerCase();
    if (!raw && !meter && !ca && !addressName) {
      return { matched: [], summaryLabel: '', detectedType: 'text' };
    }

    const pureDigits = raw.replace(/[^0-9a-zA-Z]/g, '');
    const normQ = normalizeThaiAddress(raw).toLowerCase();
    const terms = normQ.split(/\s+/).filter(Boolean);
    const rawTerms = raw.split(/\s+/).filter(Boolean);

    let searchMeter = meter ? meter.trim().toLowerCase() : null;
    let searchCa = ca ? ca.trim().toLowerCase() : null;
    let detectedType = 'text';

    if (searchCa) {
      detectedType = 'ca';
    } else if (searchMeter) {
      detectedType = 'meter';
    } else if (pureDigits.startsWith('200') || pureDigits.length >= 10) {
      detectedType = 'ca';
    } else if (pureDigits.length >= 4 && /^\d+$/.test(pureDigits) && !/[a-zA-Zก-ฮ]/.test(raw) && !raw.includes('/')) {
      detectedType = 'meter';
    } else if (raw.includes('/') || /\d+/.test(raw)) {
      detectedType = 'address';
    } else {
      detectedType = 'name';
    }

    const matched: IndexedRecord[] = [];

    for (let i = 0; i < indexedRecords.length; i++) {
      const item = indexedRecords[i];
      let score = 0;

      // 1. Explicit CA argument passed
      if (searchCa) {
        const caDigits = searchCa.replace(/[^0-9a-zA-Z]/g, '');
        if (
          item.rowCaLower.includes(searchCa) ||
          (caDigits && item.pureCaDigits.includes(caDigits)) ||
          (item.compactFields.ca && item.compactFields.ca.toLowerCase().includes(searchCa))
        ) {
          score = 100;
        }
      } else if (searchMeter) {
        // 2. Explicit Meter argument passed
        const meterDigits = searchMeter.replace(/[^0-9a-zA-Z]/g, '');
        if (
          item.rowMeterLower.includes(searchMeter) ||
          (meterDigits && item.pureMeterDigits.includes(meterDigits)) ||
          (item.compactFields.meter && item.compactFields.meter.toLowerCase().includes(searchMeter))
        ) {
          score = 100;
        }
      } else {
        // 3. Unified All-Field Search (CA, Meter, Name, Surname, House No., Address, All CSV cells)

        // A. Check PEA Meter Match
        if (
          pureDigits.length >= 3 &&
          (item.rowMeterLower.includes(raw) ||
            (pureDigits && item.pureMeterDigits.includes(pureDigits)) ||
            (item.compactFields.meter && item.compactFields.meter.toLowerCase().includes(raw)))
        ) {
          score = 100;
        }

        // B. Check CA Match
        if (
          score < 100 &&
          pureDigits.length >= 4 &&
          (item.rowCaLower.includes(raw) ||
            (pureDigits && item.pureCaDigits.includes(pureDigits)) ||
            (item.compactFields.ca && item.compactFields.ca.toLowerCase().includes(raw)))
        ) {
          score = 100;
        }

        // C. Check Full Substring or Terms Match across ALL row fields (House No., Address, Name, Surname, etc.)
        if (score < 100) {
          if (
            item.rawSearchStr.includes(raw) ||
            item.rowNameAddrNorm.includes(raw) ||
            item.rowNameAddrNorm.includes(normQ)
          ) {
            score = 100;
          } else if (rawTerms.length > 0 && rawTerms.every((t) => item.rawSearchStr.includes(t))) {
            score = 100;
          } else if (terms.length > 0 && terms.every((t) => item.rowNameAddrNorm.includes(t))) {
            score = 100;
          }
        }

        // D. Fallback to Thai Phonetic Fuzzy Matching for Names / Surnames
        if (score < 100) {
          const thaiScore = calculateThaiSimilarity(raw, item.compactFields.fullName, item.rowNameAddrNorm);
          if (thaiScore >= 95) {
            score = thaiScore;
          }
        }
      }

      if (score >= 95) {
        matched.push({ ...item, matchScore: score });
      }
    }

    // Sort matched records by highest similarity score first
    matched.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));

    let summaryLabel = '';
    if (detectedType === 'ca') {
      summaryLabel = `📌 ค้นหาเลขผู้ใช้ไฟ CA (${matched.length} รายการ)`;
    } else if (detectedType === 'meter') {
      summaryLabel = `⚡ ค้นหาเลขเครื่องวัด PEA Meter (${matched.length} รายการ)`;
    } else if (detectedType === 'address') {
      summaryLabel = `🏠 ค้นหาบ้านเลขที่/ที่อยู่ (${matched.length} รายการ)`;
    } else {
      summaryLabel = `🔍 ผลลัพธ์ตรงกัน 95-100% (${matched.length} รายการ)`;
    }

    return { matched, summaryLabel, detectedType };
  };

  // Instant Chat submit handler (Non-blocking UI execution for 0ms INP)
  const handleSendChatMessage = (e?: React.FormEvent, customQuery?: string) => {
    if (e) e.preventDefault();
    const textToSend = (customQuery !== undefined ? customQuery : chatInputText).trim();
    if (!textToSend || isAiThinking) return;

    addToSearchHistory(textToSend);

    // 1. Instantly append user message & clear input field (0ms frame update)
    const userMsgId = Date.now().toString();
    const userMsg: ChatMessage = {
      id: userMsgId,
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
    };

    setChatInputText('');
    setIsAiThinking(true);
    setChatMessages((prev) => [...prev, userMsg]);

    // 2. Yield to browser render thread before running search logic (solves INP input blocking)
    setTimeout(() => {
      const { matched: matchedResults, summaryLabel, detectedType } = smartFilterRecords(textToSend);

      const topMatch = matchedResults[0];
      let confidenceNote = '';
      if (topMatch && topMatch.matchScore && topMatch.matchScore < 100 && topMatch.matchScore >= 95) {
        confidenceNote = `\n(💡 สแกนพบชื่อที่ใกล้เคียงด้วยความแม่นยำประมาณ **${topMatch.matchScore}%**)`;
      }

      // 3. Generate instant fun, friendly bot response locally
      let funReply = '';
      if (matchedResults.length > 0) {
        const greetings = [
          `จัดไปครับผม! น้อง PEA Bot สแกนเจอพิกัด **${matchedResults.length} รายการ** ลุยหน้างานได้เลยคร้าบ! ⚡`,
          `เรียบร้อยแล้วจ้า! สแกนพบพิกัดผู้ใช้ไฟ **${matchedResults.length} รายการ** ดูกดนำทาง Google Maps ด้านล่างได้เลยครับ 😎`,
          `เจอแล้วครับป๋า! น้อง PEA Bot ค้นหาพิกัดมาให้ **${matchedResults.length} รายการ** พร้อมพิกัดจีพีเอสเลยครับ! 🚀`
        ];
        funReply = greetings[Math.floor(Math.random() * greetings.length)];
      } else {
        if (detectedType === 'ca') {
          funReply = `อ๊ะ... น้อง PEA Bot ลองสแกนเลข CA "${textToSend}" แล้ว ไม่พบในฐานข้อมูลเลยครับ ลองเช็คตัวเลขอีกทีนะฮะ! 🔍`;
        } else if (detectedType === 'meter') {
          funReply = `อ๊ะ... ลองสแกนเลข Meter "${textToSend}" แล้ว ไม่พบพิกัดเลยครับ ลองเช็คเลขเครื่องวัดอีกครั้งนะฮะ! ⚡`;
        } else {
          funReply = `น้อง PEA Bot สแกนดูแล้ว ไม่พบพิกัดที่ตรงหรือใกล้เคียงกับ "${textToSend}" ครับ ลองพิมพ์ชื่อ/ที่อยู่ใหม่ดูนะฮะ! 📌`;
        }
      }

      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: `${funReply}${confidenceNote}`,
        timestamp: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
        results: matchedResults,
        extractedSummary: summaryLabel
      };

      setChatMessages((prev) => [...prev, aiMsg]);
      setIsAiThinking(false);
    }, 16);
  };

  const clearChatHistory = () => {
    setChatMessages([
      {
        id: 'welcome-msg',
        sender: 'ai',
        text: WELCOME_MSG_TEXT,
        timestamp: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
      }
    ]);
  };

  const openGoogleMaps = (lat: string, lon: string) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const copyCoordinates = (fields: CompactFields, lat: string | null, lon: string | null, indexKey: string | number) => {
    const mapsUrl = (lat && lon) ? `https://www.google.com/maps?q=${lat},${lon}` : '-';
    const textToCopy = [
      `ชื่อ นามสกุล: ${fields.fullName || '-'}`,
      `ที่อยู่: ${fields.address || '-'}`,
      `Pea meter: ${fields.meter || '-'}`,
      `CA: ${fields.ca || '-'}`,
      `Google map: ${mapsUrl}`
    ].join('\n');

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(textToCopy).then(() => {
        setCopiedIndex(indexKey);
        setTimeout(() => setCopiedIndex(null), 2500);
      });
    } else {
      const textArea = document.createElement('textarea');
      textArea.value = textToCopy;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopiedIndex(indexKey);
      setTimeout(() => setCopiedIndex(null), 2500);
    }
  };

  const shareCoordinates = (fields: CompactFields, lat: string | null, lon: string | null) => {
    const mapsUrl = (lat && lon) ? `https://www.google.com/maps?q=${lat},${lon}` : '-';
    const text = [
      `ชื่อ นามสกุล: ${fields.fullName || '-'}`,
      `ที่อยู่: ${fields.address || '-'}`,
      `Pea meter: ${fields.meter || '-'}`,
      `CA: ${fields.ca || '-'}`,
      `Google map: ${mapsUrl}`
    ].join('\n');

    if (navigator.share) {
      navigator.share({
        title: `พิกัด PEA - ${fields.fullName || 'ผู้ใช้ไฟ'}`,
        text: text
      }).catch(() => {});
    } else {
      copyCoordinates(fields, lat, lon, 'share');
      alert('คัดลอกข้อความพิกัดสำหรับแชร์แล้ว:\n\n' + text);
    }
  };

  return (
    <>
      {showSplash && <SplashScreen onComplete={() => setShowSplash(false)} />}
      <div className="min-h-screen bg-[#0B0F19] dark:bg-[#070A12] text-slate-100 font-sans flex flex-col items-center justify-between p-2 sm:p-4 select-none transition-colors duration-300">
      
      {/* MOBILE-FIRST HEADER */}
      <header className="w-full max-w-lg mb-2">
        <div className="bg-slate-900/95 dark:bg-slate-950/95 border-2 border-slate-800 dark:border-sky-500/50 rounded-2xl p-2.5 shadow-lg flex items-center justify-between gap-2">
          
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-10 h-10 rounded-xl border-2 border-sky-400 overflow-hidden shrink-0 shadow-md transform hover:rotate-6 transition-all bg-slate-950">
              <img src={peaBotMascotImg} alt="PEA Bot 3D" className="w-full h-full object-cover" />
            </div>
            
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="text-sm font-black text-white tracking-tight font-display truncate">
                  GPS.Pea.TKT
                </h1>
                <span className="text-[9px] bg-sky-500/20 text-sky-300 border border-sky-400/30 px-1.5 py-0.2 rounded-full font-mono font-bold">
                  AI 3D Bot
                </span>
              </div>
              <p className="text-[10px] font-bold text-slate-400 truncate">
                สแกนพิกัดผู้ใช้ไฟ PEA {allRecords.length ? `(${allRecords.length.toLocaleString()} รายการ)` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {/* Force Sync Button */}
            <button
              type="button"
              disabled={loading || isSyncing}
              onClick={handleForceSync}
              className="p-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-sky-300 rounded-xl border border-slate-700 transition-all cursor-pointer"
              title="บังคับซิงก์ข้อมูลสดจาก Google Sheets"
            >
              <CloudDownload className={`w-4 h-4 ${isSyncing ? 'animate-bounce text-yellow-300' : ''}`} />
            </button>

            {/* Clear Chat Button */}
            <button
              type="button"
              onClick={clearChatHistory}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-rose-400 rounded-xl border border-slate-700 transition-all cursor-pointer"
              title="ล้างแชท"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            {/* Replay Splash Animation Button */}
            <button
              type="button"
              onClick={() => setShowSplash(true)}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-purple-300 rounded-xl border border-slate-700 transition-all cursor-pointer"
              title="ดูอนิเมชั่นต้อนรับ (Splash Screen)"
            >
              <Sparkles className="w-4 h-4 text-purple-300" />
            </button>

            {/* Dark Mode Toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-xl border border-slate-700 transition-all cursor-pointer"
              title="สลับธีม"
            >
              {isDarkMode ? <Sun className="w-4 h-4 text-amber-300" /> : <Moon className="w-4 h-4 text-sky-300" />}
            </button>
          </div>
        </div>
      </header>

      {/* SYNC & NETWORK STATUS BAR */}
      <section className="w-full max-w-lg mb-2">
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl px-3 py-1.5 flex items-center justify-between text-[10px] font-bold text-slate-400">
          <div className="flex items-center gap-1.5 truncate">
            <span className={`w-2 h-2 rounded-full ${syncStatus === 'live' ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'}`}></span>
            <span className="text-slate-300">ซิงก์ล่าสุด: {lastSyncFullDate || lastUpdated || 'ยังไม่อัปเดต'}</span>
          </div>
          {isOffline ? (
            <span className="text-amber-400 flex items-center gap-1 shrink-0 font-black">
              <WifiOff className="w-3 h-3" /> Offline
            </span>
          ) : (
            <span className="text-emerald-400 flex items-center gap-1 shrink-0 font-black">
              <CheckCircle2 className="w-3 h-3" /> Online
            </span>
          )}
        </div>
      </section>

      {/* CHAT CONTAINER - MOBILE SCALED */}
      <main className="w-full max-w-lg flex-1 bg-slate-900/90 dark:bg-slate-950/90 border border-slate-800 dark:border-slate-800 rounded-2xl shadow-xl flex flex-col overflow-hidden mb-2 relative">
        
        {/* MESSAGES SCROLL AREA */}
        <div 
          ref={chatContainerRef}
          className="flex-1 p-3 overflow-y-auto space-y-3.5 h-[calc(100vh-220px)] min-h-[380px] max-h-[72vh] scroll-smooth"
        >
          {/* Top 3D Animated Mascot Widget */}
          <PeaBot3DMascot isThinking={isAiThinking} />

          {chatMessages.map((msg) => (
            <div 
              key={msg.id} 
              className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'} animate-fadeIn`}
            >
              <div className={`flex items-start gap-2 max-w-[92%] ${msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                
                {/* Avatar */}
                {msg.sender === 'user' ? (
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border bg-indigo-600 border-indigo-400 text-white">
                    <User className="w-3.5 h-3.5" />
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-xl overflow-hidden shrink-0 border-2 border-sky-400 shadow-md bg-slate-950 transform hover:scale-105 transition-transform">
                    <img src={peaBotMascotImg} alt="3D Mascot" className="w-full h-full object-cover" />
                  </div>
                )}

                {/* Bubble */}
                <div className={`p-2.5 sm:p-3 rounded-2xl text-xs sm:text-sm font-medium leading-relaxed ${
                  msg.sender === 'user'
                    ? 'bg-indigo-600 text-white border border-indigo-500 rounded-tr-none shadow-sm'
                    : 'bg-slate-800/90 text-slate-100 border border-slate-700/80 rounded-tl-none shadow-sm'
                }`}>
                  
                  <div className="whitespace-pre-line break-words">
                    {msg.text}
                  </div>

                  {msg.extractedSummary && (
                    <div className="mt-2 pt-1.5 border-t border-slate-700/60 flex items-center gap-1 text-[11px] font-black text-sky-300">
                      <Sparkles className="w-3 h-3 text-yellow-400 shrink-0" />
                      <span>{msg.extractedSummary}</span>
                    </div>
                  )}

                  {/* EMBEDDED MOBILE RESULT CARDS */}
                  {msg.results && msg.results.length > 0 && (
                    <div className="mt-2.5 pt-2 border-t border-slate-700 space-y-2">
                      <div className="text-[10px] font-black text-amber-300 uppercase tracking-wider">
                        📍 รายการพิกัด ({msg.results.length} รายการ)
                      </div>

                      <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                        {msg.results.map((item, idx) => {
                          const { compactFields, lat, lon } = item;
                          const cardKey = `${msg.id}-${idx}`;

                          return (
                            <div 
                              key={idx}
                              className="bg-slate-900 border border-slate-700/90 rounded-xl p-2.5 text-slate-100 shadow-md text-xs space-y-1.5"
                            >
                              {/* Row 1: Full Name only (Blue Text) */}
                              <h4 className="font-black text-sky-300 leading-snug font-display break-words text-xs sm:text-sm">
                                {compactFields.fullName}
                              </h4>

                              {/* Row 2: Address with Match Score Badge behind Province */}
                              <div className="flex flex-wrap items-center justify-between gap-1.5 text-[11px] text-slate-300 leading-tight pt-0.5">
                                {compactFields.address && (
                                  <div className="flex items-start gap-1 flex-1 min-w-[160px]">
                                    <Home className="w-3 h-3 text-cyan-400 shrink-0 mt-0.5" />
                                    <span className="break-words">{compactFields.address}</span>
                                  </div>
                                )}

                                <div className="flex items-center gap-1 shrink-0 ml-auto">
                                  {item.matchScore !== undefined && (
                                    <span className={`text-[8px] font-bold px-1.5 py-0.2 rounded border ${
                                      item.matchScore === 100
                                        ? 'bg-emerald-950/90 text-emerald-300 border-emerald-700/80'
                                        : item.matchScore >= 85
                                        ? 'bg-sky-950/90 text-sky-300 border-sky-700/80'
                                        : 'bg-amber-950/90 text-amber-300 border-amber-700/80'
                                    }`}>
                                      {item.matchScore === 100 ? '🎯 ตรงกัน 100%' : `⚡ ตรงกัน ${item.matchScore}%`}
                                    </span>
                                  )}
                                  {lat && lon && (
                                    <span className="text-[8px] bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold px-1.5 py-0.2 rounded shrink-0">
                                      พิกัดพร้อม
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-1 bg-slate-950 p-1.5 rounded-lg border border-slate-800 text-[10px]">
                                {compactFields.ca && (
                                  <div>
                                    <span className="text-slate-500 block text-[8px] uppercase">CA</span>
                                    <span className="text-pink-300 font-mono font-bold">{compactFields.ca}</span>
                                  </div>
                                )}
                                {compactFields.meter && (
                                  <div>
                                    <span className="text-slate-500 block text-[8px] uppercase">Meter</span>
                                    <span className="text-yellow-300 font-mono font-bold">{compactFields.meter}</span>
                                  </div>
                                )}
                                {compactFields.phone && (
                                  <div>
                                    <span className="text-slate-500 block text-[8px] uppercase">โทร</span>
                                    <span className="text-green-300 font-mono font-bold">{compactFields.phone}</span>
                                  </div>
                                )}
                                {compactFields.route && (
                                  <div>
                                    <span className="text-slate-500 block text-[8px] uppercase">สายป้อน</span>
                                    <span className="text-sky-300 font-mono font-bold">{compactFields.route}</span>
                                  </div>
                                )}
                              </div>

                              {lat && lon ? (
                                <div className="flex items-center gap-1 pt-1">
                                  <button
                                    type="button"
                                    onClick={() => openGoogleMaps(lat, lon)}
                                    className="flex-1 bg-sky-500 hover:bg-sky-400 text-slate-950 font-black py-1.5 px-2 rounded-lg text-[10px] flex items-center justify-center gap-1 cursor-pointer active:scale-95 transition-all"
                                  >
                                    <Map className="w-3 h-3" />
                                    <span>นำทาง</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => copyCoordinates(compactFields, lat, lon, cardKey)}
                                    className="bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 font-bold py-1.5 px-2 rounded-lg text-[10px] flex items-center justify-center gap-1 cursor-pointer active:scale-95 transition-all"
                                  >
                                    <Copy className="w-3 h-3" />
                                    <span>{copiedIndex === cardKey ? 'ก๊อปแล้ว!' : 'คัดลอก'}</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => shareCoordinates(compactFields, lat, lon)}
                                    className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold p-1.5 rounded-lg text-[10px] cursor-pointer active:scale-95 transition-all"
                                  >
                                    <Share2 className="w-3 h-3" />
                                  </button>
                                </div>
                              ) : (
                                <p className="text-[10px] text-amber-400 italic">⚠️ ไม่พบพิกัด ละติจูด/ลองจิจูด ในรายการนี้</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* AI Thinking Indicator */}
          {isAiThinking && (
            <div className="flex items-center gap-2.5 text-xs font-bold text-amber-300 animate-pulse p-2 bg-slate-900/90 rounded-2xl border border-amber-500/40 w-fit shadow-md">
              <div className="w-6 h-6 rounded-lg overflow-hidden shrink-0 border border-amber-400 animate-bounce">
                <img src={peaBotMascotImg} alt="PEA Bot 3D" className="w-full h-full object-cover" />
              </div>
              <span className="flex items-center gap-1">
                <span>น้อง PEA Bot กำลังสแกนหาพิกัด...</span>
                <span className="text-yellow-400 animate-spin">⚡</span>
              </span>
            </div>
          )}
        </div>

        {/* SEARCH HISTORY BAR */}
        {searchHistory.length > 0 && (
          <div className="bg-slate-900/95 border-t border-slate-800 px-2.5 py-1.5 text-xs">
            <div className="flex items-center justify-between gap-1 mb-1">
              <div className="flex items-center gap-1.5 text-slate-400 font-bold text-[10px] sm:text-[11px]">
                <History className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-sky-400" />
                <span>ประวัติการค้นหาล่าสุด</span>
              </div>
              <button
                type="button"
                onClick={clearSearchHistory}
                className="text-[10px] text-slate-500 hover:text-rose-400 flex items-center gap-1 transition-colors px-1 py-0.5 cursor-pointer"
              >
                <Trash2 className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                <span>ล้างประวัติ</span>
              </button>
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {searchHistory.map((queryItem, idx) => (
                <div
                  key={idx}
                  onClick={() => handleSendChatMessage(undefined, queryItem)}
                  className="shrink-0 bg-slate-950 hover:bg-slate-800 text-slate-200 border border-slate-700/80 hover:border-sky-400/60 rounded-full px-2.5 py-0.5 flex items-center gap-1.5 cursor-pointer text-[10px] sm:text-[11px] font-medium transition-all group active:scale-95 shadow-sm"
                >
                  <Search className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-sky-400/70 group-hover:text-sky-300 shrink-0" />
                  <span className="max-w-[110px] sm:max-w-[140px] truncate">{queryItem}</span>
                  <button
                    type="button"
                    onClick={(e) => removeSearchHistoryItem(queryItem, e)}
                    className="text-slate-500 hover:text-rose-400 p-0.5 rounded-full hover:bg-slate-700 transition-colors shrink-0"
                    title="ลบรายการนี้"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STICKY BOTTOM INPUT BAR */}
        <form 
          onSubmit={handleSendChatMessage}
          className="p-2 sm:p-3 bg-slate-900 border-t border-slate-800 flex items-center gap-2"
        >
          <div className="relative flex-1">
            <input
              type="text"
              value={chatInputText}
              onChange={(e) => setChatInputText(e.target.value)}
              placeholder="พิมพ์ CA (ขึ้นต้น 200), Meter หรือชื่อ/บ้านเลขที่..."
              className="w-full bg-slate-950 text-white placeholder-slate-500 text-xs sm:text-sm font-medium px-3.5 py-2.5 rounded-xl border border-slate-700 focus:outline-none focus:border-sky-400 transition-all shadow-inner"
            />
          </div>

          <button
            type="submit"
            disabled={!chatInputText.trim() || isAiThinking}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white p-2.5 rounded-xl font-bold transition-all cursor-pointer flex items-center justify-center shrink-0 active:scale-95"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>

      </main>

      {/* FOOTER */}
      <footer className="text-[10px] font-bold text-slate-500 text-center py-1">
        PEA Meter & GPS AI Assistant • การไฟฟ้าส่วนภูมิภาค
      </footer>

    </div>
    </>
  );
}
