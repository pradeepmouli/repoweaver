import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Card, Title, List, Switch, Divider } from 'react-native-paper';

export function SettingsScreen() {
  const [notifications, setNotifications] = React.useState(true);
  const [autoCleanup, setAutoCleanup] = React.useState(true);
  const [verboseLogging, setVerboseLogging] = React.useState(false);

  return (
    <ScrollView style={styles.container}>
      <Card style={styles.card}>
        <Card.Content>
          <Title>General Settings</Title>
          
          <List.Item
            title="Enable Notifications"
            description="Get notified when projects complete"
            left={(props) => <List.Icon {...props} icon="bell" />}
            right={() => (
              <Switch
                value={notifications}
                onValueChange={setNotifications}
              />
            )}
          />
          
          <Divider />
          
          <List.Item
            title="Auto Cleanup"
            description="Automatically clean temporary files"
            left={(props) => <List.Icon {...props} icon="broom" />}
            right={() => (
              <Switch
                value={autoCleanup}
                onValueChange={setAutoCleanup}
              />
            )}
          />
          
          <Divider />
          
          <List.Item
            title="Verbose Logging"
            description="Enable detailed logging for debugging"
            left={(props) => <List.Icon {...props} icon="text-box" />}
            right={() => (
              <Switch
                value={verboseLogging}
                onValueChange={setVerboseLogging}
              />
            )}
          />
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Title>Default Settings</Title>
          
          <List.Item
            title="Default Merge Strategy"
            description="merge"
            left={(props) => <List.Icon {...props} icon="merge" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
          />
          
          <Divider />
          
          <List.Item
            title="Default Exclude Patterns"
            description="Manage default file exclusions"
            left={(props) => <List.Icon {...props} icon="file-hidden" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
          />
          
          <Divider />
          
          <List.Item
            title="Default Branch"
            description="main"
            left={(props) => <List.Icon {...props} icon="source-branch" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
          />
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Title>About</Title>
          
          <List.Item
            title="Version"
            description="1.0.0"
            left={(props) => <List.Icon {...props} icon="information" />}
          />
          
          <Divider />
          
          <List.Item
            title="Privacy Policy"
            description="View our privacy policy"
            left={(props) => <List.Icon {...props} icon="shield-account" />}
            right={(props) => <List.Icon {...props} icon="open-in-new" />}
          />
          
          <Divider />
          
          <List.Item
            title="Help & Support"
            description="Get help using the app"
            left={(props) => <List.Icon {...props} icon="help-circle" />}
            right={(props) => <List.Icon {...props} icon="open-in-new" />}
          />
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
});