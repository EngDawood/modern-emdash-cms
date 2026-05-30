import { useEffect } from 'react';

function TrackerPage() {
  useEffect(() => {
    window.location.href = '/tracker';
  }, []);
  return (
    <p style={{ padding: 24, fontFamily: 'system-ui', color: '#6b7280' }}>
      Opening Tracker…
    </p>
  );
}

function TrackerWidget() {
  return (
    <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <p style={{ margin: 0, fontSize: 13, color: '#6b7280', fontFamily: 'system-ui' }}>
        Your freelance task tracker
      </p>
      <a
        href="/tracker"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '7px 14px', borderRadius: 6,
          background: '#1a1a1a', color: '#fff',
          fontSize: 13, fontFamily: 'system-ui', fontWeight: 500,
          textDecoration: 'none',
        }}
      >
        Open Tracker →
      </a>
    </div>
  );
}

export const pages = {
  '/': TrackerPage,
};

export const widgets = {
  'tracker-open': TrackerWidget,
};
