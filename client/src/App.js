import React from "react";
import "./App.css";

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Profile from './components/Profile';
import AdminDashboard from "./components/AdminDashboard";
import AdminLogin from "./components/AdminLogin";

function App() {
    return (
        <Router>
            <div className="app-container">
                <Routes>
                    {/* Candidate Routes */}
                    <Route path="/login" element={<Login />} />
                    <Route path="/profile" element={<Profile />} />

                    {/* Admin Routes */}
                    <Route path="/admin/login" element={<AdminLogin />} />
                    <Route path="/admin/dashboard" element={<AdminDashboard />} />

                    {/* Admin redirect */}
                    <Route path="/admin" element={<Navigate to="/admin/login" />} />
                </Routes>
            </div>
        </Router>
    );
}

export default App;
