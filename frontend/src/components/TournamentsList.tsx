import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './TournamentsList.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
interface Team {
  id: string;
  name: string;
  players: string[];
}

interface Match {
  id: string;
  round: number;
  matchIndex: number;
  team1: Team | null;
  team2: Team | null;
  winner: Team | null;
}

interface Tournament {
  id: string;
  name: string;
  month: string;
  year: string;
  teams: Team[];
  matches: Match[];
  status: 'active' | 'completed' | 'upcoming';
}

interface TournamentsListProps {
  tournaments: Tournament[];
  onCreateNew: () => void;
  onTournamentUpdate: (updatedTournaments?: Tournament[]) => void;
}

const TournamentsList: React.FC<TournamentsListProps> = ({ tournaments, onCreateNew, onTournamentUpdate }) => {
  const navigate = useNavigate();
  const [collapsedYears, setCollapsedYears] = useState<{ [key: string]: boolean }>({});
  const [collapsedMonths, setCollapsedMonths] = useState<{ [key: string]: boolean }>({});
  const [editingTournament, setEditingTournament] = useState<Tournament | null>(null);
  const [editForm, setEditForm] = useState({ name: '', month: '', year: '' });
  const [isDeletingTournament, setIsDeletingTournament] = useState<string | null>(null);
  const [isUpdatingTournament, setIsUpdatingTournament] = useState<string | null>(null);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize collapsed state based on current date
  useEffect(() => {
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear().toString();
    const currentMonth = currentDate.toLocaleString('default', { month: 'long' }).toLowerCase();

    // Get all unique years from tournaments
    const years = Array.from(new Set(tournaments.map(t => t.year)));
    
    // Initialize collapsed state: collapse all years except current year
    const initialCollapsedState = years.reduce((acc, year) => {
      acc[year] = year !== currentYear;
      return acc;
    }, {} as { [key: string]: boolean });

    setCollapsedYears(initialCollapsedState);

    // Initialize collapsed months state
    const initialCollapsedMonths = tournaments.reduce((acc, tournament) => {
      const key = `${tournament.year}-${tournament.month}`;
      // Keep current month open, collapse others
      acc[key] = tournament.year !== currentYear || tournament.month !== currentMonth;
      return acc;
    }, {} as { [key: string]: boolean });

    setCollapsedMonths(initialCollapsedMonths);
    setIsLoading(false);
  }, [tournaments]);

  const toggleYear = (year: string) => {
    setCollapsedYears(prev => ({
      ...prev,
      [year]: !prev[year]
    }));
  };

  const toggleMonth = (year: string, month: string) => {
    const key = `${year}-${month}`;
    setCollapsedMonths(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleSelectTournament = (tournament: Tournament) => {
    navigate(`/tournament/${tournament.id}`);
  };

  const getStatusColor = (status: Tournament['status']) => {
    switch (status) {
      case 'active':
        return '#4CAF50'; // Green for active
      case 'completed':
        return '#9E9E9E'; // Grey for completed
      case 'upcoming':
        return '#2196F3'; // Blue for upcoming
      default:
        return '#757575';
    }
  };

  const getStatusIcon = (status: Tournament['status']) => {
    switch (status) {
      case 'active':
        return '▶'; // Play icon for active
      case 'completed':
        return '✓'; // Checkmark for completed
      case 'upcoming':
        return '⏳'; // Hourglass for upcoming
      default:
        return '•';
    }
  };

  // Group tournaments by year and month
  const groupedTournaments = tournaments.reduce((groups, tournament) => {
    if (!tournament || !tournament.year || !tournament.month) return groups;
    
    const year = tournament.year;
    if (!groups[year]) {
      groups[year] = {};
    }
    const month = tournament.month.toLowerCase();
    if (!groups[year][month]) {
      groups[year][month] = [];
    }
    groups[year][month].push(tournament);
    return groups;
  }, {} as { [year: string]: { [month: string]: Tournament[] } });

  // Sort years in descending order (newest first)
  const sortedYears = Object.keys(groupedTournaments).sort((a, b) => {
    if (a === 'Unknown') return 1;
    if (b === 'Unknown') return -1;
    return parseInt(b) - parseInt(a);
  });

  // Months in chronological order (lowercase to match backend)
  const months = ['january', 'february', 'march', 'april', 'may', 'june', 
                 'july', 'august', 'september', 'october', 'november', 'december'];

  const handleEditClick = (e: React.MouseEvent, tournament: Tournament) => {
    e.stopPropagation();
    setEditingTournament(tournament);
    setEditForm({
      name: tournament.name,
      month: tournament.month,
      year: tournament.year
    });
  };

  const handleDeleteClick = async (e: React.MouseEvent, tournamentId: string) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this tournament?')) {
      try {
        setIsDeletingTournament(tournamentId);
        const response = await fetch(`${API_URL}/api/tournaments/${tournamentId}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          throw new Error('Failed to delete tournament');
        }

        // Update tournaments state directly instead of reloading all tournaments
        const updatedTournaments = tournaments.filter(t => t.id !== tournamentId);
        onTournamentUpdate(updatedTournaments);
      } catch (error) {
        console.error('Error deleting tournament:', error);
        alert('Failed to delete tournament. Please try again.');
      } finally {
        setIsDeletingTournament(null);
      }
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTournament) return;

    try {
      setIsUpdatingTournament(editingTournament.id);
      const response = await fetch(`${API_URL}/api/tournaments/${editingTournament.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editForm),
      });

      if (!response.ok) {
        throw new Error('Failed to update tournament');
      }

      const updatedTournament = await response.json();
      
      // Update tournaments state directly instead of reloading all tournaments
      const updatedTournaments = tournaments.map(t => 
        t.id === updatedTournament.id ? updatedTournament : t
      );
      onTournamentUpdate(updatedTournaments);
      setEditingTournament(null);
    } catch (error) {
      console.error('Error updating tournament:', error);
      alert('Failed to update tournament. Please try again.');
    } finally {
      setIsUpdatingTournament(null);
    }
  };

  const handleEditCancel = () => {
    setEditingTournament(null);
  };

  const handleDeleteAllTournaments = async () => {
    if (window.confirm('Are you sure you want to delete ALL tournaments? This action cannot be undone.')) {
      try {
        setIsDeletingAll(true);
        const response = await fetch(`${API_URL}/api/tournaments`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          throw new Error('Failed to delete all tournaments');
        }

        onTournamentUpdate(); // Refresh the tournaments list
      } catch (error) {
        console.error('Error deleting all tournaments:', error);
        alert('Failed to delete all tournaments. Please try again.');
      } finally {
        setIsDeletingAll(false);
      }
    }
  };

  return (
    <div className="tournaments-list">
      <div className="tournaments-header">
        <div className="header-content">
          <h2>Tournaments</h2>
          <p className="tournaments-subtitle">Manage and track your tournaments</p>
        </div>
        <div className="header-actions">
          <button 
            onClick={handleDeleteAllTournaments} 
            className="delete-all-button"
            disabled={isDeletingAll || isLoading}
          >
            {isDeletingAll ? (
              <>
                <div className="loading-spinner" style={{ width: '20px', height: '20px' }} />
                Deleting...
              </>
            ) : (
              'Delete All Tournaments'
            )}
          </button>
          <button onClick={onCreateNew} className="create-tournament-button" disabled={isLoading}>
            <span className="button-icon">+</span>
            Create New Tournament
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="loading-tournaments">
          <div className="loading-spinner" style={{ width: '40px', height: '40px' }} />
          <p>Loading tournaments...</p>
        </div>
      ) : !tournaments || tournaments.length === 0 ? (
        <div className="no-tournaments">
          <div className="empty-state-icon">🏆</div>
          <p>No tournaments found. Create your first tournament!</p>
          <button onClick={onCreateNew} className="create-tournament-button">
            Create New Tournament
          </button>
        </div>
      ) : (
        <div className="tournaments-by-year">
          {sortedYears.map(year => (
            <div key={year} className="year-section">
              <div className="year-header" onClick={() => toggleYear(year)}>
                <div className="year-header-content">
                  <h2>{year}</h2>
                  <span className="tournament-count">
                    {Object.values(groupedTournaments[year] || {}).reduce((sum, tournaments) => 
                      sum + (tournaments?.length || 0), 0)} tournaments
                  </span>
                </div>
                <span className={`collapse-icon ${collapsedYears[year] ? 'collapsed' : ''}`}>
                  ▼
                </span>
              </div>
              <div className={`months-container ${collapsedYears[year] ? 'collapsed' : ''}`}>
                {months.map(month => {
                  const monthTournaments = groupedTournaments[year]?.[month] || [];
                  if (!monthTournaments || monthTournaments.length === 0) return null;

                  const monthKey = `${year}-${month}`;
                  const isMonthCollapsed = collapsedMonths[monthKey];

                  return (
                    <div key={monthKey} className="month-section">
                      <div className="month-header" onClick={() => toggleMonth(year, month)}>
                        <div className="month-header-content">
                          <h3>{month.charAt(0).toUpperCase() + month.slice(1)}</h3>
                          <span className="tournament-count">
                            {monthTournaments.length} {monthTournaments.length === 1 ? 'Tournament' : 'Tournaments'}
                          </span>
                        </div>
                        <span className={`collapse-icon ${isMonthCollapsed ? 'collapsed' : ''}`}>
                          ▼
                        </span>
                      </div>
                      <div className={`tournaments-container ${isMonthCollapsed ? 'collapsed' : ''}`}>
                        <div className="tournaments-grid">
                          {monthTournaments.map((tournament) => (
                            <div
                              key={tournament.id}
                              className="tournament-card"
                              onClick={() => handleSelectTournament(tournament)}
                            >
                              {editingTournament?.id === tournament.id ? (
                                <form onSubmit={handleEditSubmit} className="edit-form" onClick={e => e.stopPropagation()}>
                                  <input
                                    type="text"
                                    value={editForm.name}
                                    onChange={e => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                                    placeholder="Tournament Name"
                                    required
                                    disabled={isUpdatingTournament === tournament.id}
                                  />
                                  <select
                                    value={editForm.month}
                                    onChange={e => setEditForm(prev => ({ ...prev, month: e.target.value }))}
                                    required
                                    disabled={isUpdatingTournament === tournament.id}
                                  >
                                    {months.map(m => (
                                      <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>
                                    ))}
                                  </select>
                                  <input
                                    type="number"
                                    value={editForm.year}
                                    onChange={e => setEditForm(prev => ({ ...prev, year: e.target.value }))}
                                    placeholder="Year"
                                    required
                                    min="2000"
                                    max="2100"
                                    disabled={isUpdatingTournament === tournament.id}
                                  />
                                  <div className="edit-actions">
                                    <button type="submit" className="save-button" disabled={isUpdatingTournament === tournament.id}>
                                      {isUpdatingTournament === tournament.id ? (
                                        <>
                                          <div className="loading-spinner" style={{ width: '20px', height: '20px', marginRight: '8px' }} />
                                          Saving...
                                        </>
                                      ) : (
                                        'Save'
                                      )}
                                    </button>
                                    <button type="button" onClick={handleEditCancel} className="cancel-button" disabled={isUpdatingTournament === tournament.id}>
                                      Cancel
                                    </button>
                                  </div>
                                </form>
                              ) : (
                                <>
                                  <div 
                                    className="tournament-status" 
                                    style={{ backgroundColor: getStatusColor(tournament.status) }}
                                  >
                                    <span className="status-icon">{getStatusIcon(tournament.status)}</span>
                                    {tournament.status}
                                  </div>
                                  <div className="tournament-content">
                                    <h3>{tournament.name}</h3>
                                    <div className="tournament-date">
                                      {tournament.month.charAt(0).toUpperCase() + tournament.month.slice(1)} {tournament.year}
                                    </div>
                                    <div className="tournament-info">
                                      <span className="teams-count">
                                        {tournament.teams?.length || 0} {tournament.teams?.length === 1 ? 'Team' : 'Teams'}
                                      </span>
                                      <span className="matches-count">
                                        {tournament.matches?.length || 0} {tournament.matches?.length === 1 ? 'Match' : 'Matches'}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="tournament-actions">
                                    <button
                                      className="edit-button"
                                      onClick={(e) => handleEditClick(e, tournament)}
                                      title="Edit Tournament"
                                      disabled={isUpdatingTournament === tournament.id || isDeletingTournament === tournament.id}
                                    >
                                      {isUpdatingTournament === tournament.id ? (
                                        <div className="loading-spinner" style={{ width: '20px', height: '20px' }} />
                                      ) : (
                                        '✎'
                                      )}
                                    </button>
                                    <button
                                      className="delete-button"
                                      onClick={(e) => handleDeleteClick(e, tournament.id)}
                                      title="Delete Tournament"
                                      disabled={isUpdatingTournament === tournament.id || isDeletingTournament === tournament.id}
                                    >
                                      {isDeletingTournament === tournament.id ? (
                                        <div className="loading-spinner" style={{ width: '20px', height: '20px' }} />
                                      ) : (
                                        '×'
                                      )}
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TournamentsList; 