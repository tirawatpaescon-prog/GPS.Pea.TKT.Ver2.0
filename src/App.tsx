import React, { useState, useEffect, useRef, useMemo } from 'react';
import Papa from 'papaparse';
import { 
  User, 
  MapPin, 
  Zap, 
  Home, 
  Phone, 
  Hash, 
  Compass, 
  Search, 
  AlertCircle,
  X,
  Share2,
  Check,
  Download,
  Wifi,
  WifiOff,
  Database,
  RefreshCw,
  Map,
  Activity,
  Layers,
  Copy,
  ArrowUp,
  ChevronDown,
  Sun,
  Moon
} from 'lucide-react';

// Define the shape of our CSV record dynamically
interface PeaRecord {
  [key: string]: string;
}

interface CompactFields {
  fullName: string;
  address: string;
  ca: string;
  meter: string;
  phone: string;
  route: string;
  otherFields: { key: string; val: string }[];
}

interface IndexedRecord {
  record: PeaRecord;
  rowMeterLower: string;
  rowCaLower: string;
  rowNameAddrNorm: string;
  lat: string | null;
  lon: string | null;
  compactFields: CompactFields;
}

const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTsS3z2NT8lcdKRYE40bo1rPVIyc7EGJ0Hz5GkpWBD8STIpNzQS13sZAXSXn-1S90TWahJWLN2C_7Uj/pub?gid=1960280238&single=true&output=csv';

// Helper to normalize Thai address text and abbreviations for robust searching
const normalizeThaiAddress = (text: string): string => {
  if (!text) return '';
  let s = text.toLowerCase();

  // Standardize Moo prefixes (หมู่บ้าน / หมู่ที่ / หมู่ / ม. / ม) followed by optional spaces and digits
  s = s.replace(/(หมู่บ้าน|หมู่ที่|หมู่|ม\.|ม)\s*0*(\d+)/g, 'ม.$2');

  // Standardize Thai address prefixes
  s = s.replace(/ตำบล\s*/g, 'ต.');
  s = s.replace(/อำเภอ\s*/g, 'อ.');
  s = s.replace(/จังหวัด\s*/g, 'จ.');
  s = s.replace(/ถนน\s*/g, 'ถ.');
  s = s.replace(/ซอย\s*/g, 'ซ.');

  // Collapse multiple spaces
  s = s.replace(/\s+/g, ' ').trim();
  return s;
};

// Helper function to resolve coordinates from a row
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

  // Secondary fallback search
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

// Identify the best key for the Card Title
const getPrimaryTitle = (record: PeaRecord): string => {
  const titleKeys = ['ชื่อ', 'ชื่อ-นามสกุล', 'ชื่อ - นามสกุล', 'ผู้ใช้ไฟ', 'name', 'customer', 'ชื่อผู้ใช้ไฟ', 'รายละเอียด'];
  for (const key of titleKeys) {
    const foundKey = Object.keys(record).find(k => k.toLowerCase().trim().includes(key));
    if (foundKey && record[foundKey]) {
      return record[foundKey];
    }
  }
  for (const [key, val] of Object.entries(record)) {
    const normK = key.toLowerCase();
    if (val && !normK.includes('lat') && !normK.includes('lon') && !normK.includes('ลองจิ') && !normK.includes('ละติจูด')) {
      return val;
    }
  }
  return 'ผู้รับบริการ PEA';
};

// Compactly extract and combine key fields from a record
const extractCompactFields = (record: PeaRecord): CompactFields => {
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
    const v = val.trim();
    const kNorm = key.toLowerCase().trim();

    if (kNorm === 'ชื่อ' || kNorm === 'name' || kNorm === 'ชื่อผู้ใช้ไฟ' || kNorm === 'ผู้ใช้ไฟ') {
      firstName = v;
    } else if (kNorm === 'นามสกุล' || kNorm === 'surname' || kNorm === 'lastname' || kNorm === 'สกุล') {
      lastName = v;
    } else if (kNorm.includes('ชื่อ') && kNorm.includes('สกุล')) {
      firstName = v;
    } else if (kNorm === 'ca' || kNorm.includes('เลขคู่ค้า') || kNorm.includes('บัญชี') || kNorm.includes('contract') || kNorm.includes('เลขผู้ใช้ไฟ') || kNorm === 'รหัสคู่ค้า') {
      ca = v;
    } else if (kNorm.includes('meter') || kNorm.includes('เครื่องวัด') || kNorm.includes('มิเตอร์') || kNorm.includes('pea meter')) {
      meter = v;
    } else if (kNorm.includes('บ้านเลขที่') || kNorm === 'เลขที่' || kNorm.includes('address') || kNorm === 'ที่อยู่' || kNorm.includes('หมู่ที่') || kNorm === 'หมู่' || kNorm.includes('ถนน') || kNorm.includes('ตำบล') || kNorm.includes('อำเภอ')) {
      addressParts.push(v);
    } else if (kNorm.includes('โทร') || kNorm.includes('phone') || kNorm.includes('tel') || kNorm.includes('มือถือ')) {
      phone = v;
    } else if (kNorm.includes('สาย') || kNorm.includes('route') || kNorm.includes('สายป้อน') || kNorm.includes('feeder')) {
      route = v;
    } else if (
      !kNorm.includes('lat') &&
      !kNorm.includes('lon') &&
      !kNorm.includes('lng') &&
      !kNorm.includes('ละติ') &&
      !kNorm.includes('ลองจิ') &&
      kNorm !== 'x' &&
      kNorm !== 'y'
    ) {
      otherFields.push({ key, val: v });
    }
  }

  const uniqueAddressParts = Array.from(new Set(addressParts));
  const address = uniqueAddressParts.join(' ');
  const fullName = lastName ? `${firstName} ${lastName}` : firstName;

  return {
    fullName: fullName || getPrimaryTitle(record),
    address,
    ca,
    meter,
    phone,
    route,
    otherFields
  };
};

export default function App() {
  // Search Bar States
  const [searchMeter, setSearchMeter] = useState('');
  const [searchCa, setSearchCa] = useState('');
  const [searchAddressName, setSearchAddressName] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allRecords, setAllRecords] = useState<PeaRecord[]>([]);
  const [searchResults, setSearchResults] = useState<IndexedRecord[] | null>(null);
  const [displayLimit, setDisplayLimit] = useState(24);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  
  // PWA installation states
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  // Mascot feedback text
  const [mascotText, setMascotText] = useState('ยินดีต้อนรับฮะ! ป้อน PEA Meter, CA หรือ ชื่อ/บ้านเลขที่ เพื่อค้นหาพิกัดได้เลย!');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Back to top floating button visibility
  const [showBackToTop, setShowBackToTop] = useState(false);

  // Deep Night Dark Mode state with localStorage persistence
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('pea_theme') === 'dark';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      try {
        localStorage.setItem('pea_theme', 'dark');
      } catch (e) {
        console.warn('Could not save theme preference:', e);
      }
    } else {
      document.documentElement.classList.remove('dark');
      try {
        localStorage.setItem('pea_theme', 'light');
      } catch (e) {
        console.warn('Could not save theme preference:', e);
      }
    }
  }, [isDarkMode]);

  const toggleTheme = () => {
    setIsDarkMode((prev) => {
      const next = !prev;
      setMascotText(
        next
          ? 'เปิดใช้งานโหมด "Deep Night" (ธีมมืด) ถนอมสายตาสำหรับงานภาคสนามยามค่ำคืนแล้วฮะ! 🌙'
          : 'สลับกลับเป็นธีมสว่าง อ่านง่าย สบายตาเรียบร้อยแล้วฮะ! ☀️'
      );
      return next;
    });
  };

  // Ref to search input for rapid focus
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Pre-index records in memory for zero-latency instant search
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
          kNorm.includes('amp') || kNorm.includes('แอมป์') || kNorm.includes('serial') || kNorm === 'pea meter'
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

      return {
        record: row,
        rowMeterLower: rowMeterStr.toLowerCase(),
        rowCaLower: rowCaStr.toLowerCase(),
        rowNameAddrNorm: normalizeThaiAddress(rowNameAddrStr).toLowerCase(),
        lat: coords.lat,
        lon: coords.lon,
        compactFields
      };
    });
  }, [allRecords]);

  // Scroll listener for Back to Top button
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 250) {
        setShowBackToTop(true);
      } else {
        setShowBackToTop(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Monitor network status
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;
    setIsInstalled(!!isStandalone);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Listen for PWA BeforeInstallPromptEvent
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      if (!isInstalled) {
        setShowInstallBanner(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setShowInstallBanner(false);
      setDeferredPrompt(null);
      setMascotText('สุดยอด! ติดตั้งเสร็จเรียบร้อย พร้อมลุยหน้างานแล้วฮะ! 🎉');
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, [isInstalled]);

  // Fetch database (CSV)
  const fetchDatabase = async (forceRefresh = false): Promise<PeaRecord[]> => {
    if (allRecords.length > 0 && !forceRefresh) {
      return allRecords;
    }

    const localCacheStr = localStorage.getItem('pea_records_cache');
    const localCacheTime = localStorage.getItem('pea_records_cache_time');

    try {
      let csvText = '';
      
      try {
        const response = await fetch(CSV_URL);
        if (!response.ok) throw new Error(`ไม่สามารถดึงข้อมูลได้ (HTTP ${response.status})`);
        csvText = await response.text();
      } catch (directErr) {
        csvText = await new Promise<string>((resolve, reject) => {
          Papa.parse(CSV_URL, {
            download: true,
            complete: (results) => {
              if (results.data && Array.isArray(results.data) && results.data.length > 0) {
                const unparsed = Papa.unparse(results.data);
                resolve(unparsed);
              } else {
                reject(new Error('ไม่สามารถโหลดข้อมูลผ่านช่องทางสำรองได้'));
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
              const now = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
              setLastUpdated(now);
              try {
                localStorage.setItem('pea_records_cache', JSON.stringify(data));
                localStorage.setItem('pea_records_cache_time', now);
              } catch (e) {
                console.warn('Could not write to localStorage cache:', e);
              }
              resolve(data);
            } else {
              reject(new Error('ข้อมูล CSV ที่ได้รับว่างเปล่า'));
            }
          },
          error: () => {
            reject(new Error('เกิดข้อผิดพลาดในการอ่านรูปแบบไฟล์ CSV'));
          }
        });
      });
    } catch (err: any) {
      if (localCacheStr) {
        try {
          const cachedData = JSON.parse(localCacheStr) as PeaRecord[];
          if (cachedData && cachedData.length > 0) {
            setAllRecords(cachedData);
            if (localCacheTime) setLastUpdated(localCacheTime);
            return cachedData;
          }
        } catch (e) {
          console.error('Failed to parse cached data:', e);
        }
      }

      const isFetchErr = err?.message?.toLowerCase().includes('fetch') || err?.name === 'TypeError';
      const userMessage = isFetchErr
        ? 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ Google Sheets ได้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต'
        : (err?.message || 'เครือข่ายขัดข้อง กรุณาลองใหม่อีกครั้ง');

      throw new Error(userMessage);
    }
  };

  // Pre-load data on launch
  useEffect(() => {
    const localCacheStr = localStorage.getItem('pea_records_cache');
    const localCacheTime = localStorage.getItem('pea_records_cache_time');
    let hasLocalData = false;

    if (localCacheStr) {
      try {
        const cached = JSON.parse(localCacheStr) as PeaRecord[];
        if (cached && cached.length > 0) {
          setAllRecords(cached);
          if (localCacheTime) setLastUpdated(localCacheTime);
          hasLocalData = true;
          setMascotText(`โหลดข้อมูลจากแคชในเครื่องสำเร็จ (${cached.length} รายการ)! พร้อมค้นหาพิกัดเลยฮะ! ⚡`);
        }
      } catch (e) {
        // ignore
      }
    }

    setLoading(true);
    fetchDatabase(true)
      .then((data) => {
        setMascotText(`เชื่อมต่อพิกัดเสร็จสมบูรณ์! อัปเดตข้อมูลล่าสุดเรียบร้อย (${data.length} รายการ) ⚡`);
        setError(null);
      })
      .catch((err) => {
        if (!hasLocalData) {
          setError(err.message || 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้ ณ ขณะนี้');
          setMascotText('อุ๊ย... ไม่สามารถดึงข้อมูลได้ในขณะนี้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่อีกครั้งนะฮะ!');
        } else {
          setMascotText('เชื่อมต่อฐานข้อมูลสดไม่ได้ แต่ระบบกำลังใช้งานข้อมูลที่บันทึกไว้ในแคชแทนฮะ! ⚡');
        }
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  // Lightning-fast search executing in ~1ms over indexedRecords
  const executeSearch = (overrideMeter?: string, overrideCa?: string, overrideAddressName?: string) => {
    const meterQuery = (overrideMeter !== undefined ? overrideMeter : searchMeter).trim();
    const caQuery = (overrideCa !== undefined ? overrideCa : searchCa).trim();
    const addrQuery = (overrideAddressName !== undefined ? overrideAddressName : searchAddressName).trim();

    if (!meterQuery && !caQuery && !addrQuery) {
      setError('กรุณากรอกข้อมูลอย่างน้อย 1 ช่องนะฮะ (PEA Meter, CA หรือ ชื่อ/บ้านเลขที่)');
      setMascotText('ป้อนข้อมูลในช่องใดช่องหนึ่งก่อนสิฮะ ไม่งั้นปุ่มแสกนจะทำงานไม่ได้นะเนี้ย! 😅');
      return;
    }

    setError(null);
    setDisplayLimit(24);

    const meterTerms = meterQuery ? meterQuery.toLowerCase().split(/\s+/).filter(Boolean) : [];
    const caTerms = caQuery ? caQuery.toLowerCase().split(/\s+/).filter(Boolean) : [];
    const normAddrQ = addrQuery ? normalizeThaiAddress(addrQuery).toLowerCase() : '';
    const addrTerms = normAddrQ ? normAddrQ.split(/\s+/).filter(Boolean) : [];

    // Filter using pre-indexed lowercased strings
    const matched: IndexedRecord[] = [];

    for (let i = 0; i < indexedRecords.length; i++) {
      const item = indexedRecords[i];

      if (meterTerms.length > 0) {
        if (!meterTerms.every((term) => item.rowMeterLower.includes(term))) continue;
      }

      if (caTerms.length > 0) {
        if (!caTerms.every((term) => item.rowCaLower.includes(term))) continue;
      }

      if (addrTerms.length > 0) {
        if (!addrTerms.every((term) => item.rowNameAddrNorm.includes(term))) continue;
      }

      matched.push(item);
    }

    if (matched.length === 0) {
      setSearchResults([]);
      setError('ไม่พบข้อมูลตามเงื่อนไขการคัดกรองที่ท่านระบุ');
      setMascotText('ค้นหาเรียบร้อยแล้วฮะ... ไม่พบข้อมูลที่ตรงกับเงื่อนไขที่คัดกรองเลย 🥺');
      return;
    }

    // Score matching records
    const scored = matched.map((item) => {
      let score = 0;

      if (meterQuery) {
        const mQ = meterQuery.toLowerCase().trim();
        if (item.rowMeterLower === mQ) score += 10000;
        else if (item.rowMeterLower.startsWith(mQ)) score += 2000;
        else score += 500;
      }

      if (caQuery) {
        const cQ = caQuery.toLowerCase().trim();
        if (item.rowCaLower === cQ) score += 10000;
        else if (item.rowCaLower.startsWith(cQ)) score += 2000;
        else score += 500;
      }

      if (normAddrQ) {
        if (item.rowNameAddrNorm === normAddrQ) score += 10000;
        else if (item.rowNameAddrNorm.startsWith(normAddrQ)) score += 4000;
        else if (item.rowNameAddrNorm.includes(normAddrQ)) score += 2000;

        for (const term of addrTerms) {
          if (item.rowNameAddrNorm.includes(term)) score += 500;
        }

        score -= item.rowNameAddrNorm.length * 0.05;
      }

      return { item, score };
    });

    scored.sort((a, b) => b.score - a.score);
    const sortedResults = scored.map((s) => s.item);

    setSearchResults(sortedResults);
    setError(null);
    setMascotText(`ค้นหาสำเร็จ! ตรวจพบข้อมูลพิกัดไฟฟ้า PEA ตรงเงื่อนไข จำนวน ${sortedResults.length} รายการ 🚀`);
  };

  // Handle Search Submission on button click or form submit
  const handleSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (searchInputRef.current) {
      searchInputRef.current.blur();
    }
    executeSearch();
  };

  // Clear all search fields
  const handleClearAll = () => {
    setSearchMeter('');
    setSearchCa('');
    setSearchAddressName('');
    setSearchResults(null);
    setError(null);
    setDisplayLimit(24);
    setMascotText('ล้างข้อมูลค้นหาเรียบร้อยฮะ! ป้อนข้อมูลแล้วกดสแกนค้นหาได้เลย');
  };

  // Reset search results if all inputs are completely cleared
  useEffect(() => {
    if (!searchMeter.trim() && !searchCa.trim() && !searchAddressName.trim()) {
      setSearchResults(null);
      setError(null);
      setDisplayLimit(24);
      setMascotText('ยินดีต้อนรับฮะ! ป้อน PEA Meter, CA หรือ ชื่อ/บ้านเลขที่ เพื่อค้นหาพิกัดได้เลย!');
    }
  }, [searchMeter, searchCa, searchAddressName]);

  // Open Google Maps URL for a record
  const openGoogleMaps = (lat: string | null, lon: string | null) => {
    if (lat && lon) {
      const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
      window.open(mapsUrl, '_blank', 'noopener,noreferrer');
    } else {
      alert('ไม่สามารถเปิดแผนที่ได้เนื่องจากไม่พบคอลัมน์พิกัดละติจูด/ลองจิจูดในผู้ใช้งานรายนี้');
    }
  };

  // Copy coordinates to clipboard
  const copyCoordinates = (lat: string, lon: string, index: number) => {
    const coordsText = `${lat},${lon}`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(coordsText);
    } else {
      const textArea = document.createElement('textarea');
      textArea.value = coordsText;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
    setCopiedIndex(index);
    setTimeout(() => {
      setCopiedIndex(null);
    }, 2000);
  };

  // Share coordinates via Web Share API
  const shareCoordinates = async (fields: CompactFields, lat: string, lon: string) => {
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
    const shareText = `📍 พิกัดไฟฟ้า PEA: ${fields.fullName}${fields.ca ? `\n⚡ CA: ${fields.ca}` : ''}${fields.meter ? `\n🔌 Meter: ${fields.meter}` : ''}${fields.address ? `\n🏠 ที่อยู่: ${fields.address}` : ''}\n📌 พิกัด: ${lat},${lon}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `พิกัด PEA - ${fields.fullName}`,
          text: shareText,
          url: mapsUrl
        });
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error('Error sharing:', err);
        }
      }
    } else {
      copyCoordinates(lat, lon, -1);
      alert('เบราว์เซอร์นี้ไม่รองรับระบบแชร์โดยตรง ระบบได้คัดลอกพิกัดลงคลิปบอร์ดให้ท่านเรียบร้อยแล้วฮะ!');
    }
  };

  // Trigger PWA Installation Flow
  const triggerPwaInstall = async () => {
    if (!deferredPrompt) return;
    setShowInstallBanner(false);
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`[PWA] User response: ${outcome}`);
    setDeferredPrompt(null);
  };

  // Auto-fill template searches
  const handleQuickSearch = (type: 'meter' | 'ca' | 'address', term: string) => {
    if (type === 'meter') {
      setSearchMeter(term);
      setSearchCa('');
      setSearchAddressName('');
      executeSearch(term, '', '');
    } else if (type === 'ca') {
      setSearchMeter('');
      setSearchCa(term);
      setSearchAddressName('');
      executeSearch('', term, '');
    } else {
      setSearchMeter('');
      setSearchCa('');
      setSearchAddressName(term);
      executeSearch('', '', term);
    }
  };

  return (
    <div className="min-h-screen bg-[#EEF2F6] dark:bg-[#0B132B] pb-20 sm:pb-24 px-3 sm:px-4 pt-3 sm:pt-4 font-sans text-slate-800 dark:text-slate-100 flex flex-col items-center selection:bg-indigo-100 dark:selection:bg-sky-900 transition-colors duration-300">
      
      {/* Top Floating Control Capsule (Theme Toggle + Network Status) */}
      <div className="fixed top-2.5 right-2.5 sm:top-4 sm:right-4 z-50 flex items-center gap-1.5 sm:gap-2">
        {/* Theme Toggle Capsule */}
        <button
          type="button"
          onClick={toggleTheme}
          aria-label="Toggle theme"
          title={isDarkMode ? "สลับเป็นธีมสว่าง" : "สลับเป็นโหมดกลางคืน Deep Night"}
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full border-2 sm:border-3 text-[11px] sm:text-xs font-black shadow-md transition-all duration-300 border-[#1E293B] dark:border-sky-400 bg-white dark:bg-slate-800 text-slate-800 dark:text-sky-300 shadow-[2px_2px_0px_#1E293B] dark:shadow-[2px_2px_0px_#0284C7] active:translate-x-0.5 active:translate-y-0.5 cursor-pointer"
        >
          {isDarkMode ? (
            <>
              <Moon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-300 fill-current" />
              <span className="hidden sm:inline">Deep Night</span>
            </>
          ) : (
            <>
              <Sun className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-500 fill-current" />
              <span className="hidden sm:inline">โหมดสว่าง</span>
            </>
          )}
        </button>

        {/* Network Status Capsule */}
        <div className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-full border-2 sm:border-3 text-[11px] sm:text-xs font-black shadow-md transition-all duration-300 border-[#1E293B] dark:border-sky-400 ${
          isOffline 
          ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200 shadow-[2px_2px_0px_#1E293B] dark:shadow-[2px_2px_0px_#0284C7] animate-pulse' 
          : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200 shadow-[2px_2px_0px_#1E293B] dark:shadow-[2px_2px_0px_#0284C7]'
        }`}>
          {isOffline ? (
            <>
              <WifiOff className="w-3.5 h-3.5 sm:w-4.5 sm:h-4.5" />
              <span className="hidden sm:inline">ออฟไลน์</span>
            </>
          ) : (
            <>
              <Wifi className="w-3.5 h-3.5 sm:w-4.5 sm:h-4.5 text-emerald-600 dark:text-emerald-400 animate-cyber-pulse" />
              <span className="hidden sm:inline">เชื่อม PEA</span>
            </>
          )}
        </div>
      </div>

      {/* Main Header */}
      <header className="w-full max-w-md md:max-w-2xl lg:max-w-3xl text-center mt-3 sm:mt-6 mb-3 sm:mb-6 flex flex-col items-center">
        <div className="relative group mb-2 sm:mb-3">
          <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 via-sky-400 to-amber-300 rounded-full blur opacity-75 group-hover:opacity-100 transition duration-1000 group-hover:duration-200 animate-pulse"></div>
          <div className="relative w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-full bg-white dark:bg-slate-800 border-3 sm:border-4 border-[#1E293B] dark:border-sky-400 flex items-center justify-center overflow-hidden shadow-lg">
            <img 
              src="/icon.jpg" 
              alt="PEA TKT Logo" 
              className="w-full h-full object-cover transform hover:scale-110 transition duration-300"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
            <Zap className="absolute w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 text-[#FDE047] fill-current animate-bounce" />
          </div>
          <span className="absolute -bottom-1 -right-1 bg-[#FDE047] text-[#1E293B] text-[9px] sm:text-xxs px-2 py-0.5 rounded-md font-black border-2 sm:border-3 border-[#1E293B] rotate-12 shadow-[2px_2px_0px_#1E293B]">
            GPS.Pea.TKT
          </span>
        </div>

        <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-[#1E293B] dark:text-slate-100 font-display uppercase">
          GPS.Pea.TKT
        </h1>
        <p className="text-[10px] sm:text-xs text-indigo-600 dark:text-sky-400 font-black tracking-widest uppercase mt-0.5 sm:mt-1">
          ⚡ FIELD SERVICE TOOL ⚡
        </p>

        {/* Theme Toggle Button in Header */}
        <button
          type="button"
          onClick={toggleTheme}
          className="mt-2.5 sm:mt-3 cyber-btn bg-white dark:bg-slate-800 text-[#1E293B] dark:text-slate-100 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs font-black flex items-center gap-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
        >
          {isDarkMode ? (
            <>
              <Sun className="w-4 h-4 text-amber-400 fill-current animate-spin-slow" />
              <span>โหมดปัจจุบัน: <strong className="text-sky-400">Deep Night 🌙</strong> — คลิกเปลี่ยนเป็นธีมสว่าง</span>
            </>
          ) : (
            <>
              <Moon className="w-4 h-4 text-indigo-600 fill-current" />
              <span>โหมดปัจจุบัน: <strong className="text-indigo-600">ธีมสว่าง ☀️</strong> — คลิกเปลี่ยนเป็น Deep Night</span>
            </>
          )}
        </button>
      </header>

      {/* Mascot / Interactive Advice Box */}
      <div className="w-full max-w-md md:max-w-2xl lg:max-w-3xl bg-white dark:bg-slate-800 border-3 sm:border-4 border-[#1E293B] dark:border-sky-400 rounded-xl sm:rounded-2xl p-3 sm:p-4 mb-4 sm:mb-6 shadow-[3px_3px_0px_#334155] dark:shadow-[3px_3px_0px_#0284C7] sm:shadow-[4px_4px_0px_#334155] relative overflow-hidden flex gap-2.5 sm:gap-3.5 items-center">
        <div className="absolute top-0 left-0 h-1 bg-gradient-to-r from-indigo-500 to-sky-500 w-full"></div>
        
        <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-[#FEF08A] border-2 sm:border-3 border-[#1E293B] flex items-center justify-center shrink-0 shadow-[2px_2px_0px_#1E293B]">
          <Activity className="w-5 h-5 sm:w-7 sm:h-7 text-[#1E293B] animate-pulse" />
        </div>
        
        <div className="flex-1">
          <p className="text-[9px] sm:text-[10px] text-indigo-600 dark:text-sky-400 font-black uppercase tracking-widest mb-0.5">PEA-BOT แนะนำ:</p>
          <p className="text-xs text-[#1E293B] dark:text-slate-100 font-bold leading-snug sm:leading-relaxed font-sans">{mascotText}</p>
        </div>
      </div>

      {/* Core Search Panel */}
      <section className="w-full max-w-md md:max-w-2xl lg:max-w-3xl cyber-card p-3.5 sm:p-5 md:p-6 mb-4 sm:mb-6">
        <div className="flex justify-between items-center mb-3 sm:mb-4">
          <h2 className="text-base sm:text-lg font-black text-[#1E293B] dark:text-slate-100 flex items-center gap-1.5 sm:gap-2 font-display">
            <Layers className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600 dark:text-sky-400" />
            ระบุข้อมูลเพื่อแสกน
          </h2>
          {allRecords.length > 0 && (
            <span className="text-[9px] sm:text-[10px] bg-slate-100 dark:bg-slate-700 text-indigo-700 dark:text-sky-300 border-2 border-[#1E293B] dark:border-sky-400 px-2 py-0.5 rounded-full font-black">
              DB: {allRecords.length} รายการ
            </span>
          )}
        </div>

        <form onSubmit={handleSearch} className="space-y-2.5 sm:space-y-3.5">
          {/* 1. PEA Meter Bar */}
          <div>
            <label className="block text-[11px] sm:text-xs font-black text-[#1E293B] dark:text-slate-200 mb-0.5 sm:mb-1 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-yellow-500 fill-current shrink-0" />
              <span>1. PEA Meter (เลขมิเตอร์)</span>
            </label>
            <div className="relative">
              <input
                ref={searchInputRef}
                type="text"
                placeholder="เช่น 012345, PEA 987..."
                value={searchMeter}
                onChange={(e) => setSearchMeter(e.target.value)}
                className="w-full py-2 sm:py-2.5 pl-3 sm:pl-3.5 pr-8 sm:pr-10 text-slate-800 dark:text-slate-100 rounded-lg sm:rounded-xl font-sans text-xs sm:text-sm cyber-input font-bold placeholder-slate-400 dark:placeholder-slate-500"
              />
              {searchMeter && (
                <button
                  type="button"
                  onClick={() => setSearchMeter('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-all cursor-pointer"
                >
                  <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
              )}
            </div>
          </div>

          {/* 2. CA Bar */}
          <div>
            <label className="block text-[11px] sm:text-xs font-black text-[#1E293B] dark:text-slate-200 mb-0.5 sm:mb-1 flex items-center gap-1.5">
              <Hash className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-pink-500 shrink-0" />
              <span>2. CA (หมายเลขผู้ใช้ไฟฟ้า)</span>
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="เช่น 0200012345..."
                value={searchCa}
                onChange={(e) => setSearchCa(e.target.value)}
                className="w-full py-2 sm:py-2.5 pl-3 sm:pl-3.5 pr-8 sm:pr-10 text-slate-800 dark:text-slate-100 rounded-lg sm:rounded-xl font-sans text-xs sm:text-sm cyber-input font-bold placeholder-slate-400 dark:placeholder-slate-500"
              />
              {searchCa && (
                <button
                  type="button"
                  onClick={() => setSearchCa('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-all cursor-pointer"
                >
                  <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
              )}
            </div>
          </div>

          {/* 3. Name / House No. / Moo Bar */}
          <div>
            <label className="block text-[11px] sm:text-xs font-black text-[#1E293B] dark:text-slate-200 mb-0.5 sm:mb-1 flex items-center gap-1.5">
              <Home className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-500 shrink-0" />
              <span>3. ชื่อ นามสกุล / บ้านเลขที่ หมู่</span>
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="เช่น สมชาย, 81 ม.5, หมู่ 5..."
                value={searchAddressName}
                onChange={(e) => setSearchAddressName(e.target.value)}
                className="w-full py-2 sm:py-2.5 pl-3 sm:pl-3.5 pr-8 sm:pr-10 text-slate-800 dark:text-slate-100 rounded-lg sm:rounded-xl font-sans text-xs sm:text-sm cyber-input font-bold placeholder-slate-400 dark:placeholder-slate-500"
              />
              {searchAddressName && (
                <button
                  type="button"
                  onClick={() => setSearchAddressName('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-all cursor-pointer"
                >
                  <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
              )}
            </div>
          </div>

          <div className="flex gap-2 pt-0.5">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 cyber-btn bg-[#0EA5E9] hover:bg-sky-400 disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:text-slate-400 disabled:border-slate-300 text-white font-black py-2.5 sm:py-3 px-2.5 sm:px-3 rounded-lg sm:rounded-xl text-xs sm:text-sm flex items-center justify-center gap-1.5 sm:gap-2 text-center cursor-pointer select-none"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5 animate-cyber-spin text-[#FDE047]" />
                  <span>กำลังสแกน...</span>
                </>
              ) : (
                <>
                  <Search className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span>ค้นหาข้อมูลพิกัด (สแกน)</span>
                </>
              )}
            </button>

            {(searchMeter || searchCa || searchAddressName) && (
              <button
                type="button"
                onClick={handleClearAll}
                title="ล้างข้อมูลค้นหาทุกช่อง"
                className="cyber-btn bg-slate-100 dark:bg-slate-800 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-slate-700 dark:text-slate-200 hover:text-rose-700 dark:hover:text-rose-300 px-3 rounded-lg sm:rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1 cursor-pointer transition-colors"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="hidden sm:inline">ล้าง</span>
              </button>
            )}

            {/* Quick reload button */}
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                setLoading(true);
                fetchDatabase(true)
                  .then((data) => {
                    setError(null);
                    setMascotText(`อัปเดตข้อมูลสำเร็จ! ตรวจพบข้อมูลล่าสุดทั้งหมด ${data.length} รายการฮะ! ⚡`);
                  })
                  .catch((err) => {
                    setError('อัปเดตล้มเหลว: ' + err.message);
                  })
                  .finally(() => setLoading(false));
              }}
              title="รีเฟรชอัปเดตข้อมูล"
              className="cyber-btn bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-3 rounded-lg sm:rounded-xl flex items-center justify-center cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 sm:w-5 sm:h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </form>

        {/* Quick Search Templates */}
        <div className="mt-3 pt-3 sm:mt-4 sm:pt-4 border-t-2 border-dashed border-slate-200 dark:border-slate-700">
          <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-widest font-black mb-1.5">💡 ตัวอย่างการค้นหาด่วน:</p>
          <div className="flex flex-wrap gap-1 sm:gap-1.5">
            <button 
              type="button"
              onClick={() => handleQuickSearch('ca', '020')} 
              className="text-[11px] sm:text-xs bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/80 text-indigo-700 dark:text-sky-300 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl border-2 border-[#1E293B] dark:border-sky-400 font-bold transition flex items-center gap-1 cursor-pointer"
            >
              <Hash className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-pink-500" />
              <span>รหัส CA (020)</span>
            </button>
            <button 
              type="button"
              onClick={() => handleQuickSearch('address', 'สม')} 
              className="text-[11px] sm:text-xs bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/80 text-indigo-700 dark:text-sky-300 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl border-2 border-[#1E293B] dark:border-sky-400 font-bold transition flex items-center gap-1 cursor-pointer"
            >
              <Home className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-cyan-600 dark:text-cyan-400" />
              <span>ชื่อ "สม"</span>
            </button>
            <button 
              type="button"
              onClick={() => handleQuickSearch('address', '81 ม.5')} 
              className="text-[11px] sm:text-xs bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/80 text-indigo-700 dark:text-sky-300 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl border-2 border-[#1E293B] dark:border-sky-400 font-bold transition flex items-center gap-1 cursor-pointer"
            >
              <Home className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-cyan-600 dark:text-cyan-400" />
              <span>บ้านเลขที่ (81 ม.5)</span>
            </button>
          </div>
        </div>

        {/* Database update timestamp indicator */}
        {lastUpdated && (
          <div className="mt-3 sm:mt-4 flex items-center justify-between text-[10px] sm:text-xxs text-slate-500 dark:text-slate-400 font-mono font-bold">
            <span className="flex items-center gap-1">
              <Database className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-indigo-600 dark:text-sky-400" />
              ฐานข้อมูลพร้อมใช้งานแบบออฟไลน์
            </span>
            <span>อัปเดต: {lastUpdated} น.</span>
          </div>
        )}
      </section>

      {/* ERROR Banner */}
      {error && (
        <div className="w-full max-w-md md:max-w-2xl lg:max-w-3xl bg-rose-50 dark:bg-rose-950/80 border-3 sm:border-4 border-[#1E293B] dark:border-rose-400 rounded-xl sm:rounded-2xl p-3 sm:p-4 mb-4 sm:mb-6 shadow-[3px_3px_0px_#E11D48] flex items-start gap-2.5 sm:gap-3.5 text-rose-950 dark:text-rose-100 animate-fadeIn">
          <AlertCircle className="w-5 h-5 sm:w-6 sm:h-6 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-xs sm:text-sm font-black text-rose-800 dark:text-rose-200 font-display">ขออภัยฮะ!</h3>
            <p className="text-xs font-bold leading-snug mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* RESULTS DISPLAY PANEL */}
      <main className="w-full max-w-md md:max-w-3xl lg:max-w-6xl space-y-3 sm:space-y-4">
        {searchResults && searchResults.length > 0 && (
          <div className="flex items-center justify-between px-1 sm:px-2 mb-1 sm:mb-2">
            <span className="text-[11px] sm:text-xs text-indigo-700 dark:text-sky-400 font-black uppercase tracking-wider">
              🟢 ผลการสแกนพิกัด ({searchResults.length} รายการ)
            </span>
            <button 
              onClick={() => setSearchResults(null)}
              className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 underline font-bold cursor-pointer"
            >
              ล้างผลลัพธ์
            </button>
          </div>
        )}

        {searchResults && searchResults.length > 0 && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-5">
              {searchResults.slice(0, displayLimit).map((item, index) => {
                const { compactFields, lat, lon } = item;

                return (
                  <article 
                    key={index} 
                    className="cyber-card p-3.5 sm:p-4.5 relative overflow-hidden flex flex-col justify-between animate-fadeIn"
                  >
                    {/* Highlight match banner */}
                    <div className="absolute top-0 right-0 bg-[#FDE047] text-[#1E293B] text-[9px] sm:text-[10px] font-black px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-bl-xl border-l-3 sm:border-l-4 border-b-3 sm:border-b-4 border-[#1E293B] dark:border-sky-400">
                      {lat && lon ? '📍 พร้อมสแกน' : '❌ ไม่มีพิกัด'}
                    </div>

                    {/* Compact Header */}
                    <div className="mb-2.5 sm:mb-3.5 pr-14 sm:pr-16 flex items-start gap-2 sm:gap-2.5">
                      <div className="mt-0.5 p-1 sm:p-1.5 rounded-lg sm:rounded-xl bg-slate-100 dark:bg-slate-700 border-2 border-[#1E293B] dark:border-sky-400 shrink-0">
                        <User className="w-4.5 h-4.5 sm:w-5.5 sm:h-5.5 text-indigo-600 dark:text-sky-300" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[9px] sm:text-[10px] text-indigo-600 dark:text-sky-400 font-black tracking-widest uppercase mb-0.5">ผู้ใช้ไฟ PEA</p>
                        <h3 className="text-base sm:text-lg font-black text-slate-800 dark:text-slate-100 leading-tight font-display break-words">
                          {compactFields.fullName}
                        </h3>
                        {compactFields.address && (
                          <p className="text-xs sm:text-sm font-bold text-slate-600 dark:text-slate-300 mt-1 flex items-start gap-1 leading-snug break-words">
                            <Home className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-600 dark:text-cyan-400 shrink-0 mt-0.5" />
                            <span>{compactFields.address}</span>
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Core Metadata Row */}
                    <div className="grid grid-cols-2 gap-2 sm:gap-2.5 bg-slate-50 dark:bg-slate-900/80 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg sm:rounded-xl p-2.5 sm:p-3 mb-2.5 sm:mb-3.5 text-xs sm:text-sm font-bold">
                      {compactFields.ca && (
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Hash className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-pink-500 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <span className="text-[9px] sm:text-[10px] text-slate-400 dark:text-slate-400 block leading-none uppercase mb-0.5">CA</span>
                            <span className="text-slate-800 dark:text-slate-100 font-black block truncate text-xs sm:text-sm">{compactFields.ca}</span>
                          </div>
                        </div>
                      )}
                      {compactFields.meter && (
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Zap className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-yellow-500 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <span className="text-[9px] sm:text-[10px] text-slate-400 dark:text-slate-400 block leading-none uppercase mb-0.5">Meter</span>
                            <span className="text-slate-800 dark:text-slate-100 font-black block truncate text-xs sm:text-sm">{compactFields.meter}</span>
                          </div>
                        </div>
                      )}
                      {compactFields.phone && (
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Phone className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-green-500 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <span className="text-[9px] sm:text-[10px] text-slate-400 dark:text-slate-400 block leading-none uppercase mb-0.5">เบอร์โทร</span>
                            <span className="text-slate-800 dark:text-slate-100 font-black block truncate text-xs sm:text-sm">{compactFields.phone}</span>
                          </div>
                        </div>
                      )}
                      {compactFields.route && (
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Compass className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-blue-500 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <span className="text-[9px] sm:text-[10px] text-slate-400 dark:text-slate-400 block leading-none uppercase mb-0.5">สายป้อน</span>
                            <span className="text-slate-800 dark:text-slate-100 font-black block truncate text-xs sm:text-sm">{compactFields.route}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Inline coordinates */}
                    {lat && lon && (
                      <div className="flex items-center justify-between gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 bg-indigo-50/80 dark:bg-slate-900/90 rounded-lg sm:rounded-xl border border-indigo-200 dark:border-sky-800 text-[11px] sm:text-xs font-bold text-indigo-700 dark:text-sky-300 mb-2.5 sm:mb-3.5">
                        <div className="flex items-center gap-1 min-w-0">
                          <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-500 shrink-0" />
                          <span className="truncate">พิกัด: {lat}, {lon}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => copyCoordinates(lat, lon, index)}
                          className={`px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md sm:rounded-lg text-[10px] sm:text-xs font-black flex items-center gap-1 border-2 border-[#1E293B] dark:border-sky-400 shadow-[1.5px_1.5px_0px_#1E293B] dark:shadow-[1.5px_1.5px_0px_#0284C7] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer shrink-0 ${
                            copiedIndex === index
                              ? 'bg-emerald-400 text-[#1E293B]'
                              : 'bg-white dark:bg-slate-800 dark:hover:bg-sky-600 text-[#1E293B] dark:text-slate-100'
                          }`}
                        >
                          {copiedIndex === index ? (
                            <>
                              <Check className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#1E293B]" />
                              <span>คัดลอกแล้ว!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#1E293B] dark:text-slate-100" />
                              <span>คัดลอก</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}

                    {/* Dynamic Extra Fields */}
                    {compactFields.otherFields.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2.5 sm:mb-3.5">
                        {compactFields.otherFields.map((f, i) => (
                          <span key={i} className="text-[9px] sm:text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded-md font-bold">
                            {f.key}: {f.val}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Action Buttons */}
                    {lat && lon ? (
                      <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                        <button
                          type="button"
                          onClick={() => openGoogleMaps(lat, lon)}
                          className="cyber-btn bg-[#0EA5E9] hover:bg-sky-400 text-white font-black py-2 sm:py-2.5 px-1 sm:px-2 rounded-lg sm:rounded-xl text-[11px] sm:text-xs flex items-center justify-center gap-1 text-center cursor-pointer select-none transition-transform"
                          title="นำทางไปยังตำแหน่งด้วย Google Maps"
                        >
                          <Map className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                          <span>นำทาง</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => copyCoordinates(lat, lon, index)}
                          className={`cyber-btn py-2 sm:py-2.5 px-1 sm:px-2 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-black flex items-center justify-center gap-1 cursor-pointer select-none transition-all ${
                            copiedIndex === index
                              ? 'bg-emerald-400 text-[#1E293B]'
                              : 'bg-[#FDE047] hover:bg-yellow-300 text-[#1E293B]'
                          }`}
                          title="คัดลอกค่าละติจูดและลองจิจูด"
                        >
                          {copiedIndex === index ? (
                            <>
                              <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                              <span>คัดลอกแล้ว</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                              <span>คัดลอกพิกัด</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => shareCoordinates(compactFields, lat, lon)}
                          className="cyber-btn bg-indigo-600 hover:bg-indigo-500 text-white font-black py-2 sm:py-2.5 px-1 sm:px-2 rounded-lg sm:rounded-xl text-[11px] sm:text-xs flex items-center justify-center gap-1 text-center cursor-pointer select-none transition-transform"
                          title="ส่งต่อพิกัดไปยังแอปอื่น (LINE, Messenger ฯลฯ)"
                        >
                          <Share2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                          <span>แชร์พิกัด</span>
                        </button>
                      </div>
                    ) : (
                      <div className="p-2.5 sm:p-3.5 bg-rose-50 dark:bg-rose-950/60 border-3 border-dashed border-rose-200 dark:border-rose-800 rounded-lg sm:rounded-xl flex items-center gap-2 text-rose-600 dark:text-rose-300 text-xs sm:text-sm font-bold">
                        <AlertCircle className="w-4 h-4 sm:w-5.5 sm:h-5.5 shrink-0" />
                        <span>ไม่พบข้อมูลพิกัดละติจูด/ลองจิจูดในผู้ใช้งานไฟรายนี้</span>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>

            {/* Pagination / Load More Button */}
            {searchResults.length > displayLimit && (
              <div className="flex justify-center pt-4 pb-2">
                <button
                  type="button"
                  onClick={() => setDisplayLimit((prev) => prev + 24)}
                  className="cyber-btn bg-indigo-600 hover:bg-indigo-700 text-white font-black py-2.5 px-6 rounded-xl sm:rounded-2xl text-xs sm:text-sm flex items-center gap-2 shadow-[3px_3px_0px_#1E293B] cursor-pointer"
                >
                  <ChevronDown className="w-4 h-4" />
                  <span>แสดงผลลัพธ์เพิ่มเติม (เหลืออีก {searchResults.length - displayLimit} รายการ)</span>
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {/* FLOATING BACK TO TOP BUTTON */}
      {showBackToTop && (
        <button
          type="button"
          onClick={scrollToTop}
          title="เลื่อนกลับขึ้นด้านบน"
          aria-label="Back to top"
          className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 p-2.5 sm:p-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl sm:rounded-2xl border-3 border-[#1E293B] shadow-[3px_3px_0px_#1E293B] sm:shadow-[4px_4px_0px_#1E293B] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer flex items-center justify-center group animate-fadeIn"
        >
          <ArrowUp className="w-5 h-5 sm:w-6 sm:h-6 stroke-[3] group-hover:-translate-y-0.5 transition-transform text-[#FDE047]" />
        </button>
      )}

      {/* PWA CUSTOM INSTALLATION BOTTOM DRAWER */}
      {showInstallBanner && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#1E293B] border-t-4 border-[#FDE047] rounded-t-3xl p-6 shadow-[0_-10px_30px_rgba(0,0,0,0.3)] animate-slideUp max-w-md mx-auto">
          <div className="w-12 h-1.5 bg-slate-700 rounded-full mx-auto mb-4"></div>
          
          <div className="flex items-start gap-4 mb-5">
            <div className="w-16 h-16 rounded-2xl bg-[#0e071f] border-3 border-[#7C3AED] flex items-center justify-center overflow-hidden shrink-0 shadow-lg">
              <img src="/icon.jpg" alt="GPS.Pea Icon" className="w-full h-full object-cover" />
            </div>
            
            <div className="flex-1">
              <h3 className="text-base font-black text-white font-display">
                ติดตั้ง GPS.Pea.TKT บนมือถือ
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed mt-1 font-bold">
                เพื่อความรวดเร็วและพร้อมเข้าถึงระบบแผนที่ผู้ใช้ไฟได้ในทุกพื้นที่ แม้ไม่มีสัญญาณอินเทอร์เน็ต!
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setShowInstallBanner(false)}
              className="flex-1 bg-slate-800 hover:bg-slate-700 border-2 border-slate-700 text-slate-300 font-bold py-3 px-4 rounded-xl text-xs text-center cursor-pointer"
            >
              ไว้ทีหลัง
            </button>
            <button
              onClick={triggerPwaInstall}
              className="flex-1 bg-[#FDE047] hover:bg-yellow-300 border-3 border-[#1E293B] text-[#1E293B] font-extrabold py-3 px-4 rounded-xl text-xs text-center flex items-center justify-center gap-1.5 cursor-pointer shadow-[3px_3px_0px_#1E293B] active:translate-x-0.5 active:translate-y-0.5 transition-all"
            >
              <Download className="w-4 h-4" />
              <span>ติดตั้งแอปบนหน้าจอ</span>
            </button>
          </div>
        </div>
      )}

      {/* Info footer */}
      <footer className="w-full max-w-md md:max-w-2xl text-center mt-12 text-xxs text-slate-500 font-mono font-bold space-y-1">
        <p>© 2026 GPS.Pea.TKT. All rights reserved.</p>
        <p>ขับเคลื่อนด้วยระบบคลาวด์และฐานข้อมูลสนามแบบออฟไลน์ ⚡</p>
      </footer>
    </div>
  );
}
