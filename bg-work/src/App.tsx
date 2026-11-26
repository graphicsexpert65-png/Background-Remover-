import React, { useState, useEffect } from 'react';
import { Navbar, NavTab } from './components/Navbar';
import { SingleRemover } from './components/SingleRemover';
import { PassportMaker } from './components/PassportMaker';
import { BatchRemover } from './components/BatchRemover';
import { FAQAndPrivacy } from './components/FAQAndPrivacy';
import { Footer } from './components/Footer';

export default function App() {
  const [currentTab, setCurrentTab] = useState<NavTab>('remover');
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('bg_remover_theme');
      if (saved) return saved === 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  // Handoff state from SingleRemover to PassportMaker
  const [passportHandoffBlob, setPassportHandoffBlob] = useState<Blob | null>(null);
  const [passportHandoffUrl, setPassportHandoffUrl] = useState<string | null>(null);

  // Sync dark class on document element
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('bg_remover_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('bg_remover_theme', 'light');
    }
  }, [isDarkMode]);

  const toggleDarkMode = () => {
    setIsDarkMode((prev) => !prev);
  };

  // Called from SingleRemover to transition with image into PassportMaker
  const handleOpenInPassport = (imageBlob: Blob, imageUrl: string) => {
    setPassportHandoffBlob(imageBlob);
    setPassportHandoffUrl(imageUrl);
    setCurrentTab('passport');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors selection:bg-purple-600 selection:text-white">
      {/* Top Navbar */}
      <Navbar
        currentTab={currentTab}
        onSelectTab={(tab) => {
          setCurrentTab(tab);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        isDarkMode={isDarkMode}
        onToggleDarkMode={toggleDarkMode}
      />

      {/* Main App Content Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-12">
        {currentTab === 'remover' && (
          <SingleRemover onOpenInPassport={handleOpenInPassport} />
        )}

        {currentTab === 'passport' && (
          <PassportMaker
            initialImageBlob={passportHandoffBlob}
            initialImageUrl={passportHandoffUrl}
          />
        )}

        {currentTab === 'batch' && <BatchRemover />}

        {currentTab === 'faq' && <FAQAndPrivacy initialView="faq" />}

        {currentTab === 'privacy' && <FAQAndPrivacy initialView="privacy" />}
      </main>

      {/* Footer */}
      <Footer
        onSelectTab={(tab) => {
          setCurrentTab(tab);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />
    </div>
  );
}
