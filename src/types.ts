export interface TemplateRepository {
  url: string;
  name: string;
  branch?: string;
  subDirectory?: string;
}

export interface RepositoryConfig {
  name: string;
  path: string;
  templates: TemplateRepository[];
  gitRemote?: string;
  excludePatterns?: string[];
  mergeStrategy?: 'overwrite' | 'merge' | 'skip-existing';
}

export interface BootstrapOptions {
  targetPath: string;
  templates: TemplateRepository[];
  repositoryName: string;
  initGit?: boolean;
  addRemote?: string;
  mergeStrategy?: 'overwrite' | 'merge' | 'skip-existing';
  excludePatterns?: string[];
}

export interface TemplateProcessingResult {
  success: boolean;
  template: TemplateRepository;
  filesProcessed: number;
  errors: string[];
  pullRequestNumber?: number;
}

export interface BootstrapResult {
  success: boolean;
  repositoryPath: string;
  templateResults: TemplateProcessingResult[];
  totalFilesProcessed: number;
  errors: string[];
}