# Boots-strapper Mobile

React Native frontend for the Boots-strapper CLI tool.

## Features

- 📱 Native iOS and Android app
- 🌐 Web support via Expo
- 🎨 Material Design 3 UI with React Native Paper
- 📊 Redux state management
- 🔄 Real-time project progress tracking
- 📝 Template repository management
- ⚙️ Configurable project settings

## Getting Started

### Prerequisites

- Node.js 16+ 
- npm or yarn
- Expo CLI (`npm install -g @expo/cli`)
- For iOS: Xcode and iOS Simulator
- For Android: Android Studio and emulator

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm start
```

3. Choose your platform:
- Press `i` for iOS simulator
- Press `a` for Android emulator  
- Press `w` for web browser
- Scan QR code with Expo Go app on physical device

## Project Structure

```
mobile/
├── src/
│   ├── components/     # Reusable UI components
│   ├── screens/        # App screens
│   ├── navigation/     # Navigation configuration
│   ├── store/          # Redux store and slices
│   ├── services/       # API and business logic
│   ├── hooks/          # Custom React hooks
│   ├── types/          # TypeScript type definitions
│   └── theme.ts        # App theme configuration
├── App.tsx             # Root component
└── package.json
```

## Development Scripts

From the root directory:

```bash
# Install mobile dependencies
npm run mobile:install

# Start development server
npm run mobile:start

# Run on iOS simulator
npm run mobile:ios

# Run on Android emulator
npm run mobile:android

# Run in web browser
npm run mobile:web

# Build for production
npm run mobile:build
```

## Features Overview

### Home Screen
- Dashboard with project overview
- Active project progress
- Recent projects list
- Quick statistics

### Templates Screen
- Browse available template repositories
- Add/edit/remove templates
- Search and filter templates
- Template validation

### Create Project Screen
- Multi-template project setup
- Git configuration options
- Merge strategy selection
- File exclusion patterns
- Real-time form validation

### Progress Tracking
- Live project creation progress
- Step-by-step status updates
- Error handling and reporting
- Background operation support

### Settings
- App configuration
- Default preferences
- About and help information

## Integration with Core

The mobile app integrates with the core TypeScript bootstrapper through:

- Shared type definitions
- Service layer abstraction
- Mock implementations for development
- Future: Direct integration with core modules

## Building for Production

### iOS
```bash
npx expo build:ios
```

### Android
```bash
npx expo build:android
```

### Web
```bash
npx expo export:web
```

## Contributing

1. Follow the existing code style and patterns
2. Use TypeScript for all new code
3. Test on multiple platforms before submitting
4. Update documentation for new features

## License

MIT