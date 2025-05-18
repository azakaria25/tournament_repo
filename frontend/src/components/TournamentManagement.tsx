import React, { useState, useEffect } from 'react';
import './TournamentManagement.css';

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

interface TournamentDetails {
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

  useEffect(() => {
    fetchTournamentDetails();
  }, [tournament.id]);

  const fetchTournamentDetails = async () => {
    try {
      const [teamsResponse, matchesResponse] = await Promise.all([
        fetch(`http://localhost:5000/api/tournaments/${tournament.id}/teams`),
        fetch(`http://localhost:5000/api/tournaments/${tournament.id}/matches`)
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
    }
  };

  const handleAddTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    // Validate team name
    if (!newTeam.name.trim()) {
      alert('Please enter a team name');
      return;
    }
    // Filter out empty player names
    const validPlayers = newTeam.players.filter(player => player.trim() !== '');
    try {
      const response = await fetch(`http://localhost:5000/api/tournaments/${tournament.id}/teams`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newTeam.name.trim(),
          players: validPlayers
        }),
      });
      let errorMessage = 'Failed to add team';
      let data = null;
      try {
        data = await response.json();
      } catch (parseError) {
        // If parsing fails, fallback to status text
        if (!response.ok) {
          throw new Error(`Server error: ${response.status} ${response.statusText}`);
        }
        throw parseError;
      }
      if (!response.ok) {
        errorMessage = (data && data.error) ? data.error : errorMessage;
        throw new Error(errorMessage);
      }
      setTeams([...teams, data]);
      setNewTeam({ name: '', players: ['', ''] });
    } catch (error) {
      // Always show backend error if available
      alert(error instanceof Error ? error.message : 'Failed to add team. Please try again.');
    }
  };

  const startTournament = async () => {
    if (teams.length < 2) {
      alert('Please register at least 2 teams to start the tournament');
      return;
    }

    try {
      const response = await fetch(`http://localhost:5000/api/tournaments/${tournament.id}/start`, {
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
    }
  };

  const setWinner = async (matchId: string, winnerId: string) => {
    try {
      const response = await fetch(`http://localhost:5000/api/matches/${matchId}/winner`, {
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
      setMatches(updatedMatches);
    } catch (error) {
      console.error('Error updating match winner:', error);
      alert('Failed to update match winner. Please try again.');
    }
  };

  const handleDeleteTeam = async (teamId: string) => {
    if (!window.confirm('Are you sure you want to delete this team?')) {
      return;
    }

    try {
      console.log('Deleting team:', { tournamentId: tournament.id, teamId });
      const response = await fetch(`http://localhost:5000/api/tournaments/${tournament.id}/teams/${teamId}`, {
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

      // Refresh the teams list after successful deletion
      await fetchTournamentDetails();
    } catch (error) {
      console.error('Error deleting team:', error);
      alert(error instanceof Error ? error.message : 'Failed to delete team. Please try again.');
    }
  };

  const handleEditTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTeam) return;

    try {
      const response = await fetch(`http://localhost:5000/api/tournaments/${tournament.id}/teams/${editingTeam.id}`, {
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

      // Refresh the teams list after successful update
      fetchTournamentDetails();
      setEditingTeam(null);
    } catch (error) {
      console.error('Error updating team:', error);
      alert(error instanceof Error ? error.message : 'Failed to update team. Please try again.');
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

    return (
      <div className="bracket">
        {sortedRounds.map(([round, roundMatches]) => (
          <div key={round} className="round">
            <h3>{getRoundName(round, sortedRounds.length)}</h3>
            {roundMatches.map(match => {
              const isTeam1Winner = match.winner?.id === match.team1?.id;
              const isTeam2Winner = match.winner?.id === match.team2?.id;

              return (
                <div key={match.id} className="match">
                  <div 
                    className={`team ${isTeam1Winner ? 'winner' : ''}`}
                    onClick={() => match.team1 && setWinner(match.id, match.team1.id)}
                  >
                    {match.team1 ? match.team1.name : 'TBD'}
                  </div>
                  <div 
                    className={`team ${isTeam2Winner ? 'winner' : ''}`}
                    onClick={() => match.team2 && setWinner(match.id, match.team2.id)}
                  >
                    {match.team2 ? match.team2.name : 'TBD'}
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
                    />
                    {editingTeam.players.length > 2 && (
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
              <button
                type="button"
                className="add-player-button"
                onClick={() => setEditingTeam({ ...editingTeam, players: [...editingTeam.players, ''] })}
              >
                + Add Player
              </button>
              <div className="edit-actions">
                <button type="submit">Save Changes</button>
                <button type="button" onClick={() => setEditingTeam(null)}>Cancel</button>
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
                    />
                    {newTeam.players.length > 2 && (
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
              <button
                type="button"
                className="add-player-button"
                onClick={() => setNewTeam({ ...newTeam, players: [...newTeam.players, ''] })}
              >
                + Add Player
              </button>
              <button type="submit">Register Team</button>
            </form>
          )}

          <div className="teams-list">
            {teams.map(team => (
              <div key={team.id} className="team-card">
                <div className="team-header">
                  <h3>{team.name}</h3>
                  <div className="team-actions">
                    <button
                      className="edit-button"
                      onClick={() => setEditingTeam(team)}
                      title="Edit Team"
                    >
                      ✎
                    </button>
                    <button
                      className="delete-button"
                      onClick={() => handleDeleteTeam(team.id)}
                      title="Delete Team"
                    >
                      ×
                    </button>
                  </div>
                </div>
                <p>{team.players.join(' & ')}</p>
              </div>
            ))}
          </div>

          <div className="teams-controls">
            <button onClick={startTournament} disabled={teams.length < 2}>
              Start Tournament
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
          {renderBracket()}
        </div>
      </div>
    </div>
  );
};

export default TournamentManagement; 