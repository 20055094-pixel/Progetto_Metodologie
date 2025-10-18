const express = require(`express`);
const router = express.Router();
const db = require(`../database/db`);

const requireAdmin = (req, res, next) => {
  if (req.isAuthenticated() && req.user.role === `admin`) return next();
  res.status(403).json({ error: `Accesso riservato agli amministratori` });
};

// GET - Ottieni tutti gli ingredienti
router.get(`/`, async (req, res) => {
  try {
    const ingredients = await db(`ingredients`).select(`*`).orderBy(`name`);
    res.json(ingredients);
  } catch (error) {
    res.status(500).json({ error: `Errore` });
  }
});

// POST - Crea nuovo ingrediente (solo admin)
router.post(`/`, requireAdmin, async (req, res) => {
  try {
    const { name, unit } = req.body;
    const [id] = await db(`ingredients`).insert({
      name, unit: unit || `g`, created_at: new Date(), updated_at: new Date()
    });
    res.status(201).json({ id, message: `Ingrediente creato` });
  } catch (error) {
    res.status(500).json({ error: `Errore` });
  }
});

// PUT - Aggiorna ingrediente (solo admin)
router.put(`/:id`, requireAdmin, async (req, res) => {
  try {
    const { name, unit } = req.body;
    await db(`ingredients`).where(`id`, req.params.id).update({ name, unit, updated_at: new Date() });
    res.json({ message: `Ingrediente aggiornato` });
  } catch (error) {
    res.status(500).json({ error: `Errore` });
  }
});

// DELETE - Elimina ingrediente (solo admin)
router.delete(`/:id`, requireAdmin, async (req, res) => {
  try {
    await db(`ingredients`).where(`id`, req.params.id).del();
    res.json({ message: `Ingrediente eliminato` });
  } catch (error) {
    res.status(500).json({ error: `Errore` });
  }
});

module.exports = router;
