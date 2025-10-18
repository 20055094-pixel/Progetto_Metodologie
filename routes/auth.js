const express = require(`express`);
const router = express.Router();
const passport = require(`passport`);
const db = require(`../database/db`);

// GET - Status autenticazione
router.get(`/status`, (req, res) => {
    if (req.isAuthenticated()) {
        res.json({
            authenticated: true,
            user: {
                id: req.user.id,
                name: req.user.name,
                email: req.user.email,
                role: req.user.role
            }
        });
    } else {
        res.json({ authenticated: false });
    }
});

// POST - Login semplice (email/password)
router.post(`/simple-login`, async (req, res) => {
    const { email, password } = req.body;
    
    try {
        const user = await db(`users`).where({ email, password }).first();
        
        if (!user) {
            return res.status(401).json({ error: `Credenziali non valide` });
        }
        
        req.login(user, (err) => {
            if (err) {
                return res.status(500).json({ error: `Errore durante il login` });
            }
            
            res.json({
                success: true,
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role
                }
            });
        });
    } catch (error) {
        console.error(`Errore login:`, error);
        res.status(500).json({ error: `Errore del server` });
    }
});

// GET - Google OAuth
router.get(`/google`, 
    passport.authenticate(`google`, { scope: [`profile`, `email`] })
);

// GET - Google OAuth callback
router.get(`/google/callback`,
    passport.authenticate(`google`, { failureRedirect: `/login` }),
    (req, res) => {
        res.redirect(`/`);
    }
);

// POST - Logout
router.post(`/logout`, (req, res) => {
    req.logout((err) => {
        if (err) {
            return res.status(500).json({ error: `Errore durante il logout` });
        }
        res.json({ success: true });
    });
});

module.exports = router;
