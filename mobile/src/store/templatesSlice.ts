import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { MobileTemplateRepository } from '../types';

interface TemplatesState {
  templates: MobileTemplateRepository[];
  loading: boolean;
  error: string | null;
}

const initialState: TemplatesState = {
  templates: [
    {
      id: '1',
      url: 'https://github.com/facebook/react-native.git',
      name: 'React Native Template',
      branch: 'main',
      description: 'Official React Native template'
    },
    {
      id: '2',
      url: 'https://github.com/expo/expo.git',
      name: 'Expo Template',
      branch: 'main',
      subDirectory: 'templates/expo-template-blank',
      description: 'Expo blank template'
    }
  ],
  loading: false,
  error: null,
};

export const templatesSlice = createSlice({
  name: 'templates',
  initialState,
  reducers: {
    addTemplate: (state, action: PayloadAction<MobileTemplateRepository>) => {
      state.templates.push(action.payload);
    },
    updateTemplate: (state, action: PayloadAction<MobileTemplateRepository>) => {
      const index = state.templates.findIndex(t => t.id === action.payload.id);
      if (index !== -1) {
        state.templates[index] = action.payload;
      }
    },
    removeTemplate: (state, action: PayloadAction<string>) => {
      state.templates = state.templates.filter(t => t.id !== action.payload);
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
  },
});

export const { addTemplate, updateTemplate, removeTemplate, setLoading, setError } = templatesSlice.actions;