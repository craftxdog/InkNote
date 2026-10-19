import { useState } from 'react';

import type {
  NavigationSectionId,
  NavigationSectionsState,
} from '../model/navigation.types';

const initialSectionsState: NavigationSectionsState = {
  work: true,
  status: true,
  tags: true,
};

/**
 * Estado visual interno del Navigation.
 *
 * Controla únicamente:
 * - Work expandido/colapsado
 * - Status expandido/colapsado
 * - Tags expandido/colapsado
 *
 * No controla selección ni Workspace View.
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
