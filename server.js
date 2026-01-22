// server.js
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// MongoDB Connection
mongoose.connect('mongodb://localhost:27017/taskmanager', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// User Schema
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

// Task Schema
const taskSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  status: { type: String, enum: ['pending', 'in-progress', 'completed'], default: 'pending' },
  priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  dueDate: Date,
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const Task = mongoose.model('Task', taskSchema);

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(session({
  secret: 'your-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

// Auth Middleware
const requireAuth = (req, res, next) => {
  if (!req.session.userId) {
    return res.redirect('/login');
  }
  next();
};

// Routes
app.get('/', (req, res) => {
  if (req.session.userId) {
    return res.redirect('/dashboard');
  }
  res.render('index');
});

app.get('/register', (req, res) => {
  res.render('register', { error: null });
});

app.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const user = new User({
      username,
      email,
      password: hashedPassword
    });
    
    await user.save();
    res.redirect('/login');
  } catch (error) {
    res.render('register', { error: 'Username or email already exists' });
  }
});

app.get('/login', (req, res) => {
  res.render('login', { error: null });
});

app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.render('login', { error: 'Invalid credentials' });
    }
    
    req.session.userId = user._id;
    req.session.username = user.username;
    res.redirect('/dashboard');
  } catch (error) {
    res.render('login', { error: 'Login failed' });
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

app.get('/dashboard', requireAuth, async (req, res) => {
  try {
    const tasks = await Task.find({ userId: req.session.userId }).sort({ createdAt: -1 });
    const stats = {
      total: tasks.length,
      pending: tasks.filter(t => t.status === 'pending').length,
      inProgress: tasks.filter(t => t.status === 'in-progress').length,
      completed: tasks.filter(t => t.status === 'completed').length
    };
    res.render('dashboard', { 
      username: req.session.username, 
      tasks,
      stats
    });
  } catch (error) {
    res.status(500).send('Error loading dashboard');
  }
});

app.post('/tasks', requireAuth, async (req, res) => {
  try {
    const { title, description, priority, dueDate } = req.body;
    const task = new Task({
      title,
      description,
      priority,
      dueDate: dueDate || null,
      userId: req.session.userId
    });
    await task.save();
    res.redirect('/dashboard');
  } catch (error) {
    res.status(500).send('Error creating task');
  }
});

app.post('/tasks/:id/status', requireAuth, async (req, res) => {
  try {
    const { status } = req.body;
    await Task.findOneAndUpdate(
      { _id: req.params.id, userId: req.session.userId },
      { status, updatedAt: Date.now() }
    );
    res.redirect('/dashboard');
  } catch (error) {
    res.status(500).send('Error updating task');
  }
});

app.post('/tasks/:id/delete', requireAuth, async (req, res) => {
  try {
    await Task.findOneAndDelete({ _id: req.params.id, userId: req.session.userId });
    res.redirect('/dashboard');
  } catch (error) {
    res.status(500).send('Error deleting task');
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});