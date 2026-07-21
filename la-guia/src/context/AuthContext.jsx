import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check active sessions and sets the user
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for changes on auth state (login, signout, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email, password, brandName) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    
    if (data.user && brandName) {
      // Check if a default brand was already created by the DB trigger
      const { data: existingBrands } = await supabase
        .from('brands')
        .select('id')
        .eq('user_id', data.user.id);

      if (existingBrands && existingBrands.length > 0) {
        // Update the default brand's name to match what the user typed
        await supabase
          .from('brands')
          .update({ name: brandName })
          .eq('id', existingBrands[0].id);
      } else {
        // Fallback: create the brand if the DB trigger didn't run
        const { error: brandError } = await supabase
          .from('brands')
          .insert([{ user_id: data.user.id, name: brandName }]);
        if (brandError) throw brandError;
      }
    }
    return data;
  };

  const logIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  };

  const signInWithGoogle = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/`,
      },
    });
    if (error) throw error;
    return data;
  };

  const logOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const resetPassword = async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      // When they click the link in their email, route them here
      redirectTo: `${window.location.origin}/update-password`,
    });
    if (error) throw error;
  };

  const updatePassword = async (newPassword) => {
    // Supabase auth client automatically picks up the secure token from the URL 
    // when redirected from the email, allowing us to safely call updateUser.
    const { data, error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
    return data;
  };

  return (
    <AuthContext.Provider value={{ user, signUp, logIn, signInWithGoogle, logOut, resetPassword, updatePassword, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}