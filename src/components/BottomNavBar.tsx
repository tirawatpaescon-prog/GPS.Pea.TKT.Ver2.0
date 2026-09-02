import React from 'react';
import { Home, Search, Zap } from 'lucide-react';
import { ActiveTab } from '../types';

interface BottomNavBarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  recloserCount?: number;
}

export const BottomNavBar: React.FC<BottomNavBarProps> = ({
  activeTab,
  onTabChange,
  recloserCount = 0
}) => {
  return (
    <nav 
      aria-label="เมนูหลักด้านล่าง"
      className="fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-xl border-t border-slate-800/90 pt-1.5 pb-[max(env(safe-area-inset-bottom),0.5rem)] px-3 max-w-md w-full mx-auto shadow-2xl transition-all"
    >
      <div className="grid grid-cols-3 gap-1.5 items-center">
        
        {/* TAB 1: HOME */}
        <button
          id="tab-home"
          type="button"
          onClick={() => onTabChange('home')}
          className={`flex flex-col items-center justify-center min-h-[50px] py-1.5 px-2 rounded-2xl transition-all cursor-pointer select-none active:scale-95 ${
            activeTab === 'home'
              ? 'text-purple-300 bg-purple-500/20 border border-purple-400/40 shadow-lg shadow-purple-950/60'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
          }`}
        >
          <div className="relative">
            <Home className={`w-5 h-5 ${activeTab === 'home' ? 'text-purple-300 scale-110' : 'text-slate-400'} transition-transform`} />
            {activeTab === 'home' && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-purple-400 rounded-full animate-pulse ring-2 ring-slate-950" />
            )}
          </div>
          <span className={`text-[11px] font-bold mt-1 tracking-tight ${activeTab === 'home' ? 'text-purple-200 font-black' : 'text-slate-400'}`}>
            หน้าแรก
          </span>
        </button>

        {/* TAB 2: SEARCH CONSUMERS */}
        <button
          id="tab-search-consumer"
          type="button"
          onClick={() => onTabChange('search')}
          className={`flex flex-col items-center justify-center min-h-[50px] py-1.5 px-2 rounded-2xl transition-all cursor-pointer select-none active:scale-95 ${
            activeTab === 'search'
              ? 'text-cyan-300 bg-cyan-500/20 border border-cyan-400/40 shadow-lg shadow-cyan-950/60'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
          }`}
        >
          <div className="relative">
            <Search className={`w-5 h-5 ${activeTab === 'search' ? 'text-cyan-300 scale-110' : 'text-slate-400'} transition-transform`} />
            {activeTab === 'search' && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-cyan-400 rounded-full animate-pulse ring-2 ring-slate-950" />
            )}
          </div>
          <span className={`text-[11px] font-bold mt-1 tracking-tight ${activeTab === 'search' ? 'text-cyan-200 font-black' : 'text-slate-400'}`}>
            ค้นหาผู้ใช้ไฟ
          </span>
        </button>

        {/* TAB 3: RECLOSER */}
        <button
          id="tab-recloser"
          type="button"
          onClick={() => onTabChange('recloser')}
          className={`flex flex-col items-center justify-center min-h-[50px] py-1.5 px-2 rounded-2xl transition-all cursor-pointer select-none active:scale-95 relative ${
            activeTab === 'recloser'
              ? 'text-amber-300 bg-amber-500/20 border border-amber-400/40 shadow-lg shadow-amber-950/60'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
          }`}
        >
          <div className="relative">
            <Zap className={`w-5 h-5 ${activeTab === 'recloser' ? 'text-amber-300 scale-110' : 'text-slate-400'} transition-transform`} />
            {recloserCount > 0 && (
              <span className="absolute -top-1.5 -right-3.5 bg-amber-500 text-slate-950 text-[9px] font-black px-1.5 py-0.2 rounded-full font-mono shadow-md ring-2 ring-slate-950">
                {recloserCount}
              </span>
            )}
          </div>
          <span className={`text-[11px] font-bold mt-1 tracking-tight ${activeTab === 'recloser' ? 'text-amber-200 font-black' : 'text-slate-400'}`}>
            จด Recloser
          </span>
        </button>

      </div>
    </nav>
  );
};
