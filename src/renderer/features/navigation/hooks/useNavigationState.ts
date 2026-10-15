import { useState } from 'react';
import type {
  NavigationItemId,
  NavigationSectionId,
} from '../model/navigation.types';

type NavigationSectionsState = Record<NavigationSectionId, boolean>;

const initialSectionsState: NavigationSectionsState = {
  work: true,
  status: true,
  tags: true,
};

export const useNavigationState = () => {
  const [isSelectedItem, setIsSelectedItem] =
    useState<NavigationItemId>('all-notes');

  const [isExpandedSections, setIsExpandedSection] =
    useState<NavigationSectionsState>(initialSectionsState);

  const toggleSection = (section: NavigationSectionId) => {
    setIsExpandedSection((current) => ({
      ...current,
      [section]: !current[section],
    }));
  };

  return {
    isSelectedItem,
    isExpandedSections,
    selectItem: setIsSelectedItem,
    toggleSection,
  };
};
