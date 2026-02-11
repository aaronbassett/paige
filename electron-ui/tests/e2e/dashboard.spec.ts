/**
 * E2E tests for the Dashboard view.
 *
 * The Dashboard is the home screen of Paige, rendered by AppShell when
 * `currentView === 'dashboard'`. It displays 6 sections in a golden-ratio
 * grid layout:
 *   Row 1: Dreyfus radar (38%) + Stats bento (62%)
 *   Row 2: In-progress tasks (62%) + Practice challenges (38%) [hidden when empty]
 *   Row 3: GitHub issues (62%) + Learning materials (38%)
 *
 * All data is populated via WebSocket messages from the backend.
 *
 * These tests are scaffolding (test.skip) because the Electron app requires
 * a display server to launch. Complete them when a display is available.
 */

import { test } from '@playwright/test';

// Helper: launchApp() — to be implemented when display is available
// const electronApp = await electron.launch({ args: ['.'] });
// const page = await electronApp.firstWindow();
// await page.waitForSelector('[aria-label="Dashboard"]');

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Dashboard E2E', () => {
  test.skip('loads dashboard with header and PAIGE logo', async () => {
    // TODO: Launch Electron app via _launchApp()
    // Verify: Header bar is visible with role="banner"
    // Verify: "PAIGE" logo text is rendered in the header
    // Verify: No "Back to Dashboard" button shown (already on dashboard)
    // Verify: Main content area has aria-label="Dashboard"
  });

  test.skip('displays all 6 dashboard sections', async () => {
    // TODO: Launch Electron app
    // TODO: Simulate backend WebSocket messages for all 6 data channels:
    //   - dashboard:dreyfus  (Dreyfus radar axes)
    //   - dashboard:stats    (Stats bento data)
    //   - dashboard:in_progress (In-progress tasks)
    //   - dashboard:issues   (GitHub issues list)
    //   - dashboard:challenges (Practice challenges)
    //   - dashboard:materials (Learning materials)
    //
    // Verify: Dreyfus radar section visible (aria-label="Dreyfus skill radar")
    // Verify: Stats bento section visible (aria-label="Session statistics")
    // Verify: In-progress tasks section visible when tasks exist
    // Verify: GitHub issues section visible (aria-label="GitHub issues")
    // Verify: Practice challenges section visible
    // Verify: Learning materials section visible
  });

  test.skip('shows loading skeletons before data arrives', async () => {
    // TODO: Launch app WITHOUT sending WebSocket data
    // Verify: Dreyfus radar shows skeleton (role="status", aria-label="Loading...")
    // Verify: Stats bento shows skeleton cards
    // Verify: GitHub issues shows 3 skeleton cards with breathing animation
    // Verify: No "No issues assigned" empty state while loading
  });

  test.skip('shows empty states when no data', async () => {
    // TODO: Launch app and send WebSocket messages with empty arrays
    //   - dashboard:issues with { issues: [] }
    //   - dashboard:challenges with { challenges: [] }
    //   - dashboard:materials with { materials: [] }
    //
    // Verify: GitHub issues shows "No issues assigned" text
    // Verify: Row 2 is hidden when both in-progress tasks and challenges are empty
  });

  test.skip('navigates to IDE when issue card clicked', async () => {
    // TODO: Launch app
    // TODO: Send dashboard:issues with sample issues (e.g., #42 "Fix login bug")
    // TODO: Click the issue card for #42
    //
    // Verify: View transitions to IDE (aria-label="IDE workspace")
    // Verify: Header shows "Back to Dashboard" button (aria-label="Back to dashboard")
    // Verify: IDE contains file explorer, editor area, terminal, and coaching sidebar
    // Verify: WebSocket message 'dashboard:start_issue' was sent with { issueNumber: 42 }
  });

  test.skip('navigates to placeholder when practice challenge clicked', async () => {
    // TODO: Launch app
    // TODO: Send dashboard:challenges with sample challenge data
    // TODO: Click a practice challenge card
    //
    // Verify: View transitions to Placeholder
    // Verify: "COMING SOON" figlet header is visible (aria-label="Coming Soon")
    // Verify: Construction illustration SVG is rendered
    // Verify: "Back to Dashboard" link is visible (aria-label="Back to dashboard")
  });

  test.skip('navigates to placeholder when learning material clicked', async () => {
    // TODO: Launch app
    // TODO: Send dashboard:materials with sample material data
    // TODO: Click a learning material card
    //
    // Verify: View transitions to Placeholder with "COMING SOON" header
    // Verify: "Back to Dashboard" link navigates back to dashboard
  });

  test.skip('stats bento responds to period switcher', async () => {
    // TODO: Launch app
    // TODO: Send initial dashboard:stats data
    // TODO: Click "This Week" period toggle
    //
    // Verify: WebSocket message 'dashboard:stats_period' sent with { period: 'this_week' }
    // Verify: Stats update when new dashboard:stats message arrives
  });

  test.skip('back button returns to dashboard from IDE', async () => {
    // TODO: Launch app
    // TODO: Navigate to IDE via issue click
    // TODO: Click the "Back to Dashboard" button in the header
    //
    // Verify: View transitions back to dashboard (aria-label="Dashboard")
    // Verify: "Back to Dashboard" button disappears
    // Verify: Dashboard data is still displayed (not re-fetched from scratch)
  });

  test.skip('keyboard navigation works on issue cards', async () => {
    // TODO: Launch app with issues loaded
    // TODO: Tab to an issue card
    // TODO: Press Enter
    //
    // Verify: Issue card is focusable (tabIndex=0)
    // Verify: Enter key triggers navigation to IDE
    // Verify: Space key also triggers navigation (role="button")
  });
});
