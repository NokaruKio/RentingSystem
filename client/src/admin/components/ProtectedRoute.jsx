// client/src/admin/components/ProtectedRoute.jsx
import React, { useEffect, useState } from 'react';
import { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import { AdminContext } from './AdminContext';
import axios from 'axios';

function ProtectedRoute({ children }) {
  const { admin, ready } = useContext(AdminContext);
  
  if (!ready) {
    return <div>Loading...</div>;
  }

  // Check if the user is not an admin
  if (!admin && window.location.pathname !== '/profile-visit') {
    return <Navigate to="/admin/login" />;
  }

  // If the user is an admin, allow access to the route
  return children;
}

export default ProtectedRoute;