import React, { useState, useEffect, useRef } from 'react';
import Papa from 'papaparse';
import { 
  User, 
  MapPin, 
  Zap, 
  Home, 
  Phone, 
  Hash, 
  Compass, 
  Sparkles, 
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
  Info
} from 'lucide-react';

// Define the shape of our CSV record dynamically
interface PeaRecord {
  [key: string]: string;
}

const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTsS3z2NT8lcdKRYE40bo1rPVIyc7EGJ0Hz5GkpWBD8STIpNzQS13sZAXSXn-1S90TWahJWLN2C_7Uj/pub?gid=1960280238&single=true&output=csv';

export default function App() {
  // State variables
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allRecords, setAllRecords] = useState<PeaRecord[]>([]);
  const [searchResults, setSearchResults] = useState<PeaRecord[] | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  
  // PWA installation states
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  // Stats / Mascot feedback text
  const [mascotText, setMascotText] = useState('ยินดีต้อนรับฮะ! ป้อน ชื่อ, CA, เลขมิเตอร์ หรือ บ้านเลขที่ เพื่อค้นหาพิกัดได้เลย!');

  // Ref to search input for rapid focus
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Monitor network status
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check if running in standalone mode (already installed)
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
      // Prevent browser default mini-infobar
      e.preventDefault();
      // Save event so we can trigger it later
      setDeferredPrompt(e);
      // If not already installed, show our awesome comic-style bottom sheet banner
      if (!isInstalled) {
        setShowInstallBanner(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // If app installed successfully, hide the prompt
    window.addEventListener('appinstalled', () => {
      console.log('[PWA] App successfully installed!');
      setIsInstalled(true);
      setShowInstallBanner(false);
      setDeferredPrompt(null);
      setMascotText('สุดยอด! ติดตั้งเสร็จเรียบร้อย พร้อมลุยหน้างานแล้วฮะ! 🎉');
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, [isInstalled]);

  // Fetch and cache database (CSV)
  const fetchDatabase = async (forceRefresh = false): Promise<PeaRecord[]> => {
    if (allRecords.length > 0 && !forceRefresh) {
      return allRecords;
    }

    try {
      const response = await fetch(CSV_URL);
      if (!response.ok) throw new Error('ไม่สามารถโหลดฐานข้อมูลจาก Google Sheets ได้');
      
      const csvText = await response.text();
      
      return new Promise<PeaRecord[]>((resolve, reject) => {
        Papa.parse(csvText, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            const data = results.data as PeaRecord[];
            setAllRecords(data);
            const now = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
            setLastUpdated(now);
            resolve(data);
          },
          error: (err) => {
            reject(new Error('เกิดข้อผิดพลาดในการแปลผลข้อมูลไฟล์ CSV'));
          }
        });
      });
    } catch (err: any) {
      console.error('Fetch error:', err);
      throw new Error(err.message || 'เครือข่ายขัดข้อง กรุณาลองใหม่อีกครั้ง');
    }
  };

  // Pre-load data on launch for instant responsiveness
  useEffect(() => {
    setLoading(true);
    fetchDatabase()
      .then((data) => {
        setMascotText(`เชื่อมต่อพิกัดเสร็จสมบูรณ์! โหลดข้อมูลเสร็จแล้วจำนวน ${data.length} รายการฮะ! ⚡`);
      })
      .catch((err) => {
        setError('ไม่สามารถเชื่อมต่อฐานข้อมูลได้ ณ ขณะนี้ แต่อาจใช้ข้อมูลเก่าในแคชได้');
        setMascotText('อุ๊ย... เชื่อมต่อฐานข้อมูลสดไม่ได้ แต่ไม่ต้องห่วงนะฮะ ยังลองค้นหาข้อมูลเก่าในแคชระบบได้อยู่!');
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  // Core search function
  const executeSearch = async (queryStr: string) => {
    const query = queryStr.trim();
    if (!query) {
      setError('กรุณากรอกคำค้นหาด้วยนะฮะ');
      setMascotText('ป้อนคำค้นหาก่อนสิฮะ ไม่งั้นปุ่มแสกนจะทำงานไม่ได้นะเนี้ย! 😅');
      return;
    }

    setLoading(true);
    setError(null);
    setSearchResults(null);
    setMascotText('🤖 กำลังสแกนคลื่นพลังงานพิกัดและประมวลผลระบบเครือข่าย PEA...');

    try {
      // Fetch fresh data (either online fetch or service worker cached fallback)
      const data = await fetchDatabase();

      const searchTerms = query.toLowerCase().split(/\s+/);

      const filtered = data.filter((row) => {
        return searchTerms.every((term) => {
          return Object.entries(row).some(([key, val]) => {
            if (!val) return false;
            const strVal = String(val).toLowerCase().trim();
            const normKey = key.toLowerCase().trim();

            // Special instruction check for "บ้านเลขที่" (type only numbers, skip matching key name)
            if (term.includes('/') || !isNaN(Number(term))) {
              if (normKey.includes('บ้านเลขที่') || normKey.includes('เลขที่') || normKey.includes('address')) {
                return strVal.includes(term);
              }
            }

            return strVal.includes(term);
          });
        });
      });

      // Artificial short cool delay for a gamified cartoon hacking/scanning effect!
      await new Promise(resolve => setTimeout(resolve, 600));

      if (filtered.length === 0) {
        setSearchResults([]);
        setError('ไม่พบข้อมูลตามคำค้นหาที่ท่านระบุ');
        setMascotText('ค้นหาเรียบร้อยแล้วฮะ... น่าเสียดายที่ไม่พบข้อมูลผู้ใช้ไฟที่ต้องการเลย 🥺 ลองพิมพ์แบบอื่นดูนะฮะ!');
      } else {
        setSearchResults(filtered);
        setError(null);
        setMascotText(`ค้นหาสำเร็จ! ตรวจพบข้อมูลพิกัดไฟฟ้า PEA จำนวนทั้งสิ้น ${filtered.length} รายการฮะ! พร้อมลุยพิกัดเลย! 🚀`);
      }
    } catch (err: any) {
      setError(err.message || 'เกิดข้อผิดพลาดในการโหลดข้อมูล');
      setMascotText('ฮือๆ... เกิดข้อผิดพลาดทางเทคนิคระหว่างโหลดข้อมูลเข้าระบบฮะ 💥');
    } finally {
      setLoading(false);
    }
  };

  // Handle Search Submission on button click or form submit
  const handleSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (searchInputRef.current) {
      searchInputRef.current.blur();
    }
    executeSearch(searchTerm);
  };

  // Reset search results if input is completely cleared
  useEffect(() => {
    if (!searchTerm.trim()) {
      setSearchResults(null);
      setError(null);
      setMascotText('ยินดีต้อนรับฮะ! ป้อน ชื่อ, CA, เลขมิเตอร์ หรือ บ้านเลขที่ เพื่อค้นหาพิกัดได้เลย!');
    }
  }, [searchTerm]);

  // Helper function to resolve coordinates from a row
  const resolveCoordinates = (record: PeaRecord) => {
    let lat: string | null = null;
    let lon: string | null = null;

    for (const [key, value] of Object.entries(record)) {
      const normKey = key.toLowerCase().trim();
      const valStr = value?.toString().trim();
      if (!valStr) continue;

      // Match Latitude aliases
      if (
        normKey === 'lat' ||
        normKey === 'latitude' ||
        normKey.includes('ละติจูด') ||
        normKey === 'y' ||
        normKey.includes('พิกัด y') ||
        normKey.includes('latitude_y')
      ) {
        if (!isNaN(parseFloat(valStr))) {
          lat = valStr;
        }
      }

      // Match Longitude aliases
      if (
        normKey === 'lon' ||
        normKey === 'lng' ||
        normKey === 'longitude' ||
        normKey.includes('ลองจิจูด') ||
        normKey === 'x' ||
        normKey.includes('พิกัด x') ||
        normKey.includes('longitude_x')
      ) {
        if (!isNaN(parseFloat(valStr))) {
          lon = valStr;
        }
      }
    }

    // Secondary deep fallback search
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

  // Open Google Maps URL for a record
  const openGoogleMaps = (record: PeaRecord) => {
    const { lat, lon } = resolveCoordinates(record);
    if (lat && lon) {
      const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
      window.open(mapsUrl, '_blank', 'noopener,noreferrer');
    } else {
      alert('ไม่สามารถเปิดแผนที่ได้เนื่องจากไม่พบคอลัมน์พิกัดละติจูด/ลองจิจูดในผู้ใช้งานรายนี้');
    }
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
    // Fallback to first non-empty field that isn't coordinate
    for (const [key, val] of Object.entries(record)) {
      const normK = key.toLowerCase();
      if (val && !normK.includes('lat') && !normK.includes('lon') && !normK.includes('ลองจิ') && !normK.includes('ละติจูด')) {
        return val;
      }
    }
    return 'ผู้รับบริการ PEA';
  };

  // Compactly extract and combine key fields from a record to avoid long vertical lists
  const extractCompactFields = (record: PeaRecord) => {
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
        // e.g. ชื่อ-นามสกุล (already combined)
        firstName = v;
      } else if (kNorm === 'ca' || kNorm.includes('เลขคู่ค้า') || kNorm.includes('บัญชี') || kNorm.includes('contract') || kNorm.includes('เลขผู้ใช้ไฟ') || kNorm === 'รหัสคู่ค้า') {
        ca = v;
      } else if (kNorm.includes('meter') || kNorm.includes('เครื่องวัด') || kNorm.includes('มิเตอร์') || kNorm === 'pea meter') {
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

  // Icon mapping helper for cards
  const getFieldIcon = (key: string) => {
    const normKey = key.toLowerCase().trim();
    if (
      normKey.includes('ชื่อ') || 
      normKey.includes('สกุล') || 
      normKey.includes('ผู้ใช้ไฟ') || 
      normKey.includes('name') || 
      normKey.includes('customer') ||
      normKey.includes('ผู้รับบริการ')
    ) {
      return <User className="w-5 h-5 text-purple-400 shrink-0" />;
    }
    if (
      normKey.includes('meter') || 
      normKey.includes('เครื่องวัด') || 
      normKey.includes('มิเตอร์') || 
      normKey.includes('amp') || 
      normKey.includes('แอมป์') ||
      normKey.includes('pea meter')
    ) {
      return <Zap className="w-5 h-5 text-yellow-400 shrink-0" />;
    }
    if (
      normKey.includes('ca') || 
      normKey.includes('บัญชี') || 
      normKey.includes('contract') || 
      normKey.includes('เลขผู้ใช้ไฟ') ||
      normKey.includes('รหัสคู่ค้า')
    ) {
      return <Hash className="w-5 h-5 text-pink-400 shrink-0" />;
    }
    if (
      normKey.includes('บ้านเลขที่') || 
      normKey.includes('ที่อยู่') || 
      normKey.includes('address') || 
      normKey.includes('หมู่ที่') || 
      normKey.includes('ซอย') || 
      normKey.includes('ถนน') ||
      normKey.includes('สถานที่')
    ) {
      return <Home className="w-5 h-5 text-cyan-400 shrink-0" />;
    }
    if (
      normKey.includes('โทร') || 
      normKey.includes('phone') || 
      normKey.includes('tel') || 
      normKey.includes('มือถือ')
    ) {
      return <Phone className="w-5 h-5 text-green-400 shrink-0" />;
    }
    if (
      normKey.includes('สาย') || 
      normKey.includes('route') || 
      normKey.includes('สายป้อน') || 
      normKey.includes('ฟีดเดอร์') || 
      normKey.includes('feeder') ||
      normKey.includes('คิว')
    ) {
      return <Compass className="w-5 h-5 text-blue-400 shrink-0" />;
    }
    if (
      normKey.includes('lat') || 
      normKey.includes('lon') || 
      normKey.includes('ละติ') || 
      normKey.includes('ลองจิ') || 
      normKey.includes('พิกัด') || 
      normKey === 'x' || 
      normKey === 'y'
    ) {
      return <MapPin className="w-5 h-5 text-red-400 shrink-0" />;
    }
    return <Sparkles className="w-5 h-5 text-violet-400 shrink-0" />;
  };

  // Trigger PWA Installation Flow
  const triggerPwaInstall = async () => {
    if (!deferredPrompt) return;
    
    // Hide our installation modal
    setShowInstallBanner(false);
    
    // Show the native install prompt
    deferredPrompt.prompt();
    
    // Wait for user choice
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`[PWA] User response to install prompt: ${outcome}`);
    
    // Clear deferred prompt so we can't use it again
    setDeferredPrompt(null);
  };

  // Auto-fill template searches for user ease
  const handleQuickSearch = (term: string) => {
    setSearchTerm(term);
    // Focus search input
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
    executeSearch(term);
  };

  return (
    <div className="min-h-screen bg-[#F3E8FF] pb-24 px-4 pt-4 font-sans text-slate-800 flex flex-col items-center selection:bg-purple-200">
      
      {/* Network Status Floating Capsule */}
      <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-3.5 py-1.5 rounded-full border-3 text-xs font-black shadow-md transition-all duration-300 border-[#1E293B] ${
        isOffline 
        ? 'bg-rose-100 text-rose-800 shadow-[2px_2px_0px_#1E293B] animate-pulse' 
        : 'bg-emerald-100 text-emerald-800 shadow-[2px_2px_0px_#1E293B]'
      }`}>
        {isOffline ? (
          <>
            <WifiOff className="w-4.5 h-4.5" />
            <span>ออฟไลน์ (แคชข้อมูล)</span>
          </>
        ) : (
          <>
            <Wifi className="w-4.5 h-4.5 text-emerald-600 animate-cyber-pulse" />
            <span>เชื่อมฐานข้อมูล PEA</span>
          </>
        )}
      </div>

      {/* Main Comic Header */}
      <header className="w-full max-w-md text-center mt-6 mb-6 flex flex-col items-center">
        {/* Animated Cyber PEA Mascot Logo */}
        <div className="relative group mb-3">
          <div className="absolute -inset-1.5 bg-gradient-to-r from-purple-600 via-pink-500 to-yellow-400 rounded-full blur opacity-75 group-hover:opacity-100 transition duration-1000 group-hover:duration-200 animate-pulse"></div>
          <div className="relative w-24 h-24 rounded-full bg-white border-4 border-[#1E293B] flex items-center justify-center overflow-hidden shadow-xl">
            <img 
              src="/icon.jpg" 
              alt="PEA TKT Logo" 
              className="w-full h-full object-cover transform hover:scale-110 transition duration-300"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
            {/* Mascot alternative icon if image fails */}
            <Zap className="absolute w-12 h-12 text-[#FDE047] fill-current animate-bounce" />
          </div>
          {/* Glowing badge */}
          <span className="absolute -bottom-1 -right-1 bg-[#FDE047] text-[#1E293B] text-xxs px-2.5 py-0.5 rounded-md font-black border-3 border-[#1E293B] rotate-12 shadow-[2px_2px_0px_#1E293B]">
            GPS.Pea.TKT
          </span>
        </div>

        {/* Brand Typography */}
        <h1 className="text-4xl font-black tracking-tight text-[#1E293B] font-display uppercase">
          GPS.Pea.TKT
        </h1>
        <p className="text-xs text-[#7C3AED] font-black tracking-widest uppercase mt-1">
          ⚡ FIELD SERVICE TOOL ⚡
        </p>
      </header>

      {/* Mascot / Interactive Advice Box */}
      <div className="w-full max-w-md bg-white border-4 border-[#1E293B] rounded-2xl p-4 mb-6 shadow-[4px_4px_0px_#1E293B] relative overflow-hidden flex gap-3.5 items-center">
        {/* Tech Decorator lines */}
        <div className="absolute top-0 left-0 h-1.5 bg-gradient-to-r from-[#7C3AED] to-[#5B21B6] w-full"></div>
        
        {/* Animated robot/lightning mascot inside advice box */}
        <div className="w-12 h-12 rounded-xl bg-[#FDE047] border-3 border-[#1E293B] flex items-center justify-center shrink-0 shadow-[2px_2px_0px_#1E293B]">
          <Activity className="w-7 h-7 text-[#1E293B] animate-pulse" />
        </div>
        
        <div className="flex-1">
          <p className="text-[10px] text-[#7C3AED] font-black uppercase tracking-widest mb-0.5">PEA-BOT แนะนำ:</p>
          <p className="text-xs text-[#1E293B] font-bold leading-relaxed font-sans">{mascotText}</p>
        </div>
      </div>

      {/* Core Search Panel (Cyber Card style) */}
      <section className="w-full max-w-md cyber-card p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-black text-[#1E293B] flex items-center gap-2 font-display">
            <Layers className="w-5 h-5 text-[#7C3AED]" />
            ระบุข้อมูลเพื่อแสกน
          </h2>
          {allRecords.length > 0 && (
            <span className="text-[10px] bg-[#F3E8FF] text-[#7C3AED] border-2 border-[#1E293B] px-2.5 py-0.5 rounded-full font-black">
              DB: {allRecords.length} รายการ
            </span>
          )}
        </div>

        <form onSubmit={handleSearch} className="space-y-4">
          <div className="relative">
            <input
              ref={searchInputRef}
              type="text"
              placeholder="พิมพ์ชื่อ, นามสกุล, CA, เลขมิเตอร์ หรือ เลขบ้าน..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full py-3.5 pl-4 pr-12 text-slate-800 rounded-xl font-sans text-sm cyber-input font-bold placeholder-slate-400"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-500 hover:text-slate-800 rounded-full hover:bg-slate-100 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 cyber-btn bg-[#0EA5E9] hover:bg-sky-400 disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-300 text-white font-black py-3.5 px-4 rounded-xl text-sm flex items-center justify-center gap-2 text-center cursor-pointer select-none"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-cyber-spin text-[#FDE047]" />
                  <span>กำลังแสกนสัญญาณไฟ...</span>
                </>
              ) : (
                <>
                  <Search className="w-5 h-5" />
                  <span>ค้นหาข้อมูลพิกัด (สแกน)</span>
                </>
              )}
            </button>
            
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
              className="cyber-btn bg-white hover:bg-slate-50 text-slate-700 px-3 rounded-xl flex items-center justify-center cursor-pointer"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </form>

        {/* Quick Search Templates */}
        <div className="mt-4 pt-4 border-t-2 border-dashed border-slate-200">
          <p className="text-xxs text-slate-500 uppercase tracking-widest font-black mb-2">💡 ตัวอย่างการค้นหาด่วน:</p>
          <div className="flex flex-wrap gap-1.5">
            <button 
              type="button"
              onClick={() => handleQuickSearch('020')} 
              className="text-xs bg-purple-50 hover:bg-purple-100 text-[#7C3AED] px-3 py-1.5 rounded-xl border-2 border-[#1E293B] font-bold transition"
            >
              รหัส CA (020)
            </button>
            <button 
              type="button"
              onClick={() => handleQuickSearch('สม')} 
              className="text-xs bg-purple-50 hover:bg-purple-100 text-[#7C3AED] px-3 py-1.5 rounded-xl border-2 border-[#1E293B] font-bold transition"
            >
              ชื่อ "สม"
            </button>
            <button 
              type="button"
              onClick={() => handleQuickSearch('5')} 
              className="text-xs bg-purple-50 hover:bg-purple-100 text-[#7C3AED] px-3 py-1.5 rounded-xl border-2 border-[#1E293B] font-bold transition"
            >
              บ้านเลขที่ (5)
            </button>
          </div>
        </div>

        {/* Database update time stamp indicator */}
        {lastUpdated && (
          <div className="mt-4 flex items-center justify-between text-xxs text-slate-500 font-mono font-bold">
            <span className="flex items-center gap-1">
              <Database className="w-3.5 h-3.5 text-[#7C3AED]" />
              ฐานข้อมูลพร้อมใช้งานแบบออฟไลน์
            </span>
            <span>อัปเดต: {lastUpdated} น.</span>
          </div>
        )}
      </section>

      {/* ERROR Banner */}
      {error && (
        <div className="w-full max-w-md bg-rose-50 border-4 border-[#1E293B] rounded-2xl p-4 mb-6 shadow-[4px_4px_0px_#E11D48] flex items-start gap-3.5 text-rose-950 animate-fadeIn">
          <AlertCircle className="w-6 h-6 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-black text-rose-800 font-display">ขออภัยฮะ!</h3>
            <p className="text-xs leading-relaxed font-bold mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* RESULTS DISPLAY PANEL */}
      <main className="w-full max-w-md space-y-6">
        {searchResults && searchResults.length > 0 && (
          <div className="flex items-center justify-between px-2 mb-2">
            <span className="text-xs text-[#7C3AED] font-black uppercase tracking-wider">
              🟢 ผลการสแกนพิกัด ({searchResults.length} รายการ)
            </span>
            <button 
              onClick={() => setSearchResults(null)}
              className="text-xs text-slate-500 hover:text-slate-800 underline font-bold"
            >
              ล้างผลลัพธ์
            </button>
          </div>
        )}

        {searchResults && searchResults.map((record, index) => {
          const { lat, lon } = resolveCoordinates(record);
          const fields = extractCompactFields(record);

          return (
            <article 
              key={index} 
              className="cyber-card p-4.5 relative overflow-hidden flex flex-col justify-between"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              {/* Highlight match banner */}
              <div className="absolute top-0 right-0 bg-[#FDE047] text-[#1E293B] text-[10px] font-black px-3 py-1.5 rounded-bl-xl border-l-4 border-b-4 border-[#1E293B]">
                {lat && lon ? '📍 พร้อมสแกน' : '❌ ไม่มีพิกัด'}
              </div>

              {/* Compact Header: Name and Address inline/grouped */}
              <div className="mb-3.5 pr-16 flex items-start gap-2.5">
                <div className="mt-0.5 p-1.5 rounded-xl bg-slate-100 border-2 border-[#1E293B] shrink-0">
                  <User className="w-5.5 h-5.5 text-[#7C3AED]" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] text-[#7C3AED] font-black tracking-widest uppercase mb-0.5">ผู้ใช้ไฟ PEA</p>
                  <h3 className="text-lg font-black text-slate-800 leading-tight font-display break-words">
                    {fields.fullName}
                  </h3>
                  {fields.address && (
                    <p className="text-sm font-bold text-slate-600 mt-1 flex items-start gap-1 leading-snug break-words">
                      <Home className="w-4 h-4 text-cyan-600 shrink-0 mt-0.5" />
                      <span>{fields.address}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Core Metadata Row: CA, Meter, Phone, Route in compact grid */}
              <div className="grid grid-cols-2 gap-2.5 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl p-3 mb-3.5 text-sm font-bold">
                {fields.ca && (
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Hash className="w-4.5 h-4.5 text-pink-500 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] text-slate-400 block leading-none uppercase mb-0.5">CA</span>
                      <span className="text-slate-800 font-black block truncate text-sm">{fields.ca}</span>
                    </div>
                  </div>
                )}
                {fields.meter && (
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Zap className="w-4.5 h-4.5 text-yellow-500 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] text-slate-400 block leading-none uppercase mb-0.5">Meter</span>
                      <span className="text-slate-800 font-black block truncate text-sm">{fields.meter}</span>
                    </div>
                  </div>
                )}
                {fields.phone && (
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Phone className="w-4.5 h-4.5 text-green-500 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] text-slate-400 block leading-none uppercase mb-0.5">เบอร์โทร</span>
                      <span className="text-slate-800 font-black block truncate text-sm">{fields.phone}</span>
                    </div>
                  </div>
                )}
                {fields.route && (
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Compass className="w-4.5 h-4.5 text-blue-500 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] text-slate-400 block leading-none uppercase mb-0.5">สายป้อน</span>
                      <span className="text-slate-800 font-black block truncate text-sm">{fields.route}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Inline coordinates check if present */}
              {lat && lon && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 rounded-lg border border-purple-100 text-xs font-bold text-[#7C3AED] mb-3.5">
                  <MapPin className="w-4 h-4 text-rose-500 shrink-0" />
                  <span>พิกัดทางภูมิศาสตร์: {lat}, {lon}</span>
                </div>
              )}

              {/* Dynamic Extra Fields if any */}
              {fields.otherFields.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3.5">
                  {fields.otherFields.map((f, i) => (
                    <span key={i} className="text-[10px] bg-slate-100 text-slate-600 border border-slate-200 px-2.5 py-0.5 rounded-md font-bold">
                      {f.key}: {f.val}
                    </span>
                  ))}
                </div>
              )}

              {/* Action Buttons: Open Google Maps */}
              {lat && lon ? (
                <button
                  onClick={() => openGoogleMaps(record)}
                  className="w-full cyber-btn bg-[#0EA5E9] hover:bg-sky-400 text-white font-black py-3.5 px-4 rounded-xl text-base flex items-center justify-center gap-2 text-center cursor-pointer select-none transition-transform"
                >
                  <Map className="w-5.5 h-5.5 shrink-0" />
                  <span>นำทางด้วย Google Maps</span>
                </button>
              ) : (
                <div className="p-3.5 bg-rose-50 border-4 border-dashed border-rose-200 rounded-xl flex items-center gap-2 text-rose-600 text-sm font-bold">
                  <AlertCircle className="w-5.5 h-5.5 shrink-0" />
                  <span>ไม่พบข้อมูลพิกัดละติจูด/ลองจิจูดในผู้ใช้งานไฟรายนี้</span>
                </div>
              )}
            </article>
          );
        })}
      </main>

      {/* PWA CUSTOM INSTALLATION BOTTOM DRAWER */}
      {showInstallBanner && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#1E293B] border-t-4 border-[#FDE047] rounded-t-3xl p-6 shadow-[0_-10px_30px_rgba(0,0,0,0.3)] animate-slideUp max-w-md mx-auto">
          {/* Top cute cartoon pull indicator */}
          <div className="w-12 h-1.5 bg-slate-700 rounded-full mx-auto mb-4"></div>
          
          <div className="flex items-start gap-4 mb-5">
            {/* App Icon Preview */}
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
      <footer className="w-full max-w-md text-center mt-12 text-xxs text-slate-500 font-mono font-bold space-y-1">
        <p>© 2026 GPS.Pea.TKT. All rights reserved.</p>
        <p>ขับเคลื่อนด้วยระบบคลาวด์และฐานข้อมูลสนามแบบออฟไลน์ ⚡</p>
      </footer>
    </div>
  );
}
