import { Match, Team } from '../types';

export const createMatches = (teams: Team[], tournamentId: string): Match[] => {
  const matches: Match[] = [];
  const numTeams = teams.length;
  const numRounds = Math.ceil(Math.log2(numTeams));
  
  // Professional bracket seeding: Sort teams by weight (lower weight = higher seed)
  const sortedTeams = [...teams].sort((a, b) => {
    const weightA = a.weight ?? 5; // Default to 5 if not set
    const weightB = b.weight ?? 5;
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
      tournamentId,
      round: 1,
      matchIndex: i,
      team1: seededTeams[i * 2] || null,
      team2: seededTeams[i * 2 + 1] || null,
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