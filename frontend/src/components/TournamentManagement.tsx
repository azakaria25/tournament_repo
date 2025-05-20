import React, { useState, useEffect, useCallback } from 'react';
import './TournamentManagement.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

interface Team {
  id: string;
  name: string;
  players: string[];
}

interface Match {
  id: string;
  round: number;
  team1: Team | null;
  team2: Team | null;
  winner: Team | null;
  matchIndex: number;
}

interface Tournament {
  id: string;
  name: string;
  month: string;
  teams: Team[];
  matches: Match[];
  status: 'active' | 'completed' | 'upcoming';
}

interface TournamentManagementProps {
  tournament: Tournament;
  onBack: () => void;
}

const TournamentManagement: React.FC<TournamentManagementProps> = ({ tournament, onBack }) => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [newTeam, setNewTeam] = useState({ name: '', players: ['', ''] });
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [isTeamSectionVisible, setIsTeamSectionVisible] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isAddingTeam, setIsAddingTeam] = useState(false);
  const [isUpdatingTeam, setIsUpdatingTeam] = useState(false);
  const [isDeletingTeam, setIsDeletingTeam] = useState<string | null>(null);
  const [isStartingTournament, setIsStartingTournament] = useState(false);
  const [isUpdatingWinner, setIsUpdatingWinner] = useState<string | null>(null);

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
      setIsTeamSectionVisible(true);
    } catch (error) {
      console.error('Error fetching tournament details:', error);
      alert('Failed to fetch tournament details. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [tournament.id]);

  useEffect(() => {
    fetchTournamentDetails();
  }, [fetchTournamentDetails]);

  const handleAddTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeam.name.trim()) {
      alert('Please enter a team name');
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
          players: validPlayers
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
      setNewTeam({ name: '', players: ['', ''] });
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
    if (!window.confirm('Are you sure you want to delete this team?')) {
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
      setTeams(prevTeams => prevTeams.filter(team => team.id !== teamId));
      
      // If there are matches, we need to update them as well
      if (matches.length > 0) {
        const updatedMatches = matches.map(match => ({
          ...match,
          team1: match.team1?.id === teamId ? null : match.team1,
          team2: match.team2?.id === teamId ? null : match.team2,
          winner: match.winner?.id === teamId ? null : match.winner
        }));
        setMatches(updatedMatches);
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

    setIsUpdatingTeam(true);
    try {
      const response = await fetch(`${API_URL}/api/teams/${editingTeam.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: editingTeam.name,
          players: editingTeam.players
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
    const finalMatch = matches.find(m => m.round === sortedRounds.length);
    const champion = finalMatch?.winner;

    return (
      <div className="bracket">
        {isCompleted && champion && (
          <div className="champion-celebration">
            <div className="champion-box">
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
                    className={`team ${isTeam1Winner ? 'winner' : ''} ${isUpdatingTeam1 ? 'updating' : ''} ${isChampion && isTeam1Winner ? 'champion' : ''}`}
                    onClick={() => match.team1 && !isUpdatingWinner && setWinner(match.id, match.team1.id)}
                  >
                    {isUpdatingTeam1 ? (
                      <div className="loading-spinner" style={{ width: '20px', height: '20px' }} />
                    ) : (
                      match.team1 ? match.team1.name : 'TBD'
                    )}
                  </div>
                  <div 
                    className={`team ${isTeam2Winner ? 'winner' : ''} ${isUpdatingTeam2 ? 'updating' : ''} ${isChampion && isTeam2Winner ? 'champion' : ''}`}
                    onClick={() => match.team2 && !isUpdatingWinner && setWinner(match.id, match.team2.id)}
                  >
                    {isUpdatingTeam2 ? (
                      <div className="loading-spinner" style={{ width: '20px', height: '20px' }} />
                    ) : (
                      match.team2 ? match.team2.name : 'TBD'
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="tournament-management">
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
        </div>
      </div>

      <div className="content">
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
                disabled={isUpdatingTeam}
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
                disabled={isAddingTeam}
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
              <button type="submit" disabled={isAddingTeam}>
                {isAddingTeam ? 'Registering Team...' : 'Register Team'}
              </button>
            </form>
          )}

          <div className={`teams-list ${isLoading ? 'loading-section' : ''}`}>
            {teams.map(team => (
              <div key={team.id} className="team-card">
                <div className="team-header">
                  <h3>{team.name}</h3>
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
                </div>
                <p>{team.players.join(' & ')}</p>
              </div>
            ))}
          </div>

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