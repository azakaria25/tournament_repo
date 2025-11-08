import React, { useState } from 'react';
import './TournamentSetup.css';

interface TournamentSetupProps {
  onSubmit: (name: string, month: string, year: string, pin: string) => void;
  onBack: () => void;
  isSubmitting?: boolean;
}

const MONTHS = [
  { value: 'january', label: 'January' },
  { value: 'february', label: 'February' },
  { value: 'march', label: 'March' },
  { value: 'april', label: 'April' },
  { value: 'may', label: 'May' },
  { value: 'june', label: 'June' },
  { value: 'july', label: 'July' },
  { value: 'august', label: 'August' },
  { value: 'september', label: 'September' },
  { value: 'october', label: 'October' },
  { value: 'november', label: 'November' },
  { value: 'december', label: 'December' }
];

const TournamentSetup: React.FC<TournamentSetupProps> = ({ onSubmit, onBack, isSubmitting = false }) => {
  const currentDate = new Date();
  const currentMonth = currentDate.toLocaleString('default', { month: 'long' }).toLowerCase();
  const currentYear = currentDate.getFullYear();

  const [name, setName] = useState('');
  const [month, setMonth] = useState(currentMonth);
  const [year, setYear] = useState(currentYear.toString());
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState('');

  const validatePin = (pinValue: string): boolean => {
    // PIN must be exactly 4 digits
    const pinRegex = /^\d{4}$/;
    return pinRegex.test(pinValue);
  };

  const handlePinChange = (value: string) => {
    // Only allow digits and limit to 4 characters
    const digitsOnly = value.replace(/\D/g, '').slice(0, 4);
    setPin(digitsOnly);
    if (confirmPin && digitsOnly !== confirmPin) {
      setPinError('PIN codes do not match');
    } else {
      setPinError('');
    }
  };

  const handleConfirmPinChange = (value: string) => {
    // Only allow digits and limit to 4 characters
    const digitsOnly = value.replace(/\D/g, '').slice(0, 4);
    setConfirmPin(digitsOnly);
    if (pin && digitsOnly !== pin) {
      setPinError('PIN codes do not match');
    } else {
      setPinError('');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate PIN
    if (!validatePin(pin)) {
      setPinError('PIN must be exactly 4 digits');
      return;
    }
    
    if (pin !== confirmPin) {
      setPinError('PIN codes do not match');
      return;
    }
    
    if (name.trim() && month && year && pin) {
      onSubmit(name.trim(), month, year, pin);
    }
  };

  // Generate years array (current year and next 5 years)
  const years = Array.from({ length: 6 }, (_, i) => (currentYear + i).toString());

  return (
    <div className="tournament-setup">
      <button type="button" className="back-link" onClick={onBack}>
        &#8592; Back to Tournaments
      </button>
      <h2>Create New Tournament</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="tournament-name">Tournament Name</label>
          <input
            type="text"
            id="tournament-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter tournament name"
            required
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="tournament-month">Month</label>
            <select
              id="tournament-month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              required
            >
              <option value="">Select Month</option>
              {MONTHS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="tournament-year">Year</label>
            <select
              id="tournament-year"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              required
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="tournament-pin">PIN Code (4 digits)</label>
          <input
            type="password"
            id="tournament-pin"
            value={pin}
            onChange={(e) => handlePinChange(e.target.value)}
            placeholder="Enter 4-digit PIN"
            maxLength={4}
            required
            pattern="\d{4}"
            title="PIN must be exactly 4 digits"
          />
        </div>

        <div className="form-group">
          <label htmlFor="tournament-confirm-pin">Confirm PIN Code</label>
          <input
            type="password"
            id="tournament-confirm-pin"
            value={confirmPin}
            onChange={(e) => handleConfirmPinChange(e.target.value)}
            placeholder="Re-enter 4-digit PIN"
            maxLength={4}
            required
            pattern="\d{4}"
            title="PIN must be exactly 4 digits"
          />
          {pinError && <span className="error-message" style={{ color: 'red', fontSize: '0.875rem', marginTop: '0.25rem', display: 'block' }}>{pinError}</span>}
        </div>

        <div className="form-actions">
          <button type="submit" className="submit-button" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <div className="loading-spinner" style={{ width: '20px', height: '20px', marginRight: '8px' }} />
                Creating Tournament...
              </>
            ) : (
              'Create Tournament'
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default TournamentSetup; 