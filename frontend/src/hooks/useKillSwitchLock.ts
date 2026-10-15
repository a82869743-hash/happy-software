export function useKillSwitchLock(_moduleName: string) {
  return {
    clickCount: 0,
    isLocked: false,
    toggleLock: () => {},
    lockAllModules: () => {},
    registerClick: () => {},
    resetLock: () => {},
    remainingClicks: 200,
    clickLimit: 200
  };
}
