import { MaterialIcons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';

import { CreateProjectScreen } from '../screens/CreateProjectScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { ProjectProgressScreen } from '../screens/ProjectProgressScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { TemplateDetailScreen } from '../screens/TemplateDetailScreen';
import { TemplatesScreen } from '../screens/TemplatesScreen';

import { RootStackParamList } from '../types';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator<RootStackParamList>();

function MainTabs() {
	return (
		<Tab.Navigator
			screenOptions={({ route }) => ({
				tabBarIcon: ({ focused, color, size }) => {
					let iconName: keyof typeof MaterialIcons.glyphMap;

					if (route.name === 'Home') {
						iconName = 'home';
					} else if (route.name === 'Templates') {
						iconName = 'folder-copy';
					} else if (route.name === 'CreateProject') {
						iconName = 'add-circle';
					} else if (route.name === 'Settings') {
						iconName = 'settings';
					} else {
						iconName = 'help';
					}

					return <MaterialIcons name={iconName} size={size} color={color} />;
				},
				tabBarActiveTintColor: '#6200EE',
				tabBarInactiveTintColor: 'gray',
			})}>
			<Tab.Screen name="Home" component={HomeScreen} options={{ title: 'Projects' }} />
			<Tab.Screen name="Templates" component={TemplatesScreen} options={{ title: 'Templates' }} />
			<Tab.Screen name="CreateProject" component={CreateProjectScreen} options={{ title: 'Create' }} />
			<Tab.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
		</Tab.Navigator>
	);
}

export function AppNavigator() {
	return (
		<Stack.Navigator>
			<Stack.Screen name="Home" component={MainTabs} options={{ headerShown: false }} />
			<Stack.Screen name="ProjectProgress" component={ProjectProgressScreen} options={{ title: 'Project Progress' }} />
			<Stack.Screen name="TemplateDetail" component={TemplateDetailScreen} options={{ title: 'Template Details' }} />
		</Stack.Navigator>
	);
}
