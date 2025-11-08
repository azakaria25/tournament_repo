export interface Team {
  id: string;
  name: string;
  players: string[];
  weight: number; // Weight/seed for tournament bracket (1-5, lower = higher seed, max 1 decimal)
}

export interface Match {
  id: string;
  round: number;
  team1: Team | null;
  team2: Team | null;
  winner: Team | null;
  matchIndex: number;
  tournamentId: string;
  courtNumber?: string; // Court number for the match
  matchTime?: string; // Time for the match (e.g., "14:30" or "2:30 PM")
}

export interface Tournament {
  id: string;
  name: string;
  month: string;
  year: string;
  teams: Team[];
  matches: Match[];
  status: 'active' | 'completed' | 'upcoming';
  pin: string; // 4-digit PIN code
}

export interface TournamentDetails {
  id: string;
  name: string;
  month: string;
  year: string;
  teams: Team[];
  matches: Match[];
  status: 'active' | 'completed' | 'upcoming';
  pin: string; // 4-digit PIN code
} 