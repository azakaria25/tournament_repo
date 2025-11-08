import React, { useState, useEffect } from 'react';
import './PINModal.css';

interface PINModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (pin: string) => void;
  title?: string;
  message?: string;
  error?: string;
  isLoading?: boolean;
}

const PINModal: React.FC<PINModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Enter PIN Code',
  message = 'Please enter the PIN code to continue',
  error,
  isLoading = false
}) => {
  const [pin, setPin] = useState('');

  useEffect(() => {
    if (isOpen) {
      setPin('');
    }
  }, [isOpen]);

  const handlePinChange = (value: string) => {
    // Only allow digits and limit to 4 characters
    const digitsOnly = value.replace(/\D/g, '').slice(0, 4);
    setPin(digitsOnly);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length === 4) {
      onConfirm(pin);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="pin-modal-overlay" onClick={onClose}>
      <div className="pin-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="pin-modal-header">
          <h2>{title}</h2>
          <button className="pin-modal-close" onClick={onClose} disabled={isLoading}>
            ×
          </button>
        </div>
        <div className="pin-modal-body">
          <p className="pin-modal-message">{message}</p>
          <form onSubmit={handleSubmit}>
            <div className="pin-input-group">
              <label htmlFor="pin-input">PIN Code (4 digits)</label>
              <input
                type="password"
                id="pin-input"
                className="pin-input"
                value={pin}
                onChange={(e) => handlePinChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Enter 4-digit PIN"
                maxLength={4}
                pattern="\d{4}"
                title="PIN must be exactly 4 digits"
                autoFocus
                disabled={isLoading}
                required
              />
            </div>
            {error && <div className="pin-error-message">{error}</div>}
            <div className="pin-modal-actions">
              <button
                type="button"
                className="pin-modal-cancel"
                onClick={onClose}
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="pin-modal-confirm"
                disabled={pin.length !== 4 || isLoading}
              >
                {isLoading ? 'Verifying...' : 'Confirm'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default PINModal;

