import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Team, Match, Tournament, TournamentDetails } from '../src/types';
import { DatabaseService } from '../src/services/database';
import path from 'path';

// Load environment variables
const envPath = path.resolve(__dirname, '../.env');
console.log('Loading environment variables from:', envPath);
dotenv.config({ path: envPath });

// Verify DATABASE_URL is set
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL environment variable is not set');
  process.exit(1);
}

const app = express();
const port = process.env.PORT || 5000;

// Feature flags
const USE_IN_MEMORY_STORAGE = process.env.USE_IN_MEMORY_STORAGE === 'true';

// Initialize database service
const databaseService = new DatabaseService();

// Enable CORS for all routes
app.use(cors({
  origin: [
    'https://thiqah-padel-tournament.vercel.app',
    'http://localhost:3000',
    'http://localhost:3025',
    'https://tournament-repo-frontend.vercel.app',
    'https://tournament-repo.vercel.app'
  ],
  credentials: true
}));

app.use(express.json());

// Root route
app.get('/', (req, res) => {
  res.json({ message: 'Padel Tournament API is running' });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// In-memory storage (replace with database in production)
let teams: Team[] = [];
let matches: Match[] = [];
let tournaments: Tournament[] = [];
let tournamentDetails: { [key: string]: TournamentDetails } = {};

// Storage interface for future database implementation
interface Storage {
  teams: Team[];
  matches: Match[];
  tournaments: Tournament[];
  tournamentDetails: { [key: string]: TournamentDetails };
}

// Initialize storage based on feature flag
const storage: Storage = USE_IN_MEMORY_STORAGE ? {
  teams,
  matches,
  tournaments,
  tournamentDetails
} : {
  teams: [],
  matches: [],
  tournaments: [],
  tournamentDetails: {}
};

// Helper functions to access storage
const getStorage = () => storage;
const getTeams = async () => {
  if (USE_IN_MEMORY_STORAGE) {
    return getStorage().teams;
  }
  return await databaseService.getTeams();
};

const getMatches = async () => {
  if (USE_IN_MEMORY_STORAGE) {
    return getStorage().matches;
  }
  return await databaseService.getMatches();
};

const getTournaments = async () => {
  if (USE_IN_MEMORY_STORAGE) {
    return getStorage().tournaments;
  }
  return await databaseService.getTournaments();
};

const getTournamentDetails = async (id: string) => {
  if (USE_IN_MEMORY_STORAGE) {
    return getStorage().tournamentDetails[id];
  }
  return await databaseService.getTournamentDetails(id);
};

// Routes
app.get('/api/teams', async (req, res) => {
  res.json(await getTeams());
});

app.post('/api/teams', async (req, res) => {
  const { name, players, weight } = req.body;
  
  // Validate weight
  if (!weight || typeof weight !== 'number' || weight < 1 || weight > 5) {
    return res.status(400).json({ error: 'Weight is required and must be between 1 and 5' });
  }
  
  // Validate decimal places (max 1 digit after decimal)
  const weightStr = weight.toString();
  const decimalParts = weightStr.split('.');
  if (decimalParts.length > 1 && decimalParts[1].length > 1) {
    return res.status(400).json({ error: 'Weight can have maximum one digit after decimal point' });
  }
  
  const newTeam: Team = {
    id: Date.now().toString(),
    name,
    players,
    weight: weight,
  };
  
  if (USE_IN_MEMORY_STORAGE) {
    const teams = await getTeams();
    teams.push(newTeam);
  } else {
    await databaseService.createTeam(newTeam);
  }
  
  res.status(201).json(newTeam);
});

app.put('/api/teams/:id', async (req, res) => {
  const { id } = req.params;
  const { name, players, weight } = req.body;
  
  // Validate weight
  if (!weight || typeof weight !== 'number' || weight < 1 || weight > 5) {
    return res.status(400).json({ error: 'Weight is required and must be between 1 and 5' });
  }
  
  // Validate decimal places (max 1 digit after decimal)
  const weightStr = weight.toString();
  const decimalParts = weightStr.split('.');
  if (decimalParts.length > 1 && decimalParts[1].length > 1) {
    return res.status(400).json({ error: 'Weight can have maximum one digit after decimal point' });
  }
  
  if (USE_IN_MEMORY_STORAGE) {
    const teams = await getTeams();
    const teamIndex = teams.findIndex(team => team.id === id);
    if (teamIndex === -1) {
      return res.status(404).json({ error: 'Team not found' });
    }

    // Update team
    teams[teamIndex] = {
      ...teams[teamIndex],
      name,
      players,
      weight: weight,
    };

    // Update team in any existing matches
    const matches = await getMatches();
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
  } else {
    const updatedTeam: Team = {
      id,
      name,
      players,
      weight: weight,
    };
    await databaseService.updateTeam(updatedTeam);
    res.json(updatedTeam);
  }
});

app.delete('/api/teams/:id', async (req, res) => {
  const { id } = req.params;
  
  if (USE_IN_MEMORY_STORAGE) {
    const teams = await getTeams();
    const teamIndex = teams.findIndex((team: Team) => team.id === id);
    if (teamIndex === -1) {
      return res.status(404).json({ error: 'Team not found' });
    }
    
    // Remove team from teams array
    teams.splice(teamIndex, 1);
    
    // Clear all matches when a team is deleted
    const matches = await getMatches();
    matches.length = 0;
  } else {
    try {
      // First, get all tournaments that have this team
      const tournaments = await getTournaments();
      const affectedTournaments = tournaments.filter(t => 
        t.teams.some(team => team.id === id)
      );

      // Delete the team
      await databaseService.deleteTeam(id);

      // For each affected tournament, delete matches and restart
      for (const tournament of affectedTournaments) {
        const tournamentDetails = await getTournamentDetails(tournament.id);
        if (!tournamentDetails) continue;

        // Always delete existing matches
        await databaseService.deleteMatches(tournament.id);
        
        // Only restart if there are at least 2 teams
        if (tournamentDetails.teams.length >= 2) {
          // Create new matches
          const matches = createMatches(tournamentDetails.teams, tournament.id);
          
          // Save new matches to database
          for (const match of matches) {
            await databaseService.createMatch(match, tournament.id);
          }

          // Update tournament status to active
          await databaseService.updateTournament({
            ...tournamentDetails,
            status: 'active',
            pin: tournamentDetails.pin || ''
          });
        } else {
          // If not enough teams, update status to upcoming
          await databaseService.updateTournament({
            ...tournamentDetails,
            status: 'upcoming',
            pin: tournamentDetails.pin || ''
          });
        }
      }
    } catch (error) {
      console.error('Error deleting team:', error);
      return res.status(500).json({ error: 'Failed to delete team' });
    }
  }
  
  res.status(200).json({ message: 'Team deleted successfully' });
});

app.post('/api/tournaments/:id/start', async (req, res) => {
  const tournamentId = req.params.id;
  try {
    const tournament = await getTournamentDetails(tournamentId);
    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }
    if (tournament.teams.length < 2) {
      return res.status(400).json({ error: 'Need at least 2 teams to start a tournament' });
    }

    // Delete all existing matches for this tournament
    if (USE_IN_MEMORY_STORAGE) {
      tournament.matches = [];
    } else {
      await databaseService.deleteTournamentMatches(tournamentId);
    }

    // Create new matches for the tournament
    const matches = createMatches(tournament.teams, tournamentId);
    tournament.matches = matches;
    tournament.status = 'active';

    if (USE_IN_MEMORY_STORAGE) {
      const tournaments = await getTournaments();
      const tournamentIndex = tournaments.findIndex((t: Tournament) => t.id === tournamentId);
      if (tournamentIndex !== -1) {
        tournaments[tournamentIndex].status = 'active';
        tournaments[tournamentIndex].matches = matches;
      }
    } else {
      // Update tournament status first
      await databaseService.updateTournament({
        ...tournament,
        pin: tournament.pin || ''
      });
      
      // Then create all matches
      for (const match of matches) {
        try {
          await databaseService.createMatch(match, tournamentId);
        } catch (error) {
          console.error('Error creating match:', error);
          // If match creation fails, clean up by deleting all matches
          await databaseService.deleteTournamentMatches(tournamentId);
          throw new Error('Failed to create tournament matches');
        }
      }
    }

    res.json(tournament);
  } catch (error) {
    console.error('Error starting tournament:', error);
    res.status(500).json({ error: 'Failed to start tournament' });
  }
});

app.get('/api/matches', async (req, res) => {
  res.json(await getMatches());
});

app.post('/api/matches/:matchId/winner', async (req, res) => {
  const { matchId } = req.params;
  const { winnerId, tournamentId } = req.body;

  const tournament = await getTournamentDetails(tournamentId);
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
  const nextRound = match.round + 1;
  if (nextRound > Math.ceil(Math.log2(tournament.matches.length))) {
    // This was the final match
    if (!USE_IN_MEMORY_STORAGE) {
      await databaseService.updateMatch(match);
    }
    return res.json(tournament.matches);
  }

  // Calculate the next match index using binary tree traversal
  const nextMatchIndex = Math.floor(match.matchIndex / 2);
  const nextMatch = tournament.matches.find(m => 
    m.round === nextRound && 
    m.matchIndex === nextMatchIndex
  );

  if (nextMatch) {
    // In a single elimination bracket, the position in the next round is determined by the match index
    // Even indices go to team1, odd indices go to team2
    if (match.matchIndex % 2 === 0) {
      nextMatch.team1 = winner;
    } else {
      nextMatch.team2 = winner;
    }
  }

  // Check if tournament is completed
  const isCompleted = tournament.matches.every(m => m.winner);
  if (isCompleted) {
    tournament.status = 'completed';
    if (USE_IN_MEMORY_STORAGE) {
      // Update tournament status in the tournaments list
      const tournaments = await getTournaments();
      const tournamentIndex = tournaments.findIndex((t: Tournament) => t.id === tournamentId);
      if (tournamentIndex !== -1) {
        tournaments[tournamentIndex].status = 'completed';
      }
    } else {
      await databaseService.updateTournament({
        ...tournament,
        pin: tournament.pin || ''
      });
    }
  }

  if (!USE_IN_MEMORY_STORAGE) {
    await databaseService.updateMatch(match);
    if (nextMatch) {
      await databaseService.updateMatch(nextMatch);
    }
  }

  res.json(tournament.matches);
});

app.put('/api/matches/:matchId', async (req, res) => {
  try {
    const { matchId } = req.params;
    const { courtNumber, matchTime, tournamentId } = req.body;

    console.log('Updating match:', { matchId, tournamentId, courtNumber, matchTime });

    if (!tournamentId) {
      return res.status(400).json({ error: 'Tournament ID is required' });
    }

    const tournament = await getTournamentDetails(tournamentId);
    if (!tournament) {
      console.error(`Tournament not found: ${tournamentId}`);
      return res.status(404).json({ error: 'Tournament not found' });
    }

    console.log(`Tournament found with ${tournament.matches.length} matches`);
    const match = tournament.matches.find(m => m.id === matchId);
    if (!match) {
      console.error(`Match not found: ${matchId} in tournament ${tournamentId}`);
      console.error(`Available matches:`, tournament.matches.map(m => ({ id: m.id, round: m.round, matchIndex: m.matchIndex })));
      return res.status(404).json({ error: 'Match not found' });
    }

    console.log('Match found, updating...');
    // Update match with court number and time
    match.courtNumber = courtNumber && courtNumber.trim() !== '' ? courtNumber.trim() : undefined;
    match.matchTime = matchTime && matchTime.trim() !== '' ? matchTime.trim() : undefined;

    if (!USE_IN_MEMORY_STORAGE) {
      await databaseService.updateMatch(match);
      console.log('Match updated in database');
    }

    res.json(match);
  } catch (error) {
    console.error('Error updating match:', error);
    res.status(500).json({ error: 'Internal server error while updating match' });
  }
});

app.post('/api/teams/clear', async (req, res) => {
  if (!USE_IN_MEMORY_STORAGE) {
    return res.status(501).json({ error: 'In-memory storage is disabled' });
  }
  const teams = await getTeams();
  const matches = await getMatches();
  teams.length = 0; // Clear all teams
  matches.length = 0; // Clear matches as well since they depend on teams
  res.json({ message: 'All teams cleared successfully' });
});

app.post('/api/matches/clear', async (req, res) => {
  if (!USE_IN_MEMORY_STORAGE) {
    return res.status(501).json({ error: 'In-memory storage is disabled' });
  }
  const matches = await getMatches();
  matches.length = 0; // Clear only matches
  res.json({ message: 'Tournament bracket cleared successfully' });
});

// Tournament routes
app.get('/api/tournaments', async (req, res) => {
  res.json(await getTournaments());
});

app.post('/api/tournaments', async (req, res) => {
  const { name, month, year, pin } = req.body;
  if (!name || !month || !year) {
    return res.status(400).json({ error: 'Name, month, and year are required' });
  }
  
  // Validate PIN: must be exactly 4 digits
  if (!pin) {
    return res.status(400).json({ error: 'PIN code is required' });
  }
  
  const pinRegex = /^\d{4}$/;
  if (!pinRegex.test(pin)) {
    return res.status(400).json({ error: 'PIN must be exactly 4 digits' });
  }

  const newTournament: Tournament = {
    id: Date.now().toString(),
    name,
    month,
    year,
    teams: [],
    matches: [],
    status: 'upcoming',
    pin: pin
  };

  if (USE_IN_MEMORY_STORAGE) {
    const tournaments = await getTournaments();
    tournaments.push(newTournament);
    const details = await getTournamentDetails(newTournament.id);
    if (details) {
      details.teams = [];
      details.matches = [];
    }
  } else {
    await databaseService.createTournament(newTournament);
  }

  res.status(201).json(newTournament);
});

app.get('/api/tournaments/:id', async (req, res) => {
  const tournamentId = req.params.id;
  const details = await getTournamentDetails(tournamentId);
  
  if (!details) {
    return res.status(404).json({ error: 'Tournament not found' });
  }
  
  res.json(details);
});

app.get('/api/tournaments/:id/teams', async (req, res) => {
  const tournamentId = req.params.id;
  const tournament = await getTournamentDetails(tournamentId);
  
  if (!tournament) {
    return res.status(404).json({ error: 'Tournament not found' });
  }
  
  res.json(tournament.teams);
});

app.get('/api/tournaments/:id/matches', async (req, res) => {
  const { id } = req.params;
  const tournament = await getTournamentDetails(id);
  
  if (!tournament) {
    return res.status(404).json({ error: 'Tournament not found' });
  }
  
  res.json(tournament.matches);
});

app.post('/api/tournaments/:id/teams', async (req, res) => {
  try {
    const tournamentId = req.params.id;
    const tournament = await getTournamentDetails(tournamentId);
    
    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }
    
    const { teamId } = req.body;
    const teams = await getTeams();
    const team = teams.find((t: Team) => t.id === teamId);
    
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }
    
    if (tournament.teams.some((t: Team) => t.id === teamId)) {
      return res.status(400).json({ error: 'Team already in tournament' });
    }
    
    if (USE_IN_MEMORY_STORAGE) {
      tournament.teams.push(team);
      const tournaments = await getTournaments();
      const tournamentIndex = tournaments.findIndex((t: Tournament) => t.id === tournamentId);
      if (tournamentIndex !== -1) {
        tournaments[tournamentIndex].teams = tournament.teams;
      }
    } else {
      await databaseService.addTeamToTournament(tournamentId, teamId);
    }
    
    const updatedTournament = await getTournamentDetails(tournamentId);
    res.json(updatedTournament);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/tournaments/:id/teams/:teamId', async (req, res) => {
  try {
    const tournamentId = req.params.id;
    const teamId = req.params.teamId;
    const tournament = await getTournamentDetails(tournamentId);
    
    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }
    
    const teamIndex = tournament.teams.findIndex((t: Team) => t.id === teamId);
    if (teamIndex === -1) {
      return res.status(404).json({ error: 'Team not found in tournament' });
    }
    
    if (USE_IN_MEMORY_STORAGE) {
      tournament.teams.splice(teamIndex, 1);
      const tournaments = await getTournaments();
      const tournamentIndex = tournaments.findIndex((t: Tournament) => t.id === tournamentId);
      if (tournamentIndex !== -1) {
        tournaments[tournamentIndex].teams = tournament.teams;
      }
    } else {
      // Remove team from tournament
      await databaseService.removeTeamFromTournament(tournamentId, teamId);
      
      // Delete all existing matches for this tournament
      await databaseService.deleteMatches(tournamentId);
      
      // Get updated tournament details after team removal
      const updatedTournament = await getTournamentDetails(tournamentId);
      
      // If there are enough teams, regenerate matches
      if (updatedTournament && updatedTournament.teams.length >= 2) {
        // Create new matches
        const matches = createMatches(updatedTournament.teams, tournamentId);
        
        // Save new matches to database
        for (const match of matches) {
          await databaseService.createMatch(match, tournamentId);
        }
        
        // Update tournament status to active
        await databaseService.updateTournament({
          ...updatedTournament,
          status: 'active',
          pin: updatedTournament.pin || ''
        });
      } else if (updatedTournament) {
        // If not enough teams, update status to upcoming
        await databaseService.updateTournament({
          ...updatedTournament,
          status: 'upcoming',
          pin: updatedTournament.pin || ''
        });
      }
    }
    
    const updatedTournament = await getTournamentDetails(tournamentId);
    res.json(updatedTournament);
  } catch (error) {
    console.error('Error deleting team:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/tournaments/:id/status', async (req, res) => {
  try {
    const tournamentId = req.params.id;
    const { status } = req.body;
    const tournament = await getTournamentDetails(tournamentId);
    
    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }
    
    if (!['active', 'completed', 'upcoming'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    
    if (USE_IN_MEMORY_STORAGE) {
      tournament.status = status;
      const tournaments = await getTournaments();
      const tournamentIndex = tournaments.findIndex((t: Tournament) => t.id === tournamentId);
      if (tournamentIndex !== -1) {
        tournaments[tournamentIndex].status = status;
      }
    } else {
      await databaseService.updateTournament({ 
        ...tournament, 
        status,
        pin: tournament.pin || ''
      });
    }
    
    res.json(tournament);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

function createMatches(teams: Team[], tournamentId: string): Match[] {
  const matches: Match[] = [];
  // Calculate number of rounds needed
  const numTeams = teams.length;
  const numRounds = Math.ceil(Math.log2(numTeams));
  
  // Professional bracket seeding: Sort teams by weight (lower weight = higher seed)
  // Teams without weight are treated as lowest priority
  const sortedTeams = [...teams].sort((a, b) => {
    const weightA = a.weight ?? 9999; // Teams without weight go to the end
    const weightB = b.weight ?? 9999;
    return weightA - weightB; // Lower weight = higher seed
  });
  
  // Professional bracket seeding algorithm
  // Top seed plays bottom seed, 2nd plays 2nd-to-last, etc.
  const seededTeams = seedBracket(sortedTeams);
  
  // Create first round matches
  const firstRoundMatches = Math.ceil(numTeams / 2);
  for (let i = 0; i < firstRoundMatches; i++) {
    matches.push({
      id: `${tournamentId}-match-1-${i}`,
      round: 1,
      matchIndex: i,
      team1: seededTeams[i * 2],
      team2: seededTeams[i * 2 + 1] || null,
      winner: null,
      tournamentId
    });
  }
  // Create empty matches for subsequent rounds
  let currentMatchIndex = matches.length;
  for (let round = 2; round <= numRounds; round++) {
    const matchesInRound = Math.ceil(firstRoundMatches / Math.pow(2, round - 1));
    for (let i = 0; i < matchesInRound; i++) {
      matches.push({
        id: `${tournamentId}-match-${round}-${i}`,
        round,
        matchIndex: i,
        team1: null,
        team2: null,
        winner: null,
        tournamentId
      });
    }
    currentMatchIndex += matchesInRound;
  }
  return matches;
}

// Professional bracket seeding: Top seed plays bottom seed
function seedBracket(teams: Team[]): Team[] {
  const seeded: Team[] = [];
  const numTeams = teams.length;
  
  // For professional bracket seeding:
  // Seed 1 plays Seed N, Seed 2 plays Seed N-1, etc.
  for (let i = 0; i < Math.ceil(numTeams / 2); i++) {
    const topSeed = teams[i];
    const bottomSeed = teams[numTeams - 1 - i];
    
    if (topSeed) seeded.push(topSeed);
    if (bottomSeed && bottomSeed.id !== topSeed?.id) seeded.push(bottomSeed);
  }
  
  return seeded;
}

app.post('/api/tournaments/update-statuses', async (req, res) => {
  const currentDate = new Date();
  const currentMonth = currentDate.toLocaleString('default', { month: 'long' }).toLowerCase();
  const currentYear = currentDate.getFullYear().toString();
  // Get month index (0-11) for comparison
  const getMonthIndex = (month: string) => {
    const months = ['january', 'february', 'march', 'april', 'may', 'june', 
                   'july', 'august', 'september', 'october', 'november', 'december'];
    return months.indexOf(month.toLowerCase());
  };
  const currentMonthIndex = getMonthIndex(currentMonth);
  // Update tournament statuses
  const tournaments = await getTournaments();
  for (const tournament of tournaments) {
    const tournamentMonthIndex = getMonthIndex(tournament.month);
    const tournamentYear = parseInt(tournament.year);
    const currentYearNum = parseInt(currentYear);
    let newStatus: 'active' | 'completed' | 'upcoming';
    if (tournamentYear < currentYearNum) {
      newStatus = 'completed';
    } else if (tournamentYear > currentYearNum) {
      newStatus = 'upcoming';
    } else {
      if (tournamentMonthIndex < currentMonthIndex) {
        newStatus = 'completed';
      } else if (tournamentMonthIndex > currentMonthIndex) {
        newStatus = 'upcoming';
      } else {
        newStatus = 'active';
      }
    }
    tournament.status = newStatus;
    await databaseService.updateTournament({
      ...tournament,
      pin: tournament.pin || ''
    });
  }
  res.json(tournaments);
});

app.put('/api/tournaments/:id', async (req, res) => {
  const tournamentId = req.params.id;
  const { name, month, year, pin, newPin } = req.body;
  
  console.log('Update tournament request:', { tournamentId, pin, pinType: typeof pin, pinValue: pin });
  
  if (!name || !month || !year) {
    return res.status(400).json({ error: 'Name, month, and year are required' });
  }
  
  const tournament = await getTournamentDetails(tournamentId);
  if (!tournament) {
    return res.status(404).json({ error: 'Tournament not found' });
  }
  
  const tournamentPin = (tournament.pin || '').trim();
  const hasExistingPin = tournamentPin && tournamentPin !== '';
  
  // If tournament has an existing PIN, require PIN verification
  if (hasExistingPin) {
    // Convert pin to string (handles both string and number types)
    const pinString = pin ? String(pin).trim() : '';
    if (!pinString || pinString === '') {
      return res.status(400).json({ error: 'PIN code is required to update tournament' });
    }
    
    const providedPin = pinString;
    const pinRegex = /^\d{4}$/;
    
    if (!pinRegex.test(providedPin)) {
      return res.status(400).json({ error: 'PIN must be exactly 4 digits' });
    }
    
    // Super PIN "9999" bypasses all tournament PINs
    const SUPER_PIN = '9999';
    console.log(`PIN verification: providedPin="${providedPin}", SUPER_PIN="${SUPER_PIN}", tournamentPin="${tournamentPin}"`);
    
    if (providedPin === SUPER_PIN) {
      console.log(`Super PIN used to bypass PIN for tournament ${tournamentId}`);
      // Super PIN bypasses - continue with update
    } else if (tournamentPin !== providedPin) {
      console.log(`PIN verification failed for tournament ${tournamentId}: expected "${tournamentPin}", got "${providedPin}"`);
      return res.status(401).json({ error: 'Invalid PIN code' });
    }
  }
  
  // Handle new PIN setting (for old tournaments without PIN)
  let finalPin = tournamentPin;
  if (newPin && typeof newPin === 'string' && newPin.trim() !== '') {
    const newPinValue = newPin.trim();
    const pinRegex = /^\d{4}$/;
    
    if (!pinRegex.test(newPinValue)) {
      return res.status(400).json({ error: 'New PIN must be exactly 4 digits' });
    }
    
    // If tournament already has PIN, require verification before changing it
    // Super PIN "9999" bypasses this requirement
    const SUPER_PIN = '9999';
    if (hasExistingPin) {
      // Convert pin to string if it's a number
      const pinString = pin ? String(pin).trim() : '';
      const providedPin = pinString;
      if (!pinString || (providedPin !== SUPER_PIN && tournamentPin !== providedPin)) {
        return res.status(401).json({ error: 'Must verify existing PIN before changing it' });
      }
    }
    
    finalPin = newPinValue;
  }
  
  const tournaments = await getTournaments();
  const tournamentIndex = tournaments.findIndex((t: Tournament) => t.id === tournamentId);
  if (tournamentIndex === -1) {
    return res.status(404).json({ error: 'Tournament not found' });
  }
  
  tournaments[tournamentIndex] = {
    ...tournaments[tournamentIndex],
    name,
    month,
    year,
    pin: finalPin
  };
  Object.assign(tournament, { name, month, year, pin: finalPin });
  await databaseService.updateTournament({ 
    ...tournament, 
    name, 
    month, 
    year,
    pin: finalPin
  });
  res.json(tournament);
});

app.delete('/api/tournaments/:id', async (req, res) => {
  const tournamentId = req.params.id;
  const { pin } = req.body;
  
  const tournament = await getTournamentDetails(tournamentId);
  if (!tournament) {
    return res.status(404).json({ error: 'Tournament not found' });
  }
  
  const tournamentPin = (tournament.pin || '').trim();
  const hasExistingPin = tournamentPin && tournamentPin !== '';
  
  // If tournament has an existing PIN, require PIN verification
  if (hasExistingPin) {
    // Convert pin to string (handles both string and number types)
    const pinString = pin ? String(pin).trim() : '';
    if (!pinString || pinString === '') {
      return res.status(400).json({ error: 'PIN code is required to delete tournament' });
    }
    
    const providedPin = pinString;
    const pinRegex = /^\d{4}$/;
    
    if (!pinRegex.test(providedPin)) {
      return res.status(400).json({ error: 'PIN must be exactly 4 digits' });
    }
    
    // Super PIN "9999" bypasses all tournament PINs
    const SUPER_PIN = '9999';
    if (providedPin === SUPER_PIN) {
      console.log(`Super PIN used to bypass PIN for tournament ${tournamentId}`);
    } else if (tournamentPin !== providedPin) {
      console.log(`PIN verification failed for tournament ${tournamentId}: expected "${tournamentPin}", got "${providedPin}"`);
      return res.status(401).json({ error: 'Invalid PIN code' });
    }
  }
  // If tournament doesn't have PIN, allow deletion without PIN verification
  
  const tournaments = await getTournaments();
  const tournamentIndex = tournaments.findIndex((t: Tournament) => t.id === tournamentId);
  if (tournamentIndex === -1) {
    return res.status(404).json({ error: 'Tournament not found' });
  }
  tournaments.splice(tournamentIndex, 1);
  await databaseService.deleteTournament(tournamentId);
  res.json({ message: 'Tournament deleted successfully' });
});

app.delete('/api/tournaments', async (req, res) => {
  try {
    // Super PIN "9999" is required to delete all tournaments
    const SUPER_PIN = '9999';
    const { pin } = req.body;
    const providedPin = pin ? pin.trim() : '';
    
    if (!providedPin || providedPin !== SUPER_PIN) {
      return res.status(401).json({ error: 'Super PIN is required to delete all tournaments' });
    }
    
    const tournaments = await getTournaments();
    tournaments.length = 0;
    if (!USE_IN_MEMORY_STORAGE) {
      await databaseService.deleteAllTournaments();
    }
    res.json({ message: 'All tournaments deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete all tournaments' });
  }
});

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Handle 404 errors
app.use((req: express.Request, res: express.Response) => {
  res.status(404).json({ error: 'Not found' });
});

// Initialize database and start server
const startServer = async () => {
  try {
    if (!USE_IN_MEMORY_STORAGE) {
      await databaseService.initialize();
    }
    
    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer(); 