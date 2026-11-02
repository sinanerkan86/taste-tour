import { AdMob, RewardAdPluginEvents } from '@capacitor-community/admob';
import type { PluginListenerHandle } from '@capacitor/core';
import type { AdPlacement, AdService } from './AdService';

// Google's sample rewarded ad unit for Android: always serves test ads. Real ad unit IDs
// (one per placement) replace this only for the store release.
const TEST_REWARDED_AD_ID = 'ca-app-pub-3940256099942544/5224354917';

// Rewarded ads through the AdMob Capacitor plugin, used in the Android build.
export class AdMobAdService implements AdService {
  private ready: Promise<void> | null = null;

  async showRewarded(_placement: AdPlacement): Promise<boolean> {
    try {
      this.ready ??= AdMob.initialize();
      await this.ready;
      await AdMob.prepareRewardVideoAd({ adId: TEST_REWARDED_AD_ID, isTesting: true });
      return await this.playLoadedAd();
    } catch (error) {
      // No fill, no network, or the SDK refused: the player simply gets no reward.
      console.warn('Rewarded ad failed', error);
      this.ready = null;
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
