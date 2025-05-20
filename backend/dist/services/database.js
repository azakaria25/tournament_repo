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
exports.DatabaseService = void 0;
const serverless_1 = require("@neondatabase/serverless");
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
// Load environment variables from the correct path
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../../.env') });
// Get database URL from environment
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is not set');
}
// Create database connection
const sql = (0, serverless_1.neon)(databaseUrl);
class DatabaseService {
    initialize() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Execute each CREATE TABLE statement separately
                yield sql `CREATE TABLE IF NOT EXISTS teams (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        players TEXT[] NOT NULL
      )`;
                yield sql `CREATE TABLE IF NOT EXISTS matches (
        id TEXT PRIMARY KEY,
        round INTEGER NOT NULL,
        team1_id TEXT REFERENCES teams(id),
        team2_id TEXT REFERENCES teams(id),
        winner_id TEXT REFERENCES teams(id),
        match_index INTEGER NOT NULL,
        tournament_id TEXT NOT NULL
      )`;
                yield sql `CREATE TABLE IF NOT EXISTS tournaments (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        month TEXT NOT NULL,
        year TEXT NOT NULL,
        status TEXT NOT NULL
      )`;
                yield sql `CREATE TABLE IF NOT EXISTS tournament_teams (
        tournament_id TEXT REFERENCES tournaments(id),
        team_id TEXT REFERENCES teams(id),
        PRIMARY KEY (tournament_id, team_id)
      )`;
                console.log('Database initialized successfully');
            }
            catch (error) {
                console.error('Error initializing database:', error);
                throw error;
            }
        });
    }
    // Teams
    getTeams() {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield sql `
      SELECT * FROM teams
    `;
            return result;
        });
    }
    createTeam(team) {
        return __awaiter(this, void 0, void 0, function* () {
            yield sql `
      INSERT INTO teams (id, name, players)
      VALUES (${team.id}, ${team.name}, ${team.players})
    `;
            return team;
        });
    }
    updateTeam(team) {
        return __awaiter(this, void 0, void 0, function* () {
            yield sql `
      UPDATE teams
      SET name = ${team.name}, players = ${team.players}
      WHERE id = ${team.id}
    `;
            return team;
        });
    }
    deleteTeam(id) {
        return __awaiter(this, void 0, void 0, function* () {
            yield sql `
      DELETE FROM teams WHERE id = ${id}
    `;
        });
    }
    // Matches
    getMatches() {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield sql `
      SELECT m.*, 
        t1.id as team1_id, t1.name as team1_name, t1.players as team1_players,
        t2.id as team2_id, t2.name as team2_name, t2.players as team2_players,
        w.id as winner_id, w.name as winner_name, w.players as winner_players
      FROM matches m
      LEFT JOIN teams t1 ON m.team1_id = t1.id
      LEFT JOIN teams t2 ON m.team2_id = t2.id
      LEFT JOIN teams w ON m.winner_id = w.id
    `;
            return result.map((m) => ({
                id: m.id,
                round: m.round,
                team1: m.team1_id ? {
                    id: m.team1_id,
                    name: m.team1_name,
                    players: m.team1_players
                } : null,
                team2: m.team2_id ? {
                    id: m.team2_id,
                    name: m.team2_name,
                    players: m.team2_players
                } : null,
                winner: m.winner_id ? {
                    id: m.winner_id,
                    name: m.winner_name,
                    players: m.winner_players
                } : null,
                matchIndex: m.match_index,
                tournamentId: m.tournament_id
            }));
        });
    }
    createMatch(match, tournamentId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            yield sql `
      INSERT INTO matches (id, round, team1_id, team2_id, winner_id, match_index, tournament_id)
      VALUES (
        ${match.id},
        ${match.round},
        ${(_a = match.team1) === null || _a === void 0 ? void 0 : _a.id},
        ${(_b = match.team2) === null || _b === void 0 ? void 0 : _b.id},
        ${(_c = match.winner) === null || _c === void 0 ? void 0 : _c.id},
        ${match.matchIndex},
        ${tournamentId}
      )
    `;
            return Object.assign(Object.assign({}, match), { tournamentId });
        });
    }
    updateMatch(match) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            yield sql `
      UPDATE matches
      SET team1_id = ${(_a = match.team1) === null || _a === void 0 ? void 0 : _a.id},
          team2_id = ${(_b = match.team2) === null || _b === void 0 ? void 0 : _b.id},
          winner_id = ${(_c = match.winner) === null || _c === void 0 ? void 0 : _c.id}
      WHERE id = ${match.id}
    `;
            return match;
        });
    }
    deleteMatches(tournamentId) {
        return __awaiter(this, void 0, void 0, function* () {
            yield sql `
      DELETE FROM matches WHERE tournament_id = ${tournamentId}
    `;
        });
    }
    // Tournaments
    getTournaments() {
        return __awaiter(this, void 0, void 0, function* () {
            const tournaments = yield sql `
      SELECT * FROM tournaments
    `;
            // Get all teams and matches for all tournaments
            const teams = yield sql `
      SELECT t.*, tt.tournament_id
      FROM teams t
      JOIN tournament_teams tt ON tt.team_id = t.id
    `;
            const matches = yield this.getMatches();
            // Map teams and matches to their respective tournaments
            return tournaments.map(tournament => ({
                id: tournament.id,
                name: tournament.name,
                month: tournament.month,
                year: tournament.year,
                status: tournament.status,
                teams: teams
                    .filter(team => team.tournament_id === tournament.id)
                    .map(team => ({
                    id: team.id,
                    name: team.name,
                    players: team.players
                })),
                matches: matches.filter(match => match.tournamentId === tournament.id)
            }));
        });
    }
    createTournament(tournament) {
        return __awaiter(this, void 0, void 0, function* () {
            yield sql `
      INSERT INTO tournaments (id, name, month, year, status)
      VALUES (${tournament.id}, ${tournament.name}, ${tournament.month}, ${tournament.year}, ${tournament.status})
    `;
            return tournament;
        });
    }
    updateTournament(tournament) {
        return __awaiter(this, void 0, void 0, function* () {
            yield sql `
      UPDATE tournaments
      SET name = ${tournament.name},
          month = ${tournament.month},
          year = ${tournament.year},
          status = ${tournament.status}
      WHERE id = ${tournament.id}
    `;
            return tournament;
        });
    }
    deleteTournament(id) {
        return __awaiter(this, void 0, void 0, function* () {
            yield sql `DELETE FROM tournament_teams WHERE tournament_id = ${id}`;
            yield sql `DELETE FROM matches WHERE tournament_id = ${id}`;
            yield sql `DELETE FROM tournaments WHERE id = ${id}`;
        });
    }
    getTournamentDetails(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield sql `
      SELECT * FROM tournaments WHERE id = ${id}
    `;
            if (!result.length)
                return null;
            const tournament = result[0];
            const teams = yield sql `
      SELECT t.*
      FROM teams t
      JOIN tournament_teams tt ON tt.team_id = t.id
      WHERE tt.tournament_id = ${id}
    `;
            const matches = yield this.getMatches();
            return Object.assign(Object.assign({}, tournament), { teams: teams, matches: matches.filter(m => m.tournamentId === id) });
        });
    }
    addTeamToTournament(tournamentId, teamId) {
        return __awaiter(this, void 0, void 0, function* () {
            yield sql `
      INSERT INTO tournament_teams (tournament_id, team_id)
      VALUES (${tournamentId}, ${teamId})
    `;
        });
    }
    removeTeamFromTournament(tournamentId, teamId) {
        return __awaiter(this, void 0, void 0, function* () {
            yield sql `
      DELETE FROM tournament_teams
      WHERE tournament_id = ${tournamentId} AND team_id = ${teamId}
    `;
        });
    }
    deleteTournamentMatches(tournamentId) {
        return __awaiter(this, void 0, void 0, function* () {
            yield sql `
      DELETE FROM matches WHERE tournament_id = ${tournamentId}
    `;
        });
    }
    deleteAllTournaments() {
        return __awaiter(this, void 0, void 0, function* () {
            // Implementation needed
        });
    }
}
exports.DatabaseService = DatabaseService;
