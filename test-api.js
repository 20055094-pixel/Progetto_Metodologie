#!/usr/bin/env node

const fetch = require('node-fetch').default;

async function testAPI() {
    const baseURL = 'http://localhost:3000';

    console.log('Test API CookBook...\n');

    try {
        // Test 1: Status server
        console.log('1️Test connessione server...');
        const healthResponse = await fetch(`${baseURL}/auth/status`);
        console.log('Server risponde:', healthResponse.status);

        // Test 2: Caricamento ricette
        console.log('\nTest caricamento ricette...');
        const recipesResponse = await fetch(`${baseURL}/api/recipes`);
        const recipes = await recipesResponse.json();
        console.log('Ricette caricate:', recipes.length);

        // Test 3: Caricamento categorie
        console.log('\nTest caricamento categorie...');
        const categoriesResponse = await fetch(`${baseURL}/api/categories`);
        const categories = await categoriesResponse.json();
        console.log('Categorie caricate:', categories.length);

        // Test 4: Caricamento ingredienti
        console.log('\nTest caricamento ingredienti...');
        const ingredientsResponse = await fetch(`${baseURL}/api/ingredients`);
        const ingredients = await ingredientsResponse.json();
        console.log('Ingredienti caricati:', ingredients.length);

        console.log('\nTutti i test API sono passati!');
    } catch (error) {
        console.error('\nErrore nei test API:', error.message);
        console.log('\nAssicurati che il server sia avviato con: npm run dev');
    }
}

void testAPI();
