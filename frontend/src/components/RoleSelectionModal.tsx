import React, { useState, useEffect } from 'react';
import './RoleSelectionModal.css';

type Role = 'admin' | 'viewer';

interface RoleSelectionModalProps {
  isOpen: boolean;
  onRoleSelect: (role: Role, pin?: string) => void;
  tournamentName: string;
  hasPin: boolean;
  pinError?: string;
}

const RoleSelectionModal: React.FC<RoleSelectionModalProps> = ({
  isOpen,
  onRoleSelect,
  tournamentName,
  hasPin,
  pinError: externalPinError
}) => {
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSelectedRole(null);
      setPin('');
      setPinError('');
    }
  }, [isOpen]);

  useEffect(() => {
    if (externalPinError) {
      setPinError(externalPinError);
    }
  }, [externalPinError]);

  const handlePinChange = (value: string) => {
    // Only allow digits and limit to 4 characters
    const digitsOnly = value.replace(/\D/g, '').slice(0, 4);
    setPin(digitsOnly);
    setPinError('');
    // Clear external error when user types
  };

  const handleRoleSelect = (role: Role) => {
    setSelectedRole(role);
    setPinError('');
    
    // If viewer role, no PIN needed
    if (role === 'viewer') {
      onRoleSelect(role);
    }
    // If admin role and tournament has PIN, need to verify
    // If admin role and tournament doesn't have PIN, allow access
    else if (role === 'admin' && !hasPin) {
      onRoleSelect(role);
    }
  };

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!pin || pin.length !== 4) {
      setPinError('PIN must be exactly 4 digits');
      return;
    }

    setIsVerifying(true);
    setPinError('');

    // Pass PIN to parent for verification
    onRoleSelect('admin', pin);
    setIsVerifying(false);
  };

  if (!isOpen) return null;

  return (
    <div className="role-modal-overlay">
      <div className="role-modal-content">
        <div className="role-modal-header">
          <h2>Select Access Role</h2>
          <p className="tournament-name">{tournamentName}</p>
        </div>
        <div className="role-modal-body">
          {!selectedRole ? (
            <div className="role-selection">
              <p className="role-description">Choose how you want to access this tournament:</p>
              <div className="role-options">
                <button
                  className="role-button admin-button"
                  onClick={() => handleRoleSelect('admin')}
                >
                  <div className="role-icon">🔐</div>
                  <div className="role-info">
                    <h3>Admin</h3>
                    <p>Full access - create, edit, delete teams, start tournament, select winners</p>
                    {hasPin && <span className="pin-required">PIN required</span>}
                  </div>
                </button>
                <button
                  className="role-button viewer-button"
                  onClick={() => handleRoleSelect('viewer')}
                >
                  <div className="role-icon">👁️</div>
                  <div className="role-info">
                    <h3>Viewer</h3>
                    <p>View only - no modifications allowed</p>
                    <span className="no-pin-required">No PIN required</span>
                  </div>
                </button>
              </div>
            </div>
          ) : selectedRole === 'admin' && hasPin ? (
            <div className="pin-verification">
              <p className="pin-description">Enter PIN code to access as Admin:</p>
              <form onSubmit={handlePinSubmit}>
                <div className="pin-input-group">
                  <label htmlFor="admin-pin">PIN Code (4 digits)</label>
                  <input
                    type="password"
                    id="admin-pin"
                    className="pin-input"
                    value={pin}
                    onChange={(e) => handlePinChange(e.target.value)}
                    placeholder="Enter 4-digit PIN"
                    maxLength={4}
                    pattern="\d{4}"
                    title="PIN must be exactly 4 digits"
                    autoFocus
                    disabled={isVerifying}
                    required
                  />
                </div>
                {(pinError || externalPinError) && (
                  <div className="pin-error-message">{pinError || externalPinError}</div>
                )}
                <div className="pin-modal-actions">
                  <button
                    type="button"
                    className="pin-modal-cancel"
                    onClick={() => {
                      setSelectedRole(null);
                      setPin('');
                      setPinError('');
                    }}
                    disabled={isVerifying}
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    className="pin-modal-confirm"
                    disabled={pin.length !== 4 || isVerifying}
                  >
                    {isVerifying ? 'Verifying...' : 'Verify & Access'}
                  </button>
                </div>
              </form>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default RoleSelectionModal;

