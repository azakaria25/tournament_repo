import { Router, Request, Response } from 'express';
import { pool } from '../db';

const router = Router();

// Delete a tournament
router.delete('/:id', async (req: Request, res: Response) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    
    // Check if tournament exists
    const tournamentResult = await client.query('SELECT * FROM tournaments WHERE id = $1', [id]);
    if (tournamentResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Tournament not found' });
    }

    // Check and delete tournament teams if they exist
    const teamsResult = await client.query('SELECT * FROM tournament_teams WHERE tournament_id = $1', [id]);
    if (teamsResult.rows.length > 0) {
      await client.query('DELETE FROM tournament_teams WHERE tournament_id = $1', [id]);
    }

    // Check and delete matches if they exist
    const matchesResult = await client.query('SELECT * FROM matches WHERE tournament_id = $1', [id]);
    if (matchesResult.rows.length > 0) {
      await client.query('DELETE FROM matches WHERE tournament_id = $1', [id]);
    }
    
    // Finally delete the tournament
    await client.query('DELETE FROM tournaments WHERE id = $1', [id]);
    
    await client.query('COMMIT');
    res.json({ 
      message: 'Tournament and all related data deleted successfully',
      deletedData: {
        tournament: tournamentResult.rows[0],
        teams: teamsResult.rows,
        matches: matchesResult.rows
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error deleting tournament:', error);
    res.status(500).json({ message: 'Error deleting tournament' });
  } finally {
    client.release();
  }
});

export default router; 