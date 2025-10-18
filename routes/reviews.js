const express = require(`express`);
const router = express.Router();
const db = require(`../database/db`);

// PUT - Modifica recensione
router.put(`/:id`, async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: `Non autenticato` });
  }

  const { id } = req.params;
  const { rating, comment } = req.body;

  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({ error: `Valutazione non valida` });
  }

  try {
    const review = await db(`reviews`).where(`id`, id).first();
    
    if (!review) {
      return res.status(404).json({ error: `Recensione non trovata` });
    }

    if (review.user_id !== req.user.id && req.user.role !== `admin`) {
      return res.status(403).json({ error: `Non autorizzato` });
    }

    await db(`reviews`).where(`id`, id).update({
      rating,
      comment: comment || null
    });

    res.json({ message: `Recensione aggiornata con successo` });
  } catch (error) {
    console.error(`Errore aggiornamento recensione:`, error);
    res.status(500).json({ error: `Errore del server` });
  }
});

// DELETE - Elimina recensione
router.delete(`/:id`, async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: `Non autenticato` });
  }

  const { id } = req.params;

  try {
    const review = await db(`reviews`).where(`id`, id).first();
    
    if (!review) {
      return res.status(404).json({ error: `Recensione non trovata` });
    }

    if (review.user_id !== req.user.id && req.user.role !== `admin`) {
      return res.status(403).json({ error: `Non autorizzato` });
    }

    await db(`reviews`).where(`id`, id).del();
    res.json({ message: `Recensione eliminata con successo` });
  } catch (error) {
    console.error(`Errore eliminazione recensione:`, error);
    res.status(500).json({ error: `Errore del server` });
  }
});

module.exports = router;
