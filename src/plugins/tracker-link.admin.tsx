function TrackerPage() {
  return (
    <>
      <iframe
        src="/tracker"
        style={{
          position: 'fixed',
          inset: 0,
          width: '100%',
          height: '100%',
          border: 'none',
          display: 'block',
        }}
        title="Tracker"
      />
      <a
        href="/_emdash/admin"
        style={{
          position: 'fixed',
          top: 12,
          right: 16,
          zIndex: 9999,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 12px',
          borderRadius: 6,
          background: 'rgba(0,0,0,0.75)',
          color: '#fff',
          fontSize: 12,
          fontFamily: 'system-ui',
          fontWeight: 500,
          textDecoration: 'none',
          backdropFilter: 'blur(4px)',
        }}
      >
        ← Admin
      </a>
    </>
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
