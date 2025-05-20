import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const useInMemoryStorage = process.env.USE_IN_MEMORY_STORAGE === 'true';

// In-memory storage
class InMemoryDB {
  private tournaments: Map<number, any> = new Map();
  private tournamentTeams: Map<number, any[]> = new Map();
  private matches: Map<number, any[]> = new Map();
  private nextId = 1;

  async query(text: string, params: any[] = []) {
    // Parse the SQL query to determine the operation
    const operation = text.trim().toLowerCase();
    
    if (operation.startsWith('select')) {
      return this.handleSelect(text, params);
    } else if (operation.startsWith('insert')) {
      return this.handleInsert(text, params);
    } else if (operation.startsWith('update')) {
      return this.handleUpdate(text, params);
    } else if (operation.startsWith('delete')) {
      return this.handleDelete(text, params);
    }
    
    throw new Error(`Unsupported operation: ${text}`);
  }

  private handleSelect(text: string, params: any[]) {
    if (text.includes('from tournaments')) {
      if (text.includes('where id =')) {
        // Handle single tournament retrieval
        const id = params[0];
        const tournament = this.tournaments.get(id);
        return { rows: tournament ? [tournament] : [] };
      }
      // Handle all tournaments retrieval
      return { rows: Array.from(this.tournaments.values()) };
    } else if (text.includes('from tournament_teams')) {
      const tournamentId = params[0];
      return { rows: this.tournamentTeams.get(tournamentId) || [] };
    } else if (text.includes('from matches')) {
      const tournamentId = params[0];
      return { rows: this.matches.get(tournamentId) || [] };
    }
    return { rows: [] };
  }

  private handleInsert(text: string, params: any[]) {
    if (text.includes('into tournaments')) {
      const id = this.nextId++;
      const tournament = { id, ...params[0] };
      this.tournaments.set(id, tournament);
      return { rows: [tournament] };
    } else if (text.includes('into tournament_teams')) {
      const tournamentId = params[0].tournament_id;
      const teams = this.tournamentTeams.get(tournamentId) || [];
      teams.push(params[0]);
      this.tournamentTeams.set(tournamentId, teams);
      return { rows: [params[0]] };
    } else if (text.includes('into matches')) {
      const tournamentId = params[0].tournament_id;
      const matches = this.matches.get(tournamentId) || [];
      matches.push(params[0]);
      this.matches.set(tournamentId, matches);
      return { rows: [params[0]] };
    }
    return { rows: [] };
  }

  private handleUpdate(text: string, params: any[]) {
    if (text.includes('tournaments')) {
      const id = params[0];
      const tournament = this.tournaments.get(id);
      if (tournament) {
        // Update tournament properties
        const updates = params[1];
        Object.assign(tournament, updates);
        return { rows: [tournament] };
      }
    } else if (text.includes('tournament_teams')) {
      const tournamentId = params[0];
      const teams = this.tournamentTeams.get(tournamentId) || [];
      const teamIndex = teams.findIndex(team => team.id === params[1].id);
      if (teamIndex !== -1) {
        teams[teamIndex] = { ...teams[teamIndex], ...params[1] };
        this.tournamentTeams.set(tournamentId, teams);
        return { rows: [teams[teamIndex]] };
      }
    } else if (text.includes('matches')) {
      const tournamentId = params[0];
      const matches = this.matches.get(tournamentId) || [];
      const matchIndex = matches.findIndex(match => match.id === params[1].id);
      if (matchIndex !== -1) {
        matches[matchIndex] = { ...matches[matchIndex], ...params[1] };
        this.matches.set(tournamentId, matches);
        return { rows: [matches[matchIndex]] };
      }
    }
    return { rows: [] };
  }

  private handleDelete(text: string, params: any[]) {
    if (text.includes('tournaments')) {
      const id = params[0];
      const tournament = this.tournaments.get(id);
      if (tournament) {
        // Delete all related data first
        this.tournamentTeams.delete(id);
        this.matches.delete(id);
        // Then delete the tournament
        this.tournaments.delete(id);
        return { rows: [tournament] };
      }
    } else if (text.includes('tournament_teams')) {
      const tournamentId = params[0];
      const teams = this.tournamentTeams.get(tournamentId) || [];
      if (params[1]) {
        // Delete specific team
        const teamId = params[1];
        const updatedTeams = teams.filter(team => team.id !== teamId);
        this.tournamentTeams.set(tournamentId, updatedTeams);
        return { rows: [] };
      } else {
        // Delete all teams for tournament
        this.tournamentTeams.delete(tournamentId);
        return { rows: [] };
      }
    } else if (text.includes('matches')) {
      const tournamentId = params[0];
      const matches = this.matches.get(tournamentId) || [];
      if (params[1]) {
        // Delete specific match
        const matchId = params[1];
        const updatedMatches = matches.filter(match => match.id !== matchId);
        this.matches.set(tournamentId, updatedMatches);
        return { rows: [] };
      } else {
        // Delete all matches for tournament
        this.matches.delete(tournamentId);
        return { rows: [] };
      }
    }
    return { rows: [] };
  }

  async connect() {
    return this;
  }

  async release() {
    // Nothing to release for in-memory storage
  }
}

// Create either a real PostgreSQL pool or an in-memory database
const pool = useInMemoryStorage 
  ? new InMemoryDB()
  : new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false
      }
    });

export { pool }; 