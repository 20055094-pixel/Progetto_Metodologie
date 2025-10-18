const express = require(`express`);
const router = express.Router();
const db = require(`../database/db`);

const requireAdmin = (req, res, next) => {
  if (req.isAuthenticated() && req.user.role === `admin`) return next();
  res.status(403).json({ error: `Accesso riservato agli amministratori` });
};

// GET - Ottieni tutte le categorie
router.get(`/`, async (req, res) => {
  try {
    const categories = await db(`categories`).select(`*`).orderBy(`name`);
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: `Errore` });
  }
});

// POST - Crea nuova categoria (solo admin)
router.post(`/`, requireAdmin, async (req, res) => {
  try {
    const { name, description } = req.body;
    const [id] = await db(`categories`).insert({
      name, description: description || ``, created_at: new Date(), updated_at: new Date()
    });
    res.status(201).json({ id, message: `Categoria creata` });
  } catch (error) {
    res.status(500).json({ error: `Errore` });
  }
});

// PUT - Aggiorna categoria (solo admin)
router.put(`/:id`, requireAdmin, async (req, res) => {
  try {
    const { name, description } = req.body;
    await db(`categories`).where(`id`, req.params.id).update({ name, description, updated_at: new Date() });
    res.json({ message: `Categoria aggiornata` });
  } catch (error) {
    res.status(500).json({ error: `Errore` });
  }
});

// DELETE - Elimina categoria (solo admin)
router.delete(`/:id`, requireAdmin, async (req, res) => {
  try {
    await db(`categories`).where(`id`, req.params.id).del();
    res.json({ message: `Categoria eliminata` });
  } catch (error) {
    res.status(500).json({ error: `Errore` });
  }
});

module.exports = router;