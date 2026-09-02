import React from 'react';
import { 
  Search, 
  Zap, 
  MapPin, 
  Database, 
  Activity, 
  CheckCircle2, 
  Clock, 
  ArrowRight, 
  Wifi, 
  WifiOff, 
  FileText, 
  PlusCircle, 
  Sparkles,
  Smartphone,
  ChevronRight,
  ShieldAlert,
  Gauge
} from 'lucide-react';
import { ActiveTab, RecloserLog } from '../types';
import peaBotMascotImg from '../assets/images/pea_bot_mascot_1786454271309.jpg';

interface HomeTabProps {
  totalRecordsCount: number;
  recloserLogs: RecloserLog[];
  syncStatus: 'live' | 'cached' | 'error';
  isOffline: boolean;
  lastSyncFullDate: string | null;
  onNavigateTab: (tab: ActiveTab) => void;
  onQuickSearch?: (query: string) => void;
}

export const HomeTab: React.FC<HomeTabProps> = ({
  totalRecordsCount,
  recloserLogs,
  syncStatus,
  isOffline,
  lastSyncFullDate,
  onNavigateTab
}) => {
  const latestRecloser = recloserLogs.length > 0 ? recloserLogs[0] : null;

  return (
    <div className="w-full flex flex-col gap-3 pb-6 max-w-md mx-auto animate-fadeIn">
      
      {/* 1. HERO BANNER */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-purple-950/90 via-slate-900 to-slate-950 border border-purple-500/30 p-4 sm:p-5 shadow-xl">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -mb-8 -ml-8 w-32 h-32 bg-amber-500/15 rounded-full blur-2xl pointer-events-none" />
        
        <div className="relative z-10 flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-purple-500/20 border border-purple-400/30 text-purple-300 text-[10px] font-bold mb-1.5">
              <Sparkles className="w-3 h-3 text-amber-400 shrink-0" />
              <span className="truncate">PEA Smart Field System</span>
            </div>
            <h1 className="text-lg sm:text-xl font-black text-white tracking-tight leading-snug">
              ระบบสารสนเทศ<br />
              <span className="bg-gradient-to-r from-amber-300 via-purple-200 to-cyan-300 bg-clip-text text-transparent">
                การไฟฟ้าส่วนภูมิภาค
              </span>
            </h1>
            <p className="text-[11px] sm:text-xs text-slate-300 mt-1 font-medium leading-relaxed">
              เครื่องมือสนับสนุนงานภาคสนาม: ค้นหาพิกัดผู้ใช้ไฟ & จดบันทึก Recloser
            </p>
          </div>

          {/* 3D Mascot Avatar */}
          <div className="shrink-0 relative group">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden border-2 border-amber-400/80 shadow-xl shadow-purple-950/80 bg-slate-900 p-0.5 transform transition-transform group-hover:scale-105">
              <img 
                src={peaBotMascotImg} 
                alt="PEA Bot 3D" 
                className="w-full h-full object-cover rounded-xl"
              />
            </div>
            <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-slate-950 text-[8px] font-black px-1.5 py-0.2 rounded-full border border-slate-900 shadow">
              ONLINE
            </div>
          </div>
        </div>

        {/* Quick System Stats Bar */}
        <div className="mt-3 pt-3 border-t border-purple-500/20 grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-2 bg-slate-900/80 backdrop-blur-sm p-2 rounded-xl border border-purple-400/20">
            <Database className="w-4 h-4 text-purple-400 shrink-0" />
            <div className="truncate">
              <div className="text-[9px] text-slate-400 font-semibold">ฐานข้อมูลผู้ใช้ไฟ</div>
              <div className="text-xs font-bold text-white font-mono">
                {totalRecordsCount > 0 ? `${totalRecordsCount.toLocaleString()} รายการ` : 'พร้อมใช้งาน'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-slate-900/80 backdrop-blur-sm p-2 rounded-xl border border-purple-400/20">
            <Zap className="w-4 h-4 text-amber-400 shrink-0" />
            <div className="truncate">
              <div className="text-[9px] text-slate-400 font-semibold">ประวัติ Recloser</div>
              <div className="text-xs font-bold text-amber-300 font-mono">
                {recloserLogs.length} รายการ
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. TWO PRIMARY FUNCTION CARDS (PROPORTIONAL MOBILE TOUCH TARGETS) */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-black text-slate-300 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-purple-400" />
            <span>เลือกฟังก์ชันการทำงานหลัก</span>
          </span>
          <span className="text-[10px] text-slate-500">แตะเพื่อเข้าใช้งาน</span>
        </div>

        {/* FUNCTION 1: ค้นหาผู้ใช้ไฟ */}
        <div 
          id="btn-nav-search-consumer"
          onClick={() => onNavigateTab('search')}
          className="group relative overflow-hidden bg-gradient-to-r from-slate-900 via-indigo-950/60 to-slate-900 hover:from-purple-950/90 hover:via-indigo-900/80 hover:to-slate-900 border border-slate-800 hover:border-purple-500/60 rounded-3xl p-3.5 sm:p-4 cursor-pointer transition-all duration-200 shadow-lg hover:shadow-purple-900/30 active:scale-[0.98]"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400 group-hover:bg-purple-600 group-hover:text-white transition-all shadow-inner shrink-0">
              <Search className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-[9px] font-black px-1.5 py-0.2 rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  ฟังก์ชัน 1
                </span>
                <h3 className="text-sm sm:text-base font-black text-white group-hover:text-amber-300 transition-colors truncate">
                  ค้นหาผู้ใช้ไฟ & พิกัด GPS
                </h3>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-400 font-medium line-clamp-2 leading-relaxed">
                ค้นหาด้วยเลข CA, PEA Meter, บ้านเลขที่/หมู่ และชื่อผู้ใช้ไฟ พร้อมนำทาง Google Maps
              </p>

              <div className="mt-2 flex items-center gap-1.5 flex-wrap text-[10px] font-bold text-purple-300">
                <span className="flex items-center gap-1 bg-purple-950/80 border border-purple-800/60 px-2 py-0.5 rounded-lg">
                  <Smartphone className="w-3 h-3 text-amber-400" />
                  สั่งการด้วยเสียง
                </span>
                <span className="flex items-center gap-1 bg-purple-950/80 border border-purple-800/60 px-2 py-0.5 rounded-lg">
                  <MapPin className="w-3 h-3 text-emerald-400" />
                  พิกัดนำทาง 100%
                </span>
              </div>
            </div>

            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-800 group-hover:bg-purple-600 group-hover:text-white text-slate-400 flex items-center justify-center shrink-0 transition-all">
              <ChevronRight className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* FUNCTION 2: จดหน่วย Recloser (7 จุดหลัก) */}
        <div 
          id="btn-nav-recloser"
          onClick={() => onNavigateTab('recloser')}
          className="group relative overflow-hidden bg-gradient-to-r from-slate-900 via-amber-950/30 to-slate-900 hover:from-amber-950/70 hover:via-orange-950/50 hover:to-slate-900 border border-slate-800 hover:border-amber-500/60 rounded-3xl p-3.5 sm:p-4 cursor-pointer transition-all duration-200 shadow-lg hover:shadow-amber-900/20 active:scale-[0.98]"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 group-hover:bg-amber-500 group-hover:text-slate-950 transition-all shadow-inner shrink-0">
              <Zap className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-[9px] font-black px-1.5 py-0.2 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  ฟังก์ชัน 2
                </span>
                <h3 className="text-sm sm:text-base font-black text-white group-hover:text-amber-300 transition-colors truncate">
                  จดหน่วย Recloser (7 จุดหลัก)
                </h3>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-400 font-medium line-clamp-2 leading-relaxed">
                บันทึกค่า Counter (B/R, A, B, C, G) และ Current (A, B, C, G) พร้อมดูประวัติย้อนหลัง
              </p>

              <div className="mt-2 flex items-center gap-1.5 flex-wrap text-[10px] font-bold text-amber-300">
                <span className="flex items-center gap-1 bg-amber-950/80 border border-amber-800/60 px-2 py-0.5 rounded-lg">
                  <Activity className="w-3 h-3 text-amber-400" />
                  Counter B/R & เฟส
                </span>
                <span className="flex items-center gap-1 bg-amber-950/80 border border-amber-800/60 px-2 py-0.5 rounded-lg">
                  <FileText className="w-3 h-3 text-cyan-400" />
                  ดูย้อนหลัง & ส่ง LINE
                </span>
              </div>
            </div>

            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-800 group-hover:bg-amber-500 group-hover:text-slate-950 text-slate-400 flex items-center justify-center shrink-0 transition-all">
              <ChevronRight className="w-4 h-4" />
            </div>
          </div>
        </div>
      </div>

      {/* 3. RECENT RECLOSER LOG PREVIEW */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-3.5 sm:p-4 shadow-md">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400" />
            <h4 className="text-xs font-black text-white">บันทึก Recloser ล่าสุด</h4>
          </div>
          <button
            onClick={() => onNavigateTab('recloser')}
            className="text-[11px] font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
          >
            ดูประวัติ ({recloserLogs.length})
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {latestRecloser ? (
          <div 
            onClick={() => onNavigateTab('recloser')}
            className="bg-slate-950/90 hover:bg-slate-900 border border-slate-800 hover:border-amber-500/40 rounded-2xl p-3 cursor-pointer transition-all flex flex-col gap-2 shadow-inner"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950 font-black text-xs px-2 py-0.5 rounded-lg font-mono">
                  {latestRecloser.recloserId}
                </span>
                <span className="text-xs font-bold text-white truncate max-w-[150px] sm:max-w-[200px]">
                  {latestRecloser.recloserName}
                </span>
              </div>
              <span className="text-[10px] text-amber-300 font-mono font-bold">
                {latestRecloser.recordDate} {latestRecloser.recordTime} น.
              </span>
            </div>

            <div className="grid grid-cols-3 gap-1.5 text-[10px] bg-slate-900/95 p-2 rounded-xl border border-slate-800 font-mono">
              <div>
                <span className="text-slate-400 block text-[9px]">Counter B/R:</span>
                <span className="text-amber-300 font-bold">{latestRecloser.counterBR ?? '-'} ครั้ง</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[9px]">Current A/B/C:</span>
                <span className="text-cyan-300 font-bold truncate block">
                  {latestRecloser.currentA ?? '-'}/{latestRecloser.currentB ?? '-'}/{latestRecloser.currentC ?? '-'} A
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[9px]">Current Ig:</span>
                <span className="text-teal-300 font-bold truncate block">{latestRecloser.currentG !== undefined ? `${latestRecloser.currentG} A` : '-'}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-slate-950/60 border border-dashed border-slate-800 rounded-2xl p-4 text-center">
            <Zap className="w-5 h-5 text-slate-600 mx-auto mb-1" />
            <p className="text-xs text-slate-400 font-medium">ยังไม่มีข้อมูลการจดหน่วย Recloser</p>
            <button
              onClick={() => onNavigateTab('recloser')}
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-amber-400 hover:text-amber-300 bg-amber-500/10 border border-amber-500/30 px-3 py-1 rounded-xl cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              จดหน่วย Recloser รายการแรก
            </button>
          </div>
        )}
      </div>

      {/* 4. SYSTEM STATUS PILL */}
      <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-2.5 sm:p-3 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-2">
          {isOffline ? (
            <WifiOff className="w-4 h-4 text-rose-400 shrink-0" />
          ) : (
            <Wifi className="w-4 h-4 text-emerald-400 shrink-0" />
          )}
          <span className="text-[11px] font-medium truncate">
            {isOffline ? 'โหมดออฟไลน์ (ใช้งานจากแคช)' : 'เชื่อมต่อฐานข้อมูล PEA พร้อมใช้งาน'}
          </span>
        </div>
        {lastSyncFullDate && (
          <span className="text-[10px] text-slate-500 font-mono shrink-0 ml-1">
            ซิงค์: {lastSyncFullDate.split(' ')[1] || lastSyncFullDate}
          </span>
        )}
      </div>

    </div>
  );
};
