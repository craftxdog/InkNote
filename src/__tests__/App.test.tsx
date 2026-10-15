import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import App from '../renderer/App';

describe('App', () => {
  const setTrafficLightsVisible = jest.fn().mockResolvedValue(true);

  beforeEach(() => {
    Object.defineProperty(window, 'inknote', {
      configurable: true,
      value: {
        windowControls: { setTrafficLightsVisible },
      },
    });
    setTrafficLightsVisible.mockClear();
  });

  it('renders the workspace and synchronizes the traffic lights', () => {
    render(<App />);

    expect(screen.getByRole('button', { name: /^All Notes/ })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByText('Markdown Editor')).toBeInTheDocument();
    expect(screen.getByText('Markdown Preview')).toBeInTheDocument();
    expect(setTrafficLightsVisible).toHaveBeenCalledWith(true);
  });
});
