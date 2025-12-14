import React, { useState, useEffect, useCallback, useMemo } from 'react';
import './TournamentManagement.css';
import RoleSelectionModal from './RoleSelectionModal';

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
  team1: Team | null;
  team2: Team | null;
  winner: Team | null;
  matchIndex: number;
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

interface TournamentManagementProps {
  tournament: Tournament;
  onBack: () => void;
}

type UserRole = 'admin' | 'viewer' | null;

const TournamentManagement: React.FC<TournamentManagementProps> = ({ tournament, onBack }) => {
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [showRoleModal, setShowRoleModal] = useState(true);
  const [pinError, setPinError] = useState('');
  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [newTeam, setNewTeam] = useState({ name: '', players: ['', ''], weight: '' });
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [isTeamSectionVisible, setIsTeamSectionVisible] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isAddingTeam, setIsAddingTeam] = useState(false);
  const [isUpdatingTeam, setIsUpdatingTeam] = useState(false);
  const [isDeletingTeam, setIsDeletingTeam] = useState<string | null>(null);
  const [isStartingTournament, setIsStartingTournament] = useState(false);
  const [isUpdatingWinner, setIsUpdatingWinner] = useState<string | null>(null);
  const [editingMatch, setEditingMatch] = useState<string | null>(null);
  const [matchEditForm, setMatchEditForm] = useState({ courtNumber: '', matchTime: '' });
  const champion = useMemo(() => {
    if (matches.length === 0) {
      return null;
    }

    const highestRound = matches.reduce((max, match) => Math.max(max, match.round), 0);
    if (highestRound === 0) {
      return null;
    }

    const finalMatch = matches.find(match => match.round === highestRound && match.winner);
    return finalMatch?.winner ?? null;
  }, [matches]);
  const championId = champion?.id ?? null;
  const [isChampionCelebrationVisible, setChampionCelebrationVisible] = useState(championId !== null);

  useEffect(() => {
    if (championId) {
      setChampionCelebrationVisible(true);
    } else {
      setChampionCelebrationVisible(false);
    }
  }, [championId]);

  // Hide Team Management section by default if tournament bracket (matches) exists
  useEffect(() => {
    setIsTeamSectionVisible(matches.length === 0);
  }, [matches]);

  const fetchTournamentDetails = useCallback(async () => {
    setIsLoading(true);
    try {
      const [teamsResponse, matchesResponse] = await Promise.all([
        fetch(`${API_URL}/api/tournaments/${tournament.id}/teams`),
        fetch(`${API_URL}/api/tournaments/${tournament.id}/matches`)
      ]);

      if (!teamsResponse.ok || !matchesResponse.ok) {
        throw new Error('Failed to fetch tournament details');
      }

      const teamsData = await teamsResponse.json();
      const matchesData = await matchesResponse.json();

      setTeams(teamsData);
      setMatches(matchesData);
    } catch (error) {
      console.error('Error fetching tournament details:', error);
      alert('Failed to fetch tournament details. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [tournament.id]);

  useEffect(() => {
    if (userRole) {
      fetchTournamentDetails();
    }
  }, [userRole, fetchTournamentDetails]);

  const handleRoleSelect = async (role: 'admin' | 'viewer', pin?: string) => {
    const hasPin = tournament.hasPin ?? (tournament.pin && tournament.pin.trim() !== '');
    
    if (role === 'admin' && hasPin) {
      // Verify PIN for admin access
      if (!pin || pin.length !== 4) {
        setPinError('PIN must be exactly 4 digits');
        return;
      }

      // Verify PIN with backend using secure endpoint
      try {
        const response = await fetch(`${API_URL}/api/tournaments/${tournament.id}/verify-pin`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ pin: pin.trim() }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          setPinError(errorData.error || 'Invalid PIN code');
          return;
        }

        const verificationResult = await response.json();
        if (!verificationResult.verified) {
          setPinError('Invalid PIN code');
          return;
        }

        // PIN verified successfully
        setUserRole('admin');
        setShowRoleModal(false);
        setPinError('');
      } catch (error) {
        console.error('Error verifying PIN:', error);
        setPinError('Failed to verify PIN. Please try again.');
      }
    } else {
      // Viewer role or admin without PIN - no verification needed
      setUserRole(role);
      setShowRoleModal(false);
      setPinError('');
    }
  };

  const isAdmin = userRole === 'admin';
  const isViewer = userRole === 'viewer';
  const hasAccess = userRole !== null;

  const formatTime = (time: string): string => {
    // If time is in HH:MM format, convert to 12-hour format
    if (time && time.includes(':')) {
      const [hours, minutes] = time.split(':');
      const hour = parseInt(hours);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const hour12 = hour % 12 || 12;
      return `${hour12}:${minutes} ${ampm}`;
    }
    return time;
  };

  const handleUpdateMatchDetails = async (matchId: string) => {
    try {
      console.log('Updating match details:', { matchId, tournamentId: tournament.id, courtNumber: matchEditForm.courtNumber, matchTime: matchEditForm.matchTime });
      
      // Express automatically decodes URL parameters, so we don't need to encode
      const url = `${API_URL}/api/matches/${matchId}`;
      const body = JSON.stringify({
        courtNumber: matchEditForm.courtNumber.trim() || null,
        matchTime: matchEditForm.matchTime.trim() || null,
        tournamentId: tournament.id
      });
      
      console.log('Sending request to:', url);
      console.log('Request body:', body);
      
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: body,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to update match details' }));
        const errorMessage = errorData.error || `HTTP error! status: ${response.status}`;
        console.error('Error response:', errorMessage);
        throw new Error(errorMessage);
      }

      const updatedMatch = await response.json();
      
      // Update matches state
      setMatches(prevMatches => prevMatches.map(m => 
        m.id === updatedMatch.id 
          ? { ...m, courtNumber: updatedMatch.courtNumber, matchTime: updatedMatch.matchTime }
          : m
      ));
      
      setEditingMatch(null);
      setMatchEditForm({ courtNumber: '', matchTime: '' });
    } catch (error) {
      console.error('Error updating match details:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to update match details. Please try again.';
      alert(errorMessage);
    }
  };

  const handleAddTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeam.name.trim()) {
      alert('Please enter a team name');
      return;
    }
    
    // Validate weight
    if (!newTeam.weight.trim()) {
      alert('Please enter a weight (1-5)');
      return;
    }
    
    const weightValue = parseFloat(newTeam.weight);
    if (isNaN(weightValue) || weightValue < 1 || weightValue > 5) {
      alert('Weight must be between 1 and 5');
      return;
    }
    
    // Validate decimal places (max 1 digit after decimal)
    const decimalParts = newTeam.weight.split('.');
    if (decimalParts.length > 1 && decimalParts[1].length > 1) {
      alert('Weight can have maximum one digit after decimal point');
      return;
    }
    
    setIsAddingTeam(true);
    const validPlayers = newTeam.players.filter(player => player.trim() !== '');
    try {
      const createTeamResponse = await fetch(`${API_URL}/api/teams`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newTeam.name.trim(),
          players: validPlayers,
          weight: weightValue
        }),
      });

      if (!createTeamResponse.ok) {
        const errorData = await createTeamResponse.json();
        throw new Error(errorData.error || 'Failed to create team');
      }

      const createdTeam = await createTeamResponse.json();

      const registerTeamResponse = await fetch(`${API_URL}/api/tournaments/${tournament.id}/teams`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          teamId: createdTeam.id
        }),
      });

      if (!registerTeamResponse.ok) {
        const errorData = await registerTeamResponse.json();
        throw new Error(errorData.error || 'Failed to register team to tournament');
      }

      // Update teams state directly instead of reloading all teams
      setTeams(prevTeams => [...prevTeams, createdTeam]);
      setNewTeam({ name: '', players: ['', ''], weight: '' });
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to add team. Please try again.');
    } finally {
      setIsAddingTeam(false);
    }
  };

  const startTournament = async () => {
    if (teams.length < 2) {
      alert('Please register at least 2 teams to start the tournament');
      return;
    }

    // Check if tournament has been started before (has existing matches)
    const hasExistingMatches = matches.length > 0;
    
    let confirmMessage = 'Are you sure you want to start the tournament?';
    if (hasExistingMatches) {
      confirmMessage = 'This tournament has already been started. Starting again will shuffle the teams and create new matches. All existing match results will be cleared. Are you sure you want to proceed?';
    }

    if (!window.confirm(confirmMessage)) {
      return;
    }

    setIsStartingTournament(true);
    try {
      const response = await fetch(`${API_URL}/api/tournaments/${tournament.id}/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to start tournament');
      }

      const tournamentData = await response.json();
      setMatches(tournamentData.matches);
      setIsTeamSectionVisible(false);
    } catch (error) {
      console.error('Error starting tournament:', error);
      alert(error instanceof Error ? error.message : 'Failed to start tournament. Please try again.');
    } finally {
      setIsStartingTournament(false);
    }
  };

  const setWinner = async (matchId: string, winnerId: string) => {
    // Find the match to check if it already has a winner
    const match = matches.find(m => m.id === matchId);
    if (!match) return;

    // Check if match already has a winner
    if (match.winner) {
      const currentWinner = match.winner;
      const newWinner = match.team1?.id === winnerId ? match.team1 : match.team2;
      
      if (currentWinner.id === winnerId) {
        // Same winner selected, no need to change
        return;
      }

      if (!newWinner) {
        return;
      }

      const confirmMessage = `This match already has a winner: ${currentWinner.name}. Are you sure you want to change it to ${newWinner.name}?`;
      
      if (!window.confirm(confirmMessage)) {
        return;
      }
    }

    setIsUpdatingWinner(matchId);
    try {
      const response = await fetch(`${API_URL}/api/matches/${matchId}/winner`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ winnerId, tournamentId: tournament.id }),
      });

      if (!response.ok) {
        throw new Error('Failed to update match winner');
      }

      const updatedMatches = await response.json();
      
      // Update the matches state with the new data
      setMatches(updatedMatches);
      
      // Also update the tournament's matches to ensure consistency
      tournament.matches = updatedMatches;
    } catch (error) {
      console.error('Error updating match winner:', error);
      alert('Failed to update match winner. Please try again.');
    } finally {
      setIsUpdatingWinner(null);
    }
  };

  const handleDeleteTeam = async (teamId: string) => {
    const teamToDelete = teams.find(t => t.id === teamId);
    const hasStartedTournament = matches.length > 0;
    
    let confirmMessage = 'Are you sure you want to delete this team?';
    if (hasStartedTournament) {
      confirmMessage = `This tournament has already started. Deleting "${teamToDelete?.name || 'this team'}" will automatically restart the tournament with the remaining teams. All existing match results will be cleared. Are you sure you want to proceed?`;
    }

    if (!window.confirm(confirmMessage)) {
      return;
    }

    setIsDeletingTeam(teamId);
    try {
      console.log('Deleting team:', { tournamentId: tournament.id, teamId });
      const response = await fetch(`${API_URL}/api/tournaments/${tournament.id}/teams/${teamId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Delete team error:', { status: response.status, error: errorData });
        throw new Error(errorData.error || 'Failed to delete team');
      }

      // Update teams state directly instead of reloading all teams
      const updatedTeams = teams.filter(team => team.id !== teamId);
      setTeams(updatedTeams);
      
      // If tournament has started, automatically restart it with remaining teams
      if (hasStartedTournament && updatedTeams.length >= 2) {
        try {
          const startResponse = await fetch(`${API_URL}/api/tournaments/${tournament.id}/start`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            }
          });

          if (!startResponse.ok) {
            const errorData = await startResponse.json();
            throw new Error(errorData.error || 'Failed to restart tournament');
          }

          const tournamentData = await startResponse.json();
          setMatches(tournamentData.matches);
          setIsTeamSectionVisible(false);
        } catch (error) {
          console.error('Error restarting tournament:', error);
          alert('Team deleted successfully, but failed to restart tournament. Please start it manually.');
        }
      } else if (hasStartedTournament && updatedTeams.length < 2) {
        // Not enough teams to restart, clear matches
        setMatches([]);
        alert('Team deleted. Tournament needs at least 2 teams to start. Please add more teams.');
      }
    } catch (error) {
      console.error('Error deleting team:', error);
      alert(error instanceof Error ? error.message : 'Failed to delete team. Please try again.');
    } finally {
      setIsDeletingTeam(null);
    }
  };

  const handleEditTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTeam) return;

    // Validate weight
    if (!editingTeam.weight || editingTeam.weight < 1 || editingTeam.weight > 5) {
      alert('Weight must be between 1 and 5');
      return;
    }

    setIsUpdatingTeam(true);
    try {
      const response = await fetch(`${API_URL}/api/teams/${editingTeam.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: editingTeam.name,
          players: editingTeam.players,
          weight: editingTeam.weight
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update team');
      }

      const updatedTeam = await response.json();
      
      // Update teams state directly instead of reloading all teams
      setTeams(prevTeams => prevTeams.map(team => 
        team.id === updatedTeam.id ? updatedTeam : team
      ));
      
      // If tournament has started, update team names in matches to reflect changes
      if (matches.length > 0) {
        const updatedMatches = matches.map(match => ({
          ...match,
          team1: match.team1?.id === updatedTeam.id 
            ? { ...match.team1, id: updatedTeam.id, name: updatedTeam.name, players: updatedTeam.players, weight: updatedTeam.weight } as Team
            : match.team1,
          team2: match.team2?.id === updatedTeam.id 
            ? { ...match.team2, id: updatedTeam.id, name: updatedTeam.name, players: updatedTeam.players, weight: updatedTeam.weight } as Team
            : match.team2,
          winner: match.winner?.id === updatedTeam.id 
            ? { ...match.winner, id: updatedTeam.id, name: updatedTeam.name, players: updatedTeam.players, weight: updatedTeam.weight } as Team
            : match.winner
        }));
        setMatches(updatedMatches);
      }
      
      setEditingTeam(null);
    } catch (error) {
      console.error('Error updating team:', error);
      alert(error instanceof Error ? error.message : 'Failed to update team. Please try again.');
    } finally {
      setIsUpdatingTeam(false);
    }
  };

  const renderBracket = () => {
    if (matches.length === 0) return null;

    const rounds = matches.reduce((acc: { [key: number]: Match[] }, match) => {
      if (!acc[match.round]) {
        acc[match.round] = [];
      }
      acc[match.round].push(match);
      return acc;
    }, {});

    const sortedRounds = Object.entries(rounds).sort((a, b) => Number(a[0]) - Number(b[0]));
    sortedRounds.forEach(([_, roundMatches]) => {
      roundMatches.sort((a, b) => a.matchIndex - b.matchIndex);
    });

    const getRoundName = (round: string, totalRounds: number) => {
      const roundNum = parseInt(round);
      if (roundNum === 1) return 'First Round';
      if (roundNum === totalRounds) return 'Final';
      if (roundNum === totalRounds - 1) return 'Semi Finals';
      if (roundNum === totalRounds - 2) return 'Quarter Finals';
      return `Round ${roundNum}`;
    };

    // Check if tournament is completed
    const isCompleted = matches.every(m => m.winner);

    return (
      <div className="bracket">
        {isCompleted && champion && isChampionCelebrationVisible && (
          <div className="champion-celebration">
            <div className="champion-box">
              <button
                type="button"
                className="champion-close-button"
                onClick={() => setChampionCelebrationVisible(false)}
                aria-label="Close champion celebration"
              >
                X
              </button>
              <h2>🏆 Champion 🏆</h2>
              <div className="champion-name">{champion.name}</div>
              <div className="champion-players">{champion.players.join(' & ')}</div>
            </div>
            <div className="fireworks">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="firework" style={{ '--delay': `${i * 0.5}s` } as React.CSSProperties} />
              ))}
            </div>
          </div>
        )}
        {sortedRounds.map(([round, roundMatches]) => (
          <div key={round} className="round">
            <h3>{getRoundName(round, sortedRounds.length)}</h3>
            {roundMatches.map(match => {
              const isTeam1Winner = match.winner?.id === match.team1?.id;
              const isTeam2Winner = match.winner?.id === match.team2?.id;
              const isUpdatingTeam1 = isUpdatingWinner === match.id && isTeam1Winner;
              const isUpdatingTeam2 = isUpdatingWinner === match.id && isTeam2Winner;
              const isFinalMatch = match.round === sortedRounds.length;
              const isChampion = isFinalMatch && (isTeam1Winner || isTeam2Winner);

              return (
                <div key={match.id} className={`match ${isFinalMatch ? 'final-match' : ''}`}>
                  <div 
                    className={`team ${isTeam1Winner ? 'winner' : ''} ${isUpdatingTeam1 ? 'updating' : ''} ${isChampion && isTeam1Winner ? 'champion' : ''} ${!isAdmin ? 'viewer-mode' : ''}`}
                    onClick={() => isAdmin && match.team1 && !isUpdatingWinner && setWinner(match.id, match.team1.id)}
                    title={!isAdmin ? 'Viewer mode: Cannot select winner' : ''}
                  >
                    {isUpdatingTeam1 ? (
                      <div className="loading-spinner" style={{ width: '20px', height: '20px' }} />
                    ) : (
                      match.team1 ? (
                        <>
                          <span className="team-seed">#{match.team1.weight ?? 5}</span>
                          {match.team1.name}
                        </>
                      ) : 'TBD'
                    )}
                  </div>
                  <div 
                    className={`team ${isTeam2Winner ? 'winner' : ''} ${isUpdatingTeam2 ? 'updating' : ''} ${isChampion && isTeam2Winner ? 'champion' : ''} ${!isAdmin ? 'viewer-mode' : ''}`}
                    onClick={() => isAdmin && match.team2 && !isUpdatingWinner && setWinner(match.id, match.team2.id)}
                    title={!isAdmin ? 'Viewer mode: Cannot select winner' : ''}
                  >
                    {isUpdatingTeam2 ? (
                      <div className="loading-spinner" style={{ width: '20px', height: '20px' }} />
                    ) : (
                      match.team2 ? (
                        <>
                          <span className="team-seed">#{match.team2.weight ?? 5}</span>
                          {match.team2.name}
                        </>
                      ) : 'TBD'
                    )}
                  </div>
                  {editingMatch === match.id ? (
                    <div className="match-details-edit" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="text"
                        placeholder="Court #"
                        value={matchEditForm.courtNumber}
                        onChange={(e) => setMatchEditForm(prev => ({ ...prev, courtNumber: e.target.value }))}
                        style={{ width: '60px', padding: '4px', fontSize: '12px' }}
                      />
                      <input
                        type="time"
                        value={matchEditForm.matchTime}
                        onChange={(e) => setMatchEditForm(prev => ({ ...prev, matchTime: e.target.value }))}
                        style={{ width: '80px', padding: '4px', fontSize: '12px', marginLeft: '4px' }}
                      />
                      <button
                        onClick={() => handleUpdateMatchDetails(match.id)}
                        style={{ padding: '4px 8px', fontSize: '11px', marginLeft: '4px' }}
                      >
                        ✓
                      </button>
                      <button
                        onClick={() => {
                          setEditingMatch(null);
                          setMatchEditForm({ courtNumber: '', matchTime: '' });
                        }}
                        style={{ padding: '4px 8px', fontSize: '11px', marginLeft: '2px' }}
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <div className="match-details" onClick={(e) => {
                      e.stopPropagation();
                      if (isAdmin) {
                        setEditingMatch(match.id);
                        setMatchEditForm({
                          courtNumber: match.courtNumber || '',
                          matchTime: match.matchTime || ''
                        });
                      }
                    }}>
                      {match.courtNumber && <span className="court-number">Court {match.courtNumber}</span>}
                      {match.matchTime && <span className="match-time">{formatTime(match.matchTime)}</span>}
                      {!match.courtNumber && !match.matchTime && isAdmin && (
                        <span className="add-details-hint" style={{ fontSize: '11px', color: '#999', cursor: 'pointer' }}>
                          Click to add
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  };

  const hasPin = tournament.hasPin ?? (tournament.pin && tournament.pin.trim() !== '');

  return (
    <div className="tournament-management">
      <RoleSelectionModal
        isOpen={showRoleModal}
        onRoleSelect={handleRoleSelect}
        tournamentName={tournament.name}
        hasPin={hasPin || false}
        pinError={pinError}
      />
      {isLoading && (
        <div className="loading-overlay">
          <div className="loading">
            <div className="loading-spinner" />
            <div className="loading-text">Loading tournament details...</div>
          </div>
        </div>
      )}
      <div className="tournament-header">
        <button className="back-button" onClick={onBack} aria-label="Back to Tournaments" />
        <div className="tournament-info">
          <h2>{tournament.name}</h2>
          <p>Month: {tournament.month}</p>
          {hasAccess && (
            <span className={`role-badge ${isAdmin ? 'admin' : 'viewer'}`}>
              {isAdmin ? '🔐 Admin' : '👁️ Viewer'}
            </span>
          )}
        </div>
      </div>

      <div className={`content ${!hasAccess ? 'blurred' : ''}`}>
        <div className={`teams-section ${!isTeamSectionVisible ? 'slide-out' : ''}`}>
          <h2>Team Management</h2>
          {editingTeam ? (
            <form onSubmit={handleEditTeam}>
              <input
                type="text"
                placeholder="Team Name *"
                value={editingTeam.name}
                onChange={(e) => setEditingTeam({ ...editingTeam, name: e.target.value })}
                required
                minLength={2}
                disabled={isUpdatingTeam || !isAdmin}
              />
              <div className="players-container">
                {editingTeam.players.map((player, index) => (
                  <div key={index} className="player-input-group">
                    <input
                      type="text"
                      placeholder={`Player ${index + 1}`}
                      value={player}
                      onChange={(e) => {
                        const updatedPlayers = [...editingTeam.players];
                        updatedPlayers[index] = e.target.value;
                        setEditingTeam({ ...editingTeam, players: updatedPlayers });
                      }}
                      disabled={isUpdatingTeam}
                    />
                    {editingTeam.players.length > 2 && !isUpdatingTeam && (
                      <button
                        type="button"
                        className="remove-player-button"
                        onClick={() => {
                          const updatedPlayers = editingTeam.players.filter((_, i) => i !== index);
                          setEditingTeam({ ...editingTeam, players: updatedPlayers });
                        }}
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {!isUpdatingTeam && (
                <button
                  type="button"
                  className="add-player-button"
                  onClick={() => setEditingTeam({ ...editingTeam, players: [...editingTeam.players, ''] })}
                >
                  + Add Player
                </button>
              )}
              <input
                type="number"
                placeholder="Weight/Seed (1-5, required)"
                value={editingTeam.weight || ''}
                onChange={(e) => {
                  const value = e.target.value;
                  // Allow empty, numbers, and one decimal point with max 1 digit after
                  if (value === '' || /^\d+(\.\d?)?$/.test(value)) {
                    setEditingTeam({ ...editingTeam, weight: value ? parseFloat(value) : (editingTeam.weight || 5) });
                  }
                }}
                min="1"
                max="5"
                step="0.1"
                required
                disabled={isUpdatingTeam || !isAdmin}
                style={{ marginTop: '10px' }}
              />
              <div className="edit-actions">
                <button type="submit" disabled={isUpdatingTeam}>
                  {isUpdatingTeam ? 'Saving...' : 'Save Changes'}
                </button>
                <button type="button" onClick={() => setEditingTeam(null)} disabled={isUpdatingTeam}>
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleAddTeam}>
              <input
                type="text"
                placeholder="Team Name *"
                value={newTeam.name}
                onChange={(e) => setNewTeam({ ...newTeam, name: e.target.value })}
                required
                minLength={2}
                disabled={isAddingTeam || !isAdmin}
              />
              <div className="players-container">
                {newTeam.players.map((player, index) => (
                  <div key={index} className="player-input-group">
                    <input
                      type="text"
                      placeholder={`Player ${index + 1}`}
                      value={player}
                      onChange={(e) => {
                        const updatedPlayers = [...newTeam.players];
                        updatedPlayers[index] = e.target.value;
                        setNewTeam({ ...newTeam, players: updatedPlayers });
                      }}
                      disabled={isAddingTeam}
                    />
                    {newTeam.players.length > 2 && !isAddingTeam && (
                      <button
                        type="button"
                        className="remove-player-button"
                        onClick={() => {
                          const updatedPlayers = newTeam.players.filter((_, i) => i !== index);
                          setNewTeam({ ...newTeam, players: updatedPlayers });
                        }}
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {!isAddingTeam && (
                <button
                  type="button"
                  className="add-player-button"
                  onClick={() => setNewTeam({ ...newTeam, players: [...newTeam.players, ''] })}
                >
                  + Add Player
                </button>
              )}
              <input
                type="number"
                placeholder="Weight/Seed (1-5, required)"
                value={newTeam.weight}
                onChange={(e) => {
                  const value = e.target.value;
                  // Allow empty, numbers, and one decimal point with max 1 digit after
                  if (value === '' || /^\d+(\.\d?)?$/.test(value)) {
                    setNewTeam({ ...newTeam, weight: value });
                  }
                }}
                min="1"
                max="5"
                step="0.1"
                required
                disabled={isAddingTeam || !isAdmin}
                style={{ marginTop: '10px' }}
              />
              <button type="submit" disabled={isAddingTeam || !isAdmin}>
                {isAddingTeam ? 'Registering Team...' : 'Register Team'}
              </button>
              {!isAdmin && (
                <p className="viewer-notice" style={{ color: '#666', fontSize: '0.9rem', marginTop: '10px' }}>
                  Viewer mode: You can only view teams. Admin access required to create teams.
                </p>
              )}
            </form>
          )}

          <div className={`teams-list ${isLoading ? 'loading-section' : ''}`}>
            {teams.map(team => (
              <div key={team.id} className="team-card">
                <div className="team-header">
                  <h3>
                    <span className="team-seed">#{team.weight ?? 5}</span>
                    {team.name}
                  </h3>
                  {isAdmin && (
                    <div className="team-actions">
                      <button
                        className="edit-button"
                        onClick={() => setEditingTeam(team)}
                        title="Edit Team"
                        disabled={isDeletingTeam === team.id || isUpdatingTeam}
                      >
                        {isUpdatingTeam && editingTeam?.id === team.id ? (
                          <div className="loading-spinner" style={{ width: '20px', height: '20px' }} />
                        ) : (
                          '✎'
                        )}
                      </button>
                      <button
                        className="delete-button"
                        onClick={() => handleDeleteTeam(team.id)}
                        title="Delete Team"
                        disabled={isDeletingTeam === team.id || isUpdatingTeam}
                      >
                        {isDeletingTeam === team.id ? (
                          <div className="loading-spinner" style={{ width: '20px', height: '20px' }} />
                        ) : (
                          '×'
                        )}
                      </button>
                    </div>
                  )}
                </div>
                <p>{team.players.join(' & ')}</p>
              </div>
            ))}
          </div>

          {isAdmin && (
            <div className="teams-controls">
              <button 
                onClick={startTournament} 
                disabled={teams.length < 2 || isStartingTournament}
              >
                {isStartingTournament ? (
                  <>
                    <div className="loading-spinner" style={{ width: '20px', height: '20px', marginRight: '8px' }} />
                    Starting Tournament...
                  </>
                ) : (
                  'Start Tournament'
                )}
              </button>
            </div>
          )}
          {isViewer && (
            <div className="teams-controls">
              <p className="viewer-notice" style={{ color: '#666', fontSize: '0.9rem' }}>
                Viewer mode: You can only view teams. Admin access required to start tournament.
              </p>
            </div>
          )}
        </div>

        <div className={`bracket-section ${!isTeamSectionVisible ? 'expand' : ''}`}>
          <div className="bracket-header">
            <h2>Tournament Bracket</h2>
            <button 
              onClick={() => setIsTeamSectionVisible(!isTeamSectionVisible)}
              className={`toggle-team-section ${!isTeamSectionVisible ? 'show' : 'hide'}`}
            >
              {isTeamSectionVisible ? 'Hide Teams' : 'Show Teams'}
            </button>
          </div>
          <div className={isLoading ? 'loading-section' : ''}>
            {renderBracket()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TournamentManagement; 