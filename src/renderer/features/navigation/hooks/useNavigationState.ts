import { useState } from 'react';

import type { NavigationSectionId } from '../model/navigation.types';

type NavigationSectionsState = Record<NavigationSectionId, boolean>;

const initialSectionsState: NavigationSectionsState = {
  work: true,
  status: true,
  tags: true,
};

/**
 * Controla únicamente estado visual interno
 * del Navigation:
 *
 * - Work abierto/cerrado
 * - Status abierto/cerrado
 * - Tags abierto/cerrado
 *
 * NO controla qué sección está seleccionada.
 */
export function useNavigationState() {
  const [expandedSections, setExpandedSections] =
    useState<NavigationSectionsState>(initialSectionsState);

  const toggleSection = (section: NavigationSectionId) => {
    setExpandedSections((current) => ({
      ...current,

      [section]: !current[section],
    }));
  };

  return {
    expandedSections,
    toggleSection,
  };
}
