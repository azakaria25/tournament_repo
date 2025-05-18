import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useParams } from 'react-router-dom';
import './App.css';
import TournamentSetup from './components/TournamentSetup';
import TournamentsList from './components/TournamentsList';
import TournamentManagement from './components/TournamentManagement';

interface Team {
  id: string;
  name: string;
  players: string[];
}

interface Match {
  id: string;
  round: number;
  team1: Team | null;
  team2: Team | null;
  winner: Team | null;
  matchIndex: number;
}

interface Tournament {
  id: string;
  name: string;
  month: string;
  year: string;
  teams: Team[];
  matches: Match[];
  status: 'active' | 'completed' | 'upcoming';
}

function App() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [showSetup, setShowSetup] = useState(false);

  useEffect(() => {
    fetchTournaments();
    updateTournamentStatuses();
  }, []);

  const fetchTournaments = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/tournaments');
      if (!response.ok) {
        throw new Error('Failed to fetch tournaments');
      }
      const data = await response.json();
      setTournaments(data);
    } catch (error) {
      console.error('Error fetching tournaments:', error);
    }
  };

  const updateTournamentStatuses = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/tournaments/update-statuses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error('Failed to update tournament statuses');
      }

      const updatedTournaments = await response.json();
      setTournaments(updatedTournaments);
    } catch (error) {
      console.error('Error updating tournament statuses:', error);
    }
  };

  const handleTournamentSetup = async (name: string, month: string, year: string) => {
    try {
      console.log('Creating tournament with:', { name, month, year });
      const response = await fetch('http://localhost:5000/api/tournaments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, month, year }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Server error:', errorData);
        throw new Error(errorData.error || 'Failed to create tournament');
      }

      const newTournament = await response.json();
      console.log('Tournament created:', newTournament);
      
      // Update all tournament statuses after creating a new tournament
      const statusResponse = await fetch('http://localhost:5000/api/tournaments/update-statuses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!statusResponse.ok) {
        throw new Error('Failed to update tournament statuses');
      }

      const updatedTournaments = await statusResponse.json();
      setTournaments(updatedTournaments);
      setShowSetup(false);
    } catch (error) {
      console.error('Error creating tournament:', error);
      alert(error instanceof Error ? error.message : 'Failed to create tournament. Please try again.');
    }
  };

  return (
    <Router>
      <div className="app">
        <header className="header">
          <div className="header-content">
            <div className="logo-container">
              <img src="https://www.thiqah.sa/media/qv0drq0w/logo.png" alt="THIQAH Logo" className="logo" />
            </div>
            <div className="header-text">
              <h1>THIQAH Tournament Management</h1>
            </div>
          </div>
        </header>

        <Routes>
          <Route path="/" element={
            <div className="container">
              <TournamentsList 
                tournaments={tournaments} 
                onCreateNew={() => setShowSetup(true)}
                onTournamentUpdate={fetchTournaments}
              />
              {showSetup && (
                <div className="modal-overlay">
                  <div className="modal-content">
                    <TournamentSetup onSubmit={handleTournamentSetup} onBack={() => setShowSetup(false)} />
                  </div>
                </div>
              )}
            </div>
          } />
          <Route path="/tournament/:id" element={<TournamentManagementWrapper tournaments={tournaments} setTournaments={setTournaments} />} />
        </Routes>
        <footer className="app-footer">
          <p>TDMs CONNECT</p>
        </footer>
      </div>
    </Router>
  );
}

function TournamentManagementWrapper({ tournaments, setTournaments }: { tournaments: Tournament[], setTournaments: (tournaments: Tournament[]) => void }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTournament = async () => {
      try {
        const response = await fetch(`http://localhost:5000/api/tournaments/${id}`);
        if (!response.ok) {
          throw new Error('Failed to fetch tournament');
        }
        const data = await response.json();
        setTournament(data);
      } catch (error) {
        console.error('Error fetching tournament:', error);
        alert('Failed to load tournament. Please try again.');
        navigate('/');
      } finally {
        setLoading(false);
      }
    };

    fetchTournament();
  }, [id, navigate]);

  const handleBack = async () => {
    try {
      // Fetch updated tournaments list before navigating back
      const response = await fetch('http://localhost:5000/api/tournaments');
      if (!response.ok) {
        throw new Error('Failed to fetch tournaments');
      }
      const updatedTournaments = await response.json();
      // Update the tournaments list in the parent component
      setTournaments(updatedTournaments);
    } catch (error) {
      console.error('Error fetching tournaments:', error);
    }
    navigate('/');
  };

  if (loading) {
    return <div className="loading">Loading tournament...</div>;
  }

  if (!tournament) {
    return <div>Tournament not found</div>;
  }

  return (
    <TournamentManagement 
      tournament={tournament} 
      onBack={handleBack} 
    />
  );
}

export default App;
