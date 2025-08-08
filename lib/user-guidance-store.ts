export interface UserGuidanceState {
  hasSeenHostGuidance: boolean;
  currentGuidanceStep: number;
  isGuidanceActive: boolean;
}

const USER_GUIDANCE_STORAGE_KEY = 'planning-poker-user-guidance';

class UserGuidanceStore {
  private state: UserGuidanceState = {
    hasSeenHostGuidance: false,
    currentGuidanceStep: 0,
    isGuidanceActive: false,
  };

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(USER_GUIDANCE_STORAGE_KEY);
        if (stored) {
          this.state = { ...this.state, ...JSON.parse(stored) };
        }
      } catch (error) {
        console.warn('Failed to load user guidance state from storage:', error);
      }
    }
  }

  private saveToStorage(): void {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(USER_GUIDANCE_STORAGE_KEY, JSON.stringify(this.state));
      } catch (error) {
        console.warn('Failed to save user guidance state to storage:', error);
      }
    }
  }

  hasSeenHostGuidance(): boolean {
    return this.state.hasSeenHostGuidance;
  }

  markHostGuidanceSeen(): void {
    this.state.hasSeenHostGuidance = true;
    this.saveToStorage();
  }

  getCurrentStep(): number {
    return this.state.currentGuidanceStep;
  }

  setCurrentStep(step: number): void {
    this.state.currentGuidanceStep = step;
    this.saveToStorage();
  }

  isActive(): boolean {
    return this.state.isGuidanceActive;
  }

  startGuidance(): void {
    this.state.isGuidanceActive = true;
    this.state.currentGuidanceStep = 0;
    this.saveToStorage();
  }

  completeGuidance(): void {
    this.state.isGuidanceActive = false;
    this.state.hasSeenHostGuidance = true;
    this.state.currentGuidanceStep = 0;
    this.saveToStorage();
  }

  skipGuidance(): void {
    this.state.isGuidanceActive = false;
    this.state.hasSeenHostGuidance = true;
    this.state.currentGuidanceStep = 0;
    this.saveToStorage();
  }

  resetGuidance(): void {
    this.state = {
      hasSeenHostGuidance: false,
      currentGuidanceStep: 0,
      isGuidanceActive: false,
    };
    this.saveToStorage();
  }
}

export const userGuidanceStore = new UserGuidanceStore();