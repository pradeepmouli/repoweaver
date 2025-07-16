import { useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { bootstrapperService } from '../services';
import { updateProgress } from '../store/progressSlice';
import { MobileRepositoryConfig } from '../types';

export function useBootstrapper() {
  const dispatch = useDispatch();

  const createProject = useCallback(async (config: MobileRepositoryConfig) => {
    const result = await bootstrapperService.createProject(config, (progress) => {
      dispatch(updateProgress({ id: config.id, ...progress }));
    });
    return result;
  }, [dispatch]);

  const updateProject = useCallback(async (config: MobileRepositoryConfig) => {
    const result = await bootstrapperService.updateProject(config, (progress) => {
      dispatch(updateProgress({ id: config.id, ...progress }));
    });
    return result;
  }, [dispatch]);

  const validateTemplate = useCallback(async (url: string, branch?: string) => {
    return await bootstrapperService.validateTemplate(url, branch);
  }, []);

  const getRepositoryInfo = useCallback(async (url: string) => {
    return await bootstrapperService.getRepositoryInfo(url);
  }, []);

  return {
    createProject,
    updateProject,
    validateTemplate,
    getRepositoryInfo,
  };
}