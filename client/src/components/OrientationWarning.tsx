import { useEffect, useState } from 'react';

export function OrientationWarning() {
  const [showWarning, setShowWarning] = useState(false);

  useEffect(() => {
    const checkOrientation = () => {
      // Check if width is mobile-ish (< 900px to cover tablets too)
      // AND height > width (Portrait)
      const isPortrait = window.innerHeight > window.innerWidth;
      const isMobileSize = window.innerWidth < 900;
      
      setShowWarning(isPortrait && isMobileSize);
    };

    // Check initially
    checkOrientation();

    // Listen for resize (orientation change triggers resize)
    window.addEventListener('resize', checkOrientation);
    return () => window.removeEventListener('resize', checkOrientation);
  }, []);

  if (!showWarning) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: '#ffffff',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#333',
      padding: '20px',
      textAlign: 'center',
      boxSizing: 'border-box'
    }}>
      <div style={{ fontSize: '4em', marginBottom: '20px' }}>↻</div>
      <h2>Please Rotate Your Device</h2>
      <p style={{ color: '#888', maxWidth: '300px' }}>
        Naga Poker is best experienced in landscape mode.
      </p>
    </div>
  );
}
