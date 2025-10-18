require(`dotenv`).config();
const express = require(`express`);
const session = require(`express-session`);
const passport = require(`passport`);
const cors = require(`cors`);
const path = require(`path`);
const { initDatabase } = require(`./database/db`);
const db = require(`./database/db`); // Aggiungi questa importazione

const app = express();
const PORT = process.env.PORT || 3000;

// Inizializza database all`avvio
initDatabase().then(() => {
  console.log(`Database ready!`);
}).catch(error => {
  console.error(`Database initialization failed:`, error);
});

// Middleware
app.use(cors());
app.use(express.json({ limit: `10mb` }));
app.use(express.urlencoded({ extended: true, limit: `10mb` }));
app.use(express.static(`public`));

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || `cookbook-secret-key-change-in-production`,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === `production`,
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 ore
    }
}));

// Passport initialization
app.use(passport.initialize());
app.use(passport.session());

// Passport configuration
require(`./config/passport`)(passport);

// Routes
app.use(`/auth`, require(`./routes/auth`));
app.use(`/api/recipes`, require(`./routes/recipes`));
app.use(`/api/categories`, require(`./routes/categories`));
app.use(`/api/ingredients`, require(`./routes/ingredients`));
app.use(`/api/users`, require(`./routes/users`));
app.use(`/api/reviews`, require(`./routes/reviews`));

// Route pagine applicazione (MPA)
const servePage = (page) => (req, res) => {
    res.sendFile(path.join(__dirname, `public`, page));
};

app.get(`/`, servePage(`index.html`));
app.get(`/recipes`, servePage(`recipes.html`));
app.get(`/recipe`, servePage(`recipe.html`));
app.get(`/recipe-form`, servePage(`recipe-form.html`));
app.get(`/login`, servePage(`login.html`));
app.get(`/dashboard`, servePage(`dashboard.html`));

// Route di registrazione semplice
app.post(`/auth/register`, async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    
    console.log(`Tentativo registrazione:`, { name, email, role });
    
    // Validazioni server-side
    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: `Tutti i campi sono obbligatori` });
    }
    
    if (password.length < 6) {
      return res.status(400).json({ error: `La password deve essere di almeno 6 caratteri` });
    }
    
    if (![`user`, `chef`].includes(role)) {
      return res.status(400).json({ error: `Ruolo non valido. Seleziona Cliente o Chef.` });
    }
    
    // Verifica se l`email esiste già
    const existingUser = await db(`users`).where({ email: email.toLowerCase().trim() }).first();
    if (existingUser) {
      return res.status(400).json({ error: `Email già registrata. Usa un\`altra email o effettua il login.` });
    }
    
    // Crea il nuovo utente
    const [userId] = await db(`users`).insert({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: password, // In produzione dovresti hashare la password
      role: role
    });
    
    console.log(`Nuovo utente registrato:`, { id: userId, name, email, role });
    
    res.status(201).json({ 
      message: `Registrazione completata con successo`,
      userId: userId 
    });
    
  } catch (error) {
    console.error(`Errore registrazione:`, error);
    res.status(500).json({ error: `Errore interno del server durante la registrazione` });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(`Errore server:`, err);
    res.status(500).json({ 
        error: `Errore interno del server`,
        details: process.env.NODE_ENV === `development` ? err.message : undefined
    });
});

app.listen(PORT, () => {
    console.log(`========================================`);
    console.log(`   CookBook Server avviato sulla porta ${PORT}`);
    console.log(`========================================`);
    console.log(`URL: http://localhost:${PORT}`);
    console.log(`Ambiente: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Credenziali di test:`);
    console.log(`   Admin: admin@cookbook.com / admin123`);
    console.log(`   Chef: chef@cookbook.com / chef123`);
    console.log(`   User: user@cookbook.com / user123`);
    console.log(`========================================\n`);
});
