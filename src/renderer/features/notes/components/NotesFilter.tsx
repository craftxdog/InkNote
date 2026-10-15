import type { ChangeEvent, KeyboardEvent } from 'react';

import { ClearIcon, FilterIcon } from './NotesIcons';

type NotesFilterProps = {
  value: string;
  onChange: (value: string) => void;
};

export const NotesFilter = ({ value, onChange }: NotesFilterProps) => {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.value);
  };
  const clearFilter = () => {
    onChange('');
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape' && value) {
      event.preventDefault();

      clearFilter();
    }
  };

  return (
    <>
      <div className="notes-filter">
        <span className="notes-filter__icon">
          <FilterIcon />
        </span>

        <input
          type="text"
          className="notes-filter__input"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Filter"
          aria-label="Filter notes"
          autoComplete="off"
          spellCheck={false}
        />

        {value && (
          <button
            type="button"
            className="notes-filter__clear"
            onClick={clearFilter}
            aria-label="Clear filter"
            title="Clear filter"
          >
            <ClearIcon />
          </button>
        )}
      </div>
    </>
  );
};
