import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  Card,
  Title,
  Paragraph,
  ProgressBar,
  List,
  Chip,
  Button,
  IconButton,
} from 'react-native-paper';
import { useSelector, useDispatch } from 'react-redux';
import { RouteProp, useRoute } from '@react-navigation/native';
import { RootState } from '../store';
import { completeProject } from '../store/progressSlice';
import { RootStackParamList } from '../types';

type ProjectProgressRouteProp = RouteProp<RootStackParamList, 'ProjectProgress'>;

export function ProjectProgressScreen() {
  const route = useRoute<ProjectProgressRouteProp>();
  const dispatch = useDispatch();
  const { projectId } = route.params;
  
  const project = useSelector((state: RootState) => 
    state.progress.activeProjects.find(p => p.id === projectId)
  );

  if (!project) {
    return (
      <View style={styles.container}>
        <Card style={styles.card}>
          <Card.Content>
            <Title>Project Not Found</Title>
            <Paragraph>The requested project could not be found.</Paragraph>
          </Card.Content>
        </Card>
      </View>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return '#4CAF50';
      case 'error': return '#F44336';
      case 'in-progress': return '#2196F3';
      default: return '#9E9E9E';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return 'check-circle';
      case 'error': return 'alert-circle';
      case 'in-progress': return 'progress-clock';
      default: return 'clock-outline';
    }
  };

  const handleDismiss = () => {
    dispatch(completeProject(projectId));
  };

  return (
    <ScrollView style={styles.container}>
      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.header}>
            <View style={styles.titleContainer}>
              <Title>{project.name}</Title>
              <Chip 
                mode="outlined" 
                style={[styles.statusChip, { borderColor: getStatusColor(project.status) }]}
                textStyle={{ color: getStatusColor(project.status) }}
              >
                {project.status.toUpperCase()}
              </Chip>
            </View>
            {(project.status === 'completed' || project.status === 'error') && (
              <IconButton
                icon="close"
                mode="contained"
                onPress={handleDismiss}
              />
            )}
          </View>
          
          <View style={styles.progressContainer}>
            <View style={styles.progressHeader}>
              <Paragraph>Progress: {project.progress}%</Paragraph>
              <Paragraph>{project.currentStep}</Paragraph>
            </View>
            <ProgressBar 
              progress={project.progress / 100} 
              style={styles.progressBar}
              color={getStatusColor(project.status)}
            />
          </View>
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Title>Current Step</Title>
          <List.Item
            title={project.currentStep}
            description={`Step ${Math.ceil((project.progress / 100) * project.totalSteps)} of ${project.totalSteps}`}
            left={(props) => (
              <List.Icon 
                {...props} 
                icon={getStatusIcon(project.status)}
                color={getStatusColor(project.status)}
              />
            )}
          />
        </Card.Content>
      </Card>

      {project.errors.length > 0 && (
        <Card style={styles.card}>
          <Card.Content>
            <Title style={styles.errorTitle}>Errors</Title>
            {project.errors.map((error, index) => (
              <List.Item
                key={index}
                title={`Error ${index + 1}`}
                description={error}
                left={(props) => <List.Icon {...props} icon="alert-circle" color="#F44336" />}
                titleStyle={styles.errorText}
                descriptionStyle={styles.errorDescription}
              />
            ))}
          </Card.Content>
        </Card>
      )}

      <Card style={styles.card}>
        <Card.Content>
          <Title>Project Details</Title>
          <List.Item
            title="Total Steps"
            description={`${project.totalSteps} operations to complete`}
            left={(props) => <List.Icon {...props} icon="format-list-numbered" />}
          />
          <List.Item
            title="Status"
            description={project.status}
            left={(props) => (
              <List.Icon 
                {...props} 
                icon={getStatusIcon(project.status)}
                color={getStatusColor(project.status)}
              />
            )}
          />
        </Card.Content>
      </Card>

      {project.status === 'completed' && (
        <View style={styles.buttonContainer}>
          <Button
            mode="contained"
            onPress={handleDismiss}
            style={styles.doneButton}
            contentStyle={styles.doneButtonContent}
          >
            Done
          </Button>
        </View>
      )}

      {project.status === 'error' && (
        <View style={styles.buttonContainer}>
          <Button
            mode="outlined"
            onPress={handleDismiss}
            style={styles.dismissButton}
            contentStyle={styles.dismissButtonContent}
          >
            Dismiss
          </Button>
        </View>
      )}
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  titleContainer: {
    flex: 1,
  },
  statusChip: {
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  progressContainer: {
    marginTop: 8,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
  },
  errorTitle: {
    color: '#F44336',
  },
  errorText: {
    color: '#F44336',
  },
  errorDescription: {
    color: '#F44336',
    opacity: 0.7,
  },
  buttonContainer: {
    marginBottom: 32,
  },
  doneButton: {
    marginTop: 16,
    backgroundColor: '#4CAF50',
  },
  doneButtonContent: {
    paddingVertical: 8,
  },
  dismissButton: {
    marginTop: 16,
    borderColor: '#F44336',
  },
  dismissButtonContent: {
    paddingVertical: 8,
  },
});