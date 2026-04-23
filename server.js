require('dotenv').config();

const express = require('express');
const cors = require('cors');
const categoriesRoutes = require('./server/routes/categories.routes');
const transactionsRoutes = require('./server/routes/transactions.routes');
const recurringRoutes = require('./server/routes/recurring.routes');
const quickAddRoutes = require('./server/routes/quickAdd.routes');
const summaryRoutes = require('./server/routes/summary.routes');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('.'));
app.use(categoriesRoutes);
app.use(transactionsRoutes);
app.use(recurringRoutes);
app.use(quickAddRoutes);
app.use(summaryRoutes);

app.get('/', (req, res) => {
  res.send('Сервер работает');
});

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Сервер запущен: http://localhost:${port}`);
});



