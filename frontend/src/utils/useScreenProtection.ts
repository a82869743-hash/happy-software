import { useEffect } from 'react';

/**
 * useScreenProtection — Best-effort browser deterrents against screenshots & screen recording.
 * 
 * What it does:
 * - Blocks PrintScreen key
 * - Blocks Ctrl+P / Cmd+P (print)
 * - Blocks Ctrl+Shift+S (screenshot shortcuts)
 * - Blocks right-click context menu
 * - Detects when the window/tab loses focus and clears clipboard
 * 
 * NOTE: True OS-level screenshot/recording prevention is NOT possible in a web browser.
 * This provides deterrents only.
 */
export function useScreenProtection() {
  useEffect(() => {
    // ── Bypass on public and print routes ──
    const path = window.location.pathname;
    if (path.startsWith('/track/') || path.startsWith('/print/') || path.startsWith('/invoice/') || path.startsWith('/view/') || path === '/login') {
      return;
    }

    // ─── Block keyboard shortcuts ───
    const handleKeyDown = (e: KeyboardEvent) => {
      // Block PrintScreen
      if (e.key === 'PrintScreen') {
        e.preventDefault();
        // Attempt to clear clipboard
        navigator.clipboard?.writeText('').catch(() => {});
        return false;
      }

      // Block Ctrl+P (print)
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        return false;
      }

      // Block Ctrl+Shift+S (some screenshot tools)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 's') {
        e.preventDefault();
        return false;
      }

      // Block Ctrl+Shift+I (DevTools) — optional extra protection
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'I') {
        e.preventDefault();
        return false;
      }

      // Block F12 (DevTools)
      if (e.key === 'F12') {
        e.preventDefault();
        return false;
      }
    };

    // ─── Block right-click context menu ───
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      return false;
    };

    // ─── On visibility change — try to overwrite clipboard ───
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        navigator.clipboard?.writeText('').catch(() => {});
      }
    };

    // ─── Block copy events ───
    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      e.clipboardData?.setData('text/plain', '');
    };

    // Attach listeners
    document.addEventListener('keydown', handleKeyDown, { capture: true });
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('copy', handleCopy);

    // Cleanup
    return () => {
      document.removeEventListener('keydown', handleKeyDown, { capture: true });
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('copy', handleCopy);
    };
  }, []);
}
