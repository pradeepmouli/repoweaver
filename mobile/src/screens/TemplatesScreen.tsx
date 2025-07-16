import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { 
  Card, 
  Title, 
  Paragraph, 
  FAB, 
  List, 
  IconButton, 
  Searchbar,
  Chip,
  Portal,
  Modal,
  TextInput,
  Button
} from 'react-native-paper';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../store';
import { addTemplate, removeTemplate } from '../store/templatesSlice';
import { MobileTemplateRepository } from '../types';

export function TemplatesScreen() {
  const dispatch = useDispatch();
  const templates = useSelector((state: RootState) => state.templates.templates);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTemplate, setNewTemplate] = useState({
    url: '',
    name: '',
    branch: 'main',
    subDirectory: '',
    description: '',
  });

  const filteredTemplates = templates.filter(template =>
    template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    template.url.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddTemplate = () => {
    const template: MobileTemplateRepository = {
      id: Date.now().toString(),
      url: newTemplate.url,
      name: newTemplate.name,
      branch: newTemplate.branch,
      subDirectory: newTemplate.subDirectory || undefined,
      description: newTemplate.description || undefined,
    };
    
    dispatch(addTemplate(template));
    setNewTemplate({ url: '', name: '', branch: 'main', subDirectory: '', description: '' });
    setShowAddModal(false);
  };

  const handleRemoveTemplate = (id: string) => {
    dispatch(removeTemplate(id));
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <Searchbar
          placeholder="Search templates..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchbar}
        />
      </View>

      <ScrollView style={styles.scrollView}>
        {filteredTemplates.map((template) => (
          <Card key={template.id} style={styles.card}>
            <Card.Content>
              <View style={styles.cardHeader}>
                <View style={styles.cardTitle}>
                  <Title>{template.name}</Title>
                  {template.description && (
                    <Paragraph>{template.description}</Paragraph>
                  )}
                </View>
                <IconButton
                  icon="delete"
                  mode="contained"
                  onPress={() => handleRemoveTemplate(template.id)}
                />
              </View>
              
              <List.Item
                title="Repository URL"
                description={template.url}
                left={(props) => <List.Icon {...props} icon="github" />}
              />
              
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
        ))}
      </ScrollView>

      <FAB
        style={styles.fab}
        icon="plus"
        onPress={() => setShowAddModal(true)}
      />

      <Portal>
        <Modal
          visible={showAddModal}
          onDismiss={() => setShowAddModal(false)}
          contentContainerStyle={styles.modal}
        >
          <Title>Add New Template</Title>
          
          <TextInput
            label="Template Name"
            value={newTemplate.name}
            onChangeText={(text) => setNewTemplate({ ...newTemplate, name: text })}
            style={styles.input}
          />
          
          <TextInput
            label="Repository URL"
            value={newTemplate.url}
            onChangeText={(text) => setNewTemplate({ ...newTemplate, url: text })}
            style={styles.input}
          />
          
          <TextInput
            label="Branch (optional)"
            value={newTemplate.branch}
            onChangeText={(text) => setNewTemplate({ ...newTemplate, branch: text })}
            style={styles.input}
          />
          
          <TextInput
            label="Subdirectory (optional)"
            value={newTemplate.subDirectory}
            onChangeText={(text) => setNewTemplate({ ...newTemplate, subDirectory: text })}
            style={styles.input}
          />
          
          <TextInput
            label="Description (optional)"
            value={newTemplate.description}
            onChangeText={(text) => setNewTemplate({ ...newTemplate, description: text })}
            style={styles.input}
            multiline
          />
          
          <View style={styles.modalButtons}>
            <Button mode="outlined" onPress={() => setShowAddModal(false)}>
              Cancel
            </Button>
            <Button 
              mode="contained" 
              onPress={handleAddTemplate}
              disabled={!newTemplate.name || !newTemplate.url}
            >
              Add Template
            </Button>
          </View>
        </Modal>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  searchContainer: {
    padding: 16,
    paddingBottom: 8,
  },
  searchbar: {
    elevation: 4,
  },
  scrollView: {
    flex: 1,
    padding: 16,
    paddingTop: 8,
  },
  card: {
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardTitle: {
    flex: 1,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  chip: {
    marginLeft: 8,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
  },
  modal: {
    backgroundColor: 'white',
    padding: 20,
    margin: 20,
    borderRadius: 8,
  },
  input: {
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
});