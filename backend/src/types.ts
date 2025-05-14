export interface Team {
  id: string;
  name: string;
  players: string[];
}

export interface Match {
  id: string;
  round: number;
  team1: Team | null;
  team2: Team | null;
  winner: Team | null;
  matchIndex: number;
}

export interface Tournament {
  id: string;
  name: string;
  month: string;
  year: string;
  teams: number;
  status: 'active' | 'completed' | 'upcoming';
}

export interface TournamentDetails {
  id: string;
  name: string;
  month: string;
  year: string;
  teams: Team[];
  matches: Match[];
  status: 'active' | 'completed' | 'upcoming';
} 