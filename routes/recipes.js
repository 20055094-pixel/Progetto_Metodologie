const express = require(`express`);
const router = express.Router();
const db = require(`../database/db`);

// GET - Tutte le ricette con filtri
router.get(`/`, async (req, res) => {
  try {
    const { category, difficulty, prep_time, search } = req.query;
    
    let query = db(`recipes as r`)
      .select(
        `r.*`,
        `c.name as category_name`,
        `u.name as chef_name`
      )
      .leftJoin(`categories as c`, `r.category_id`, `c.id`)
      .leftJoin(`users as u`, `r.chef_id`, `u.id`);

    if (category) {
      query = query.where(`r.category_id`, category);
    }

    if (difficulty) {
      query = query.where(`r.difficulty`, difficulty);
    }

    if (prep_time) {
      query = query.where(`r.prep_time`, `<=`, prep_time);
    }

    if (search) {
      query = query.where(function() {
        this.where(`r.title`, `like`, `%${search}%`)
          .orWhere(`r.description`, `like`, `%${search}%`);
      });
    }

    const recipes = await query.orderBy(`r.created_at`, `desc`);
    res.json(recipes);
  } catch (error) {
    console.error(`Errore nel recupero delle ricette:`, error);
    res.status(500).json({ error: `Errore del server` });
  }
});

// GET - Singola ricetta con ingredienti e recensioni
router.get(`/:id`, async (req, res) => {
  try {
    const { id } = req.params;
    
    const recipe = await db(`recipes as r`)
      .select(
        `r.*`,
        `c.name as category_name`,
        `u.name as chef_name`
      )
      .leftJoin(`categories as c`, `r.category_id`, `c.id`)
      .leftJoin(`users as u`, `r.chef_id`, `u.id`)
      .where(`r.id`, id)
      .first();

    if (!recipe) {
      return res.status(404).json({ error: `Ricetta non trovata` });
    }

    const ingredients = await db(`recipe_ingredients as ri`)
      .select(`i.id`, `i.name`, `ri.quantity`, `ri.unit`)
      .join(`ingredients as i`, `ri.ingredient_id`, `i.id`)
      .where(`ri.recipe_id`, id);

    const reviews = await db(`reviews as r`)
      .select(`r.*`, `u.name as user_name`)
      .join(`users as u`, `r.user_id`, `u.id`)
      .where(`r.recipe_id`, id)
      .orderBy(`r.created_at`, `desc`);

    recipe.ingredients = ingredients;
    recipe.reviews = reviews;

    res.json(recipe);
  } catch (error) {
    console.error(`Errore nel recupero della ricetta:`, error);
    res.status(500).json({ error: `Errore del server` });
  }
});

// POST - Crea nuova ricetta
router.post(`/`, async (req, res) => {
  console.log(`\n ========== INIZIO CREAZIONE RICETTA ==========`);
  console.log(` POST /api/recipes - Creazione ricetta`);
  console.log(` Autenticato:`, req.isAuthenticated());
  console.log(` Utente completo:`, JSON.stringify(req.user, null, 2));
  console.log(` Body completo:`, JSON.stringify(req.body, null, 2));
  
  if (!req.isAuthenticated()) {
    console.log(`Non autenticato - STOP`);
    return res.status(401).json({ error: `Non autenticato` });
  }

  if (req.user.role !== `chef` && req.user.role !== `admin`) {
    console.log(`Ruolo non autorizzato:`, req.user.role, `- STOP`);
    return res.status(403).json({ error: `Solo chef e admin possono creare ricette` });
  }

  const { 
    title, 
    description, 
    instructions, 
    prep_time, 
    cook_time, 
    difficulty, 
    servings, 
    category_id, 
    image_url,
    ingredients 
  } = req.body;

  console.log(`Dati estratti:`);
  console.log(`   - Title:`, title);
  console.log(`   - Instructions:`, instructions?.substring(0, 50) + `...`);
  console.log(`   - Category ID:`, category_id, `Type:`, typeof category_id);
  console.log(`   - Ingredients array:`, Array.isArray(ingredients));
  console.log(`   - Ingredients count:`, ingredients?.length);
  console.log(`   - Image URL length:`, image_url?.length || 0);

  // Validazione dettagliata
  const validationErrors = [];
  if (!title) validationErrors.push(`title mancante`);
  if (!instructions) validationErrors.push(`instructions mancanti`);
  if (!category_id) validationErrors.push(`category_id mancante`);
  if (!ingredients) validationErrors.push(`ingredients mancante`);
  if (ingredients && ingredients.length === 0) validationErrors.push(`ingredients vuoto`);

  if (validationErrors.length > 0) {
    console.log(`Validazione fallita:`, validationErrors.join(`, `));
    return res.status(400).json({ 
      error: `Campi obbligatori mancanti`, 
      details: validationErrors 
    });
  }

  console.log(`Validazione superata`);

  let trx;
  try {
    console.log(`Inizio transazione database...`);
    trx = await db.transaction();
    console.log(`Transazione iniziata`);

    // Verifica esistenza categoria
    const categoryExists = await trx(`categories`).where(`id`, category_id).first();
    console.log(`Categoria esistente:`, !!categoryExists, categoryExists);

    if (!categoryExists) {
      await trx.rollback();
      console.log(`Categoria non trovata - STOP`);
      return res.status(400).json({ error: `Categoria con ID ${category_id} non trovata` });
    }

    // Prepara dati ricetta
    const recipeData = {
      title,
      description: description || null,
      instructions,
      prep_time: prep_time || 30,
      cook_time: cook_time || 30,
      difficulty: difficulty || `facile`,
      servings: servings || 4,
      image_url: image_url || null,
      category_id,
      chef_id: req.user.id
    };

    console.log(`Dati ricetta da inserire:`, {
      ...recipeData,
      image_url: image_url ? `[${image_url.length} chars]` : null
    });

    // Inserisci ricetta
    console.log(`Inserimento ricetta nel database...`);
    const result = await trx(`recipes`).insert(recipeData);
    const recipeId = result[0];
    console.log(`Ricetta inserita con ID:`, recipeId);

    // Verifica ingredienti
    console.log(`Verifica ingredienti...`);
    for (let i = 0; i < ingredients.length; i++) {
      const ing = ingredients[i];
      console.log(`   Ingrediente ${i + 1}:`, ing);
      
      const ingredientExists = await trx(`ingredients`).where(`id`, ing.ingredient_id).first();
      if (!ingredientExists) {
        await trx.rollback();
        console.log(`Ingrediente ${ing.ingredient_id} non trovato - STOP`);
        return res.status(400).json({ error: `Ingrediente con ID ${ing.ingredient_id} non trovato` });
      }
    }

    // Inserisci ingredienti
    const ingredientInserts = ingredients.map(ing => ({
      recipe_id: recipeId,
      ingredient_id: ing.ingredient_id,
      quantity: ing.quantity,
      unit: ing.unit || `g`
    }));

    console.log(`Ingredienti da inserire:`, ingredientInserts);
    console.log(`Inserimento ingredienti nel database...`);
    await trx(`recipe_ingredients`).insert(ingredientInserts);
    console.log(`Ingredienti inseriti:`, ingredientInserts.length);

    console.log(`Commit transazione...`);
    await trx.commit();
    console.log(`Transazione committata con successo!`);
    console.log(`========== FINE CREAZIONE RICETTA ==========\n`);

    res.status(201).json({ id: recipeId, message: `Ricetta creata con successo` });
  } catch (error) {
    console.error(`\n❌ ========== ERRORE CREAZIONE RICETTA ==========`);
    console.error(`Tipo errore:`, error.name);
    console.error(`Messaggio:`, error.message);
    console.error(`Stack:`, error.stack);
    console.error(`Codice SQL:`, error.code);
    console.error(`❌ ================================================\n`);
    
    if (trx) {
      console.log(`Rollback transazione...`);
      await trx.rollback();
      console.log(`Rollback completato`);
    }
    
    res.status(500).json({ 
      error: `Errore nel server`, 
      details: error.message,
      code: error.code 
    });
  }
});

// PUT - Aggiorna ricetta
router.put(`/:id`, async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: `Non autenticato` });
  }

  const { id } = req.params;
  const { 
    title, 
    description, 
    instructions, 
    prep_time, 
    cook_time, 
    difficulty, 
    servings, 
    category_id, 
    image_url,
    ingredients 
  } = req.body;

  let trx;
  try {
    trx = await db.transaction();

    const recipe = await trx(`recipes`).where(`id`, id).first();
    
    if (!recipe) {
      await trx.rollback();
      return res.status(404).json({ error: `Ricetta non trovata` });
    }

    if (recipe.chef_id !== req.user.id && req.user.role !== `admin`) {
      await trx.rollback();
      return res.status(403).json({ error: `Non autorizzato` });
    }

    const updateData = {
      title,
      description: description || null,
      instructions,
      prep_time: prep_time || 30,
      cook_time: cook_time || 30,
      difficulty: difficulty || `facile`,
      servings: servings || 4,
      category_id
    };

    if (image_url !== undefined) {
      updateData.image_url = image_url || null;
    }

    await trx(`recipes`).where(`id`, id).update(updateData);

    if (ingredients && ingredients.length > 0) {
      await trx(`recipe_ingredients`).where(`recipe_id`, id).del();
      
      const ingredientInserts = ingredients.map(ing => ({
        recipe_id: id,
        ingredient_id: ing.ingredient_id,
        quantity: ing.quantity,
        unit: ing.unit || `g`
      }));

      await trx(`recipe_ingredients`).insert(ingredientInserts);
    }

    await trx.commit();
    res.json({ message: `Ricetta aggiornata con successo` });
  } catch (error) {
    if (trx) await trx.rollback();
    console.error(`❌ Errore aggiornamento ricetta:`, error);
    res.status(500).json({ error: `Errore nel server`, details: error.message });
  }
});

// DELETE - Elimina ricetta
router.delete(`/:id`, async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: `Non autenticato` });
  }

  const { id } = req.params;

  try {
    const recipe = await db(`recipes`).where(`id`, id).first();
    
    if (!recipe) {
      return res.status(404).json({ error: `Ricetta non trovata` });
    }

    if (recipe.chef_id !== req.user.id && req.user.role !== `admin`) {
      return res.status(403).json({ error: `Non autorizzato` });
    }

    await db(`recipes`).where(`id`, id).del();
    res.json({ message: `Ricetta eliminata con successo` });
  } catch (error) {
    console.error(`Errore nell\`eliminazione della ricetta:`, error);
    res.status(500).json({ error: `Errore del server` });
  }
});

// POST - Aggiungi ai preferiti
router.post(`/:id/favorite`, async (req, res) => {
  console.log(`\n========== POST /api/recipes/:id/favorite ==========`);
  console.log(`Autenticato:`, req.isAuthenticated());
  console.log(`Utente:`, req.user);
  console.log(`Ricetta ID:`, req.params.id);
  
  if (!req.isAuthenticated()) {
    console.log(`Non autenticato`);
    return res.status(401).json({ error: `Non autenticato` });
  }

  const { id } = req.params;

  try {
    // Verifica se esiste già
    const existing = await db(`favorites`)
      .where({ user_id: req.user.id, recipe_id: id })
      .first();
    
    console.log(`Preferito già esistente?`, !!existing);
    
    if (existing) {
      console.log(`Preferito già presente`);
      return res.json({ message: `Ricetta già nei preferiti`, alreadyExists: true });
    }
    
    // Inserisci nuovo preferito
    await db(`favorites`).insert({
      user_id: req.user.id,
      recipe_id: id
    });
    
    console.log(`Preferito aggiunto con successo`);
    
    // Verifica inserimento
    const verification = await db(`favorites`)
      .where({ user_id: req.user.id, recipe_id: id })
      .first();
    
    console.log(`Verifica inserimento:`, !!verification);
    console.log(`==========================================\n`);

    res.json({ message: `Ricetta aggiunta ai preferiti` });
  } catch (error) {
    console.error(`❌ Errore aggiunta ai preferiti:`, error);
    console.error(`Stack:`, error.stack);
    res.status(500).json({ error: `Errore del server`, details: error.message });
  }
});

// DELETE - Rimuovi dai preferiti
router.delete(`/:id/favorite`, async (req, res) => {
  console.log(`\n========== DELETE /api/recipes/:id/favorite ==========`);
  console.log(`Autenticato:`, req.isAuthenticated());
  console.log(`Utente:`, req.user);
  console.log(`Ricetta ID:`, req.params.id);
  
  if (!req.isAuthenticated()) {
    console.log(`Non autenticato`);
    return res.status(401).json({ error: `Non autenticato` });
  }

  const { id } = req.params;

  try {
    const deleted = await db(`favorites`)
      .where({
        user_id: req.user.id,
        recipe_id: id
      })
      .del();
    
    console.log(`Righe eliminate:`, deleted);
    
    if (deleted === 0) {
      console.log(`Preferito non trovato`);
      return res.status(404).json({ error: `Preferito non trovato` });
    }
    
    console.log(`Preferito rimosso con successo`);
    console.log(`==========================================\n`);

    res.json({ message: `Ricetta rimossa dai preferiti` });
  } catch (error) {
    console.error(`❌ Errore rimozione dai preferiti:`, error);
    console.error(`Stack:`, error.stack);
    res.status(500).json({ error: `Errore del server`, details: error.message });
  }
});

// POST - Aggiungi recensione
router.post(`/:id/review`, async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: `Non autenticato` });
  }

  const { id } = req.params;
  const { rating, comment } = req.body;

  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({ error: `Valutazione non valida` });
  }

  try {
    await db(`reviews`).insert({
      recipe_id: id,
      user_id: req.user.id,
      rating,
      comment: comment || null
    });

    res.json({ message: `Recensione aggiunta con successo` });
  } catch (error) {
    console.error(`Errore nell\`aggiunta della recensione:`, error);
    res.status(500).json({ error: `Errore del server` });
  }
});

module.exports = router;
