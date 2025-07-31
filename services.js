const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config(); // ✅ Load environment variables


const app = express();
const PORT = 3002;


// Routes
const employeeRoutes = require('./routes/employee');
const profileRoutes = require('./routes/profile');
const leaveRoutes = require('./routes/leave');
const payRouter = require('./routes/pay'); 
const paypdfRouter = require('./routes/paypdf');



// Middlewares
app.use(cors());
app.use(bodyParser.json());
app.use('/api', employeeRoutes);
app.use('/api', profileRoutes);
app.use('/api', leaveRoutes);
app.use('/api', payRouter);
app.use('/api', paypdfRouter);


app.listen(PORT, () => {
  console.log(`Employee Portal backend is running at http://localhost:${PORT}`);
});
