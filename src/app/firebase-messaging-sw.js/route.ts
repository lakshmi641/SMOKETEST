import { NextResponse } from 'next/server'

export async function GET() {
  const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
  }

  const swContent = `
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

firebase.initializeApp(${JSON.stringify(firebaseConfig)});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message:', payload);

  const notificationTitle = payload.notification?.title || payload.data?.title || 'New Notification';
  const notificationOptions = {
    body: payload.notification?.body || payload.data?.body || 'You have a new notification',
    icon: payload.notification?.icon || payload.data?.icon || '/favicon.ico',
    badge: '/favicon.ico',
    image: payload.notification?.image || payload.data?.image,
    tag: payload.data?.notificationId || ('notification-' + Date.now()),
    requireInteraction: payload.data?.actionRequired === 'true',
    data: {
      url: payload.data?.actionUrl || payload.fcmOptions?.link || '/notifications',
      notificationId: payload.data?.notificationId,
      type: payload.data?.type,
      ...payload.data
    },
    actions: payload.data?.actions ? JSON.parse(payload.data.actions) : [],
    vibrate: payload.data?.vibrate ? JSON.parse(payload.data.vibrate) : [200, 100, 200],
    timestamp: Date.now()
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/notifications';

  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then((clientList) => {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

self.addEventListener('notificationclose', (event) => {
  // Track notification close events if needed
});
`

  return new NextResponse(swContent, {
    headers: {
      'Content-Type': 'application/javascript',
      'Service-Worker-Allowed': '/',
      'Cache-Control': 'public, max-age=0, must-revalidate',
    },
  })
}
