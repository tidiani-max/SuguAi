"use client";
import { useState, useEffect } from "react";
import Cookies from "js-cookie";
import { authApi } from "@/lib/api";
import { Business } from "@/types";

export function useAuth() {
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = Cookies.get("access_token");
    if (!token) {
      setLoading(false);
      return;
    }
    authApi.me()
      .then((res) => setBusiness(res.data))
      .catch(() => {
        Cookies.remove("access_token");
      })
      .finally(() => setLoading(false));
  }, []);

  const login = (token: string, biz: Business) => {
    Cookies.set("access_token", token, { expires: 1 }); // 1 day
    setBusiness(biz);
  };

  const logout = () => {
    Cookies.remove("access_token");
    setBusiness(null);
    window.location.href = "/login";
  };

  return { business, loading, login, logout };
}