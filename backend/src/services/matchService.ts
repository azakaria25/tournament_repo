import { Match, Team } from '../types';

export const createMatches = (teams: Team[]): Match[] => {
  const matches: Match[] = [];
  let round = 1;
  let currentTeams = [...teams];
  
  // Shuffle teams for random matchups
  currentTeams = shuffleArray(currentTeams);
  
  while (currentTeams.length > 1) {
    const roundMatches: Match[] = [];
    const matchCount = Math.ceil(currentTeams.length / 2);
    
    for (let i = 0; i < matchCount; i++) {
      const team1 = currentTeams[i * 2];
      const team2 = currentTeams[i * 2 + 1];
      
      roundMatches.push({
        id: `match-${round}-${i}`,
        round,
        matchIndex: i,
        team1: team1 || null,
        team2: team2 || null,
        winner: null,
      });
    }
    
    matches.push(...roundMatches);
    currentTeams = new Array(Math.ceil(currentTeams.length / 2)).fill(null);
    round++;
  }
  
  return matches;
};

export const advanceWinner = (matches: Match[], matchId: string, winnerId: string): Match[] => {
  const updatedMatches = [...matches];
  const currentMatch = updatedMatches.find(m => m.id === matchId);
  
  if (!currentMatch) return matches;
  
  // Update current match winner
  const winner = currentMatch.team1?.id === winnerId ? currentMatch.team1 : currentMatch.team2;
  currentMatch.winner = winner;
  
  // Find next match
  const nextRound = currentMatch.round + 1;
  const nextMatchIndex = Math.floor(currentMatch.matchIndex / 2);
  const nextMatch = updatedMatches.find(m => 
    m.round === nextRound && 
    m.matchIndex === nextMatchIndex
  );
  
  if (nextMatch && winner) {
    // Determine if winner should be team1 or team2 in next match
    const isTeam1Slot = currentMatch.matchIndex % 2 === 0;
    
    if (isTeam1Slot) {
      nextMatch.team1 = winner;
    } else {
      nextMatch.team2 = winner;
    }
  }
  
  return updatedMatches;
};

// Helper function to shuffle array
function shuffleArray<T>(array: T[]): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
} 