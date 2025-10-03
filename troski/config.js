// This file exposes runtime configuration values for the app.
// For local development, create a `.env` file at the project root with:
// GOOGLE_PLACES_API_KEY=your_key_here
// The `.env` file is ignored by git.
// In production you should provide this key via secure build-time secrets, a backend proxy, or EAS secrets.

// Import from the react-native-dotenv plugin (babel) so code can reference `@env`.
import { GOOGLE_PLACES_API_KEY } from '@env';

export default {
	GOOGLE_PLACES_API_KEY: GOOGLE_PLACES_API_KEY || '',
};

