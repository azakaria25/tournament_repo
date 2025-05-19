import React, { useState } from 'react';
import './TournamentSetup.css';

interface TournamentSetupProps {
  onSubmit: (name: string, month: string, year: string) => void;
  onBack: () => void;
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

const TournamentSetup: React.FC<TournamentSetupProps> = ({ onSubmit, onBack }) => {
  const currentDate = new Date();
  const currentMonth = currentDate.toLocaleString('default', { month: 'long' }).toLowerCase();
  const currentYear = currentDate.getFullYear();

  const [name, setName] = useState('');
  const [month, setMonth] = useState(currentMonth);
  const [year, setYear] = useState(currentYear.toString());

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() && month && year) {
      onSubmit(name.trim(), month, year);
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

        <div className="form-actions">
          <button type="submit" className="submit-button">
            Create Tournament
          </button>
        </div>
      </form>
    </div>
  );
};

export default TournamentSetup; 