"use client";
import React, { createContext, useContext, useEffect, useState } from "react";
import { User, onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { ref, get, set, onValue } from "firebase/database";
import { auth, googleProvider, database } from "@/lib/firebase";
import { useRouter } from "next/navigation";

export type UserRole = "tesoureiro" | "coordenador" | "usuario" | "usuario_area" | "adm_area" | "pendente" | "bloqueado" | null;

const activeRoles: Exclude<UserRole, null>[] = ["tesoureiro", "coordenador", "usuario", "usuario_area", "adm_area"];

interface AuthContextType {
  user: User | null;
  role: UserRole;
  loading: boolean;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: null,
  loading: true,
  loginWithGoogle: async () => {},
  logout: async () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
          const roleRef = ref(database, `roles/${currentUser.uid}`);
          const snapshot = await get(roleRef);
          const isAdmin = currentUser.email === "danielalvesdasilvasantos60@gmail.com";
          
          if (snapshot.exists()) {
            const currentRole = snapshot.val().role;
            if (isAdmin && currentRole !== "tesoureiro") {
              await set(roleRef, { email: currentUser.email, role: "tesoureiro" });
              setRole("tesoureiro");
              setUser(currentUser);
            } else if (currentRole === "pendente" || currentRole === "bloqueado") {
              await signOut(auth);
              setUser(null);
              setRole(null);
            } else {
              setRole(currentRole as UserRole);
              setUser(currentUser);
            }
          } else {
            const initialRole = isAdmin ? "tesoureiro" : "pendente";
            await set(roleRef, { email: currentUser.email, role: initialRole });
            if (initialRole === "pendente") {
              await signOut(auth);
              setUser(null);
              setRole(null);
            } else {
              setRole(initialRole);
              setUser(currentUser);
            }
          }
        } catch (error) {
          console.error("Erro ao buscar permissões:", error);
          setRole(null);
          setUser(null);
        }
      } else {
        setUser(null);
        setRole(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    const unsubscribe = onValue(ref(database, `roles/${user.uid}`), (snapshot) => {
      const currentRole = snapshot.val()?.role as UserRole;
      if (!currentRole || !activeRoles.includes(currentRole)) {
        void signOut(auth);
        return;
      }
      setRole(currentRole);
    }, (error) => {
      console.error("Erro ao acompanhar permissões:", error);
      void signOut(auth);
    });

    return () => unsubscribe();
  }, [user]);

  const loginWithGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const currentUser = result.user;
      const roleRef = ref(database, `roles/${currentUser.uid}`);
      const snapshot = await get(roleRef);
      const isAdmin = currentUser.email === "danielalvesdasilvasantos60@gmail.com";
      
      let finalRole = "";
      if (snapshot.exists()) {
        finalRole = snapshot.val().role;
        if (isAdmin && finalRole !== "tesoureiro") {
          await set(roleRef, { email: currentUser.email, role: "tesoureiro" });
          finalRole = "tesoureiro";
        }
      } else {
        finalRole = isAdmin ? "tesoureiro" : "pendente";
        await set(roleRef, { email: currentUser.email, role: finalRole });
      }

      if (finalRole === "pendente" || finalRole === "bloqueado") {
        await signOut(auth);
        throw new Error("ACCESS_DENIED");
      }

      router.push("/dashboard");
    } catch (error: unknown) {
      console.error("Erro no login com Google:", error);
      throw error;
    }
  };

  const logout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  return (
    <AuthContext.Provider value={{ user, role, loading, loginWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

