import React, { useState } from 'react';
import { Layers, ShieldCheck, Github, ExternalLink, Cloud, X, CheckCircle, Terminal } from 'lucide-react';
import { NavTab } from './Navbar';

interface FooterProps {
  onSelectTab: (tab: NavTab) => void;
}

export const Footer: React.FC<FooterProps> = ({ onSelectTab }) => {
  const [showDeploymentModal, setShowDeploymentModal] = useState<boolean>(false);

  return (
    <footer className="mt-20 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand Column */}
          <div className="space-y-3 md:col-span-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white font-bold shadow-sm">
                <Layers className="w-4 h-4" />
              </div>
              <span className="font-black text-base tracking-tight text-slate-900 dark:text-white">
                BG Remover Pro
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Professional in-browser AI background remover, passport photo creator, and batch processing studio.
              Built for speed, privacy, and zero server costs.
            </p>
            <div className="flex items-center gap-2 text-xs text-emerald-600 font-medium">
              <ShieldCheck className="w-4 h-4" />
              <span>100% Client-Side Privacy</span>
            </div>
          </div>

          {/* Quick Tools */}
          <div className="space-y-3">
            <h5 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
              Studio Tools
            </h5>
            <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
              <li>
                <button
                  onClick={() => onSelectTab('remover')}
                  className="hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                >
                  AI Background Remover
                </button>
              </li>
              <li>
                <button
                  onClick={() => onSelectTab('passport')}
                  className="hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                >
                  Passport & Visa Photo Maker
                </button>
              </li>
              <li>
                <button
                  onClick={() => onSelectTab('batch')}
                  className="hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                >
                  Batch Image Processing (5 Max)
                </button>
              </li>
              <li>
                <button
                  onClick={() => onSelectTab('passport')}
                  className="hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                >
                  Printable 4x6 & A4 Sheets
                </button>
              </li>
            </ul>
          </div>

          {/* Specifications & Legal */}
          <div className="space-y-3">
            <h5 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
              Resources & Privacy
            </h5>
            <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
              <li>
                <button
                  onClick={() => onSelectTab('faq')}
                  className="hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                >
                  FAQ & 300 DPI Specs
                </button>
              </li>
              <li>
                <button
                  onClick={() => onSelectTab('privacy')}
                  className="hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                >
                  Zero-Upload Architecture
                </button>
              </li>
              <li>
                <button
                  onClick={() => onSelectTab('privacy')}
                  className="hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                >
                  Terms of Use
                </button>
              </li>
              <li>
                <button
                  onClick={() => setShowDeploymentModal(true)}
                  className="text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1 font-semibold"
                >
                  <Cloud className="w-3.5 h-3.5" />
                  <span>Cloudflare Pages Deploy Guide</span>
                </button>
              </li>
            </ul>
          </div>

          {/* Deployment Banner / Tech Stack */}
          <div className="space-y-3 p-4 rounded-2xl bg-purple-50/50 dark:bg-slate-800/60 border border-purple-100 dark:border-slate-700 text-xs">
            <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Cloud className="w-4 h-4 text-purple-600" />
              Cloudflare Pages Ready
            </span>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal">
              100% static client-side bundle. Build with <code className="font-mono bg-purple-100/70 dark:bg-slate-700 px-1 py-0.5 rounded text-purple-700 dark:text-purple-300">npm run build</code> and deploy to Cloudflare Pages or Vercel with zero server maintenance.
            </p>
            <button
              onClick={() => setShowDeploymentModal(true)}
              className="text-[11px] font-bold text-purple-600 dark:text-purple-400 hover:underline inline-flex items-center gap-1"
            >
              <span>View Deployment Steps</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-8 pt-8 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} BG Remover Pro. Free for personal & commercial use.</p>
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1 text-slate-400">
              <span>Powered by WebAssembly & ONNX Web</span>
            </span>
          </div>
        </div>
      </div>

      {/* Cloudflare Pages Deployment Modal */}
      {showDeploymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-xl w-full p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cloud className="w-6 h-6 text-purple-600" />
                <h4 className="font-bold text-lg text-slate-900 dark:text-white">
                  Deploy to Cloudflare Pages (Free Tier)
                </h4>
              </div>
              <button
                onClick={() => setShowDeploymentModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Because BG Remover Pro processes everything client-side in the browser via WebAssembly, it can be deployed as a static site anywhere with zero backend runtime.
            </p>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-1">
                <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                  Step 1: Build Static Assets
                </span>
                <p className="text-slate-500">Run the Vite build command:</p>
                <div className="bg-slate-900 text-purple-300 p-2 rounded-lg font-mono text-[11px] flex items-center gap-2">
                  <Terminal className="w-3.5 h-3.5" />
                  <span>npm run build</span>
                </div>
                <p className="text-[11px] text-slate-400">Output directory: <strong className="font-mono text-slate-700 dark:text-slate-300">dist/</strong></p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-1">
                <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                  Step 2: Push to GitHub or Direct Upload
                </span>
                <p className="text-slate-500">
                  Connect your repository in the Cloudflare Dashboard under <strong>Compute (Workers & Pages) &gt; Pages</strong>, or drag the <code className="font-mono text-slate-700 dark:text-slate-300">dist</code> folder directly.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-1">
                <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                  Step 3: Build Settings
                </span>
                <ul className="space-y-0.5 text-slate-600 dark:text-slate-300">
                  <li>• Framework preset: <strong>Vite</strong></li>
                  <li>• Build command: <strong>npm run build</strong></li>
                  <li>• Build output directory: <strong>dist</strong></li>
                </ul>
              </div>
            </div>

            <button
              onClick={() => setShowDeploymentModal(false)}
              className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition-colors"
            >
              Got it, close
            </button>
          </div>
        </div>
      )}
    </footer>
  );
};
