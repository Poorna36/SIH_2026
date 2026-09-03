import React, { useState } from 'react';
import { Navbar } from './Navbar';
import { Hero } from './Hero';
import { PipelineSection } from './PipelineSection';
import { SensorsSection } from './SensorsSection';
import { ScienceApplicationsSection } from './ScienceApplicationsSection';
import { TeamSection } from './TeamSection';
import { TechnicalDossierModal } from './TechnicalDossierModal';

interface LunarisLandingProps {
  onLaunchWorkbench: () => void;
}

export type LandingSection = 'overview' | 'pipeline' | 'sensors' | 'science' | 'team';

export const LunarisLanding: React.FC<LunarisLandingProps> = ({ onLaunchWorkbench }) => {
  const [currentPage, setCurrentPage] = useState<LandingSection>('overview');
  const [isDossierOpen, setIsDossierOpen] = useState(false);

  const navigateToPage = (page: LandingSection) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen w-full bg-[#07090C] text-[#E7E3D9] flex flex-col relative overflow-x-hidden selection:bg-[#D6C38B]/20 selection:text-[#D6C38B]">
      {/* Fixed Editorial Navigation */}
      <Navbar
        activeSection={currentPage}
        onNavigate={navigateToPage}
        onLaunchWorkbench={onLaunchWorkbench}
        onOpenDossier={() => setIsDossierOpen(true)}
      />

      <main className="flex-1 flex flex-col">
        {/* 01 — OVERVIEW & ORBITAL TRAJECTORY */}
        {currentPage === 'overview' && (
          <Hero
            onNext={() => navigateToPage('pipeline')}
            onLaunchWorkbench={onLaunchWorkbench}
          />
        )}

        {/* 02 — 4-STAGE CO-REGISTRATION PIPELINE */}
        {currentPage === 'pipeline' && (
          <PipelineSection
            onNext={() => navigateToPage('sensors')}
            onLaunchWorkbench={onLaunchWorkbench}
          />
        )}

        {/* 03 — SENSORS & PAYLOAD COMPENDIUM */}
        {currentPage === 'sensors' && (
          <SensorsSection onNext={() => navigateToPage('science')} />
        )}

        {/* 04 — SCIENCE APPLICATIONS & WATER-ICE FINDINGS */}
        {currentPage === 'science' && (
          <ScienceApplicationsSection
            onNext={() => navigateToPage('team')}
            onLaunchWorkbench={onLaunchWorkbench}
          />
        )}

        {/* 05 — TEAM & RESEARCHERS */}
        {currentPage === 'team' && (
          <TeamSection />
        )}
      </main>

      {/* Interactive Mathematical & Scientific Dossier Modal */}
      <TechnicalDossierModal
        isOpen={isDossierOpen}
        onClose={() => setIsDossierOpen(false)}
        onLaunchWorkbench={onLaunchWorkbench}
      />
    </div>
  );
};

export default LunarisLanding;
