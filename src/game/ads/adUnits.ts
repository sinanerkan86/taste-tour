import type { AdPlacement } from './AdService';

// Only the store build (`vite build --mode release`, see .env.release) shows real ads. Every other
// build uses Google's sample ad unit, so testing on a phone never counts as invalid traffic.
export const RELEASE_ADS = import.meta.env.VITE_ADS_RELEASE === '1';

// Google's sample rewarded ad unit for Android: always serves test ads.
const TEST_REWARDED_AD_ID = 'ca-app-pub-3940256099942544/5224354917';

// Real rewarded ad units of the "Taste Tour: Idle Restaurant" AdMob app, one per placement so
// reports show what each reward earns (names in the AdMob console in comments).
const RELEASE_AD_UNITS: Record<AdPlacement, string> = {
  rush: 'ca-app-pub-6709000702163453/2588576173', // Rush 2x
  timeSkip: 'ca-app-pub-6709000702163453/6336249495', // Extra cash
  offlineDouble: 'ca-app-pub-6709000702163453/4465985811', // Offline double
  vip: 'ca-app-pub-6709000702163453/2885310839', // VIP tip
  // Not created in AdMob yet: until they are, these placements show Google's test ad.
  dailyDouble: '', // Daily double
  busDouble: '', // Tour bus double
  labSpeedUp: '', // Lab speed up
};

export function rewardedAdUnit(placement: AdPlacement): string {
  return (RELEASE_ADS && RELEASE_AD_UNITS[placement]) || TEST_REWARDED_AD_ID;
}
