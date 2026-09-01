import { useState, useEffect } from 'react';

export function useMissionClock() {
  const [utc, setUtc] = useState(() => new Date().toUTCString());

  useEffect(() => {
    const timer = setInterval(() => {
      setUtc(new Date().toUTCString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return utc;
}
