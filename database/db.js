const knex = require(`knex`);
const path = require(`path`);

const db = knex({
    client: `sqlite3`,
    connection: {
        filename: process.env.DB_PATH || path.join(__dirname, `ricette.db`)
    },
    useNullAsDefault: true
});

// Inizializzazione database
const initDatabase = async () => {
  console.log(`Inizializzazione database...`);

  try {
    // Tabella utenti
    if (!(await db.schema.hasTable(`users`))) {
      await db.schema.createTable(`users`, (table) => {
        table.increments(`id`).primary();
        table.string(`google_id`).unique();
        table.string(`name`).notNullable();
        table.string(`email`).unique().notNullable();
        table.string(`password`); // Aggiunto per login semplice
        table.enum(`role`, [`user`, `chef`, `admin`]).defaultTo(`user`);
        table.timestamp(`created_at`).defaultTo(db.fn.now());
        table.timestamp(`updated_at`).defaultTo(db.fn.now());
      });
      console.log(`Tabella users creata`);
    } else {
      // Verifica se la colonna password esiste, altrimenti la aggiunge
      const hasPasswordColumn = await db.schema.hasColumn(`users`, `password`);
      if (!hasPasswordColumn) {
        console.log(`Aggiunta colonna password alla tabella users...`);
        await db.schema.table(`users`, (table) => {
          table.string(`password`);
        });
        console.log(`Colonna password aggiunta`);
      }
    }

    // Tabella categorie
    if (!(await db.schema.hasTable(`categories`))) {
      await db.schema.createTable(`categories`, (table) => {
        table.increments(`id`).primary();
        table.string(`name`).unique().notNullable();
        table.text(`description`);
        table.timestamp(`created_at`).defaultTo(db.fn.now());
        table.timestamp(`updated_at`).defaultTo(db.fn.now());
      });
      console.log(`Tabella categories creata`);
      
      // Inserisci categorie di default
      const categoriesExist = await db(`categories`).count(`* as count`).first();
      if (categoriesExist.count === 0) {
        await db(`categories`).insert([
          { name: `Antipasti`, description: `Antipasti e stuzzichini` },
          { name: `Primi Piatti`, description: `Pasta, risotti e zuppe` },
          { name: `Secondi Piatti`, description: `Carne e pesce` },
          { name: `Contorni`, description: `Verdure e contorni` },
          { name: `Dolci`, description: `Dessert e dolci` },
          { name: `Pizza e Focaccia`, description: `Pizza, focaccia e pane` }
        ]);
        console.log(`Categorie inserite`);
      }
    }

    // Tabella ingredienti
    if (!(await db.schema.hasTable(`ingredients`))) {
      await db.schema.createTable(`ingredients`, (table) => {
        table.increments(`id`).primary();
        table.string(`name`).unique().notNullable();
        table.string(`unit`).defaultTo(`g`);
        table.timestamp(`created_at`).defaultTo(db.fn.now());
        table.timestamp(`updated_at`).defaultTo(db.fn.now());
      });
      console.log(`Tabella ingredients creata`);
      
      // Inserisci ingredienti comuni
      const ingredientsExist = await db(`ingredients`).count(`* as count`).first();
      if (ingredientsExist.count === 0) {
        await db(`ingredients`).insert([
          { name: `Farina`, unit: `g` },
          { name: `Zucchero`, unit: `g` },
          { name: `Sale`, unit: `g` },
          { name: `Olio extravergine`, unit: `ml` },
          { name: `Burro`, unit: `g` },
          { name: `Uova`, unit: `pz` },
          { name: `Latte`, unit: `ml` },
          { name: `Pomodoro`, unit: `g` },
          { name: `Cipolla`, unit: `pz` },
          { name: `Aglio`, unit: `spicchi` },
          { name: `Mozzarella`, unit: `g` },
          { name: `Parmigiano`, unit: `g` },
          { name: `Pepe nero`, unit: `g` },
          { name: `Basilico`, unit: `foglie` },
          { name: `Passata di pomodoro`, unit: `g` },
          { name: `Lievito di birra`, unit: `g` },
          { name: `Acqua`, unit: `ml` },
          { name: `Riso Arborio`, unit: `g` },
          { name: `Funghi porcini`, unit: `g` },
          { name: `Brodo vegetale`, unit: `ml` },
          { name: `Vino bianco`, unit: `ml` },
          { name: `Pomodorini`, unit: `g` },
          { name: `Prezzemolo`, unit: `g` },
          { name: `Rosmarino`, unit: `g` },
          { name: `Origano`, unit: `g` },
          { name: `Aceto balsamico`, unit: `ml` },
          { name: `Pepe`, unit: `g` },
          { name: `Limone`, unit: `pz` },
          { name: `Scalogno`, unit: `pz` },
          { name: `Timo`, unit: `g` },
          { name: `Pasta`, unit: `g` },
          { name: `Pollo`, unit: `g` },
          { name: `Manzo`, unit: `g` },
          { name: `Pesce`, unit: `g` },
          { name: `Insalata`, unit: `g` },
          { name: `Carota`, unit: `g` },
          { name: `Patate`, unit: `g` }
        ]);
        console.log(`Ingredienti inseriti`);
      }
    }

    // Tabella ricette
    if (!(await db.schema.hasTable(`recipes`))) {
      await db.schema.createTable(`recipes`, (table) => {
        table.increments(`id`).primary();
        table.string(`title`).notNullable();
        table.text(`description`);
        table.text(`instructions`).notNullable();
        table.integer(`prep_time`);
        table.integer(`cook_time`);
        table.enum(`difficulty`, [`facile`, `medio`, `difficile`]).defaultTo(`facile`);
        table.integer(`servings`).defaultTo(4);
        table.string(`image_url`);
        table.integer(`chef_id`).unsigned().references(`id`).inTable(`users`).onDelete(`CASCADE`);
        table.integer(`category_id`).unsigned().references(`id`).inTable(`categories`);
        table.timestamp(`created_at`).defaultTo(db.fn.now());
        table.timestamp(`updated_at`).defaultTo(db.fn.now());
      });
      console.log(`Tabella recipes creata`);
    }

    // Tabella ingredienti ricette
    if (!(await db.schema.hasTable(`recipe_ingredients`))) {
      await db.schema.createTable(`recipe_ingredients`, (table) => {
        table.increments(`id`).primary();
        table.integer(`recipe_id`).unsigned().references(`id`).inTable(`recipes`).onDelete(`CASCADE`);
        table.integer(`ingredient_id`).unsigned().references(`id`).inTable(`ingredients`);
        table.decimal(`quantity`, 10, 2);
        table.string(`unit`);
      });
      console.log(`Tabella recipe_ingredients creata`);
    }

    // Tabella preferiti
    if (!(await db.schema.hasTable(`favorites`))) {
      await db.schema.createTable(`favorites`, (table) => {
        table.increments(`id`).primary();
        table.integer(`user_id`).unsigned().references(`id`).inTable(`users`).onDelete(`CASCADE`);
        table.integer(`recipe_id`).unsigned().references(`id`).inTable(`recipes`).onDelete(`CASCADE`);
        table.timestamp(`created_at`).defaultTo(db.fn.now());
        table.unique([`user_id`, `recipe_id`]);
      });
      console.log(`Tabella favorites creata`);
    }

    // Tabella recensioni
    if (!(await db.schema.hasTable(`reviews`))) {
      await db.schema.createTable(`reviews`, (table) => {
        table.increments(`id`).primary();
        table.integer(`user_id`).unsigned().references(`id`).inTable(`users`).onDelete(`CASCADE`);
        table.integer(`recipe_id`).unsigned().references(`id`).inTable(`recipes`).onDelete(`CASCADE`);
        table.integer(`rating`).notNullable();
        table.text(`comment`);
        table.timestamp(`created_at`).defaultTo(db.fn.now());
        table.timestamp(`updated_at`).defaultTo(db.fn.now());
        table.unique([`user_id`, `recipe_id`]);
      });
      console.log(`Tabella reviews creata`);
    }

    // Inserisci utenti di test se non esistono
    const usersCount = await db(`users`).count(`* as count`).first();
    if (usersCount.count === 0) {
      await db(`users`).insert([
        { 
          email: `admin@cookbook.com`, 
          password: `admin123`, 
          name: `Admin CookBook`, 
          role: `admin` 
        },
        { 
          email: `chef@cookbook.com`, 
          password: `chef123`, 
          name: `Chef Mario Rossi`, 
          role: `chef` 
        },
        { 
          email: `user@cookbook.com`, 
          password: `user123`, 
          name: `Utente Demo`, 
          role: `user` 
        }
      ]);
      console.log(`Utenti di test creati`);
      console.log(`Credenziali disponibili:`);
      console.log(`   Admin: admin@cookbook.com / admin123`);
      console.log(`   Chef: chef@cookbook.com / chef123`);
      console.log(`   User: user@cookbook.com / user123`);
    } else {
      // Verifica se gli utenti esistenti hanno la password impostata
      const usersWithoutPassword = await db(`users`).whereNull(`password`);
      if (usersWithoutPassword.length > 0) {
        console.log(`Aggiornamento password per utenti esistenti...`);
        await db(`users`).where(`email`, `admin@cookbook.com`).update({ password: `admin123` });
        await db(`users`).where(`email`, `chef@cookbook.com`).update({ password: `chef123` });
        await db(`users`).where(`email`, `user@cookbook.com`).update({ password: `user123` });
        console.log(`Password aggiornate per utenti esistenti`);
      }
    }

    console.log(`Database inizializzato correttamente!`);
    return true;
  } catch (error) {
    console.error(`Errore nell\`inizializzazione del database:`, error);
    return false;
  }
};

// Esporta sia il database che la funzione di inizializzazione
module.exports = db;
module.exports.initDatabase = initDatabase;
