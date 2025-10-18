const express = require(`express`);
const router = express.Router();
const db = require(`../database/db`);

const requireAuth = (req, res, next) => {
  if (req.isAuthenticated()) return next();
  res.status(401).json({ error: `Accesso non autorizzato` });
};

// GET - Ottieni profilo utente
router.get(`/profile`, requireAuth, async (req, res) => {
  try {
    const user = await db(`users`).where(`id`, req.user.id).first();
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: `Errore` });
  }
});

// GET - Preferiti dell`utente
router.get(`/favorites`, async (req, res) => {
  console.log(`\n========== GET /api/users/favorites ==========`);
  console.log(`Autenticato:`, req.isAuthenticated());
  console.log(`Utente:`, req.user);
  
  if (!req.isAuthenticated()) {
    console.log(`Non autenticato`);
    return res.status(401).json({ error: `Non autenticato` });
  }

  try {
    console.log(`Caricamento preferiti per utente ID:`, req.user.id);
    
    // Prima verifica quanti preferiti ci sono
    const favCount = await db(`favorites`)
      .where(`user_id`, req.user.id)
      .count(`* as count`)
      .first();
    
    console.log(`Preferiti nella tabella favorites:`, favCount.count);
    
    const favorites = await db(`favorites as f`)
      .select(
        `r.*`,
        `c.name as category_name`,
        `u.name as chef_name`,
        `f.created_at as favorited_at`
      )
      .join(`recipes as r`, `f.recipe_id`, `r.id`)
      .leftJoin(`categories as c`, `r.category_id`, `c.id`)
      .leftJoin(`users as u`, `r.chef_id`, `u.id`)
      .where(`f.user_id`, req.user.id)
      .orderBy(`f.created_at`, `desc`);

    console.log(`Preferiti caricati:`, favorites.length);
    console.log(`Dettaglio preferiti:`, favorites.map(f => ({ id: f.id, title: f.title })));
    console.log(`==========================================\n`);
    
    res.json(favorites);
  } catch (error) {
    console.error(`❌ Errore nel recupero dei preferiti:`, error);
    console.error(`Stack:`, error.stack);
    res.status(500).json({ error: `Errore del server`, details: error.message });
  }
});

// GET - Ottieni ricette dell`utente (solo per chef/admin)
router.get(`/recipes`, requireAuth, async (req, res) => {
  try {
    if (req.user.role !== `chef` && req.user.role !== `admin`) {
      return res.status(403).json({ error: `Accesso riservato ai cuochi` });
    }
    const recipes = await db(`recipes`)
      .select(`recipes.*`, `categories.name as category_name`)
      .leftJoin(`categories`, `recipes.category_id`, `categories.id`)
      .where(`recipes.chef_id`, req.user.id);
    res.json(recipes);
  } catch (error) {
    res.status(500).json({ error: `Errore nel recupero delle ricette` });
  }
});

// GET - Le recensioni dell`utente
router.get(`/reviews`, async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: `Non autenticato` });
  }

  try {
    const reviews = await db(`reviews as r`)
      .select(
        `r.*`,
        `rec.title as recipe_title`,
        `rec.id as recipe_id`
      )
      .join(`recipes as rec`, `r.recipe_id`, `rec.id`)
      .where(`r.user_id`, req.user.id)
      .orderBy(`r.created_at`, `desc`);

    res.json(reviews);
  } catch (error) {
    console.error(`Errore nel recupero delle recensioni:`, error);
    res.status(500).json({ error: `Errore del server` });
  }
});

// GET - Tutte le recensioni (solo admin)
router.get(`/all-reviews`, async (req, res) => {
  console.log(`\n========== GET /api/users/all-reviews ==========`);
  console.log(`Autenticato:`, req.isAuthenticated());
  console.log(`Utente:`, req.user);
  
  if (!req.isAuthenticated()) {
    console.log(`Non autenticato`);
    return res.status(401).json({ error: `Non autenticato` });
  }

  if (req.user.role !== `admin`) {
    console.log(`Non autorizzato - solo admin`);
    return res.status(403).json({ error: `Solo gli admin possono vedere tutte le recensioni` });
  }

  try {
    const reviews = await db(`reviews as r`)
      .select(
        `r.*`,
        `rec.title as recipe_title`,
        `rec.id as recipe_id`,
        `u.name as user_name`,
        `u.email as user_email`
      )
      .join(`recipes as rec`, `r.recipe_id`, `rec.id`)
      .join(`users as u`, `r.user_id`, `u.id`)
      .orderBy(`r.created_at`, `desc`);

    console.log(`Recensioni caricate:`, reviews.length);
    console.log(`==========================================\n`);
    
    res.json(reviews);
  } catch (error) {
    console.error(`Errore nel recupero di tutte le recensioni:`, error);
    res.status(500).json({ error: `Errore del server` });
  }
});

module.exports = router;
