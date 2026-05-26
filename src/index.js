require('dotenv').config();
const app = require('./app');
const { connectDB } = require('./config/database');

const PORT = process.env.PORT || 5000;

async function start() {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`CinemaRace API running on port ${PORT} [${process.env.NODE_ENV}]`);
  });
}

start();
