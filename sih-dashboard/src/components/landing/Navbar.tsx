import React, { useState, useEffect } from 'react';
import { Menu, X } from 'lucide-react';

interface NavbarProps {
  activeSection: 'overview' | 'pipeline' | 'sensors' | 'science' | 'team';
  onNavigate: (section: 'overview' | 'pipeline' | 'sensors' | 'science' | 'team') => void;
  onLaunchWorkbench?: () => void;
  onOpenDossier?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeSection,
  onNavigate,
  onLaunchWorkbench,
  onOpenDossier,
}) => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleNavClick = (section: 'overview' | 'pipeline' | 'sensors' | 'science' | 'team') => {
    setMobileMenuOpen(false);
    onNavigate(section);
  };

  return (
    <header
      id="main-navbar"
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-[#07090C]/95 backdrop-blur-md py-2.5 border-b border-subtle'
          : 'bg-[#07090C]/80 backdrop-blur-sm py-3.5 border-b border-subtle/40'
      }`}
    >
      <div className="max-w-7xl mx-auto px-2 sm:px-4 md:px-6 lg:px-6 flex items-center justify-between">
        
        {/* ECLIPSE Clickable Logo Button */}
        <button
          onClick={() => handleNavClick('overview')}
          className="flex items-center gap-2.5 group shrink-0 text-left focus:outline-none cursor-pointer -ml-1 sm:-ml-2"
          title="Return to Overview"
          aria-label="ECLIPSE Overview Home"
        >
          <div className="flex items-center gap-2">
            <span className="font-headline text-base sm:text-lg md:text-xl tracking-[0.14em] font-bold text-[#E7E3D9] uppercase group-hover:text-[#D6C38B] transition-colors">
              ECLIPSE
            </span>
            <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full border border-[#D6C38B]/60 relative overflow-hidden flex items-center justify-center shrink-0">
              <div className="absolute inset-0 bg-[#E7E3D9] rounded-full translate-x-1.5 translate-y-0.5 opacity-90"></div>
              <div className="absolute inset-0 bg-[#07090C] rounded-full translate-x-0.5 opacity-95"></div>
            </div>
          </div>
          <div className="hidden sm:flex flex-col text-left pl-2.5 border-l border-[#E7E3D9]/15">
            <span className="font-mono-tech text-[8.5px] tracking-widest text-[#8B908F] uppercase font-medium">
              CHANDRAYAAN-2
            </span>
          </div>
        </button>

        {/* Desktop Navigation: OVERVIEW, PIPELINE, SENSORS, SCIENCE, TEAM */}
        <div className="hidden md:flex items-center gap-6 lg:gap-8">
          <nav className="flex items-center space-x-5 lg:space-x-8 text-[11.5px] lg:text-[12.5px] font-sans font-medium tracking-[0.16em]">
            <button
              onClick={() => handleNavClick('overview')}
              className={`transition-colors duration-200 uppercase relative py-1 cursor-pointer ${
                activeSection === 'overview'
                  ? 'text-[#D6C38B] font-bold'
                  : 'text-[#8B908F] hover:text-[#E7E3D9]'
              }`}
            >
              OVERVIEW
              {activeSection === 'overview' && (
                <span className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-[#D6C38B]" />
              )}
            </button>

            <button
              onClick={() => handleNavClick('pipeline')}
              className={`transition-colors duration-200 uppercase relative py-1 cursor-pointer ${
                activeSection === 'pipeline'
                  ? 'text-[#D6C38B] font-bold'
                  : 'text-[#8B908F] hover:text-[#E7E3D9]'
              }`}
            >
              PIPELINE
              {activeSection === 'pipeline' && (
                <span className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-[#D6C38B]" />
              )}
            </button>

            <button
              onClick={() => handleNavClick('sensors')}
              className={`transition-colors duration-200 uppercase relative py-1 cursor-pointer ${
                activeSection === 'sensors'
                  ? 'text-[#D6C38B] font-bold'
                  : 'text-[#8B908F] hover:text-[#E7E3D9]'
              }`}
            >
              SENSORS
              {activeSection === 'sensors' && (
                <span className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-[#D6C38B]" />
              )}
            </button>

            <button
              onClick={() => handleNavClick('science')}
              className={`transition-colors duration-200 uppercase relative py-1 cursor-pointer ${
                activeSection === 'science'
                  ? 'text-[#D6C38B] font-bold'
                  : 'text-[#8B908F] hover:text-[#E7E3D9]'
              }`}
            >
              SCIENCE
              {activeSection === 'science' && (
                <span className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-[#D6C38B]" />
              )}
            </button>

            <button
              onClick={() => handleNavClick('team')}
              className={`transition-colors duration-200 uppercase relative py-1 cursor-pointer ${
                activeSection === 'team'
                  ? 'text-[#D6C38B] font-bold'
                  : 'text-[#8B908F] hover:text-[#E7E3D9]'
              }`}
            >
              TEAM
              {activeSection === 'team' && (
                <span className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-[#D6C38B]" />
              )}
            </button>
          </nav>

          <div className="flex items-center gap-2.5">
            {onOpenDossier && (
              <button
                onClick={onOpenDossier}
                className="px-3 py-1.5 rounded-xl border border-[#D6C38B]/30 hover:border-[#D6C38B] text-[#D6C38B] hover:text-white font-sans font-medium text-[11px] tracking-wider transition-colors cursor-pointer"
              >
                DOSSIER
              </button>
            )}

            {onLaunchWorkbench && (
              <button
                onClick={onLaunchWorkbench}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-[#D6C38B] hover:bg-[#FAF6EB] text-black font-sans font-bold text-[11px] tracking-wider transition-all duration-300 shadow-[0_0_16px_rgba(214,195,139,0.35)] cursor-pointer"
              >
                <span>LAUNCH</span>
              </button>
            )}
          </div>
        </div>

        {/* Mobile Hamburger Button */}
        <button
          id="btn-mobile-menu"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden p-2 text-[#E7E3D9] hover:text-[#D6C38B] border border-subtle rounded focus:outline-none"
          aria-label="Toggle Navigation Menu"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>

      </div>

      {/* Mobile Menu Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-[#0D1116] border-b border-subtle px-6 py-5 space-y-3 font-sans text-xs tracking-widest">
          <button
            onClick={() => handleNavClick('overview')}
            className={`block w-full text-left py-2 border-b border-subtle/40 uppercase ${
              activeSection === 'overview' ? 'text-[#D6C38B] font-bold' : 'text-[#E7E3D9]'
            }`}
          >
            OVERVIEW
          </button>

          <button
            onClick={() => handleNavClick('pipeline')}
            className={`block w-full text-left py-2 border-b border-subtle/40 uppercase ${
              activeSection === 'pipeline' ? 'text-[#D6C38B] font-bold' : 'text-[#E7E3D9]'
            }`}
          >
            PIPELINE
          </button>

          <button
            onClick={() => handleNavClick('sensors')}
            className={`block w-full text-left py-2 border-b border-subtle/40 uppercase ${
              activeSection === 'sensors' ? 'text-[#D6C38B] font-bold' : 'text-[#E7E3D9]'
            }`}
          >
            SENSORS
          </button>

          <button
            onClick={() => handleNavClick('science')}
            className={`block w-full text-left py-2 border-b border-subtle/40 uppercase ${
              activeSection === 'science' ? 'text-[#D6C38B] font-bold' : 'text-[#E7E3D9]'
            }`}
          >
            SCIENCE
          </button>

          <button
            onClick={() => handleNavClick('team')}
            className={`block w-full text-left py-2 text-[#8B908F] hover:text-[#E7E3D9] uppercase ${
              activeSection === 'team' ? 'text-[#D6C38B] font-bold' : ''
            }`}
          >
            TEAM
          </button>

          <div className="pt-2 flex flex-col gap-2">
            {onOpenDossier && (
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenDossier();
                }}
                className="block w-full text-center py-2 rounded-xl border border-[#D6C38B]/40 text-[#D6C38B] font-sans font-bold text-xs tracking-wider"
              >
                SCIENTIFIC DOSSIER
              </button>
            )}

            {onLaunchWorkbench && (
              <button
                onClick={onLaunchWorkbench}
                className="block w-full text-center py-2.5 rounded-xl bg-[#D6C38B] text-black font-sans font-bold text-xs tracking-wider"
              >
                LAUNCH
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
