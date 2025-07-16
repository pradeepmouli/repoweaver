import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Card, Title, Paragraph, List, Chip, Button } from 'react-native-paper';
import { RouteProp, useRoute } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { RootStackParamList } from '../types';

type TemplateDetailRouteProp = RouteProp<RootStackParamList, 'TemplateDetail'>;

export function TemplateDetailScreen() {
  const route = useRoute<TemplateDetailRouteProp>();
  const { templateId } = route.params;
  
  const template = useSelector((state: RootState) => 
    state.templates.templates.find(t => t.id === templateId)
  );

  if (!template) {
    return (
      <View style={styles.container}>
        <Card style={styles.card}>
          <Card.Content>
            <Title>Template Not Found</Title>
            <Paragraph>The requested template could not be found.</Paragraph>
          </Card.Content>
        </Card>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Card style={styles.card}>
        <Card.Content>
          <Title>{template.name}</Title>
          {template.description && (
            <Paragraph style={styles.description}>{template.description}</Paragraph>
          )}
          
          <View style={styles.chipContainer}>
            <Chip mode="outlined" compact>
              Branch: {template.branch || 'main'}
            </Chip>
            {template.subDirectory && (
              <Chip mode="outlined" compact style={styles.chip}>
                Subdir: {template.subDirectory}
              </Chip>
            )}
          </View>
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Title>Repository Details</Title>
          
          <List.Item
            title="Repository URL"
            description={template.url}
            left={(props) => <List.Icon {...props} icon="github" />}
          />
          
          <List.Item
            title="Branch"
            description={template.branch || 'main'}
            left={(props) => <List.Icon {...props} icon="source-branch" />}
          />
          
          {template.subDirectory && (
            <List.Item
              title="Subdirectory"
              description={template.subDirectory}
              left={(props) => <List.Icon {...props} icon="folder" />}
            />
          )}
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Title>Actions</Title>
          
          <Button
            mode="contained"
            style={styles.button}
            contentStyle={styles.buttonContent}
            onPress={() => {
              // Navigate to create project with this template pre-selected
            }}
          >
            Use This Template
          </Button>
          
          <Button
            mode="outlined"
            style={styles.button}
            contentStyle={styles.buttonContent}
            onPress={() => {
              // Open edit template modal
            }}
          >
            Edit Template
          </Button>
          
          <Button
            mode="outlined"
            style={[styles.button, styles.dangerButton]}
            contentStyle={styles.buttonContent}
            textColor="#F44336"
            onPress={() => {
              // Show delete confirmation
            }}
          >
            Delete Template
          </Button>
        </Card.Content>
      </Card>
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
  description: {
    marginTop: 8,
    marginBottom: 16,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  chip: {
    marginLeft: 8,
  },
  button: {
    marginBottom: 12,
  },
  buttonContent: {
    paddingVertical: 8,
  },
  dangerButton: {
    borderColor: '#F44336',
  },
});