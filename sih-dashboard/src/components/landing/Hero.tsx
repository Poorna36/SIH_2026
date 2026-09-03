import React from 'react';
import { ArrowRight } from 'lucide-react';
import { heroImg } from '../../data/lunarisDatasets';
import { ChandrayaanViewer } from './ChandrayaanViewer';

interface HeroProps {
  onNext: () => void;
  onLaunchWorkbench?: () => void;
}

export const Hero: React.FC<HeroProps> = ({ onNext, onLaunchWorkbench }) => {

  return (
    <section
      id="overview"
      className="relative w-full min-h-[100vh] bg-[#07090C] overflow-hidden flex flex-col justify-between pt-20 md:pt-24 pb-6 px-4 sm:px-6 md:px-8 lg:px-12 border-b border-subtle select-none"
    >
      {/* Background Cinematic Lunar Imagery with Smooth Continuous Zoom In / Zoom Out Breathing Illusion */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden select-none">
        <div
          className="absolute inset-0 w-full h-full animate-moon-zoom-continuous"
          style={{ transformOrigin: 'center center' }}
        >
          <img
            src={heroImg}
            alt="Lunar Surface Panorama"
            className="w-full h-full object-cover object-center lg:object-[65%_center] opacity-60 filter grayscale contrast-125 brightness-90"
            referrerPolicy="no-referrer"
          />
        </div>

        <div className="absolute inset-0 pointer-events-none opacity-15 overflow-hidden">
          <div className="w-full h-full bg-[radial-gradient(circle_at_65%_50%,rgba(214,195,139,0.25)_0%,transparent_70%)]"></div>
        </div>

        <div className="absolute inset-0 bg-gradient-to-t from-[#07090C] via-[#07090C]/60 to-[#07090C]/90"></div>
        <div className="absolute inset-0 bg-gradient-to-r from-[#07090C] via-[#07090C]/75 to-transparent"></div>
        <div className="absolute inset-0 lunar-noise-overlay opacity-40"></div>
        <div className="absolute inset-0 grid-lines-lunar opacity-30"></div>
      </div>

      {/* Main Hero Content Grid: Left Title + Right 3D Interactive Chandrayaan Spacecraft */}
      <div className="relative z-10 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-center my-auto flex-1">
        
        {/* LEFT SIDE: Clean Bold ECLIPSE Title with Individual Interactive Letter Buttons */}
        <div className="lg:col-span-6 flex flex-col items-start text-left overflow-visible">
          <h1 className="font-headline tracking-[0.03em] uppercase text-5xl sm:text-7xl md:text-8xl lg:text-[92px] xl:text-[104px] font-extrabold leading-[1.1] select-none m-0 p-0 flex items-center overflow-visible py-2 bg-transparent border-0">
            {'ECLIPSE'.split('').map((letter, idx) => (
              <span
                key={idx}
                role="button"
                tabIndex={0}
                data-magnetic="false"
                onClick={onLaunchWorkbench || onNext}
                onKeyDown={(e) => e.key === 'Enter' && (onLaunchWorkbench ? onLaunchWorkbench() : onNext())}
                className="eclipse-letter-btn"
                aria-label={`Letter ${letter} - Launch Main Application`}
                title="Launch ECLIPSE Dashboard"
              >
                {letter}
              </span>
            ))}
          </h1>
        </div>

        {/* RIGHT SIDE: Compact Hyperrealistic 8K Chandrayaan-2 Spacecraft */}
        <div className="lg:col-span-6 relative flex items-center justify-center lg:justify-end">
          <ChandrayaanViewer onLaunchWorkbench={onLaunchWorkbench} />
        </div>
      </div>

      {/* Overview Page Bottom Bar with minimal NEXT button */}
      <div className="relative z-10 max-w-7xl mx-auto w-full pt-2 sm:pt-4 flex items-center justify-between border-t border-subtle">
        <div className="font-mono-tech text-[10px] text-[#8B908F] uppercase tracking-widest hidden sm:block">
          CHANDRAYAAN • SECTION 01 / 05 — MISSION OVERVIEW
        </div>

        <button
          id="overview-next-button"
          onClick={onNext}
          className="group inline-flex items-center gap-3 text-xs md:text-sm font-sans font-semibold tracking-[0.18em] text-[#E7E3D9] hover:text-[#D6C38B] py-1.5 sm:py-2 px-4 rounded-full border border-subtle hover:border-[#D6C38B]/50 bg-[#0D1116]/80 hover:bg-[#0D1116] transition-all ml-auto focus:outline-none cursor-pointer"
          aria-label="Navigate to Pipeline page"
        >
          <span>NEXT: PIPELINE</span>
          <ArrowRight className="w-4 h-4 text-[#D6C38B] group-hover:translate-x-1.5 transition-transform duration-300" />
        </button>
      </div>
    </section>
  );
};
