import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Card, Title, Paragraph, FAB, List, Chip } from 'react-native-paper';
import { useSelector } from 'react-redux';
import { RootState } from '../store';

export function HomeScreen() {
  const projects = useSelector((state: RootState) => state.projects.projects);
  const activeProjects = useSelector((state: RootState) => state.progress.activeProjects);

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {activeProjects.length > 0 && (
          <Card style={styles.card}>
            <Card.Content>
              <Title>Active Projects</Title>
              {activeProjects.map((project) => (
                <List.Item
                  key={project.id}
                  title={project.name}
                  description={`${project.currentStep} (${project.progress}%)`}
                  left={(props) => <List.Icon {...props} icon="progress-clock" />}
                  right={() => (
                    <Chip mode="outlined" compact>
                      {project.status}
                    </Chip>
                  )}
                />
              ))}
            </Card.Content>
          </Card>
        )}

        <Card style={styles.card}>
          <Card.Content>
            <Title>Recent Projects</Title>
            {projects.length === 0 ? (
              <Paragraph>No projects yet. Create your first project!</Paragraph>
            ) : (
              projects.slice(0, 5).map((project) => (
                <List.Item
                  key={project.id}
                  title={project.name}
                  description={`${project.templates.length} templates • ${project.path}`}
                  left={(props) => <List.Icon {...props} icon="folder" />}
                  right={() => (
                    <Chip mode="outlined" compact>
                      {project.mergeStrategy}
                    </Chip>
                  )}
                />
              ))
            )}
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Content>
            <Title>Quick Stats</Title>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Title>{projects.length}</Title>
                <Paragraph>Projects</Paragraph>
              </View>
              <View style={styles.statItem}>
                <Title>{projects.reduce((sum, p) => sum + p.templates.length, 0)}</Title>
                <Paragraph>Templates Used</Paragraph>
              </View>
              <View style={styles.statItem}>
                <Title>{activeProjects.length}</Title>
                <Paragraph>Active</Paragraph>
              </View>
            </View>
          </Card.Content>
        </Card>
      </ScrollView>

      <FAB
        style={styles.fab}
        icon="plus"
        onPress={() => {
          // Navigate to create project screen
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  card: {
    marginBottom: 16,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 16,
  },
  statItem: {
    alignItems: 'center',
  },
});