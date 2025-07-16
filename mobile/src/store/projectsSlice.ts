import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { MobileRepositoryConfig } from '../types';

interface ProjectsState {
  projects: MobileRepositoryConfig[];
  loading: boolean;
  error: string | null;
}

const initialState: ProjectsState = {
  projects: [],
  loading: false,
  error: null,
};

export const projectsSlice = createSlice({
  name: 'projects',
  initialState,
  reducers: {
    addProject: (state, action: PayloadAction<MobileRepositoryConfig>) => {
      state.projects.push(action.payload);
    },
    updateProject: (state, action: PayloadAction<MobileRepositoryConfig>) => {
      const index = state.projects.findIndex(p => p.id === action.payload.id);
      if (index !== -1) {
        state.projects[index] = action.payload;
      }
    },
    removeProject: (state, action: PayloadAction<string>) => {
      state.projects = state.projects.filter(p => p.id !== action.payload);
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
  },
});

export const { addProject, updateProject, removeProject, setLoading, setError } = projectsSlice.actions;