import { useEffect, useState } from 'react';

export default function Notification({ notification }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (notification) {
      setVisible(true);
      const timer = setTimeout(() => setVisible(false), 2700);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  if (!notification || !visible) return null;

  const className = `notification ${notification.type === 'error' ? 'error-notification' : 'success-notification'}`;

  return (
    <div id="notification" className={className} style={{ display: 'block' }}>
      {notification.message}
    </div>
  );
}
