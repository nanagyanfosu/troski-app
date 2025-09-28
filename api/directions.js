import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import directionsHandler from './api/directions.js';
import routesHandler from './api/routes.js';

const app = express();

// Enable CORS for all routes (configure origin as needed)
app.use(cors());

// Health check
app.get('/health', (req, res) => {
	res.status(200).json({ status: 'ok' });
});

// Directions passthrough
app.get('/directions', (req, res) => {
	return directionsHandler(req, res);
});

// Routes with ranking
app.get('/routes', (req, res) => {
	return routesHandler(req, res);
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
	console.log(`Server listening on port ${PORT}`);
});


