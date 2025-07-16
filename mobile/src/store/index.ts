import { configureStore } from '@reduxjs/toolkit';
import { templatesSlice } from './templatesSlice';
import { projectsSlice } from './projectsSlice';
import { progressSlice } from './progressSlice';

export const store = configureStore({
  reducer: {
    templates: templatesSlice.reducer,
    projects: projectsSlice.reducer,
    progress: progressSlice.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST'],
      },
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;