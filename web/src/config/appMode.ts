// Vite inlines this at build time. Leave VITE_APP_MODE unset for the public demo site.
export const isProductionMode = import.meta.env.VITE_APP_MODE === 'production';
export const isDemoMode = !isProductionMode;
