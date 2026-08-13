import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Zap, MapPin, ChevronRight, ShieldCheck, Smartphone, Download, Share2, Check, X, Sparkles } from 'lucide-react';

interface SplashScreenProps {
  onComplete: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete }) => {
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('กำลังเริ่มต้นระบบ PEA GPS SEARCH...');
  const [isExiting, setIsExiting] = useState(false);
  
  // PWA Install Prompt state
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            setShowInstallPrompt(true);
          }, 300);
          return 100;
        }

        const next = prev + 2;
        if (next < 30) {
          setStatusText('กำลังโหลดฐานข้อมูลพิกัดผู้ใช้ไฟ...');
        } else if (next < 70) {
          setStatusText('เตรียมระบบสแกนสระภาษาไทยอัจฉริยะ...');
        } else if (next < 95) {
          setStatusText('กำลังสร้างระบบค้นหาด่วน 0ms...');
        } else {
          setStatusText('ระบบพร้อมใช้งาน 100%');
        }
        return next;
      });
    }, 35);

    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleEnterAppDirectly = () => {
    setShowInstallPrompt(false);
    setShowInstructions(false);
    setIsExiting(true);
    setTimeout(() => {
      onComplete();
    }, 600);
  };

  const handleTriggerInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
        setTimeout(() => {
          handleEnterAppDirectly();
        }, 800);
      } else {
        handleEnterAppDirectly();
      }
      setDeferredPrompt(null);
    } else {
      // Fallback instructions for iOS/Chrome where prompt isn't directly triggerable
      setShowInstructions(true);
    }
  };

  return (
    <AnimatePresence>
      {!isExiting && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.05, filter: 'blur(10px)' }}
          transition={{ duration: 0.5, ease: 'easeInOut' }}
          className="fixed inset-0 z-[9999] bg-slate-950 text-slate-100 flex flex-col items-center justify-between p-6 overflow-hidden select-none"
        >
          {/* Animated Background Cyber Rings & Grid */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(14,165,233,0.15)_0%,rgba(15,23,42,0.95)_70%)] pointer-events-none" />
          
          <div className="absolute inset-0 opacity-20 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />

          {/* Floating Neon Pulse Orbs */}
          <motion.div
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.3, 0.6, 0.3],
            }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl pointer-events-none"
          />
          <motion.div
            animate={{
              scale: [1, 1.3, 1],
              opacity: [0.2, 0.5, 0.2],
            }}
            transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
            className="absolute bottom-1/4 left-1/2 -translate-x-1/2 translate-y-1/2 w-80 h-80 bg-sky-500/20 rounded-full blur-3xl pointer-events-none"
          />

          {/* Top Header Badge */}
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="relative z-10 pt-4 flex items-center gap-2 bg-slate-900/80 backdrop-blur-md px-4 py-1.5 rounded-full border border-sky-500/30 text-sky-300 text-xs font-semibold shadow-lg shadow-sky-950/50"
          >
            <ShieldCheck className="w-4 h-4 text-sky-400" />
            <span>PROVINCIAL ELECTRICITY AUTHORITY</span>
          </motion.div>

          {/* Center Graphic & Title Section */}
          <div className="relative z-10 my-auto flex flex-col items-center text-center max-w-sm w-full">
            {/* Main Cyber Shield Graphic Container */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, duration: 0.6, type: 'spring', stiffness: 120 }}
              className="relative w-64 h-64 sm:w-72 sm:h-72 mb-6 flex items-center justify-center"
            >
              {/* Rotating Outer Tech Ring */}
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                className="absolute inset-0 rounded-full border-2 border-dashed border-sky-500/40 p-2 pointer-events-none"
              />

              {/* Reverse Rotating Inner Ring */}
              <motion.div
                animate={{ rotate: -360 }}
                transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
                className="absolute inset-3 rounded-full border border-purple-500/30 border-t-purple-400 p-2 pointer-events-none"
              />

              {/* Glowing Aura Frame */}
              <div className="absolute inset-4 rounded-3xl bg-gradient-to-br from-sky-500/20 via-purple-500/20 to-indigo-500/20 blur-md" />

              {/* Image Asset Container */}
              <div className="relative w-56 h-56 sm:w-64 sm:h-64 rounded-2xl overflow-hidden border-2 border-sky-400/60 shadow-2xl shadow-sky-500/30 bg-slate-900 group">
                <img
                  src="/splash.jpg"
                  alt="PEA GPS SEARCH"
                  className="w-full h-full object-cover transform scale-105 group-hover:scale-110 transition-transform duration-700"
                />

                {/* Radar Scanning Line Effect */}
                <motion.div
                  animate={{ y: ['-100%', '200%'] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }}
                  className="absolute inset-x-0 h-12 bg-gradient-to-b from-sky-400/0 via-sky-400/30 to-sky-400/0 border-b border-sky-300/80 pointer-events-none"
                />
              </div>

              {/* Floating Tech Badges */}
              <motion.div
                animate={{ y: [-4, 4, -4] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute -top-2 -right-2 bg-slate-900/90 text-amber-300 border border-amber-500/40 p-2 rounded-xl shadow-lg backdrop-blur-md"
              >
                <Zap className="w-5 h-5 fill-amber-300" />
              </motion.div>

              <motion.div
                animate={{ y: [4, -4, 4] }}
                transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute -bottom-2 -left-2 bg-slate-900/90 text-sky-400 border border-sky-500/40 p-2 rounded-xl shadow-lg backdrop-blur-md"
              >
                <MapPin className="w-5 h-5" />
              </motion.div>
            </motion.div>

            {/* Title & Description */}
            <motion.h1
              initial={{ y: 15, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="text-2xl sm:text-3xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-sky-300 via-purple-200 to-sky-400 font-display drop-shadow-[0_2px_10px_rgba(14,165,233,0.3)]"
            >
              PEA GPS SEARCH
            </motion.h1>

            <motion.p
              initial={{ y: 15, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.5 }}
              className="text-xs sm:text-sm text-sky-200/80 font-medium mt-1 mb-2"
            >
              ระบบค้นหาพิกัดผู้ใช้ไฟและการไฟฟ้านครหลวง/ส่วนภูมิภาค
            </motion.p>
          </div>

          {/* Bottom Progress & Launch Area */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.5 }}
            className="relative z-10 w-full max-w-sm flex flex-col items-center gap-3 pb-4"
          >
            {/* Progress Bar Container */}
            <div className="w-full bg-slate-900/90 border border-slate-800 p-3 rounded-2xl backdrop-blur-md shadow-xl">
              <div className="flex justify-between items-center text-xs mb-1.5">
                <span className="text-slate-400 font-medium truncate pr-2">{statusText}</span>
                <span className="text-sky-400 font-black font-mono">{progress}%</span>
              </div>

              <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-800/80">
                <motion.div
                  className="h-full bg-gradient-to-r from-sky-500 via-indigo-500 to-purple-500 rounded-full"
                  style={{ width: `${progress}%` }}
                  transition={{ ease: 'easeOut' }}
                />
              </div>
            </div>

            {/* Quick Launch Button */}
            <button
              type="button"
              onClick={() => {
                if (progress >= 100) {
                  setShowInstallPrompt(true);
                } else {
                  handleEnterAppDirectly();
                }
              }}
              className="w-full py-3 px-6 rounded-2xl bg-gradient-to-r from-sky-500 via-purple-600 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-bold text-sm shadow-lg shadow-sky-500/25 border border-sky-300/30 flex items-center justify-center gap-2 group cursor-pointer active:scale-98 transition-all"
            >
              <span>เข้าสู่แอปพลิเคชัน (Enter WebApp)</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </motion.div>

          {/* INSTALL APP MODAL PROMPT */}
          <AnimatePresence>
            {showInstallPrompt && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[10000] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4"
              >
                <motion.div
                  initial={{ scale: 0.9, y: 20 }}
                  animate={{ scale: 1, y: 0 }}
                  exit={{ scale: 0.9, y: 20 }}
                  className="bg-slate-900 border border-slate-700/80 rounded-3xl p-6 max-w-sm w-full text-center shadow-2xl relative overflow-hidden"
                >
                  <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-sky-500 via-purple-500 to-indigo-500" />
                  
                  <div className="w-16 h-16 bg-sky-500/10 border border-sky-500/30 rounded-2xl flex items-center justify-center mx-auto mb-4 text-sky-400 shadow-inner">
                    <Smartphone className="w-8 h-8" />
                  </div>

                  <h3 className="text-lg font-black text-slate-100 font-display mb-1.5">
                    ติดตั้งแอปบนหน้าจอหลักไหม?
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed mb-5">
                    เพิ่มแอป <span className="text-sky-300 font-bold">PEA GPS SEARCH</span> ลงในหน้าจอหลัก (Home Screen) เพื่อเปิดใช้งานรวดเร็ว ได้เต็มหน้าจอเสมือนแอปพลิเคชันจริง
                  </p>

                  {!showInstructions ? (
                    <div className="space-y-2.5">
                      <button
                        type="button"
                        onClick={handleTriggerInstall}
                        className="w-full py-3 px-4 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-sky-500/20 border border-sky-300/30 flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition-all"
                      >
                        <Download className="w-4 h-4" />
                        <span>ติดตั้งแอปบนหน้าจอหลัก (Install)</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleEnterAppDirectly}
                        className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs rounded-xl border border-slate-700/80 flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all"
                      >
                        <span>เข้าสู่แอปพลิเคชันโดยไม่ติดตั้ง</span>
                      </button>
                    </div>
                  ) : (
                    <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 text-left space-y-2.5 mb-2">
                      <div className="flex items-center gap-2 text-sky-400 text-xs font-bold">
                        <Sparkles className="w-4 h-4 shrink-0" />
                        <span>วิธีติดตั้งด้วยตนเอง (How to Install):</span>
                      </div>
                      <div className="text-[11px] text-slate-300 space-y-1.5 leading-tight">
                        <p className="flex items-start gap-1.5">
                          <span className="bg-sky-500/20 text-sky-300 font-bold px-1.5 py-0.2 rounded text-[10px]">iOS / Safari</span>
                          <span>กดปุ่ม <Share2 className="w-3 h-3 inline text-sky-400" /> ด้านล่างจอ ➡️ เลือก <b>"เพิ่มไปยังหน้าจอหลัก"</b></span>
                        </p>
                        <p className="flex items-start gap-1.5">
                          <span className="bg-purple-500/20 text-purple-300 font-bold px-1.5 py-0.2 rounded text-[10px]">Android / Chrome</span>
                          <span>กดเมนู 3 จุด 🌐 ➡️ เลือก <b>"ติดตั้งแอป"</b> หรือ <b>"เพิ่มลงในหน้าจอโฮม"</b></span>
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={handleEnterAppDirectly}
                        className="w-full mt-2 py-2.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-black text-xs rounded-xl flex items-center justify-center gap-1 cursor-pointer transition-all"
                      >
                        <span>เข้าใจแล้ว เข้าใช้งานเลย!</span>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

