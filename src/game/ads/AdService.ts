import { Capacitor } from '@capacitor/core';
import { AdMobAdService } from './AdMobAdService';

// Rewarded ads. Game code only talks to this interface; the browser uses a fake test ad,
// the Android build uses AdMob.

export type AdPlacement = 'rush' | 'timeSkip' | 'offlineDouble' | 'vip';

export interface AdService {
  // Shows a rewarded ad. Resolves true only if the player watched it to the end.
  showRewarded(placement: AdPlacement): Promise<boolean>;
}

const TEST_AD_SECONDS = 3;

// Stand-in for a real ad network while developing in the browser: a full-screen overlay with a
// short countdown. Closing it early forfeits the reward, like a real rewarded ad.
export class TestAdService implements AdService {
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
