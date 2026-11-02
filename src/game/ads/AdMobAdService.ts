import {
  AdMob,
  AdmobConsentDebugGeography,
  AdmobConsentStatus,
  RewardAdPluginEvents,
} from '@capacitor-community/admob';
import type { PluginListenerHandle } from '@capacitor/core';
import type { AdPlacement, AdService } from './AdService';

// Google's sample rewarded ad unit for Android: always serves test ads. Real ad unit IDs
// (one per placement) replace this only for the store release.
const TEST_REWARDED_AD_ID = 'ca-app-pub-3940256099942544/5224354917';
// Build with VITE_ADS_DEBUG_EEA=1 to see the consent form as a player in the EU would.
const DEBUG_EEA = import.meta.env.VITE_ADS_DEBUG_EEA === '1';

// Rewarded ads through the AdMob Capacitor plugin, used in the Android build.
export class AdMobAdService implements AdService {
  private ready: Promise<void> | null = null;

  // Starts the SDK and asks for consent where the law requires it (EU/UK: GDPR), so the form
  // shows at launch rather than in the middle of the first ad. Safe to call more than once.
  init(): Promise<void> {
    this.ready ??= this.start().catch((error) => {
      console.warn('AdMob setup failed', error);
      this.ready = null;
    });
    return this.ready;
  }

  private async start(): Promise<void> {
    await AdMob.initialize();
    const info = await AdMob.requestConsentInfo(DEBUG_EEA ? { debugGeography: AdmobConsentDebugGeography.EEA } : {});
    if (info.status === AdmobConsentStatus.REQUIRED && info.isConsentFormAvailable) {
      await AdMob.showConsentForm();
    }
  }

  async showRewarded(_placement: AdPlacement): Promise<boolean> {
    try {
      await this.init();
      await AdMob.prepareRewardVideoAd({ adId: TEST_REWARDED_AD_ID, isTesting: true });
      return await this.playLoadedAd();
    } catch (error) {
      // No fill, no network, or the SDK refused: the player simply gets no reward.
      console.warn('Rewarded ad failed', error);
      return false;
    }
  }

  // The reward and the dismissal arrive as separate events; the ad counts as watched only if
  // the reward event came before the player closed it.
  private async playLoadedAd(): Promise<boolean> {
    let rewarded = false;
    let finish: (watched: boolean) => void = () => {};
    const finished = new Promise<boolean>((resolve) => (finish = resolve));
    // Listen before showing so no event is missed.
    const handles: PluginListenerHandle[] = await Promise.all([
      AdMob.addListener(RewardAdPluginEvents.Rewarded, () => {
        rewarded = true;
      }),
      AdMob.addListener(RewardAdPluginEvents.Dismissed, () => finish(rewarded)),
      AdMob.addListener(RewardAdPluginEvents.FailedToShow, () => finish(false)),
    ]);
    try {
      // Resolves when the reward is earned; the dismissal still has to follow.
      await AdMob.showRewardVideoAd().catch(() => finish(false));
      return await finished;
    } finally {
      await Promise.all(handles.map((handle) => handle.remove()));
    }
  }
}
