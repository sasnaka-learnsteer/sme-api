// src/components/AdminDashboard.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import '../styles/admin.css';

const AdminDashboard = () => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const navigate = useNavigate();
    const [candidates, setCandidates] = useState([]);
    const [panelMember, setPanelMember] = useState(null);



    useEffect(() => {
        const fetchDashboard = async () => {
            const token = localStorage.getItem('adminToken');

            if (!token) {
                navigate('/admin/login');
                return;
            }

            try {
                const res = await axios.get('/api/admin/dashboard', {
                    headers: { Authorization: `Bearer ${token}` }
                });

                setPanelMember(res.data.panelMember);
                setCandidates(res.data.assignedCandidates || []);
            } catch (err) {
                console.error('Error fetching dashboard data:', err);
                setError('Failed to load dashboard data. Please try again.');
                if (err.response?.status === 401) {
                    localStorage.removeItem('adminToken');
                    localStorage.removeItem('userRole');
                    navigate('/admin/login');
                }
            } finally {
                setLoading(false);
            }
        };

        fetchDashboard();
    }, [navigate]);

    const handleLogout = () => {
        localStorage.removeItem('adminToken');
        localStorage.removeItem('userRole');
        navigate('/admin/login');
    };

    if (loading) return <div className="loading">Loading dashboard...</div>;
    if (error) return <div className="error-container">{error}</div>;

    return (
        <div className="admin-dashboard">
            <div className="dashboard-header">
                <h2>Admin Panel Dashboard</h2>
                <div className="panel-info">
                    <p>Panel ID: {panelMember?.panelId}</p>
                    <p>Name: {panelMember?.name || 'N/A'}</p>
                    <button onClick={handleLogout} className="btn-logout">Logout</button>
                </div>
            </div>

            <div className="dashboard-content">
                <h2>Your Assigned Candidates</h2>

                {candidates.length === 0 ? (
                    <p className="no-candidates">No candidates assigned yet.</p>
                ) : (
                    <div className="candidate-cards">
                        {candidates.map(candidate => (
                            <div key={candidate._id} className="candidate-card">
                                <h3>{candidate.fullName}</h3>
                                <p><strong>NIC:</strong> {candidate.NIC}</p>
                                <p><strong>Email:</strong> {candidate.email}</p>
                                <p><strong>Phone:</strong> {candidate.phone}</p>
                                <p><strong>Status:</strong> {candidate.status || 'Pending Review'}</p>
                                <button
                                    className="btn-view-details"
                                    onClick={() => navigate(`/admin/candidate/${candidate._id}`)}
                                >
                                    View Full Details
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminDashboard;