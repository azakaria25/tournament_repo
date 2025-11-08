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
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../db");
const router = (0, express_1.Router)();
// Delete a tournament
router.delete('/:id', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const client = yield db_1.pool.connect();
    try {
        yield client.query('BEGIN');
        const { id } = req.params;
        // Check if tournament exists
        const tournamentResult = yield client.query('SELECT * FROM tournaments WHERE id = $1', [id]);
        if (tournamentResult.rows.length === 0) {
            yield client.query('ROLLBACK');
            return res.status(404).json({ message: 'Tournament not found' });
        }
        // Check and delete tournament teams if they exist
        const teamsResult = yield client.query('SELECT * FROM tournament_teams WHERE tournament_id = $1', [id]);
        if (teamsResult.rows.length > 0) {
            yield client.query('DELETE FROM tournament_teams WHERE tournament_id = $1', [id]);
        }
        // Check and delete matches if they exist
        const matchesResult = yield client.query('SELECT * FROM matches WHERE tournament_id = $1', [id]);
        if (matchesResult.rows.length > 0) {
            yield client.query('DELETE FROM matches WHERE tournament_id = $1', [id]);
        }
        // Finally delete the tournament
        yield client.query('DELETE FROM tournaments WHERE id = $1', [id]);
        yield client.query('COMMIT');
        res.json({
            message: 'Tournament and all related data deleted successfully',
            deletedData: {
                tournament: tournamentResult.rows[0],
                teams: teamsResult.rows,
                matches: matchesResult.rows
            }
        });
    }
    catch (error) {
        yield client.query('ROLLBACK');
        console.error('Error deleting tournament:', error);
        res.status(500).json({ message: 'Error deleting tournament' });
    }
    finally {
        client.release();
    }
}));
exports.default = router;
