import React, { useState, useEffect } from 'react';
import TournamentForm from './TournamentForm';
import './TournamentList.css';

interface Tournament {
  id: number;
  name: string;
  month: string;
}

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const TournamentList: React.FC = () => {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingTournament, setEditingTournament] = useState<Tournament | null>(null);
  const [showForm, setShowForm] = useState(false);

  const fetchTournaments = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`${API_URL}/api/tournaments`);
      if (!response.ok) {
        throw new Error('Failed to fetch tournaments');
      }
      const data = await response.json();
      setTournaments(data);
    } catch (error) {
      console.error('Error fetching tournaments:', error);
      alert('Failed to load tournaments');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTournaments();
  }, []);

  const handleCreateTournament = async (tournamentData: { name: string; month: string }) => {
    try {
      setIsSubmitting(true);
      const response = await fetch(`${API_URL}/api/tournaments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(tournamentData),
      });

      if (!response.ok) {
        throw new Error('Failed to create tournament');
      }

      const newTournament = await response.json();
      setTournaments([...tournaments, newTournament]);
      setShowForm(false);
    } catch (error) {
      console.error('Error creating tournament:', error);
      alert('Failed to create tournament');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditTournament = async (tournamentData: { name: string; month: string }) => {
    if (!editingTournament) return;

    try {
      setIsSubmitting(true);
      const response = await fetch(`${API_URL}/api/tournaments/${editingTournament.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(tournamentData),
      });

      if (!response.ok) {
        throw new Error('Failed to update tournament');
      }

      const updatedTournament = await response.json();
      setTournaments(tournaments.map(t => 
        t.id === updatedTournament.id ? updatedTournament : t
      ));
      setEditingTournament(null);
      setShowForm(false);
    } catch (error) {
      console.error('Error updating tournament:', error);
      alert('Failed to update tournament');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTournament = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this tournament?')) {
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await fetch(`${API_URL}/api/tournaments/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete tournament');
      }

      setTournaments(tournaments.filter(t => t.id !== id));
    } catch (error) {
      console.error('Error deleting tournament:', error);
      alert('Failed to delete tournament');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleViewTournament = (id: number) => {
    window.location.href = `/tournament/${id}`;
  };

  return (
    <div className="tournament-list">
      <h1>Tournaments</h1>
      
      {showForm ? (
        <div className="form-container">
          <TournamentForm
            onSubmit={editingTournament ? handleEditTournament : handleCreateTournament}
            initialData={editingTournament || undefined}
            isSubmitting={isSubmitting}
          />
          <button 
            className="cancel-button"
            onClick={() => {
              setShowForm(false);
              setEditingTournament(null);
            }}
            disabled={isSubmitting}
          >
            Cancel
          </button>
        </div>
      ) : (
        <button 
          className="create-button"
          onClick={() => setShowForm(true)}
          disabled={isSubmitting}
        >
          Create New Tournament
        </button>
      )}

      {isLoading ? (
        <div className="loading">
          <div className="loading-spinner" />
          <div className="loading-text">Loading tournaments...</div>
        </div>
      ) : (
        <div className="tournaments-grid">
          {tournaments.map(tournament => (
            <div key={tournament.id} className="tournament-card">
              <h3>{tournament.name}</h3>
              <p>Month: {tournament.month}</p>
              <div className="tournament-actions">
                <button
                  onClick={() => {
                    setEditingTournament(tournament);
                    setShowForm(true);
                  }}
                  disabled={isSubmitting}
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDeleteTournament(tournament.id)}
                  disabled={isSubmitting}
                  className="delete-button"
                >
                  Delete
                </button>
                <button
                  onClick={() => handleViewTournament(tournament.id)}
                  disabled={isSubmitting}
                >
                  View
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TournamentList; 