import React from 'react';
import { Hotel, ArrowRight, Bed, Users, CalendarDays, ShieldCheck } from 'lucide-react';

interface LandingProps {
  onLoginClick: () => void;
}

export default function Landing({ onLoginClick }: LandingProps) {
  console.log('Landing: Rendering...');
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f2ed', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <h1 style={{ fontSize: '3rem', marginBottom: '20px' }}>Welcome to Guesthouse Manager</h1>
      <button 
        onClick={onLoginClick}
        style={{ backgroundColor: '#5A5A40', color: 'white', padding: '15px 30px', borderRadius: '30px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
      >
        Get Started
      </button>
    </div>
  );
}
