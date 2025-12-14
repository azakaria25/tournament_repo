import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import './TournamentsList.css';
import PINModal from './PINModal';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
interface Team {
  id: string;
  name: string;
  players: string[];
  weight: number; // Weight/seed for tournament bracket (1-5, lower = higher seed, max 1 decimal)
}

interface Match {
  id: string;
  round: number;
  matchIndex: number;
  team1: Team | null;
  team2: Team | null;
  winner: Team | null;
  courtNumber?: string;
  matchTime?: string;
}

interface Tournament {
  id: string;
  name: string;
  month: string;
  year: string;
  teams: Team[];
  matches: Match[];
  status: 'active' | 'completed' | 'upcoming';
  hasPin?: boolean; // Whether tournament requires a PIN (PIN value never exposed to frontend)
  pin?: string; // Deprecated: kept for backward compatibility, should use hasPin
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
  const [editForm, setEditForm] = useState({ name: '', month: '', year: '', newPin: '', confirmPin: '' });
  const [pinError, setPinError] = useState('');
  const [isDeletingTournament, setIsDeletingTournament] = useState<string | null>(null);
  const [isUpdatingTournament, setIsUpdatingTournament] = useState<string | null>(null);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showPINModal, setShowPINModal] = useState(false);
  const [pinModalError, setPinModalError] = useState('');
  const [pendingAction, setPendingAction] = useState<{
    type: 'update' | 'delete' | 'deleteAll';
    tournamentId?: string;
    data?: { name: string; month: string; year: string };
  } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTournaments = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return tournaments;
    }

    return tournaments.filter(tournament => {
      const name = tournament.name?.toLowerCase() ?? '';
      const month = tournament.month?.toLowerCase() ?? '';
      const year = tournament.year?.toLowerCase() ?? '';
      const status = tournament.status?.toLowerCase() ?? '';
      const teams = (tournament.teams ?? []).map(team => team.name?.toLowerCase()).filter(Boolean);

      return (
        name.includes(query) ||
        month.includes(query) ||
        year.includes(query) ||
        status.includes(query) ||
        teams.some(teamName => teamName?.includes(query))
      );
    });
  }, [searchQuery, tournaments]);

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
  const groupedTournaments = filteredTournaments.reduce((groups, tournament) => {
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
      year: tournament.year,
      newPin: '',
      confirmPin: ''
    });
    setPinError('');
  };

  const handleDeleteClick = async (e: React.MouseEvent, tournamentId: string) => {
    e.stopPropagation();
    const tournament = tournaments.find(t => t.id === tournamentId);
    const hasExistingPin = tournament?.hasPin ?? (tournament?.pin && tournament.pin.trim() !== '');
    
    if (window.confirm('Are you sure you want to delete this tournament?')) {
      // If tournament has PIN, require verification
      if (hasExistingPin) {
        setPendingAction({ type: 'delete', tournamentId });
        setShowPINModal(true);
        setPinModalError('');
      } else {
        // Tournament doesn't have PIN - allow direct delete
        if (window.confirm('This tournament does not have a PIN. Are you absolutely sure you want to delete it?')) {
          await handleDirectDelete(tournamentId);
        }
      }
    }
  };

  const handleDirectDelete = async (tournamentId: string) => {
    try {
      setIsDeletingTournament(tournamentId);
      const response = await fetch(`${API_URL}/api/tournaments/${tournamentId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete tournament');
      }

      // Update tournaments state directly instead of reloading all tournaments
      const updatedTournaments = tournaments.filter(t => t.id !== tournamentId);
      onTournamentUpdate(updatedTournaments);
    } catch (error) {
      console.error('Error deleting tournament:', error);
      alert(error instanceof Error ? error.message : 'Failed to delete tournament');
    } finally {
      setIsDeletingTournament(null);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTournament) return;

    const hasExistingPin = editingTournament.pin && editingTournament.pin.trim() !== '';
    const hasNewPin = editForm.newPin && editForm.newPin.trim() !== '';

    // Validate new PIN if provided
    if (hasNewPin) {
      const pinRegex = /^\d{4}$/;
      if (!pinRegex.test(editForm.newPin.trim())) {
        setPinError('PIN must be exactly 4 digits');
        return;
      }
      if (editForm.newPin !== editForm.confirmPin) {
        setPinError('PIN codes do not match');
        return;
      }
    }

    // If tournament has existing PIN, require PIN verification via modal
    if (hasExistingPin) {
      setPendingAction({
        type: 'update',
        tournamentId: editingTournament.id,
        data: editForm
      });
      setShowPINModal(true);
      setPinModalError('');
    } else {
      // Tournament doesn't have PIN - allow direct update, optionally set new PIN
      await handleDirectUpdate(editForm, hasNewPin ? editForm.newPin : undefined);
    }
  };

  const handleDirectUpdate = async (formData: typeof editForm, newPin?: string) => {
    if (!editingTournament) return;

    try {
      setIsUpdatingTournament(editingTournament.id);
      const updateData: any = {
        name: formData.name,
        month: formData.month,
        year: formData.year
      };

      if (newPin) {
        updateData.newPin = newPin;
      }

      const response = await fetch(`${API_URL}/api/tournaments/${editingTournament.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update tournament');
      }

      const updatedTournament = await response.json();
      
      // Update tournaments state directly instead of reloading all tournaments
      const updatedTournaments = tournaments.map(t => 
        t.id === updatedTournament.id ? updatedTournament : t
      );
      onTournamentUpdate(updatedTournaments);
      setEditingTournament(null);
      setPinError('');
    } catch (error) {
      console.error('Error updating tournament:', error);
      setPinError(error instanceof Error ? error.message : 'Failed to update tournament');
    } finally {
      setIsUpdatingTournament(null);
    }
  };

  const handlePINConfirm = async (pin: string) => {
    if (!pendingAction) return;

    setPinModalError('');
    
    // Super PIN "9999" bypasses all tournament PINs
    const SUPER_PIN = '9999';
    const trimmedPin = pin.trim();
    const isSuperPin = trimmedPin === SUPER_PIN;
    
    console.log(`PIN confirmation: pin="${pin}", trimmedPin="${trimmedPin}", isSuperPin=${isSuperPin}`);
    
    // For delete all, require super PIN
    if (pendingAction.type === 'deleteAll') {
      if (!isSuperPin) {
        setPinModalError('Super PIN is required to delete all tournaments');
        return;
      }
      await handleDeleteAllWithPIN(trimmedPin);
      return;
    }
    
    if (isSuperPin) {
      console.log(`Super PIN used to ${pendingAction.type === 'update' ? 'update' : 'delete'} tournament`);
    }
    
    try {
      if (pendingAction.type === 'update' && pendingAction.tournamentId) {
        setIsUpdatingTournament(pendingAction.tournamentId);
        
        const requestBody = {
          ...pendingAction.data,
          pin: trimmedPin // Ensure PIN is trimmed
        };
        
        console.log('Update tournament request body:', requestBody);
        
        const response = await fetch(`${API_URL}/api/tournaments/${pendingAction.tournamentId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const errorData = await response.json();
          if (response.status === 401) {
            setPinModalError(errorData.error || 'Invalid PIN code');
            setIsUpdatingTournament(null);
            return; // Stop execution - don't update tournament
          }
          setIsUpdatingTournament(null);
          throw new Error(errorData.error || 'Failed to update tournament');
        }

        const updatedTournament = await response.json();
        
        // Update tournaments state directly instead of reloading all tournaments
        const updatedTournaments = tournaments.map(t => 
          t.id === updatedTournament.id ? updatedTournament : t
        );
        onTournamentUpdate(updatedTournaments);
        setEditingTournament(null);
        setShowPINModal(false);
        setPendingAction(null);
        setPinError('');
      } else if (pendingAction.type === 'delete' && pendingAction.tournamentId) {
        setIsDeletingTournament(pendingAction.tournamentId);
        
        const requestBody = { pin: trimmedPin };
        console.log('Delete tournament request body:', requestBody);
        
        const response = await fetch(`${API_URL}/api/tournaments/${pendingAction.tournamentId}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const errorData = await response.json();
          if (response.status === 401) {
            setPinModalError(errorData.error || 'Invalid PIN code');
            setIsDeletingTournament(null);
            return; // Stop execution - don't delete tournament
          }
          setIsDeletingTournament(null);
          throw new Error(errorData.error || 'Failed to delete tournament');
        }

        // Update tournaments state directly instead of reloading all tournaments
        const updatedTournaments = tournaments.filter(t => t.id !== pendingAction.tournamentId);
        onTournamentUpdate(updatedTournaments);
        setShowPINModal(false);
        setPendingAction(null);
      }
    } catch (error) {
      console.error(`Error ${pendingAction.type === 'update' ? 'updating' : 'deleting'} tournament:`, error);
      setPinModalError(error instanceof Error ? error.message : `Failed to ${pendingAction.type === 'update' ? 'update' : 'delete'} tournament`);
    } finally {
      setIsUpdatingTournament(null);
      setIsDeletingTournament(null);
    }
  };

  const handlePINModalClose = () => {
    setShowPINModal(false);
    setPendingAction(null);
    setPinModalError('');
  };

  const handleEditCancel = () => {
    setEditingTournament(null);
  };

  const handleDeleteAllTournaments = () => {
    // Always require super PIN for delete all
    setPendingAction({ type: 'deleteAll' });
    setShowPINModal(true);
    setPinModalError('');
  };

  const handleDeleteAllWithPIN = async (pin: string) => {
    try {
      setIsDeletingAll(true);
      const response = await fetch(`${API_URL}/api/tournaments`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ pin: pin.trim() }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 401) {
          setPinModalError(errorData.error || 'Invalid super PIN code');
          setIsDeletingAll(false);
          return;
        }
        throw new Error(errorData.error || 'Failed to delete all tournaments');
      }

      onTournamentUpdate(); // Refresh the tournaments list
      setShowPINModal(false);
      setPendingAction(null);
    } catch (error) {
      console.error('Error deleting all tournaments:', error);
      setPinModalError(error instanceof Error ? error.message : 'Failed to delete all tournaments');
    } finally {
      setIsDeletingAll(false);
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
          <div className="search-container">
            <span className="search-icon" aria-hidden="true">🔍</span>
            <input
              type="search"
              className="search-input"
              placeholder="Search tournaments..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search tournaments"
            />
            {searchQuery.trim() !== '' && (
              <button
                type="button"
                className="search-clear-button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </div>
          <div className="action-buttons">
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
      ) : filteredTournaments.length === 0 ? (
        <div className="no-tournaments search-empty">
          <div className="empty-state-icon">🔍</div>
          <p>No tournaments match your search.</p>
          <button
            type="button"
            className="clear-search-button"
            onClick={() => setSearchQuery('')}
          >
            Clear Search
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
                                  {!(tournament.hasPin ?? (tournament.pin && tournament.pin.trim() !== '')) && (
                                    <>
                                      <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#f0f0f0', borderRadius: '4px' }}>
                                        <p style={{ margin: '0 0 10px 0', fontSize: '0.9rem', color: '#666' }}>
                                          This tournament doesn't have a PIN. Set a PIN to secure it (optional):
                                        </p>
                                        <input
                                          type="password"
                                          value={editForm.newPin}
                                          onChange={e => {
                                            const value = e.target.value.replace(/\D/g, '').slice(0, 4);
                                            setEditForm(prev => ({ ...prev, newPin: value }));
                                            if (value.length === 4 && value !== editForm.confirmPin) {
                                              setPinError('PIN codes do not match');
                                            } else {
                                              setPinError('');
                                            }
                                          }}
                                          placeholder="Enter 4-digit PIN (optional)"
                                          maxLength={4}
                                          pattern="\d{4}"
                                          disabled={isUpdatingTournament === tournament.id}
                                        />
                                        <input
                                          type="password"
                                          value={editForm.confirmPin}
                                          onChange={e => {
                                            const value = e.target.value.replace(/\D/g, '').slice(0, 4);
                                            setEditForm(prev => ({ ...prev, confirmPin: value }));
                                            if (editForm.newPin && value !== editForm.newPin) {
                                              setPinError('PIN codes do not match');
                                            } else {
                                              setPinError('');
                                            }
                                          }}
                                          placeholder="Confirm PIN"
                                          maxLength={4}
                                          pattern="\d{4}"
                                          disabled={isUpdatingTournament === tournament.id}
                                          style={{ marginTop: '8px' }}
                                        />
                                        {pinError && (
                                          <div style={{ color: 'red', fontSize: '0.875rem', marginTop: '8px' }}>
                                            {pinError}
                                          </div>
                                        )}
                                      </div>
                                    </>
                                  )}
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
      <PINModal
        isOpen={showPINModal}
        onClose={handlePINModalClose}
        onConfirm={handlePINConfirm}
        title={pendingAction?.type === 'deleteAll' 
          ? 'Enter Super PIN to Delete All Tournaments'
          : pendingAction?.type === 'update' 
          ? 'Enter PIN to Update Tournament' 
          : 'Enter PIN to Delete Tournament'}
        message={pendingAction?.type === 'deleteAll'
          ? 'WARNING: This will delete ALL tournaments. Enter super PIN to proceed. This action cannot be undone.'
          : pendingAction?.type === 'update' 
          ? 'Please enter the PIN code to update this tournament'
          : 'Please enter the PIN code to delete this tournament. This action cannot be undone.'}
        error={pinModalError}
        isLoading={isUpdatingTournament !== null || isDeletingTournament !== null || isDeletingAll}
      />
    </div>
  );
};

export default TournamentsList; 