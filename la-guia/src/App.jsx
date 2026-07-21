import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { UserPreferencesProvider } from './context/UserPreferencesContext.jsx';

// Welcome is the landing page — keep it eager so it paints on first load.
// (Its one heavy dependency, the WebGL IntroGate/three.js, is lazy-loaded
// inside Welcome itself.)
import Welcome from './pages/auth/Welcome.jsx';

// Everything else is code-split: the other auth pages, and — crucially — the
// entire authenticated app (all data providers + all route pages) so a
// logged-out visitor on the landing page never downloads any of it.
const SignUp = lazy(() => import('./pages/auth/SignUp.jsx'));
const LogIn = lazy(() => import('./pages/auth/LogIn.jsx'));
const ResetPassword = lazy(() => import('./pages/auth/ResetPassword.jsx'));
const UpdatePassword = lazy(() => import('./pages/auth/UpdatePassword.jsx'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy.jsx'));
const TermsOfService = lazy(() => import('./pages/TermsOfService.jsx'));
const AuthenticatedApp = lazy(() => import('./AuthenticatedApp.jsx'));

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return null;
  if (!user) return <Navigate to="/welcome" state={{ from: location }} replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <UserPreferencesProvider>
        <BrowserRouter>
          <Suspense fallback={null}>
            <Routes>
              <Route path="/welcome" element={<Welcome />} />
              <Route path="/signup" element={<SignUp />} />
              <Route path="/login" element={<LogIn />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/update-password" element={<UpdatePassword />} />
              <Route path="/privacy" element={<PrivacyPolicy />} />
              <Route path="/terms" element={<TermsOfService />} />
              <Route path="/*" element={
                <ProtectedRoute>
                  <AuthenticatedApp />
                </ProtectedRoute>
              } />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </UserPreferencesProvider>
    </AuthProvider>
  );
}
