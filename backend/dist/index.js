"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const database_1 = require("./services/database");
const path_1 = __importDefault(require("path"));
// Load environment variables
const envPath = path_1.default.resolve(__dirname, '../.env');
console.log('Loading environment variables from:', envPath);
dotenv_1.default.config({ path: envPath });
// Verify DATABASE_URL is set
if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL environment variable is not set');
    process.exit(1);
}
const app = (0, express_1.default)();
const port = process.env.PORT || 3001;
// Feature flags
const USE_IN_MEMORY_STORAGE = false;
// Initialize database service
const databaseService = new database_1.DatabaseService();
// Enable CORS for all routes
app.use((0, cors_1.default)({
    origin: ['https://thiqah-padel-tournament.vercel.app', 'http://localhost:3000'],
    credentials: true
}));
app.use(express_1.default.json());
// In-memory storage (replace with database in production)
let teams = [];
let matches = [];
let tournaments = [];
let tournamentDetails = {};
// Initialize storage based on feature flag
const storage = USE_IN_MEMORY_STORAGE ? {
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
const getTeams = () => __awaiter(void 0, void 0, void 0, function* () {
    if (USE_IN_MEMORY_STORAGE) {
        return getStorage().teams;
    }
    return yield databaseService.getTeams();
});
const getMatches = () => __awaiter(void 0, void 0, void 0, function* () {
    if (USE_IN_MEMORY_STORAGE) {
        return getStorage().matches;
    }
    return yield databaseService.getMatches();
});
const getTournaments = () => __awaiter(void 0, void 0, void 0, function* () {
    if (USE_IN_MEMORY_STORAGE) {
        return getStorage().tournaments;
    }
    return yield databaseService.getTournaments();
});
const getTournamentDetails = (id) => __awaiter(void 0, void 0, void 0, function* () {
    if (USE_IN_MEMORY_STORAGE) {
        return getStorage().tournamentDetails[id];
    }
    return yield databaseService.getTournamentDetails(id);
});
// Routes
app.get('/api/teams', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    res.json(yield getTeams());
}));
app.post('/api/teams', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { name, players } = req.body;
    const newTeam = {
        id: Date.now().toString(),
        name,
        players,
    };
    if (USE_IN_MEMORY_STORAGE) {
        const teams = yield getTeams();
        teams.push(newTeam);
    }
    else {
        yield databaseService.createTeam(newTeam);
    }
    res.status(201).json(newTeam);
}));
app.put('/api/teams/:id', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const { name, players } = req.body;
    if (USE_IN_MEMORY_STORAGE) {
        const teams = yield getTeams();
        const teamIndex = teams.findIndex(team => team.id === id);
        if (teamIndex === -1) {
            return res.status(404).json({ error: 'Team not found' });
        }
        // Update team
        teams[teamIndex] = Object.assign(Object.assign({}, teams[teamIndex]), { name,
            players });
        // Update team in any existing matches
        const matches = yield getMatches();
        matches.forEach(match => {
            var _a, _b, _c;
            if (((_a = match.team1) === null || _a === void 0 ? void 0 : _a.id) === id) {
                match.team1 = teams[teamIndex];
            }
            if (((_b = match.team2) === null || _b === void 0 ? void 0 : _b.id) === id) {
                match.team2 = teams[teamIndex];
            }
            if (((_c = match.winner) === null || _c === void 0 ? void 0 : _c.id) === id) {
                match.winner = teams[teamIndex];
            }
        });
        res.json(teams[teamIndex]);
    }
    else {
        const updatedTeam = {
            id,
            name,
            players,
        };
        yield databaseService.updateTeam(updatedTeam);
        res.json(updatedTeam);
    }
}));
app.delete('/api/teams/:id', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    if (USE_IN_MEMORY_STORAGE) {
        const teams = yield getTeams();
        const teamIndex = teams.findIndex((team) => team.id === id);
        if (teamIndex === -1) {
            return res.status(404).json({ error: 'Team not found' });
        }
        // Remove team from teams array
        teams.splice(teamIndex, 1);
        // Clear all matches when a team is deleted
        const matches = yield getMatches();
        matches.length = 0;
    }
    else {
        try {
            // First, get all tournaments that have this team
            const tournaments = yield getTournaments();
            const affectedTournaments = tournaments.filter(t => t.teams.some(team => team.id === id));
            // Delete the team
            yield databaseService.deleteTeam(id);
            // For each affected tournament, delete matches and restart
            for (const tournament of affectedTournaments) {
                const tournamentDetails = yield getTournamentDetails(tournament.id);
                if (!tournamentDetails)
                    continue;
                // Always delete existing matches
                yield databaseService.deleteMatches(tournament.id);
                // Only restart if there are at least 2 teams
                if (tournamentDetails.teams.length >= 2) {
                    // Create new matches
                    const matches = createMatches(tournamentDetails.teams, tournament.id);
                    // Save new matches to database
                    for (const match of matches) {
                        yield databaseService.createMatch(match, tournament.id);
                    }
                    // Update tournament status to active
                    yield databaseService.updateTournament(Object.assign(Object.assign({}, tournamentDetails), { status: 'active' }));
                }
                else {
                    // If not enough teams, update status to upcoming
                    yield databaseService.updateTournament(Object.assign(Object.assign({}, tournamentDetails), { status: 'upcoming' }));
                }
            }
        }
        catch (error) {
            console.error('Error deleting team:', error);
            return res.status(500).json({ error: 'Failed to delete team' });
        }
    }
    res.status(200).json({ message: 'Team deleted successfully' });
}));
app.post('/api/tournaments/:id/start', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const tournamentId = req.params.id;
    try {
        const tournament = yield getTournamentDetails(tournamentId);
        if (!tournament) {
            return res.status(404).json({ error: 'Tournament not found' });
        }
        if (tournament.teams.length < 2) {
            return res.status(400).json({ error: 'Need at least 2 teams to start a tournament' });
        }
        // Delete all existing matches for this tournament
        if (USE_IN_MEMORY_STORAGE) {
            tournament.matches = [];
        }
        else {
            yield databaseService.deleteTournamentMatches(tournamentId);
        }
        // Create new matches for the tournament
        const matches = createMatches(tournament.teams, tournamentId);
        tournament.matches = matches;
        tournament.status = 'active';
        if (USE_IN_MEMORY_STORAGE) {
            const tournaments = yield getTournaments();
            const tournamentIndex = tournaments.findIndex((t) => t.id === tournamentId);
            if (tournamentIndex !== -1) {
                tournaments[tournamentIndex].status = 'active';
                tournaments[tournamentIndex].matches = matches;
            }
        }
        else {
            // Update tournament status first
            yield databaseService.updateTournament(tournament);
            // Then create all matches
            for (const match of matches) {
                try {
                    yield databaseService.createMatch(match, tournamentId);
                }
                catch (error) {
                    console.error('Error creating match:', error);
                    // If match creation fails, clean up by deleting all matches
                    yield databaseService.deleteTournamentMatches(tournamentId);
                    throw new Error('Failed to create tournament matches');
                }
            }
        }
        res.json(tournament);
    }
    catch (error) {
        console.error('Error starting tournament:', error);
        res.status(500).json({ error: 'Failed to start tournament' });
    }
}));
app.get('/api/matches', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    res.json(yield getMatches());
}));
app.post('/api/matches/:matchId/winner', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { matchId } = req.params;
    const { winnerId, tournamentId } = req.body;
    const tournament = yield getTournamentDetails(tournamentId);
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
    // Get all matches in the current round and sort them by matchIndex
    const currentRoundMatches = tournament.matches
        .filter(m => m.round === currentRound)
        .sort((a, b) => a.matchIndex - b.matchIndex);
    const currentMatchIndex = currentRoundMatches.findIndex(m => m.id === matchId);
    // Get all matches in the next round and sort them by matchIndex
    const nextRoundMatches = tournament.matches
        .filter(m => m.round === nextRound)
        .sort((a, b) => a.matchIndex - b.matchIndex);
    // Calculate the next match index based on the current match's position
    // This ensures winners go to the nearest match in the next round
    const nextMatchIndex = Math.floor(currentMatchIndex / 2);
    const nextMatch = nextRoundMatches[nextMatchIndex];
    if (nextMatch) {
        // Determine if winner should be team1 or team2 in next match
        // For matches in the first half of the current round, winner goes to team1
        // For matches in the second half of the current round, winner goes to team2
        const isTeam1Slot = currentMatchIndex < currentRoundMatches.length / 2;
        // Only update if the slot is empty or if we're updating the same team
        if (isTeam1Slot) {
            if (!nextMatch.team1 || nextMatch.team1.id === winner.id) {
                nextMatch.team1 = winner;
            }
        }
        else {
            if (!nextMatch.team2 || nextMatch.team2.id === winner.id) {
                nextMatch.team2 = winner;
            }
        }
    }
    // Check if tournament is completed
    const isCompleted = tournament.matches.every(m => m.winner);
    if (isCompleted) {
        tournament.status = 'completed';
        if (USE_IN_MEMORY_STORAGE) {
            // Update tournament status in the tournaments list
            const tournaments = yield getTournaments();
            const tournamentIndex = tournaments.findIndex((t) => t.id === tournamentId);
            if (tournamentIndex !== -1) {
                tournaments[tournamentIndex].status = 'completed';
            }
        }
        else {
            yield databaseService.updateTournament(tournament);
        }
    }
    if (!USE_IN_MEMORY_STORAGE) {
        yield databaseService.updateMatch(match);
        if (nextMatch) {
            yield databaseService.updateMatch(nextMatch);
        }
    }
    res.json(tournament.matches);
}));
app.post('/api/teams/clear', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if (!USE_IN_MEMORY_STORAGE) {
        return res.status(501).json({ error: 'In-memory storage is disabled' });
    }
    const teams = yield getTeams();
    const matches = yield getMatches();
    teams.length = 0; // Clear all teams
    matches.length = 0; // Clear matches as well since they depend on teams
    res.json({ message: 'All teams cleared successfully' });
}));
app.post('/api/matches/clear', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if (!USE_IN_MEMORY_STORAGE) {
        return res.status(501).json({ error: 'In-memory storage is disabled' });
    }
    const matches = yield getMatches();
    matches.length = 0; // Clear only matches
    res.json({ message: 'Tournament bracket cleared successfully' });
}));
// Tournament routes
app.get('/api/tournaments', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    res.json(yield getTournaments());
}));
app.post('/api/tournaments', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { name, month, year } = req.body;
    if (!name || !month || !year) {
        return res.status(400).json({ error: 'Name, month, and year are required' });
    }
    const newTournament = {
        id: Date.now().toString(),
        name,
        month,
        year,
        teams: [],
        matches: [],
        status: 'upcoming'
    };
    if (USE_IN_MEMORY_STORAGE) {
        const tournaments = yield getTournaments();
        tournaments.push(newTournament);
        const details = yield getTournamentDetails(newTournament.id);
        if (details) {
            details.teams = [];
            details.matches = [];
        }
    }
    else {
        yield databaseService.createTournament(newTournament);
    }
    res.status(201).json(newTournament);
}));
app.get('/api/tournaments/:id', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const tournamentId = req.params.id;
    const details = yield getTournamentDetails(tournamentId);
    if (!details) {
        return res.status(404).json({ error: 'Tournament not found' });
    }
    res.json(details);
}));
app.get('/api/tournaments/:id/teams', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const tournamentId = req.params.id;
    const tournament = yield getTournamentDetails(tournamentId);
    if (!tournament) {
        return res.status(404).json({ error: 'Tournament not found' });
    }
    res.json(tournament.teams);
}));
app.get('/api/tournaments/:id/matches', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const tournament = yield getTournamentDetails(id);
    if (!tournament) {
        return res.status(404).json({ error: 'Tournament not found' });
    }
    res.json(tournament.matches);
}));
app.post('/api/tournaments/:id/teams', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const tournamentId = req.params.id;
        const tournament = yield getTournamentDetails(tournamentId);
        if (!tournament) {
            return res.status(404).json({ error: 'Tournament not found' });
        }
        const { teamId } = req.body;
        const teams = yield getTeams();
        const team = teams.find((t) => t.id === teamId);
        if (!team) {
            return res.status(404).json({ error: 'Team not found' });
        }
        if (tournament.teams.some((t) => t.id === teamId)) {
            return res.status(400).json({ error: 'Team already in tournament' });
        }
        if (USE_IN_MEMORY_STORAGE) {
            tournament.teams.push(team);
            const tournaments = yield getTournaments();
            const tournamentIndex = tournaments.findIndex((t) => t.id === tournamentId);
            if (tournamentIndex !== -1) {
                tournaments[tournamentIndex].teams = tournament.teams;
            }
        }
        else {
            yield databaseService.addTeamToTournament(tournamentId, teamId);
        }
        const updatedTournament = yield getTournamentDetails(tournamentId);
        res.json(updatedTournament);
    }
    catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
}));
app.delete('/api/tournaments/:id/teams/:teamId', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const tournamentId = req.params.id;
        const teamId = req.params.teamId;
        const tournament = yield getTournamentDetails(tournamentId);
        if (!tournament) {
            return res.status(404).json({ error: 'Tournament not found' });
        }
        const teamIndex = tournament.teams.findIndex((t) => t.id === teamId);
        if (teamIndex === -1) {
            return res.status(404).json({ error: 'Team not found in tournament' });
        }
        if (USE_IN_MEMORY_STORAGE) {
            tournament.teams.splice(teamIndex, 1);
            const tournaments = yield getTournaments();
            const tournamentIndex = tournaments.findIndex((t) => t.id === tournamentId);
            if (tournamentIndex !== -1) {
                tournaments[tournamentIndex].teams = tournament.teams;
            }
        }
        else {
            // Remove team from tournament
            yield databaseService.removeTeamFromTournament(tournamentId, teamId);
            // Delete all existing matches for this tournament
            yield databaseService.deleteMatches(tournamentId);
            // Get updated tournament details after team removal
            const updatedTournament = yield getTournamentDetails(tournamentId);
            // If there are enough teams, regenerate matches
            if (updatedTournament && updatedTournament.teams.length >= 2) {
                // Create new matches
                const matches = createMatches(updatedTournament.teams, tournamentId);
                // Save new matches to database
                for (const match of matches) {
                    yield databaseService.createMatch(match, tournamentId);
                }
                // Update tournament status to active
                yield databaseService.updateTournament(Object.assign(Object.assign({}, updatedTournament), { status: 'active' }));
            }
            else if (updatedTournament) {
                // If not enough teams, update status to upcoming
                yield databaseService.updateTournament(Object.assign(Object.assign({}, updatedTournament), { status: 'upcoming' }));
            }
        }
        const updatedTournament = yield getTournamentDetails(tournamentId);
        res.json(updatedTournament);
    }
    catch (error) {
        console.error('Error deleting team:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}));
app.put('/api/tournaments/:id/status', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const tournamentId = req.params.id;
        const { status } = req.body;
        const tournament = yield getTournamentDetails(tournamentId);
        if (!tournament) {
            return res.status(404).json({ error: 'Tournament not found' });
        }
        if (!['active', 'completed', 'upcoming'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }
        if (USE_IN_MEMORY_STORAGE) {
            tournament.status = status;
            const tournaments = yield getTournaments();
            const tournamentIndex = tournaments.findIndex((t) => t.id === tournamentId);
            if (tournamentIndex !== -1) {
                tournaments[tournamentIndex].status = status;
            }
        }
        else {
            yield databaseService.updateTournament(Object.assign(Object.assign({}, tournament), { status }));
        }
        res.json(tournament);
    }
    catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
}));
function createMatches(teams, tournamentId) {
    const matches = [];
    // Calculate number of rounds needed
    const numTeams = teams.length;
    const numRounds = Math.ceil(Math.log2(numTeams));
    // Shuffle teams for random seeding
    const shuffledTeams = [...teams].sort(() => Math.random() - 0.5);
    // Create first round matches
    const firstRoundMatches = Math.ceil(numTeams / 2);
    for (let i = 0; i < firstRoundMatches; i++) {
        matches.push({
            id: `${tournamentId}-match-1-${i}`,
            round: 1,
            matchIndex: i,
            team1: shuffledTeams[i * 2],
            team2: shuffledTeams[i * 2 + 1] || null,
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
app.post('/api/tournaments/update-statuses', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const currentDate = new Date();
    const currentMonth = currentDate.toLocaleString('default', { month: 'long' }).toLowerCase();
    const currentYear = currentDate.getFullYear().toString();
    // Get month index (0-11) for comparison
    const getMonthIndex = (month) => {
        const months = ['january', 'february', 'march', 'april', 'may', 'june',
            'july', 'august', 'september', 'october', 'november', 'december'];
        return months.indexOf(month.toLowerCase());
    };
    const currentMonthIndex = getMonthIndex(currentMonth);
    // Update tournament statuses
    const tournaments = yield getTournaments();
    for (const tournament of tournaments) {
        const tournamentMonthIndex = getMonthIndex(tournament.month);
        const tournamentYear = parseInt(tournament.year);
        const currentYearNum = parseInt(currentYear);
        let newStatus;
        if (tournamentYear < currentYearNum) {
            newStatus = 'completed';
        }
        else if (tournamentYear > currentYearNum) {
            newStatus = 'upcoming';
        }
        else {
            if (tournamentMonthIndex < currentMonthIndex) {
                newStatus = 'completed';
            }
            else if (tournamentMonthIndex > currentMonthIndex) {
                newStatus = 'upcoming';
            }
            else {
                newStatus = 'active';
            }
        }
        tournament.status = newStatus;
        yield databaseService.updateTournament(tournament);
    }
    res.json(tournaments);
}));
app.put('/api/tournaments/:id', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const tournamentId = req.params.id;
    const { name, month, year } = req.body;
    if (!name || !month || !year) {
        return res.status(400).json({ error: 'Name, month, and year are required' });
    }
    const tournaments = yield getTournaments();
    const tournamentIndex = tournaments.findIndex((t) => t.id === tournamentId);
    if (tournamentIndex === -1) {
        return res.status(404).json({ error: 'Tournament not found' });
    }
    const tournament = yield getTournamentDetails(tournamentId);
    if (!tournament) {
        return res.status(404).json({ error: 'Tournament details not found' });
    }
    tournaments[tournamentIndex] = Object.assign(Object.assign({}, tournaments[tournamentIndex]), { name,
        month,
        year });
    Object.assign(tournament, { name, month, year });
    yield databaseService.updateTournament(Object.assign(Object.assign({}, tournament), { name, month, year }));
    res.json(tournament);
}));
app.delete('/api/tournaments/:id', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const tournamentId = req.params.id;
    const tournaments = yield getTournaments();
    const tournamentIndex = tournaments.findIndex((t) => t.id === tournamentId);
    if (tournamentIndex === -1) {
        return res.status(404).json({ error: 'Tournament not found' });
    }
    tournaments.splice(tournamentIndex, 1);
    yield databaseService.deleteTournament(tournamentId);
    res.json({ message: 'Tournament deleted successfully' });
}));
app.delete('/api/tournaments', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const tournaments = yield getTournaments();
        tournaments.length = 0;
        // Optionally, you can clear all tournaments from the database as well
        // await databaseService.deleteAllTournaments();
        res.json({ message: 'All tournaments deleted successfully' });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to delete all tournaments' });
    }
}));
// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
});
// Handle 404 errors
app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});
// Initialize database and start server
const startServer = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!USE_IN_MEMORY_STORAGE) {
            yield databaseService.initialize();
        }
        app.listen(port, () => {
            console.log(`Server running on port ${port}`);
        });
    }
    catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
});
startServer();
