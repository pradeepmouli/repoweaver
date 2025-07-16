export interface MobileTemplateRepository {
	id: string;
	url: string;
	name: string;
	branch?: string;
	subDirectory?: string;
	description?: string;
}

export interface MobileRepositoryConfig {
	id: string;
	name: string;
	path: string;
	templates: MobileTemplateRepository[];
	gitRemote?: string;
	excludePatterns: string[];
	mergeStrategy: 'overwrite' | 'merge' | 'skip';
	createdAt: Date;
	updatedAt: Date;
}

export interface ProjectProgress {
	id: string;
	name: string;
	status: 'pending' | 'in-progress' | 'completed' | 'error';
	progress: number;
	currentStep: string;
	totalSteps: number;
	errors: string[];
}

export type RootStackParamList = {
	Home: undefined;
	Templates: undefined;
	CreateProject: undefined;
	ProjectProgress: { projectId: string };
	Settings: undefined;
	TemplateDetail: { templateId: string };
};
