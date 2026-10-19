{{flutter_js}}
{{flutter_build_config}}

// Unregister all service workers to ensure immediate live updates
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(function(registrations) {
    for (var i = 0; i < registrations.length; i++) {
      registrations[i].unregister();
    }
  });
}

// Clear all browser caches
if ('caches' in window) {
  caches.keys().then(function(names) {
    for (var i = 0; i < names.length; i++) {
      caches.delete(names[i]);
    }
  });
}

_flutter.loader.load({
  serviceWorkerSettings: null
});
