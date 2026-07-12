export const LOGO_KEYS = {
  blue: 'plasmodyne-logo-blue',
  white: 'plasmodyne-logo-white',
  grey: 'plasmodyne-logo-grey',
  gold: 'plasmodyne-logo-gold'
};

export const LOGO_PATHS = {
  [LOGO_KEYS.blue]: './assets/ui/logos/plasmodyne-logo-blue.png',
  [LOGO_KEYS.white]: './assets/ui/logos/plasmodyne-logo-white.png',
  [LOGO_KEYS.grey]: './assets/ui/logos/plasmodyne-logo-grey.png',
  [LOGO_KEYS.gold]: './assets/ui/logos/plasmodyne-logo-gold.png'
};

export function preloadLogoAssets(scene) {
  for (const [key, path] of Object.entries(LOGO_PATHS)) {
    scene.load.image(key, path);
  }
}
