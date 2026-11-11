import { Capacitor } from '@capacitor/core';
import { t, type TranslationKey } from '../../i18n';
import { AdMobAdService } from './AdMobAdService';

// Rewarded ads. Game code only talks to this interface; the browser uses a fake test ad,
// the Android build uses AdMob.

export type AdPlacement = 'rush' | 'timeSkip' | 'offlineDouble' | 'vip' | 'dailyDouble' | 'busDouble' | 'labSpeedUp' | 'streakSave';

export interface AdService {
  // Prepares the ad network (and asks for consent where needed) at startup.
  init(): Promise<void>;
  // Shows a rewarded ad. Resolves true only if the player watched it to the end.
  showRewarded(placement: AdPlacement): Promise<boolean>;
  // Whether the player must be able to change their ad privacy choices from the settings
  // (players under GDPR or US state privacy laws). Known after init().
  readonly privacyOptionsRequired: boolean;
  // Opens the privacy choices form (consent in the EU, "do not sell" in US states).
  showPrivacyOptions(): Promise<void>;
}

const TEST_AD_SECONDS = 3;

// Stand-in for a real ad network while developing in the browser: a full-screen overlay with a
// short countdown. Closing it early forfeits the reward, like a real rewarded ad.
export class TestAdService implements AdService {
  // Dev only: /?privacy=1 shows the privacy options button in the settings.
  readonly privacyOptionsRequired = new URLSearchParams(location.search).has('privacy');

  async init(): Promise<void> {}

  async showPrivacyOptions(): Promise<void> {
    window.alert('Privacy options form (shown by AdMob on Android)');
  }

  showRewarded(placement: AdPlacement): Promise<boolean> {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.style.cssText =
        'position:fixed;inset:0;z-index:1000;display:flex;flex-direction:column;align-items:center;' +
        'justify-content:center;gap:24px;background:rgba(10,10,20,0.92);color:#fff;font:600 22px system-ui,sans-serif';
      const title = document.createElement('div');
      title.textContent = `Test ad (${placement})`;
      title.style.cssText = 'font-size:32px';
      const countdown = document.createElement('div');
      const button = document.createElement('button');
      button.style.cssText =
        'padding:12px 28px;border:0;border-radius:12px;font:600 20px system-ui,sans-serif;cursor:pointer';
      overlay.append(title, countdown, button);
      document.body.append(overlay);

      let left = TEST_AD_SECONDS;
      const render = () => {
        countdown.textContent = left > 0 ? `Reward in ${left}s` : 'Reward earned';
        button.textContent = left > 0 ? 'Skip (no reward)' : 'Close';
        button.style.background = left > 0 ? '#555' : '#f4b400';
        button.style.color = left > 0 ? '#ddd' : '#3a2618';
      };
      render();
      const timer = window.setInterval(() => {
        left--;
        render();
        if (left <= 0) window.clearInterval(timer);
      }, 1000);
      button.addEventListener('click', () => {
        window.clearInterval(timer);
        overlay.remove();
        resolve(left <= 0);
      });
    });
  }
}

export const ads: AdService = Capacitor.isNativePlatform() ? new AdMobAdService() : new TestAdService();

// "No Ads" (in-app purchase): the scene keeps this in sync with the save.
export const adPolicy = { removed: false };

// Every rewarded ad goes through here: with "No Ads" the reward comes without the ad.
export function showRewardedAd(placement: AdPlacement): Promise<boolean> {
  return adPolicy.removed ? Promise.resolve(true) : ads.showRewarded(placement);
}

// The ad icon on reward buttons, left out once ads are removed.
// An offer text: the "...Free" variant of the key (no "watch an ad") once ads are removed.
export function adText(key: TranslationKey, params: Record<string, string | number> = {}): string {
  return t((adPolicy.removed ? `${key}Free` : key) as TranslationKey, params);
}

export function adIcon(): string | undefined {
  return adPolicy.removed ? undefined : 'ad';
}
