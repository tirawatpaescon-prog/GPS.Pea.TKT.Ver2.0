import React, { useState, useMemo, useEffect } from 'react';
import {
  Lightbulb,
  CheckCircle2,
  Clock,
  MapPin,
  ExternalLink,
  Search,
  Filter,
  Share2,
  Copy,
  Check,
  Zap,
  Building2,
  FileSpreadsheet,
  FileText,
  RotateCcw,
  SlidersHorizontal,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  TrendingUp
} from 'lucide-react';
import { STREETLIGHT_TRANSFORMERS, STREETLIGHT_VILLAGES, StreetlightTransformer } from '../data/streetlightSurveyData';

const STORAGE_KEY = 'pea_streetlight_survey_statuses_v1';

interface StoredStatus {
  status: 'สำรวจแล้ว' | 'ยังไม่สำรวจ';
  updatedAt: number;
}

interface StreetlightTabProps {
  initialVillage?: string | null;
}

export const StreetlightTab: React.FC<StreetlightTabProps> = ({ initialVillage = null }) => {
  // 1. Status state loaded from localStorage, with fallback to initial status in dataset
  const [statusMap, setStatusMap] = useState<Record<string, StoredStatus>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Failed to load streetlight survey statuses:', e);
    }
    // Default from dataset
    const defaults: Record<string, StoredStatus> = {};
    STREETLIGHT_TRANSFORMERS.forEach((item) => {
      defaults[item.peano] = {
        status: item.initialSurveyStatus,
        updatedAt: Date.now()
      };
    });
    return defaults;
  });

  // Save to localStorage when statusMap changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(statusMap));
    } catch (e) {
      console.error('Failed to persist streetlight survey statuses:', e);
    }
  }, [statusMap]);

  // 2. Active village tab state ('all' or village name)
  const [activeVillage, setActiveVillage] = useState<string>(initialVillage || 'all');

  // 3. Status filter: 'all' | 'pending' | 'completed'
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed'>('all');

  // 4. Search text
  const [searchQuery, setSearchQuery] = useState<string>('');

  // 5. Toast / Feedback state
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Toggle status handler
  const handleToggleStatus = (peano: string) => {
    const current = statusMap[peano]?.status || 'ยังไม่สำรวจ';
    const nextStatus = current === 'สำรวจแล้ว' ? 'ยังไม่สำรวจ' : 'สำรวจแล้ว';

    setStatusMap((prev) => ({
      ...prev,
      [peano]: {
        status: nextStatus,
        updatedAt: Date.now()
      }
    }));

    showToast(
      nextStatus === 'สำรวจแล้ว'
        ? `✅ บันทึกหม้อแปลง ${peano} เป็น "สำรวจแล้ว"`
        : `⏳ ปรับหม้อแปลง ${peano} เป็น "ยังไม่สำรวจ"`
    );
  };

  // Reset to original status from CSV file
  const handleResetToDefault = () => {
    if (window.confirm('ต้องการรีเซ็ตสถานะการสำรวจกลับเป็นค่าเริ่มต้นตามไฟล์ระบบหรือไม่?')) {
      const defaults: Record<string, StoredStatus> = {};
      STREETLIGHT_TRANSFORMERS.forEach((item) => {
        defaults[item.peano] = {
          status: item.initialSurveyStatus,
          updatedAt: Date.now()
        };
      });
      setStatusMap(defaults);
      showToast('🔄 รีเซ็ตสถานะกลับเป็นค่าเริ่มต้นแล้ว');
    }
  };

  // Village Navigation helpers
  const handlePrevVillage = () => {
    if (activeVillage === 'all') return;
    const idx = STREETLIGHT_VILLAGES.indexOf(activeVillage);
    if (idx > 0) {
      setActiveVillage(STREETLIGHT_VILLAGES[idx - 1]);
    } else {
      setActiveVillage('all');
    }
  };

  const handleNextVillage = () => {
    if (activeVillage === 'all') {
      if (STREETLIGHT_VILLAGES.length > 0) {
        setActiveVillage(STREETLIGHT_VILLAGES[0]);
      }
      return;
    }
    const idx = STREETLIGHT_VILLAGES.indexOf(activeVillage);
    if (idx < STREETLIGHT_VILLAGES.length - 1) {
      setActiveVillage(STREETLIGHT_VILLAGES[idx + 1]);
    } else {
      setActiveVillage('all');
    }
  };

  // Statistics calculation
  const overallStats = useMemo(() => {
    let completed = 0;
    let totalAffected = 0;
    const villageCounts: Record<string, { total: number; completed: number; affected: number }> = {};

    STREETLIGHT_VILLAGES.forEach((v) => {
      villageCounts[v] = { total: 0, completed: 0, affected: 0 };
    });

    STREETLIGHT_TRANSFORMERS.forEach((t) => {
      const isCompleted = (statusMap[t.peano]?.status || t.initialSurveyStatus) === 'สำรวจแล้ว';
      if (isCompleted) completed++;
      totalAffected += t.affected;

      if (villageCounts[t.village]) {
        villageCounts[t.village].total += 1;
        if (isCompleted) villageCounts[t.village].completed += 1;
        villageCounts[t.village].affected += t.affected;
      }
    });

    const total = STREETLIGHT_TRANSFORMERS.length;
    const pending = total - completed;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

    return {
      total,
      completed,
      pending,
      percent,
      totalAffected,
      villageCounts
    };
  }, [statusMap]);

  // Current selected village stats
  const selectedVillageStats = useMemo(() => {
    if (activeVillage === 'all') {
      return overallStats;
    }
    const c = overallStats.villageCounts[activeVillage] || { total: 0, completed: 0, affected: 0 };
    const pending = c.total - c.completed;
    const percent = c.total > 0 ? Math.round((c.completed / c.total) * 100) : 0;
    return {
      total: c.total,
      completed: c.completed,
      pending,
      percent,
      totalAffected: c.affected
    };
  }, [activeVillage, overallStats]);

  // Filter transformers
  const filteredTransformers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return STREETLIGHT_TRANSFORMERS.filter((item) => {
      // 1. Village filter
      if (activeVillage !== 'all' && item.village !== activeVillage) {
        return false;
      }

      // 2. Status filter
      const currentStatus = statusMap[item.peano]?.status || item.initialSurveyStatus;
      if (statusFilter === 'completed' && currentStatus !== 'สำรวจแล้ว') {
        return false;
      }
      if (statusFilter === 'pending' && currentStatus !== 'ยังไม่สำรวจ') {
        return false;
      }

      // 3. Search query
      if (q) {
        const matchPeano = item.peano.toLowerCase().includes(q);
        const matchLoc = item.location.toLowerCase().includes(q);
        const matchVillage = item.village.toLowerCase().includes(q);
        const matchPhase = item.phase.toLowerCase().includes(q);
        const matchKva = item.kva.toString().includes(q);
        if (!matchPeano && !matchLoc && !matchVillage && !matchPhase && !matchKva) {
          return false;
        }
      }

      return true;
    });
  }, [activeVillage, statusFilter, searchQuery, statusMap]);

  // Copy details helper
  const handleCopyDetails = (item: StreetlightTransformer) => {
    const currentStatus = statusMap[item.peano]?.status || item.initialSurveyStatus;
    const text = `หม้อแปลง: ${item.peano} (${item.phase} ${item.kva} kVA)\nหมู่บ้าน: ${item.village}\nสถานที่: ${item.location}\nสถานะสำรวจโคมไฟ: ${currentStatus}\nพิกัด: ${item.latlong || `${item.latitude}, ${item.longitude}`}`;
    navigator.clipboard.writeText(text);
    setCopiedId(item.peano);
    showToast(`คัดลอกข้อมูลหม้อแปลง ${item.peano} แล้ว`);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Copy LINE summary memo
  const handleCopyLineSummary = () => {
    const now = new Date();
    const dateStr = now.toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });

    let msg = `⚡ สรุปผลสำรวจโคมไฟส่องสว่าง PEA.TKT ⚡\n`;
    msg += `📅 วันที่: ${dateStr}\n`;
    if (activeVillage !== 'all') {
      msg += `🏘️ หมู่บ้าน: ${activeVillage}\n`;
      msg += `📊 ความคืบหน้า: สำรวจแล้ว ${selectedVillageStats.completed}/${selectedVillageStats.total} เครื่อง (${selectedVillageStats.percent}%)\n`;
      msg += `⏳ คงเหลือยังไม่สำรวจ: ${selectedVillageStats.pending} เครื่อง\n`;
    } else {
      msg += `📊 ภาพรวมทั้งหมด 23 หมู่บ้าน:\n`;
      msg += `✅ สำรวจแล้ว: ${overallStats.completed}/${overallStats.total} เครื่อง (${overallStats.percent}%)\n`;
      msg += `⏳ คงเหลือยังไม่สำรวจ: ${overallStats.pending} เครื่อง\n`;
      msg += `👥 ผู้ใช้ไฟได้รับผลกระทบรวม: ${overallStats.totalAffected.toLocaleString()} ราย\n`;
    }

    msg += `\n📝 รายการหม้อแปลง (${filteredTransformers.length} เครื่อง):\n`;
    filteredTransformers.forEach((item, idx) => {
      const st = statusMap[item.peano]?.status || item.initialSurveyStatus;
      const mark = st === 'สำรวจแล้ว' ? '✅' : '⏳';
      msg += `${idx + 1}. [${mark}] ${item.peano} (${item.kva} kVA) - ${item.location}\n`;
    });

    navigator.clipboard.writeText(msg);
    showToast('📋 คัดลอกสรุปผลสำรวจสำหรับส่ง LINE เรียบร้อย');
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = [
      'ลำดับ',
      'รหัสหม้อแปลง (PEA No)',
      'สถานะสำรวจโคมไฟ',
      'หมู่บ้าน',
      'ระบบเฟส',
      'ขนาด kVA',
      'สถานที่ติดตั้ง',
      'ผู้ใช้ไฟกระทบ',
      'ละติจูด',
      'ลองจิจูด',
      'พิกัด LatLong',
      'ลิงก์ Google Maps'
    ];

    const rows = filteredTransformers.map((item, idx) => {
      const st = statusMap[item.peano]?.status || item.initialSurveyStatus;
      const gmap = item.latitude && item.longitude 
        ? `https://www.google.com/maps/search/?api=1&query=${item.latitude},${item.longitude}`
        : '';
      return [
        idx + 1,
        `"${item.peano}"`,
        `"${st}"`,
        `"${item.village}"`,
        `"${item.phase}"`,
        item.kva,
        `"${item.location}"`,
        item.affected,
        item.latitude ?? '',
        item.longitude ?? '',
        `"${item.latlong}"`,
        `"${gmap}"`
      ];
    });

    const csvContent = '\uFEFF' + [
      headers.join(','),
      ...rows.map((r) => r.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const villageTag = activeVillage === 'all' ? 'All_Villages' : activeVillage.replace(/\s+/g, '_');
    link.download = `PEA_Streetlight_Survey_${villageTag}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('💾 ดาวน์โหลดตาราง CSV สรุปสถานะเรียบร้อย');
  };

  return (
    <div className="w-full flex flex-col gap-3 pb-24 max-w-md mx-auto animate-fadeIn select-none">
      
      {/* FLOATING TOAST */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 border border-amber-400 text-white text-xs font-bold px-4 py-2.5 rounded-2xl shadow-2xl backdrop-blur-md animate-fadeIn flex items-center gap-2 max-w-[90vw]">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping shrink-0" />
          <span className="truncate">{toastMessage}</span>
        </div>
      )}

      {/* 1. TOP HEADER & OVERALL PROGRESS CARD */}
      <div className="bg-gradient-to-br from-amber-950/70 via-slate-900 to-indigo-950/70 border border-amber-500/30 rounded-3xl p-3.5 sm:p-4 shadow-xl relative overflow-hidden">
        {/* Glow decorative effect */}
        <div className="absolute top-0 right-0 w-36 h-36 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="flex items-start justify-between gap-2 relative z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-400 text-slate-950 flex items-center justify-center font-black shadow-lg shadow-amber-500/20 shrink-0">
              <Lightbulb className="w-5 h-5 fill-slate-950 text-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="text-base font-black text-white tracking-tight">
                  สำรวจโคมไฟส่องสว่าง
                </h2>
                <span className="text-[10px] font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30 px-2 py-0.5 rounded-full font-mono">
                  106 หม้อแปลง
                </span>
              </div>
              <p className="text-xs text-slate-300 font-medium mt-0.5">
                แยกตามหมู่บ้าน • อ.ท่าคันโท
              </p>
            </div>
          </div>

          <button
            onClick={handleResetToDefault}
            title="รีเซ็ตสถานะเป็นค่าเริ่มต้น"
            className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 transition-colors cursor-pointer shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* PROGRESS BAR & STATS GRID */}
        <div className="mt-3.5 pt-3 border-t border-slate-800/80">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <div className="flex items-center gap-1.5 font-bold text-slate-200">
              <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
              <span>
                {activeVillage === 'all' ? 'ความคืบหน้ารวมทุกหมู่บ้าน' : `ความคืบหน้า: ${activeVillage}`}
              </span>
            </div>
            <span className="font-mono font-black text-amber-300 text-xs">
              {selectedVillageStats.completed}/{selectedVillageStats.total} เครื่อง ({selectedVillageStats.percent}%)
            </span>
          </div>

          {/* Progress Bar Track */}
          <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden border border-slate-800 p-0.5 shadow-inner">
            <div
              className="h-full bg-gradient-to-r from-amber-500 via-emerald-400 to-emerald-500 rounded-full transition-all duration-500 shadow-sm"
              style={{ width: `${selectedVillageStats.percent}%` }}
            />
          </div>

          {/* Mini Stats Badges */}
          <div className="grid grid-cols-3 gap-2 mt-3 text-center">
            <div className="bg-slate-950/80 border border-slate-800/90 rounded-xl py-1.5 px-2">
              <span className="text-[10px] text-slate-400 block">หม้อแปลงทั้งหมด</span>
              <span className="text-xs font-mono font-black text-white">
                {selectedVillageStats.total} <span className="text-[10px] font-normal text-slate-400">เครื่อง</span>
              </span>
            </div>
            <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-xl py-1.5 px-2">
              <span className="text-[10px] text-emerald-400 block">สำรวจแล้ว</span>
              <span className="text-xs font-mono font-black text-emerald-300">
                {selectedVillageStats.completed} <span className="text-[10px] font-normal text-emerald-400/80">เครื่อง</span>
              </span>
            </div>
            <div className="bg-amber-950/40 border border-amber-500/30 rounded-xl py-1.5 px-2">
              <span className="text-[10px] text-amber-400 block">ยังไม่สำรวจ</span>
              <span className="text-xs font-mono font-black text-amber-300">
                {selectedVillageStats.pending} <span className="text-[10px] font-normal text-amber-400/80">เครื่อง</span>
              </span>
            </div>
          </div>
        </div>

        {/* QUICK SHARE ACTIONS */}
        <div className="flex gap-2 mt-3">
          <button
            onClick={handleCopyLineSummary}
            className="flex-1 py-1.5 px-3 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>คัดลอกสรุปส่ง LINE</span>
          </button>
          <button
            onClick={handleExportCSV}
            className="py-1.5 px-3 bg-slate-800/80 hover:bg-slate-800 text-slate-300 border border-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-cyan-400" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* 2. VILLAGE SELECTION DROPDOWN (เลือกหมู่บ้านแบบ Dropdown) */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 shadow-md">
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-xs">
          <div className="flex items-center gap-1.5 font-bold text-white">
            <Building2 className="w-4 h-4 text-amber-400" />
            <span>เลือกหมู่บ้าน (Dropdown):</span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">
            {activeVillage === 'all' ? 'แสดงทั้งหมด 23 หมู่บ้าน' : `หมู่บ้านที่ ${STREETLIGHT_VILLAGES.indexOf(activeVillage) + 1} จาก 23`}
          </span>
        </div>

        {/* Dropdown Box with Prev/Next Buttons */}
        <div className="flex items-center gap-2">
          {/* Quick Prev Village Button */}
          <button
            type="button"
            onClick={handlePrevVillage}
            disabled={activeVillage === 'all'}
            title="หมู่บ้านก่อนหน้า"
            className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer shrink-0 active:scale-95"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* Main Select Dropdown */}
          <div className="relative flex-1 min-w-0">
            <select
              id="village-dropdown-select"
              value={activeVillage}
              onChange={(e) => setActiveVillage(e.target.value)}
              className="w-full appearance-none bg-slate-950 text-white font-bold text-xs sm:text-sm py-2.5 pl-3.5 pr-9 rounded-xl border border-slate-800 hover:border-amber-500/50 focus:border-amber-400 focus:outline-none transition-all cursor-pointer truncate shadow-inner"
            >
              <option value="all">
                🏘️ ทั้งหมดทุกหมู่บ้าน ({overallStats.completed}/{overallStats.total} สำรวจแล้ว)
              </option>
              {STREETLIGHT_VILLAGES.map((v, idx) => {
                const c = overallStats.villageCounts[v] || { total: 0, completed: 0 };
                const isFinished = c.total > 0 && c.completed === c.total;
                return (
                  <option key={v} value={v}>
                    {idx + 1}. {v} ({c.completed}/{c.total} เครื่อง{isFinished ? ' ✓ ครบ' : ''})
                  </option>
                );
              })}
            </select>
            <ChevronDown className="w-4 h-4 text-amber-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Quick Next Village Button */}
          <button
            type="button"
            onClick={handleNextVillage}
            title="หมู่บ้านถัดไป"
            className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer shrink-0 active:scale-95"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Selected Village Info & Quick Actions */}
        {activeVillage !== 'all' && (
          <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <span className={`w-2 h-2 rounded-full shrink-0 ${
                selectedVillageStats.completed === selectedVillageStats.total && selectedVillageStats.total > 0
                  ? 'bg-emerald-400 ring-2 ring-emerald-400/30'
                  : 'bg-amber-400 ring-2 ring-amber-400/30'
              }`} />
              <span className="font-bold text-white truncate">
                {activeVillage}
              </span>
              <span className="text-[11px] text-slate-400 font-mono shrink-0">
                ({selectedVillageStats.completed}/{selectedVillageStats.total} เครื่อง • {selectedVillageStats.percent}%)
              </span>
            </div>
            <button
              type="button"
              onClick={() => setActiveVillage('all')}
              className="text-[11px] font-bold text-amber-400 hover:text-amber-300 py-0.5 px-2 rounded-lg bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 transition-all cursor-pointer shrink-0 ml-1"
            >
              ดูทั้งหมด
            </button>
          </div>
        )}
      </div>


      {/* 3. SEARCH & STATUS FILTER ROW */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-2.5 shadow-md flex flex-col gap-2">
        {/* Search input */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ค้นหารหัสหม้อแปลง เช่น 20-001352, ขนาด kVA..."
            className="w-full bg-slate-950 text-white placeholder-slate-500 text-xs rounded-xl pl-9 pr-8 py-2 border border-slate-800 focus:outline-none focus:border-amber-400 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 text-xs cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>

        {/* Status Filter Buttons */}
        <div className="grid grid-cols-3 gap-1.5">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`py-1.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 border ${
              statusFilter === 'all'
                ? 'bg-slate-800 text-white border-slate-600'
                : 'bg-slate-950 text-slate-400 border-slate-800/80 hover:bg-slate-800'
            }`}
          >
            <span>ทั้งหมด</span>
            <span className="text-[10px] font-mono text-slate-400">({filteredTransformers.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('pending')}
            className={`py-1.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 border ${
              statusFilter === 'pending'
                ? 'bg-amber-500 text-slate-950 border-amber-400 font-black'
                : 'bg-slate-950 text-amber-400/90 border-slate-800/80 hover:bg-amber-950/30'
            }`}
          >
            <Clock className="w-3.5 h-3.5 shrink-0" />
            <span>ยังไม่สำรวจ</span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('completed')}
            className={`py-1.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 border ${
              statusFilter === 'completed'
                ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-black'
                : 'bg-slate-950 text-emerald-400/90 border-slate-800/80 hover:bg-emerald-950/30'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span>สำรวจแล้ว</span>
          </button>
        </div>
      </div>

      {/* 4. TRANSFORMER CARDS LIST */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between px-1 text-xs text-slate-400 font-bold">
          <span>
            {activeVillage === 'all' ? 'รายการหม้อแปลงทั้งหมด' : `หม้อแปลงใน: ${activeVillage}`}
          </span>
          <span className="font-mono text-[11px] text-amber-300">
            แสดง {filteredTransformers.length} เครื่อง
          </span>
        </div>

        {filteredTransformers.length === 0 ? (
          <div className="bg-slate-900/60 border border-dashed border-slate-800 rounded-3xl p-8 text-center">
            <Lightbulb className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-xs font-bold text-slate-300">ไม่พบหม้อแปลงตามเงื่อนไขที่เลือก</p>
            <p className="text-[11px] text-slate-500 mt-1">ลองเปลี่ยนตัวกรองสถานะ หรือคำค้นหา</p>
          </div>
        ) : (
          filteredTransformers.map((item, idx) => {
            const currentStatus = statusMap[item.peano]?.status || item.initialSurveyStatus;
            const isCompleted = currentStatus === 'สำรวจแล้ว';
            const is3Phase = item.phase.includes('3');

            return (
              <div
                key={item.peano}
                className={`border rounded-3xl p-3.5 transition-all shadow-md ${
                  isCompleted
                    ? 'bg-slate-900/90 border-emerald-500/40 shadow-emerald-950/20'
                    : 'bg-slate-900/95 border-slate-800 hover:border-amber-500/40'
                }`}
              >
                {/* ROW 1: BADGES & IDENTIFIERS */}
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Phase Badge */}
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border font-mono ${
                      is3Phase
                        ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                        : 'bg-sky-500/15 text-sky-300 border-sky-500/30'
                    }`}>
                      {item.phase}
                    </span>

                    {/* kVA Badge */}
                    <span className="text-[10px] font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-lg font-mono">
                      {item.kva} kVA
                    </span>

                    {/* Affected users badge */}
                    {item.affected > 0 && (
                      <span className="text-[10px] text-slate-400 bg-slate-950 border border-slate-800 px-2 py-0.5 rounded-lg font-mono">
                        กระทบ {item.affected} ราย
                      </span>
                    )}
                  </div>

                  {/* Village tag */}
                  <span className="text-[10px] text-slate-400 font-bold bg-slate-950 border border-slate-800 px-2 py-0.5 rounded-lg truncate max-w-[130px]">
                    {item.village}
                  </span>
                </div>

                {/* ROW 2: PEA TR NO & LOCATION */}
                <div className="flex items-start justify-between gap-2 mb-2.5">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm sm:text-base font-black text-white font-mono tracking-tight">
                        {item.peano}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopyDetails(item)}
                        className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800 transition-colors cursor-pointer"
                        title="คัดลอกข้อมูล"
                      >
                        {copiedId === item.peano ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>

                    <p className="text-xs text-slate-300 font-medium mt-0.5 leading-snug">
                      {item.location}
                    </p>
                  </div>
                </div>

                {/* ROW 3: STATUS TOGGLE BUTTON (เด่นชัดตามที่ผู้ใช้ร้องขอ) */}
                <div className="pt-2 border-t border-slate-800/80 mb-2.5">
                  <button
                    type="button"
                    onClick={() => handleToggleStatus(item.peano)}
                    className={`w-full py-2.5 px-3 rounded-2xl font-black text-xs transition-all cursor-pointer flex items-center justify-between shadow-sm active:scale-98 ${
                      isCompleted
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 shadow-emerald-500/20'
                        : 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {isCompleted ? (
                        <CheckCircle2 className="w-4 h-4 fill-slate-950 text-emerald-200" />
                      ) : (
                        <Clock className="w-4 h-4 text-amber-400" />
                      )}
                      <span>
                        สถานะ: {isCompleted ? 'สำรวจแล้ว (เสร็จสิ้น)' : 'ยังไม่สำรวจ'}
                      </span>
                    </div>

                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${
                      isCompleted 
                        ? 'bg-slate-950/20 text-slate-950' 
                        : 'bg-amber-500 text-slate-950 font-black'
                    }`}>
                      {isCompleted ? 'แตะเพื่อแก้ไข' : 'แตะบันทึกว่าสำรวจแล้ว'}
                    </span>
                  </button>
                </div>

                {/* ROW 4: ACTION LINKS & UTILITIES */}
                <div className="flex items-center gap-1.5 flex-wrap pt-1 text-[11px]">
                  {/* Google Maps link */}
                  {item.latitude && item.longitude && (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${item.latitude},${item.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 py-1 px-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-sky-300 border border-slate-800 hover:border-sky-500/30 transition-all font-bold"
                    >
                      <MapPin className="w-3 h-3 text-sky-400" />
                      <span>เปิด Maps</span>
                      <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                    </a>
                  )}

                  {/* Meter Sheets link */}
                  {item.meter && (
                    <a
                      href={item.meter}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 py-1 px-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-emerald-300 border border-slate-800 hover:border-emerald-500/30 transition-all font-bold"
                      title="ดูตารางข้อมูล Meter ต่อหม้อแปลง"
                    >
                      <FileSpreadsheet className="w-3 h-3 text-emerald-400" />
                      <span>ข้อมูล Meter</span>
                      <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                    </a>
                  )}

                  {/* Image / Plan link */}
                  {item.plan && (
                    <a
                      href={`https://drive.google.com/file/d/${item.plan}/view`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 py-1 px-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-purple-300 border border-slate-800 hover:border-purple-500/30 transition-all font-bold"
                      title="ดูแผนผังหม้อแปลง"
                    >
                      <FileText className="w-3 h-3 text-purple-400" />
                      <span>แผนผัง</span>
                      <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                    </a>
                  )}

                  {/* LatLong text pill */}
                  {item.latlong && (
                    <span className="text-[10px] text-slate-500 font-mono py-1 px-2 bg-slate-950/60 rounded-xl truncate max-w-[150px]">
                      {item.latlong}
                    </span>
                  )}
                </div>

              </div>
            );
          })
        )}
      </div>

    </div>
  );
};
