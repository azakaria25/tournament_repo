import express from 'express';
import cors from 'cors';
import { Team, Match, Tournament } from './types';

const app = express();
const port = process.env.PORT || 5000;

// Enable CORS for all routes
app.use(cors({
  origin: ['https://thiqah-padel-tournament.vercel.app', 'http://localhost:3000'],
  credentials: true
}));

app.use(express.json());

// In-memory storage (replace with database in production)
let teams: Team[] = [];
let matches: Match[] = [];
let tournaments: Tournament[] = [];

interface TournamentDetails {
  id: string;
  name: string;
  date: string;
  teams: Team[];
  matches: Match[];
  status: 'active' | 'completed' | 'upcoming';
}

// In-memory storage for tournaments and their details
let tournamentDetails: { [key: string]: TournamentDetails } = {};

// Routes
app.get('/api/teams', (req, res) => {
  res.json(teams);
});

app.post('/api/teams', (req, res) => {
  const { name, players } = req.body;
  const newTeam: Team = {
    id: Date.now().toString(),
    name,
    players,
  };
  teams.push(newTeam);
  res.status(201).json(newTeam);
});

app.put('/api/teams/:id', (req, res) => {
  const { id } = req.params;
  const { name, players } = req.body;
  
  const teamIndex = teams.findIndex(team => team.id === id);
  if (teamIndex === -1) {
    return res.status(404).json({ error: 'Team not found' });
  }

  // Update team
  teams[teamIndex] = {
    ...teams[teamIndex],
    name,
    players,
  };

  // Update team in any existing matches
  matches.forEach(match => {
    if (match.team1?.id === id) {
      match.team1 = teams[teamIndex];
    }
    if (match.team2?.id === id) {
      match.team2 = teams[teamIndex];
    }
    if (match.winner?.id === id) {
      match.winner = teams[teamIndex];
    }
  });

  res.json(teams[teamIndex]);
});

app.delete('/api/teams/:id', (req, res) => {
  const { id } = req.params;
  const teamIndex = teams.findIndex(team => team.id === id);
  
  if (teamIndex === -1) {
    return res.status(404).json({ error: 'Team not found' });
  }
  
  // Remove team from teams array
  teams.splice(teamIndex, 1);
  
  // Clear all matches when a team is deleted
  matches = [];
  
  res.status(200).json({ message: 'Team deleted successfully' });
});

app.post('/api/tournament/start', (req, res) => {
  const tournamentId = req.query.tournamentId as string;
  const tournament = tournamentDetails[tournamentId];
  
  if (!tournament) {
    return res.status(404).json({ error: 'Tournament not found' });
  }

  if (tournament.teams.length < 2) {
    return res.status(400).json({ error: 'At least 2 teams are required to start a tournament' });
  }

  const matches = createMatches(tournament.teams);
  tournament.matches = matches;
  tournament.status = 'active';

  // Update tournament status in the tournaments list
  const tournamentIndex = tournaments.findIndex(t => t.id === tournamentId);
  if (tournamentIndex !== -1) {
    tournaments[tournamentIndex].status = 'active';
  }

  res.json(matches);
});

app.get('/api/matches', (req, res) => {
  res.json(matches);
});

app.post('/api/matches/:matchId/winner', (req, res) => {
  const { matchId } = req.params;
  const { winnerId, tournamentId } = req.body;

  const tournament = tournamentDetails[tournamentId];
  if (!tournament) {
    return res.status(404).json({ error: 'Tournament not found' });
  }

  const match = tournament.matches.find(m => m.id === matchId);
  if (!match) {
    return res.status(404).json({ error: 'Match not found' });
  }

  const winner = tournament.teams.find(t => t.id === winnerId);
  if (!winner) {
    return res.status(404).json({ error: 'Winner team not found' });
  }

  match.winner = winner;

  // Find the next round match for this winner
  const currentRound = match.round;
  const nextRound = currentRound + 1;
  
  // Get all matches in the current round
  const currentRoundMatches = tournament.matches.filter(m => m.round === currentRound);
  const currentMatchIndex = currentRoundMatches.findIndex(m => m.id === matchId);
  
  // Calculate the next match index in the next round
  const nextMatchIndex = Math.floor(currentMatchIndex / 2);
  
  // Get all matches in the next round
  const nextRoundMatches = tournament.matches.filter(m => m.round === nextRound);
  const nextMatch = nextRoundMatches[nextMatchIndex];
  
  if (nextMatch) {
    // Determine if winner should be team1 or team2 in next match
    const isTeam1Slot = currentMatchIndex % 2 === 0;
    if (isTeam1Slot) {
      nextMatch.team1 = winner;
    } else {
      nextMatch.team2 = winner;
    }
  }

  // Check if tournament is completed
  const isCompleted = tournament.matches.every(m => m.winner);
  if (isCompleted) {
    tournament.status = 'completed';
    // Update tournament status in the tournaments list
    const tournamentIndex = tournaments.findIndex(t => t.id === tournamentId);
    if (tournamentIndex !== -1) {
      tournaments[tournamentIndex].status = 'completed';
    }
  }

  res.json(tournament.matches);
});

app.post('/api/teams/clear', (req, res) => {
  teams = []; // Clear all teams
  matches = []; // Clear matches as well since they depend on teams
  res.json({ message: 'All teams cleared successfully' });
});

app.post('/api/matches/clear', (req, res) => {
  matches = []; // Clear only matches
  res.json({ message: 'Tournament bracket cleared successfully' });
});

// Tournament routes
app.get('/api/tournaments', (req, res) => {
  res.json(tournaments);
});

app.post('/api/tournaments', (req, res) => {
  const { name, date } = req.body;
  if (!name || !date) {
    return res.status(400).json({ error: 'Name and date are required' });
  }

  const newTournament: Tournament = {
    id: Date.now().toString(),
    name,
    date,
    teams: 0,
    status: 'upcoming'
  };

  // Initialize tournament details
  tournamentDetails[newTournament.id] = {
    ...newTournament,
    teams: [],
    matches: []
  };

  tournaments.push(newTournament);
  res.status(201).json(newTournament);
});

app.get('/api/tournaments/:id', (req, res) => {
  const tournamentId = req.params.id;
  const details = tournamentDetails[tournamentId];
  
  if (!details) {
    return res.status(404).json({ error: 'Tournament not found' });
  }
  
  res.json(details);
});

app.get('/api/tournaments/:id/teams', (req, res) => {
  const tournamentId = req.params.id;
  const tournament = tournamentDetails[tournamentId];
  
  if (!tournament) {
    return res.status(404).json({ error: 'Tournament not found' });
  }
  
  res.json(tournament.teams);
});

app.get('/api/tournaments/:id/matches', (req, res) => {
  const { id } = req.params;
  const tournament = tournaments.find(t => t.id === id);
  
  if (!tournament) {
    return res.status(404).json({ error: 'Tournament not found' });
  }

  res.json(matches);
});

app.post('/api/tournaments/:id/teams', (req, res) => {
  const tournamentId = req.params.id;
  const tournament = tournamentDetails[tournamentId];
  
  if (!tournament) {
    return res.status(404).json({ error: 'Tournament not found' });
  }

  const newTeam: Team = {
    id: Date.now().toString(),
    name: req.body.name,
    players: req.body.players
  };

  tournament.teams.push(newTeam);
  // Update the teams count in the tournaments list
  const tournamentIndex = tournaments.findIndex(t => t.id === tournamentId);
  if (tournamentIndex !== -1) {
    tournaments[tournamentIndex].teams = tournament.teams.length;
  }

  res.status(201).json(newTeam);
});

function createMatches(teams: Team[]): Match[] {
  const matches: Match[] = [];
  
  // Calculate number of rounds needed
  const numTeams = teams.length;
  const numRounds = Math.ceil(Math.log2(numTeams));

  // Shuffle teams for random seeding
  const shuffledTeams = [...teams].sort(() => Math.random() - 0.5);
  
  // Create first round matches
  const firstRoundMatches = Math.ceil(numTeams / 2);
  for (let i = 0; i < firstRoundMatches; i++) {
    matches.push({
      id: Date.now().toString() + i,
      round: 1,
      matchIndex: i,
      team1: shuffledTeams[i * 2],
      team2: shuffledTeams[i * 2 + 1] || null,
      winner: null,
    });
  }

  // Create empty matches for subsequent rounds
  let currentMatchIndex = matches.length;
  for (let round = 2; round <= numRounds; round++) {
    const matchesInRound = Math.ceil(firstRoundMatches / Math.pow(2, round - 1));
    for (let i = 0; i < matchesInRound; i++) {
      matches.push({
        id: Date.now().toString() + currentMatchIndex + i,
        round,
        matchIndex: i,
        team1: null,
        team2: null,
        winner: null,
      });
    }
    currentMatchIndex += matchesInRound;
  }

  return matches;
}

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
}); 