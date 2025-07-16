import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  Card,
  Title,
  TextInput,
  Button,
  Checkbox,
  List,
  Chip,
  IconButton,
  SegmentedButtons,
  Switch,
  Divider,
} from 'react-native-paper';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../store';
import { addProject } from '../store/projectsSlice';
import { startProject } from '../store/progressSlice';
import { MobileRepositoryConfig, MobileTemplateRepository } from '../types';

export function CreateProjectScreen() {
  const dispatch = useDispatch();
  const availableTemplates = useSelector((state: RootState) => state.templates.templates);
  
  const [projectName, setProjectName] = useState('');
  const [projectPath, setProjectPath] = useState('');
  const [gitRemote, setGitRemote] = useState('');
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>([]);
  const [mergeStrategy, setMergeStrategy] = useState<'overwrite' | 'merge' | 'skip-existing'>('merge');
  const [initGit, setInitGit] = useState(true);
  const [excludePatterns, setExcludePatterns] = useState<string[]>(['.git/**', 'node_modules/**']);
  const [newExcludePattern, setNewExcludePattern] = useState('');

  const handleTemplateToggle = (templateId: string) => {
    setSelectedTemplates(prev =>
      prev.includes(templateId)
        ? prev.filter(id => id !== templateId)
        : [...prev, templateId]
    );
  };

  const handleAddExcludePattern = () => {
    if (newExcludePattern.trim() && !excludePatterns.includes(newExcludePattern.trim())) {
      setExcludePatterns([...excludePatterns, newExcludePattern.trim()]);
      setNewExcludePattern('');
    }
  };

  const handleRemoveExcludePattern = (pattern: string) => {
    setExcludePatterns(excludePatterns.filter(p => p !== pattern));
  };

  const handleCreateProject = () => {
    const selectedTemplateObjects = availableTemplates.filter(t => 
      selectedTemplates.includes(t.id)
    );

    const newProject: MobileRepositoryConfig = {
      id: Date.now().toString(),
      name: projectName,
      path: projectPath,
      templates: selectedTemplateObjects,
      gitRemote: gitRemote || undefined,
      excludePatterns,
      mergeStrategy,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    dispatch(addProject(newProject));
    
    // Start the project creation process
    dispatch(startProject({
      id: newProject.id,
      name: projectName,
      status: 'pending',
      progress: 0,
      currentStep: 'Initializing project',
      totalSteps: selectedTemplateObjects.length + (initGit ? 1 : 0),
      errors: [],
    }));

    // Reset form
    setProjectName('');
    setProjectPath('');
    setGitRemote('');
    setSelectedTemplates([]);
    setExcludePatterns(['.git/**', 'node_modules/**']);
  };

  const isFormValid = projectName.trim() && projectPath.trim() && selectedTemplates.length > 0;

  return (
    <ScrollView style={styles.container}>
      <Card style={styles.card}>
        <Card.Content>
          <Title>Project Details</Title>
          
          <TextInput
            label="Project Name"
            value={projectName}
            onChangeText={setProjectName}
            style={styles.input}
            mode="outlined"
          />
          
          <TextInput
            label="Project Path"
            value={projectPath}
            onChangeText={setProjectPath}
            style={styles.input}
            mode="outlined"
            placeholder="/path/to/your/project"
          />
          
          <TextInput
            label="Git Remote (optional)"
            value={gitRemote}
            onChangeText={setGitRemote}
            style={styles.input}
            mode="outlined"
            placeholder="https://github.com/user/repo.git"
          />
          
          <View style={styles.switchContainer}>
            <Title style={styles.switchLabel}>Initialize Git Repository</Title>
            <Switch value={initGit} onValueChange={setInitGit} />
          </View>
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Title>Select Templates</Title>
          {availableTemplates.map((template) => (
            <List.Item
              key={template.id}
              title={template.name}
              description={template.url}
              left={() => (
                <Checkbox
                  status={selectedTemplates.includes(template.id) ? 'checked' : 'unchecked'}
                  onPress={() => handleTemplateToggle(template.id)}
                />
              )}
              onPress={() => handleTemplateToggle(template.id)}
            />
          ))}
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Title>Merge Strategy</Title>
          <SegmentedButtons
            value={mergeStrategy}
            onValueChange={(value) => setMergeStrategy(value as typeof mergeStrategy)}
            buttons={[
              { value: 'merge', label: 'Merge' },
              { value: 'overwrite', label: 'Overwrite' },
              { value: 'skip-existing', label: 'Skip' },
            ]}
            style={styles.segmentedButtons}
          />
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Title>Exclude Patterns</Title>
          
          <View style={styles.addPatternContainer}>
            <TextInput
              label="Add exclude pattern"
              value={newExcludePattern}
              onChangeText={setNewExcludePattern}
              style={styles.patternInput}
              mode="outlined"
              placeholder="*.log, temp/**, etc."
            />
            <IconButton
              icon="plus"
              mode="contained"
              onPress={handleAddExcludePattern}
              disabled={!newExcludePattern.trim()}
            />
          </View>
          
          <View style={styles.patternsContainer}>
            {excludePatterns.map((pattern, index) => (
              <Chip
                key={index}
                mode="outlined"
                onClose={() => handleRemoveExcludePattern(pattern)}
                style={styles.patternChip}
              >
                {pattern}
              </Chip>
            ))}
          </View>
        </Card.Content>
      </Card>

      <View style={styles.buttonContainer}>
        <Button
          mode="contained"
          onPress={handleCreateProject}
          disabled={!isFormValid}
          style={styles.createButton}
          contentStyle={styles.createButtonContent}
        >
          Create Project
        </Button>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  card: {
    marginBottom: 16,
  },
  input: {
    marginBottom: 16,
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  switchLabel: {
    fontSize: 16,
  },
  segmentedButtons: {
    marginTop: 8,
  },
  addPatternContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 16,
  },
  patternInput: {
    flex: 1,
    marginRight: 8,
  },
  patternsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  patternChip: {
    marginRight: 8,
    marginBottom: 8,
  },
  buttonContainer: {
    marginBottom: 32,
  },
  createButton: {
    marginTop: 16,
  },
  createButtonContent: {
    paddingVertical: 8,
  },
});