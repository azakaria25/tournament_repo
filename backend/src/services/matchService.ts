import { Match, Team } from '../types';

export const createMatches = (teams: Team[], tournamentId: string): Match[] => {
  const matches: Match[] = [];
  const numTeams = teams.length;
  const numRounds = Math.ceil(Math.log2(numTeams));
  
  // Shuffle teams for random seeding
  const shuffledTeams = shuffleArray(teams);
  
  // Create first round matches
  const firstRoundMatches = Math.ceil(numTeams / 2);
  for (let i = 0; i < firstRoundMatches; i++) {
    matches.push({
      id: `${tournamentId}-match-1-${i}`,
      tournamentId,
      round: 1,
      matchIndex: i,
      team1: shuffledTeams[i * 2] || null,
      team2: shuffledTeams[i * 2 + 1] || null,
      winner: null,
    });
  }
  
  // Create empty matches for subsequent rounds
  for (let round = 2; round <= numRounds; round++) {
    const matchesInRound = Math.ceil(firstRoundMatches / Math.pow(2, round - 1));
    for (let i = 0; i < matchesInRound; i++) {
      matches.push({
        id: `${tournamentId}-match-${round}-${i}`,
        tournamentId,
        round,
        matchIndex: i,
        team1: null,
        team2: null,
        winner: null,
      });
    }
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
  if (nextRound > Math.ceil(Math.log2(matches.length))) {
    return updatedMatches; // This was the final match
  }
  
  // Calculate the next match index using binary tree traversal
  // In a single elimination bracket, each match's winner goes to a specific position in the next round
  const nextMatchIndex = Math.floor(currentMatch.matchIndex / 2);
  const nextMatch = updatedMatches.find(m => 
    m.round === nextRound && 
    m.matchIndex === nextMatchIndex
  );
  
  if (nextMatch && winner) {
    // In a single elimination bracket, the position in the next round is determined by the match index
    // Even indices go to team1, odd indices go to team2
    if (currentMatch.matchIndex % 2 === 0) {
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