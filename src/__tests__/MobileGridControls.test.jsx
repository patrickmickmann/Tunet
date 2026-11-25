import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import M3Slider from '../components/ui/M3Slider';
import DashboardGrid from '../rendering/DashboardGrid';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const offline = vi.hoisted(() => ({ value: false }));
vi.mock('../contexts/HomeAssistantContext', () => ({
  useHomeAssistantOffline: () => offline.value,
}));

const dashboardProps = {
  page: {
    activePage: 'home',
    pagesConfig: { pages: ['home'], home: ['sensor.mobile_test'], header: [] },
    pageSettings: {},
    editMode: false,
    isMediaPage: () => false,
    isSonosPage: () => false,
    isLightsPage: () => false,
    isBatteryPage: () => false,
    isRoomExplorerPage: () => false,
  },
  media: {
    entities: {},
    conn: null,
    isSonosActive: false,
    activeMediaId: null,
    setActiveMediaId: vi.fn(),
    getA: vi.fn(),
    getEntityImageUrl: vi.fn(),
    callService: vi.fn(),
    savePageSetting: vi.fn(),
  },
  grid: {
    gridLayout: { 'sensor.mobile_test': { row: 1, col: 1, span: 2, colSpan: 1 } },
    isMobile: true,
    gridGapV: 24,
    gridGapH: 12,
    gridColCount: 2,
    isCompactCards: false,
    cardScale: 100,
  },
  cards: {
    cardSettings: {},
    getCardSettingsKey: (id) => id,
    hiddenCards: [],
    isCardHiddenByLogic: () => false,
    renderCard: () => <div>Mobile test card</div>,
  },
  actions: {
    setShowAddCardModal: vi.fn(),
    setConfigTab: vi.fn(),
    setShowConfigModal: vi.fn(),
  },
  t: (key) => key,
};

describe('card slots without contact with Home Assistant', () => {
  afterEach(() => {
    offline.value = false;
  });

  const slot = () => screen.getByText('Mobile test card').closest('.dashboard-card-slot');

  it('leaves the slot alone while the data can be trusted', () => {
    render(<DashboardGrid {...dashboardProps} />);
    expect(slot()).not.toHaveAttribute('data-card-offline');
  });

  it('marks the slot when offline', () => {
    offline.value = true;
    render(<DashboardGrid {...dashboardProps} />);
    expect(slot()).toHaveAttribute('data-card-offline');
  });

  it('keeps a locked card out of reach of the keyboard', () => {
    offline.value = true;
    render(<DashboardGrid {...dashboardProps} />);
    expect(slot()).toHaveAttribute('inert');
  });

  it('leaves the keyboard alone while the data can be trusted and during edit mode', () => {
    const { unmount } = render(<DashboardGrid {...dashboardProps} />);
    expect(slot()).not.toHaveAttribute('inert');
    unmount();

    offline.value = true;
    render(<DashboardGrid {...dashboardProps} page={{ ...dashboardProps.page, editMode: true }} />);
    expect(slot()).not.toHaveAttribute('inert');
  });

  it('does not mark the slot during edit mode', () => {
    offline.value = true;
    render(<DashboardGrid {...dashboardProps} page={{ ...dashboardProps.page, editMode: true }} />);
    expect(slot()).not.toHaveAttribute('data-card-offline');
    expect(slot()).toHaveAttribute('data-card-editing');
  });

  it('blocks taps on the card itself, not only on the controls inside it', () => {
    const rule =
      /\.dashboard-card-slot\[data-card-offline\],\s*\.dashboard-card-slot\[data-card-offline\] \*\s*\{\s*pointer-events: none;/;
    expect(readFileSync(resolve(process.cwd(), 'src/styles/dashboard.css'), 'utf8')).toMatch(rule);
  });
});

describe('mobile grid controls', () => {
  it('applies the configured horizontal and vertical gaps on mobile', () => {
    const { container } = render(<DashboardGrid {...dashboardProps} />);

    const grid = container.querySelector('.page-transition.grid');
    expect(grid.style.gap).toBe(
      'calc(24px * var(--density-gap-scale, 1)) calc(12px * var(--density-gap-scale, 1))'
    );
    expect(screen.getByText('Mobile test card').closest('[data-dashboard-card]')).toHaveStyle({
      height: '188px',
    });
  });

  it('reserves horizontal dragging for sliders while allowing vertical page scrolling', () => {
    render(<M3Slider min={0} max={64} step={4} value={20} onChange={vi.fn()} ariaLabel="Gap" />);

    const slider = screen.getByRole('slider', { name: 'Gap' });
    expect(slider).toHaveStyle({ touchAction: 'pan-y' });
    expect(slider.parentElement).toHaveStyle({ touchAction: 'pan-y' });
  });
});

describe('fit to screen', () => {
  const tabletProps = {
    ...dashboardProps,
    grid: { ...dashboardProps.grid, isMobile: false, fitToScreen: true },
  };
  const card = () => screen.getByText('Mobile test card').closest('[data-dashboard-card]');

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const renderMeasured = (props, screenSize) => {
    const computedStyle = mockScreen(screenSize);
    const result = render(
      <div id="main-content">
        <DashboardGrid {...props} />
      </div>
    );
    computedStyle.mockRestore();
    return result;
  };

  const mockScreen = ({ innerHeight, gridTop }) => {
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(innerHeight);
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      top: gridTop,
      bottom: gridTop,
      left: 0,
      right: 0,
      width: 0,
      height: 0,
      x: 0,
      y: gridTop,
      toJSON: () => ({}),
    });
    // Only the measuring pass reads these; the real styles come back before the assertions.
    return vi
      .spyOn(window, 'getComputedStyle')
      .mockReturnValue({ paddingBottom: '40px', rowGap: '20px' });
  };

  it('stretches the rows so the page ends at the bottom of the screen', () => {
    // iPad A16 in landscape is 820 CSS pixels high.
    const { container } = renderMeasured(tabletProps, { innerHeight: 820, gridTop: 200 });

    // 820 - 200 above - 40 padding = 580 for two rows and one 20px gap.
    expect(card()).toHaveStyle({ height: '580px' });
    expect(container.querySelector('[data-fit-to-screen]')).not.toBeNull();
  });

  it('keeps the normal row height when the rows would get too short', () => {
    const { container } = renderMeasured(tabletProps, { innerHeight: 260, gridTop: 200 });

    expect(card()).toHaveStyle({ height: '224px' });
    expect(container.querySelector('[data-fit-to-screen]')).toBeNull();
  });

  it('leaves phones alone', () => {
    renderMeasured(
      { ...tabletProps, grid: { ...tabletProps.grid, isMobile: true } },
      { innerHeight: 820, gridTop: 200 }
    );

    expect(card()).toHaveStyle({ height: '188px' });
  });
});

describe('fit to screen after the first card appears', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('measures once the page gets its first card', () => {
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(820);
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      top: 200,
      bottom: 200,
      left: 0,
      right: 0,
      width: 0,
      height: 0,
      x: 0,
      y: 200,
      toJSON: () => ({}),
    });
    const computedStyle = vi
      .spyOn(window, 'getComputedStyle')
      .mockReturnValue({ paddingBottom: '40px', rowGap: '20px' });
    const grid = { ...dashboardProps.grid, isMobile: false, fitToScreen: true };
    const { rerender } = render(
      <div id="main-content">
        <DashboardGrid {...dashboardProps} grid={{ ...grid, gridLayout: {} }} />
      </div>
    );

    rerender(
      <div id="main-content">
        <DashboardGrid {...dashboardProps} grid={grid} />
      </div>
    );
    computedStyle.mockRestore();

    expect(screen.getByText('Mobile test card').closest('[data-dashboard-card]')).toHaveStyle({
      height: '580px',
    });
  });
});
