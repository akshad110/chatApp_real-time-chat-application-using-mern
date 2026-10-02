import { createContext, useContext, useState, useEffect } from "react";

import api from "../config/api";

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

function errorMessage(error, fallback) {
  return error.response?.data?.message || fallback;
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function register(email, password) {
    try {
      const res = await api.post("/auth/register", { email, password });
      localStorage.setItem("token", res.data.token);
      setCurrentUser(res.data.user);
    } catch (error) {
      throw new Error(errorMessage(error, "Failed to register"));
    }
  }

  async function login(email, password) {
    try {
      const res = await api.post("/auth/login", { email, password });
      localStorage.setItem("token", res.data.token);
      setCurrentUser(res.data.user);
    } catch (error) {
      throw new Error(errorMessage(error, "Failed to login"));
    }
  }

  function logout() {
    localStorage.removeItem("token");
    setCurrentUser(null);
  }

  async function updateUserProfile(profile) {
    try {
      const res = await api.put("/user/profile", profile);
      setCurrentUser(res.data);
      return res.data;
    } catch (error) {
      throw new Error(errorMessage(error, "Failed to update profile"));
    }
  }

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) {
      setLoading(false);
      return;
    }

    api
      .get("/user/me")
      .then((res) => setCurrentUser(res.data))
      .catch(() => {
        localStorage.removeItem("token");
        setCurrentUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const value = {
    currentUser,
    error,
    setError,
    login,
    register,
    logout,
    updateUserProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
