const http = require('http');
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const { initWebSocketServer } = require('./wsServer');
const authRoutes = require('./routes/auth');
const stockRoutes = require('./routes/stock');
const tradeRoutes = require('./routes/trade');

dotenv.config();

connectDB().catch((error) => {
  console.error('Database connection failed:', error);
  process.exit(1);
});

const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/stocks', stockRoutes);
app.use('/api/trade', tradeRoutes);

app.get('/', (req, res) => {
  res.json({ message: 'Personal Exchange API is running' });
});

const server = http.createServer(app);
initWebSocketServer(server);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
