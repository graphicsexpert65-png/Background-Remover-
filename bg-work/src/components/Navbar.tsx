import React, { useEffect, useState } from 'react';
import { Layers, Scissors, UserCheck, FolderKanban, HelpCircle, ShieldCheck, Sun, Moon, Cpu, Zap, Menu, X } from 'lucide-react';
import { checkWebGPUAvailability } from '../services/backgroundRemoval';

export type NavTab = 'remover' | 'passport' | 'batch' | 'faq' | 'privacy';

interface NavbarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  isDarkMode,
  onToggleDarkMode,
}) => {
  const [hasWebGpu, setHasWebGpu] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  useEffect(() => {
    checkWebGPUAvailability().then(setHasWebGpu);
  }, []);

  const navItems = [
    { id: 'remover' as NavTab, label: 'BG Remover', icon: Scissors },
    { id: 'passport' as NavTab, label: 'Passport Photo Maker', icon: UserCheck },
    { id: 'batch' as NavTab, label: 'Batch Processing', icon: FolderKanban },
    { id: 'faq' as NavTab, label: 'FAQ & Specs', icon: HelpCircle },
    { id: 'privacy' as NavTab, label: 'Privacy & Security', icon: ShieldCheck },
  ];

  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-md border-b transition-colors bg-white/90 border-slate-200/80 dark:bg-slate-900/90 dark:border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div
            className="flex items-center gap-3 cursor-pointer group"
            onClick={() => onSelectTab('remover')}
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-pink-500 flex items-center justify-center shadow-md shadow-purple-500/20 group-hover:scale-105 transition-transform">
              <Layers className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-purple-700 via-indigo-600 to-purple-900 dark:from-purple-400 dark:via-indigo-300 dark:to-pink-300 bg-clip-text text-transparent">
                  BG Remover Pro
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                  AI v2
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium hidden sm:block">
                100% In-Browser • Zero Server Upload
              </p>
            </div>
          </div>

          {/* Desktop Nav Items */}
          <nav className="hidden md:flex items-center gap-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-purple-50 text-purple-700 shadow-sm border border-purple-200/60 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800/80 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-purple-600 dark:text-purple-400' : 'text-slate-400'}`} />
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Right Action: Hardware Accelerator Status & Dark Mode */}
          <div className="flex items-center gap-2">
            {/* Acceleration status tag */}
            <div
              className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border bg-slate-50 border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300"
              title={
                hasWebGpu
                  ? 'WebGPU acceleration available'
                  : 'WebAssembly CPU execution active (WASM SIMD)'
              }
            >
              {hasWebGpu ? (
                <>
                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                  <span>WebGPU Enabled</span>
                </>
              ) : (
                <>
                  <Cpu className="w-3.5 h-3.5 text-indigo-500" />
                  <span>WASM SIMD Engine</span>
                </>
              )}
            </div>

            {/* Dark Mode Toggle */}
            <button
              onClick={onToggleDarkMode}
              className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 transition-colors"
              aria-label="Toggle theme"
              title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Mobile menu trigger */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 md:hidden rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              aria-label="Toggle mobile menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 pt-2 pb-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectTab(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${
                  isActive
                    ? 'bg-purple-50 text-purple-700 dark:bg-purple-950/70 dark:text-purple-300 font-semibold'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <Icon className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                {item.label}
              </button>
            );
          })}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 px-3">
            <span>Engine: {hasWebGpu ? 'WebGPU' : 'WebAssembly CPU'}</span>
            <span className="text-emerald-600 font-medium">100% Private</span>
          </div>
        </div>
      )}
    </header>
  );
};
