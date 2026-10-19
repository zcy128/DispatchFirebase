// Google Maps JavaScript API Singleton Loader for Dispatch Web App

let googleMapsPromise: Promise<typeof google.maps> | null = null;

export const loadGoogleMaps = (): Promise<typeof google.maps> => {
  if (typeof window !== 'undefined' && (window as any).google?.maps) {
    return Promise.resolve((window as any).google.maps);
  }

  if (googleMapsPromise) {
    return googleMapsPromise;
  }

  googleMapsPromise = new Promise((resolve, reject) => {
    // Check if script is already present in document
    const existingScript = document.getElementById('google-maps-js-sdk');
    if (existingScript) {
      existingScript.addEventListener('load', () => {
        if ((window as any).google?.maps) {
          resolve((window as any).google.maps);
        } else {
          reject(new Error('Google Maps SDK loaded but google.maps is not available'));
        }
      });
      existingScript.addEventListener('error', (e) => reject(e));
      return;
    }

    const apiKey =
      import.meta.env.VITE_GOOGLE_MAPS_API_KEY ||
      import.meta.env.VITE_FIREBASE_API_KEY;

    if (!apiKey) {
      console.warn('Google Maps API key is not configured. Set VITE_GOOGLE_MAPS_API_KEY in .env');
      return;
    }

    const script = document.createElement('script');
    script.id = 'google-maps-js-sdk';
    script.type = 'text/javascript';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=geometry,places`;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      if ((window as any).google?.maps) {
        resolve((window as any).google.maps);
      } else {
        reject(new Error('Google Maps SDK loaded without window.google.maps object'));
      }
    };

    script.onerror = (err) => {
      googleMapsPromise = null;
      reject(new Error(`Failed to load Google Maps SDK: ${err}`));
    };

    document.head.appendChild(script);
  });

  return googleMapsPromise;
};
