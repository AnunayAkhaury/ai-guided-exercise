importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyAQNGH2BNurUfZlPn2mWgkHcQb5kbD3QX8',
  authDomain: 'ai-guided-exercise-feedback.firebaseapp.com',
  projectId: 'ai-guided-exercise-feedback',
  storageBucket: 'ai-guided-exercise-feedback.firebasestorage.app',
  messagingSenderId: '396997576150',
  appId: '1:396997576150:web:751cdf7ad7849f36e35077'
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || 'Guided Exercise';
  const options = {
    body: payload.notification?.body || '',
    data: payload.data || {},
    icon: '/favicon.png'
  };

  self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.focus();
          client.postMessage(data);
          return;
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow('/');
      }
      return undefined;
    })
  );
});
