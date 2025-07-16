import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { ProjectProgress } from '../types';

interface ProgressState {
  activeProjects: ProjectProgress[];
}

const initialState: ProgressState = {
  activeProjects: [],
};

export const progressSlice = createSlice({
  name: 'progress',
  initialState,
  reducers: {
    startProject: (state, action: PayloadAction<ProjectProgress>) => {
      state.activeProjects.push(action.payload);
    },
    updateProgress: (state, action: PayloadAction<Partial<ProjectProgress> & { id: string }>) => {
      const index = state.activeProjects.findIndex(p => p.id === action.payload.id);
      if (index !== -1) {
        state.activeProjects[index] = { ...state.activeProjects[index], ...action.payload };
      }
    },
    completeProject: (state, action: PayloadAction<string>) => {
      state.activeProjects = state.activeProjects.filter(p => p.id !== action.payload);
    },
  },
});

export const { startProject, updateProgress, completeProject } = progressSlice.actions;