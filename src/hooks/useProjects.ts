import { useState, useEffect } from "react";
import { ref, onValue, push, set, remove, update } from "firebase/database";
import { database } from "@/lib/firebase";

export interface ProjectEntry {
  id: string;
  description: string;
  amount: number;
  type: "income" | "expense";
  createdAt: number;
  createdByEmail: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  status: "Aberto" | "Pendente_Aprovacao" | "Processado";
  entries: Record<string, ProjectEntry>;
  createdAt: number;
  createdByEmail: string;
  projectionBaselineCents?: number;
  lastReopenedAt?: number;
  lastReopenedBy?: string;
  lastReopenReason?: string;
}

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const projectsRef = ref(database, 'projects');
    const unsubscribe = onValue(projectsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const parsedData = Object.keys(data).map(key => ({
          ...data[key],
          id: key,
          entries: data[key].entries || {}
        })) as Project[];
        setProjects(parsedData.sort((a, b) => b.createdAt - a.createdAt));
      } else {
        setProjects([]);
      }
      setLoading(false);
    }, (error) => {
      console.error("Firebase fetch error:", error);
      setLoading(false);
    });

    const timer = setTimeout(() => setLoading(false), 2000);

    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, []);

  const createProject = async (name: string, description: string, createdByEmail: string) => {
    try {
      const projectsRef = ref(database, 'projects');
      const newRef = push(projectsRef);
      await set(newRef, {
        name,
        description,
        status: "Aberto",
        createdAt: Date.now(),
        createdByEmail,
        entries: {}
      });
    } catch (error) {
      console.error("Erro ao criar projeto:", error);
      throw error;
    }
  };

  const deleteProject = async (id: string) => {
    try {
      await remove(ref(database, `projects/${id}`));
    } catch (error) {
      console.error("Erro ao excluir projeto:", error);
      throw error;
    }
  };

  const updateProjectStatus = async (id: string, status: "Aberto" | "Pendente_Aprovacao" | "Processado") => {
    try {
      await update(ref(database, `projects/${id}`), { status });
    } catch (error) {
      console.error("Erro ao atualizar status do projeto:", error);
      throw error;
    }
  };

  const addProjectEntry = async (projectId: string, entry: Omit<ProjectEntry, 'id'>) => {
    try {
      const entriesRef = ref(database, `projects/${projectId}/entries`);
      const newEntryRef = push(entriesRef);
      await set(newEntryRef, entry);
    } catch (error) {
      console.error("Erro ao adicionar entrada no projeto:", error);
      throw error;
    }
  };

  const deleteProjectEntry = async (projectId: string, entryId: string) => {
    try {
      await remove(ref(database, `projects/${projectId}/entries/${entryId}`));
    } catch (error) {
      console.error("Erro ao excluir entrada do projeto:", error);
      throw error;
    }
  };

  return { 
    projects, 
    loading, 
    createProject, 
    deleteProject, 
    updateProjectStatus, 
    addProjectEntry, 
    deleteProjectEntry 
  };
}
