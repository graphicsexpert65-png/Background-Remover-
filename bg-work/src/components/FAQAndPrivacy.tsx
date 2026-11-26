import React, { useState } from 'react';
import {
  HelpCircle,
  ShieldCheck,
  ChevronDown,
  Lock,
  Cpu,
  Layers,
  FileText,
  Printer,
  Sparkles,
  ServerOff,
} from 'lucide-react';

interface FAQAndPrivacyProps {
  initialView?: 'faq' | 'privacy';
}

export const FAQAndPrivacy: React.FC<FAQAndPrivacyProps> = ({ initialView = 'faq' }) => {
  const [activeTab, setActiveTab] = useState<'faq' | 'privacy' | 'terms'>(initialView);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  const faqs = [
    {
      q: 'How does BG Remover Pro remove backgrounds without uploading my photos to a server?',
      a: 'BG Remover Pro executes a neural segmentation model (ISNet) directly inside your web browser using WebAssembly (WASM) and WebGPU runtimes via ONNX Runtime Web. When you drop an image, the neural network processes the pixel data locally in your computer or phone’s memory. No image bytes or personal files are ever transmitted to any remote server or cloud bucket.',
    },
    {
      q: 'Why are passport dimensions measured in millimeters (mm) rather than pixels?',
      a: 'Official embassy passport standards specify physical millimeter dimensions (such as 35x45 mm in Europe/UK or 2x2 inches / 51x51 mm in the US). In digital printing, physical size is converted to pixels using DPI (Dots Per Inch). At standard 300 DPI: 35 mm = (35 / 25.4) * 300 = 413 pixels wide, and 45 mm = 531 pixels high. Our tool automatically computes exact pixel dimensions so your prints match official measurement rulers.',
    },
    {
      q: 'Can I print multiple passport photos on a standard 4x6" photo card or A4 sheet?',
      a: 'Yes! The Passport Photo Maker includes a dedicated Print Sheet mode. It automatically calculates how many copies cleanly fit on standard 4x6 inch (102x152 mm) photo paper or A4 sheets, adds optional dashed cutting lines, and allows you to download a print-ready PDF or high-resolution PNG.',
    },
    {
      q: 'Does background color changing require re-running the AI model?',
      a: 'No. Once the AI extracts the foreground alpha mask, the mask is preserved in browser memory. Changing background color (pure white, passport blue, red, grey, or custom hex) composites instantly on an HTML5 Canvas in less than 10 milliseconds without re-running the neural model.',
    },
    {
      q: 'What is the purpose of the Anti-Halo and Edge Refinement controls?',
      a: 'When an image is photographed against a bright or colorful background, foreground edges (especially hair and clothing boundaries) often retain color bleeding or a faint halo. The Anti-Halo filter slightly neutralizes edge tinting, while Edge Shift allows you to shrink the mask boundary by 1–2 pixels to create a razor-sharp cut.',
    },
    {
      q: 'Is there a limit on image dimensions or batch size?',
      a: 'We preserve your original photo dimensions wherever technically possible. For batch processing, we enforce a memory-safe limit of 5 photos per queue, processed sequentially. This prevents browser memory crashes on laptops or mobile devices.',
    },
    {
      q: 'Is this service truly free with no watermarks?',
      a: 'Yes. There are no subscriptions, no accounts, no credit cards, and no watermarks added to any exported images.',
    },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Sub-navigation tabs */}
      <div className="flex justify-center">
        <div className="inline-flex rounded-2xl p-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('faq')}
            className={`px-5 py-2 rounded-xl transition-all flex items-center gap-2 ${
              activeTab === 'faq'
                ? 'bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Frequently Asked Questions</span>
          </button>
          <button
            onClick={() => setActiveTab('privacy')}
            className={`px-5 py-2 rounded-xl transition-all flex items-center gap-2 ${
              activeTab === 'privacy'
                ? 'bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Privacy Architecture</span>
          </button>
          <button
            onClick={() => setActiveTab('terms')}
            className={`px-5 py-2 rounded-xl transition-all flex items-center gap-2 ${
              activeTab === 'terms'
                ? 'bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Terms of Use</span>
          </button>
        </div>
      </div>

      {/* FAQ TAB */}
      {activeTab === 'faq' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-xl p-6 sm:p-10 space-y-4">
          <div className="space-y-1 mb-6">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">
              Questions & Technical Specifications
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Everything you need to know about our in-browser AI segmentation, passport standards, and print workflows.
            </p>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, index) => {
              const isOpen = openFaqIndex === index;
              return (
                <div
                  key={index}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 overflow-hidden transition-all"
                >
                  <button
                    onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                    className="w-full flex items-center justify-between p-4 sm:p-5 text-left font-bold text-sm text-slate-900 dark:text-white"
                  >
                    <span>{faq.q}</span>
                    <ChevronDown
                      className={`w-4 h-4 text-purple-600 shrink-0 ml-3 transition-transform ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-5 sm:px-5 text-xs text-slate-600 dark:text-slate-300 leading-relaxed border-t border-slate-200/60 dark:border-slate-800 pt-3">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* PRIVACY TAB */}
      {activeTab === 'privacy' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-xl p-6 sm:p-10 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <ServerOff className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                Zero-Upload Privacy Architecture
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Guaranteed by client-side browser cryptography and WebAssembly sandbox.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-2">
              <div className="flex items-center gap-2 font-bold text-xs text-slate-900 dark:text-white">
                <Cpu className="w-4 h-4 text-purple-600" />
                <span>Local Browser Inference</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Unlike other services that transmit your photos to cloud servers for processing, BG Remover Pro
                executes the AI model completely on your local CPU or GPU.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-2">
              <div className="flex items-center gap-2 font-bold text-xs text-slate-900 dark:text-white">
                <Lock className="w-4 h-4 text-emerald-600" />
                <span>No Data Storage or Tracking</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                We do not maintain databases of processed images, facial biometrics, or personal identifiers.
                Once you close or refresh the tab, image buffers in RAM are purged immediately.
              </p>
            </div>
          </div>

          <div className="text-xs text-slate-600 dark:text-slate-300 space-y-3 leading-relaxed border-t border-slate-100 dark:border-slate-800 pt-4">
            <h4 className="font-bold text-sm text-slate-900 dark:text-white">
              Compliance with Global Privacy Standards
            </h4>
            <p>
              Because no user photos or personal biometric data are ever sent over network sockets to a backend server,
              BG Remover Pro is inherently compliant with GDPR (General Data Protection Regulation), CCPA (California Consumer
              Privacy Act), and international privacy frameworks by design.
            </p>
            <p>
              Model weights (WASM binaries and ONNX files) are loaded from high-speed public CDN caches (UNPKG / Cloudflare CDN)
              with strict CORS and content integrity headers.
            </p>
          </div>
        </div>
      )}

      {/* TERMS TAB */}
      {activeTab === 'terms' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-xl p-6 sm:p-10 space-y-4">
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">
            Terms of Use
          </h3>
          <div className="text-xs text-slate-600 dark:text-slate-300 space-y-3 leading-relaxed">
            <p>
              By accessing and using BG Remover Pro, you agree to use this tool for lawful personal and commercial image editing purposes.
            </p>
            <p>
              <strong className="text-slate-900 dark:text-white">Passport Photo Guidance:</strong> The biometric guides and dimensions provided
              are for assistance only. Government passport, visa, and ID requirements (such as acceptable background color, head tilt,
              clothing colors, eyeglasses, or smiling) differ by country and are subject to change. The user assumes responsibility for
              confirming their country&apos;s specific embassy requirements before submitting photographs.
            </p>
            <p>
              <strong className="text-slate-900 dark:text-white">License:</strong> In-browser segmentation uses open-source machine learning weights
              compatible with client-side deployment. All generated images remain 100% your own property.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
