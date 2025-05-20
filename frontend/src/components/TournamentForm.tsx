import React, { useState } from 'react';
import './TournamentForm.css';

interface TournamentFormProps {
  onSubmit: (tournament: { name: string; month: string }) => void;
  initialData?: { name: string; month: string };
  isSubmitting?: boolean;
}

const TournamentForm: React.FC<TournamentFormProps> = ({ 
  onSubmit, 
  initialData = { name: '', month: '' },
  isSubmitting = false 
}) => {
  const [name, setName] = useState(initialData.name);
  const [month, setMonth] = useState(initialData.month);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ name, month });
  };

  return (
    <form onSubmit={handleSubmit} className="tournament-form">
      <div className="form-group">
        <label htmlFor="name">Tournament Name</label>
        <input
          type="text"
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          disabled={isSubmitting}
          placeholder="Enter tournament name"
        />
      </div>
      <div className="form-group">
        <label htmlFor="month">Month</label>
        <select
          id="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          required
          disabled={isSubmitting}
        >
          <option value="">Select a month</option>
          <option value="January">January</option>
          <option value="February">February</option>
          <option value="March">March</option>
          <option value="April">April</option>
          <option value="May">May</option>
          <option value="June">June</option>
          <option value="July">July</option>
          <option value="August">August</option>
          <option value="September">September</option>
          <option value="October">October</option>
          <option value="November">November</option>
          <option value="December">December</option>
        </select>
      </div>
      <button type="submit" disabled={isSubmitting} className={isSubmitting ? 'submitting' : ''}>
        {isSubmitting ? (
          <>
            <div className="loading-spinner" style={{ width: '20px', height: '20px', marginRight: '8px' }} />
            {initialData.name ? 'Saving...' : 'Creating...'}
          </>
        ) : (
          initialData.name ? 'Save Changes' : 'Create Tournament'
        )}
      </button>
    </form>
  );
};

export default TournamentForm; 