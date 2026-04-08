require('dotenv').config();
const express = require('express');
const cors = require('cors');
const accountRoutes = require('./routes/account');
const userRoutes = require('./routes/user');

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

app.get('/', (req, res) => {
    res.send('서버 정상 작동 중!');
});

app.use('/api/account', accountRoutes);
app.use('/api/user', userRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`서버 실행 중 : http://localhost:${PORT}`);
});