import { neon } from '@neondatabase/serverless';
import { Team, Match, Tournament, TournamentDetails } from '../types';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from the correct path
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Get database URL from environment
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL environment variable is not set');
}

// Create database connection
const sql = neon(databaseUrl);

export class DatabaseService {
  async initialize() {
    try {
      // Execute each CREATE TABLE statement separately
      await sql`CREATE TABLE IF NOT EXISTS teams (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        players TEXT[] NOT NULL
      )`;

      await sql`CREATE TABLE IF NOT EXISTS matches (
        id TEXT PRIMARY KEY,
        round INTEGER NOT NULL,
        team1_id TEXT REFERENCES teams(id),
        team2_id TEXT REFERENCES teams(id),
        winner_id TEXT REFERENCES teams(id),
        match_index INTEGER NOT NULL,
        tournament_id TEXT NOT NULL
      )`;

      await sql`CREATE TABLE IF NOT EXISTS tournaments (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        month TEXT NOT NULL,
        year TEXT NOT NULL,
        status TEXT NOT NULL
      )`;

      await sql`CREATE TABLE IF NOT EXISTS tournament_teams (
        tournament_id TEXT REFERENCES tournaments(id),
        team_id TEXT REFERENCES teams(id),
        PRIMARY KEY (tournament_id, team_id)
      )`;

      console.log('Database initialized successfully');
    } catch (error) {
      console.error('Error initializing database:', error);
      throw error;
    }
  }

  // Teams
  async getTeams(): Promise<Team[]> {
    const result = await sql`
      SELECT * FROM teams
    `;
    return result as Team[];
  }

  async createTeam(team: Team): Promise<Team> {
    await sql`
      INSERT INTO teams (id, name, players)
      VALUES (${team.id}, ${team.name}, ${team.players})
    `;
    return team;
  }

  async updateTeam(team: Team): Promise<Team> {
    await sql`
      UPDATE teams
      SET name = ${team.name}, players = ${team.players}
      WHERE id = ${team.id}
    `;
    return team;
  }

  async deleteTeam(id: string): Promise<void> {
    await sql`
      DELETE FROM teams WHERE id = ${id}
    `;
  }

  // Matches
  async getMatches(): Promise<Match[]> {
    const result = await sql`
      SELECT m.*, 
        t1.id as team1_id, t1.name as team1_name, t1.players as team1_players,
        t2.id as team2_id, t2.name as team2_name, t2.players as team2_players,
        w.id as winner_id, w.name as winner_name, w.players as winner_players
      FROM matches m
      LEFT JOIN teams t1 ON m.team1_id = t1.id
      LEFT JOIN teams t2 ON m.team2_id = t2.id
      LEFT JOIN teams w ON m.winner_id = w.id
    `;
    return result.map((m: any) => ({
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
  }

  async createMatch(match: Match, tournamentId: string): Promise<Match> {
    await sql`
      INSERT INTO matches (id, round, team1_id, team2_id, winner_id, match_index, tournament_id)
      VALUES (
        ${match.id},
        ${match.round},
        ${match.team1?.id},
        ${match.team2?.id},
        ${match.winner?.id},
        ${match.matchIndex},
        ${tournamentId}
      )
    `;
    return { ...match, tournamentId };
  }

  async updateMatch(match: Match): Promise<Match> {
    await sql`
      UPDATE matches
      SET team1_id = ${match.team1?.id},
          team2_id = ${match.team2?.id},
          winner_id = ${match.winner?.id}
      WHERE id = ${match.id}
    `;
    return match;
  }

  async deleteMatches(tournamentId: string): Promise<void> {
    await sql`
      DELETE FROM matches WHERE tournament_id = ${tournamentId}
    `;
  }

  // Tournaments
  async getTournaments(): Promise<Tournament[]> {
    const tournaments = await sql`
      SELECT * FROM tournaments
    `;

    // Get all teams and matches for all tournaments
    const teams = await sql`
      SELECT t.*, tt.tournament_id
      FROM teams t
      JOIN tournament_teams tt ON tt.team_id = t.id
    `;

    const matches = await this.getMatches();

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
  }

  async createTournament(tournament: Tournament): Promise<Tournament> {
    await sql`
      INSERT INTO tournaments (id, name, month, year, status)
      VALUES (${tournament.id}, ${tournament.name}, ${tournament.month}, ${tournament.year}, ${tournament.status})
    `;
    return tournament;
  }

  async updateTournament(tournament: Tournament): Promise<Tournament> {
    await sql`
      UPDATE tournaments
      SET name = ${tournament.name},
          month = ${tournament.month},
          year = ${tournament.year},
          status = ${tournament.status}
      WHERE id = ${tournament.id}
    `;
    return tournament;
  }

  async deleteTournament(id: string): Promise<void> {
    await sql`DELETE FROM tournament_teams WHERE tournament_id = ${id}`;
    await sql`DELETE FROM matches WHERE tournament_id = ${id}`;
    await sql`DELETE FROM tournaments WHERE id = ${id}`;
  }

  async getTournamentDetails(id: string): Promise<TournamentDetails | null> {
    const result = await sql`
      SELECT * FROM tournaments WHERE id = ${id}
    `;
    
    if (!result.length) return null;

    const tournament = result[0] as Tournament;
    
    const teams = await sql`
      SELECT t.*
      FROM teams t
      JOIN tournament_teams tt ON tt.team_id = t.id
      WHERE tt.tournament_id = ${id}
    `;

    const matches = await this.getMatches();

    return {
      ...tournament,
      teams: teams as Team[],
      matches: matches.filter(m => m.tournamentId === id)
    };
  }

  async addTeamToTournament(tournamentId: string, teamId: string): Promise<void> {
    await sql`
      INSERT INTO tournament_teams (tournament_id, team_id)
      VALUES (${tournamentId}, ${teamId})
    `;
  }

  async removeTeamFromTournament(tournamentId: string, teamId: string): Promise<void> {
    await sql`
      DELETE FROM tournament_teams
      WHERE tournament_id = ${tournamentId} AND team_id = ${teamId}
    `;
  }

  async deleteTournamentMatches(tournamentId: string): Promise<void> {
    await sql`
      DELETE FROM matches WHERE tournament_id = ${tournamentId}
    `;
  }

  async deleteAllTournaments(): Promise<void> {
    // Delete all related data first due to foreign key constraints
    await sql`DELETE FROM tournament_teams`;
    await sql`DELETE FROM matches`;
    await sql`DELETE FROM teams`;
    await sql`DELETE FROM tournaments`;
  }
} 