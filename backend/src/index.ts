import express from 'express';
import cors from 'cors';

const app = express();
const port = process.env.PORT || 5000;

// Enable CORS for all routes
app.use(cors({
  origin: 'http://localhost:3000',
  methods: ['GET', 'POST', 'DELETE'],
  allowedHeaders: ['Content-Type'],
  credentials: true // Allow credentials
}));

app.use(express.json());

// Types
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

// In-memory storage (replace with database in production)
let teams: Team[] = [];
let matches: Match[] = [];

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
  if (teams.length < 2) {
    return res.status(400).json({ error: 'Need at least 2 teams to start tournament' });
  }

  // Clear previous matches to regenerate
  matches = []; 

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

  res.json(matches);
});

app.get('/api/matches', (req, res) => {
  res.json(matches);
});

app.post('/api/matches/:id/winner', (req, res) => {
  const { id } = req.params;
  const { winnerId } = req.body;
  
  const match = matches.find(m => m.id === id);
  if (!match) {
    return res.status(404).json({ error: 'Match not found' });
  }

  const winner = match.team1?.id === winnerId ? match.team1 : match.team2;
  if (!winner) {
    return res.status(400).json({ error: 'Invalid winner' });
  }

  match.winner = winner;

  // Find the next round match for this winner
  const currentRound = match.round;
  const nextRound = currentRound + 1;
  
  // Get all matches in the current round
  const currentRoundMatches = matches.filter(m => m.round === currentRound);
  const currentMatchIndex = currentRoundMatches.findIndex(m => m.id === id);
  
  // Calculate the next match index in the next round
  const nextMatchIndex = Math.floor(currentMatchIndex / 2);
  
  // Get all matches in the next round
  const nextRoundMatches = matches.filter(m => m.round === nextRound);
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

  res.json(matches);
});

app.post('/api/teams/clear', (req, res) => {
  teams = []; // Clear all teams
  matches = []; // Optionally clear matches if needed
  res.json({ message: 'All teams cleared successfully' });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
}); 