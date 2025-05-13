export interface Team {
  id: string;
  name: string;
  players: string[];
}

export interface Match {
  id: string;
  round: number;
  matchIndex: number;
  team1: Team | null;
  team2: Team | null;
  winner: Team | null;
}

export interface Tournament {
  id: string;
  name: string;
  date: string;
  teams: number;
  status: 'active' | 'completed' | 'upcoming';
} 