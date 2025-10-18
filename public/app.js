class RecipeApp {
    constructor() {
        this.currentUser = null;
        this.currentRoute = '';
        this.currentParams = [];
        this.recipes = [];
        this.categories = [];
        this.ingredients = [];
        
        this.init();
    }

    async init() {
        console.log('Inizializzazione app...');
        
        try {
            // Prima controlla lo stato di autenticazione
            const authData = await this.checkAuthStatus();
            if (authData.authenticated) {
                this.currentUser = authData.user;
                console.log('Utente autenticato:', this.currentUser);
            }
            
            this.updateAuthUI();
            this.setupEventListeners();
            this.setupRouting();
            this.navigate(window.location.hash.slice(1) || 'home');
        } catch (error) {
            console.error('Errore inizializzazione:', error);
            // Mostra comunque l'interfaccia anche se c'è un errore
            this.setupEventListeners();
            this.setupRouting();
            this.navigate('home');
        }
    }

    async checkAuthStatus() {
        try {
            console.log('Controllo stato autenticazione...');
            const response = await fetch('/auth/status', {
                credentials: 'include'
            });
            
            if (!response.ok) {
                console.log('Response non OK:', response.status);
                return { authenticated: false };
            }
            
            const authData = await response.json();
            console.log('Auth data ricevuti:', authData);
            return authData;
        } catch (error) {
            console.error('❌ Errore controllo autenticazione:', error);
            return { authenticated: false };
        }
    }

    updateAuthUI() {
        const authLinks = document.getElementById('auth-links');
        
        if (this.currentUser) {
            authLinks.innerHTML = `
                <span style="color: white;">Ciao, ${this.currentUser.name}</span>
                <a href="#" data-route="dashboard">Dashboard</a>
                <a href="#" id="logout-btn">Logout</a>
            `;
            
            document.getElementById('logout-btn')?.addEventListener('click', (e) => {
                e.preventDefault();
                this.logout();
            });
        } else {
            authLinks.innerHTML = '<a href="#" data-route="login">Login</a>';
        }
    }

    async logout() {
        try {
            await fetch('/auth/logout', { method: 'POST' });
            this.currentUser = null;
            this.updateAuthUI();
            this.navigate('home');
            alert('Logout effettuato con successo!');
        } catch (error) {
            console.error('Errore durante il logout:', error);
        }
    }

    setupEventListeners() {
        document.addEventListener('click', (e) => {
            if (e.target.matches('[data-route]')) {
                e.preventDefault();
                this.navigate(e.target.dataset.route);
            }
            
            // Manipolazione DOM - eliminazione elementi
            if (e.target.classList.contains('delete-card')) {
                const card = e.target.closest('.recipe-card');
                if (card && confirm('Vuoi rimuovere questa card?')) {
                    this.removeElement(card);
                }
            }
        });

        window.addEventListener('popstate', () => {
            this.navigate(window.location.hash.slice(1) || 'home'); // Operatore || per default
        });
    }

    // Manipolazione client-side del DOM - eliminazione elemento
    removeElement(element) {
        element.classList.add('removing');
        setTimeout(() => {
            element.remove();
        }, 300);
    }

    setupRouting() {
        this.routes = {
            'home': this.renderHome.bind(this),
            'recipes': this.renderRecipes.bind(this),
            'recipe': this.renderRecipeDetail.bind(this),
            'add-recipe': this.renderRecipeForm.bind(this),
            'edit-recipe': this.renderRecipeForm.bind(this),
            'login': this.renderLogin.bind(this),
            'dashboard': this.renderDashboard.bind(this)
        };
    }

    navigate(route) {
        const [routeName, ...params] = route.split('/');
        this.currentRoute = routeName;
        this.currentParams = params;
        
        window.location.hash = route;
        
        const handler = this.routes[routeName] || this.routes['home']; // Operatore || per fallback
        handler();
    }

    async renderHome() {
        const template = document.getElementById('home-template');
        const content = template.content.cloneNode(true);
        
        document.getElementById('app').innerHTML = '';
        document.getElementById('app').appendChild(content);
        
        await this.loadFeaturedRecipes();
    }

    async loadFeaturedRecipes() {
        console.log('Caricamento ricette in evidenza...');
        try {
            const response = await fetch('/api/recipes');
            console.log('Response status:', response.status);
            
            if (!response.ok) {
                throw new Error('Errore nel caricamento');
            }
            
            const recipes = await response.json();
            console.log('Ricette caricate:', recipes.length, recipes);
            
            const grid = document.getElementById('featured-recipes-grid');
            if (!grid) {
                console.error('❌ Grid non trovato!');
                return;
            }
            
            grid.innerHTML = '';
            
            if (recipes.length === 0) {
                grid.innerHTML = `
                    <div style="grid-column: 1/-1; text-align: center; padding: 3rem;">
                        <h3>😔 Nessuna ricetta disponibile</h3>
                        <p>Il database sembra vuoto</p>
                    </div>
                `;
            } else {
                recipes.forEach(recipe => {
                    const card = this.createRecipeCard(recipe);
                    grid.appendChild(card);
                });
            }
        } catch (error) {
            console.error('❌ Errore nel caricamento ricette:', error);
            const grid = document.getElementById('featured-recipes-grid');
            if (grid) {
                grid.innerHTML = `
                    <div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: red;">
                        <h3>❌ Errore di caricamento</h3>
                        <p>Impossibile caricare le ricette: ${error.message}</p>
                        <p><small>Controlla che il server sia attivo</small></p>
                    </div>
                `;
            }
        }
    }

    async renderRecipes() {
        const template = document.getElementById('recipes-template');
        const content = template.content.cloneNode(true);
        
        document.getElementById('app').innerHTML = '';
        document.getElementById('app').appendChild(content);
        
        if (this.currentUser && (this.currentUser.role === 'chef' || this.currentUser.role === 'admin')) {
            document.getElementById('authenticated-actions').style.display = 'block';
            document.getElementById('add-recipe-btn').addEventListener('click', () => {
                this.navigate('add-recipe');
            });
        }
        
        await this.loadCategories();
        this.setupFilters();
        await this.loadRecipes();
    }

    async loadCategories() {
        try {
            if (this.categories.length === 0) {
                const response = await fetch('/api/categories');
                this.categories = await response.json();
            }
            
            const categoryFilter = document.getElementById('category-filter');
            if (categoryFilter) {
                // Pulisci e ripopola il filtro categoria
                categoryFilter.innerHTML = '<option value="">Tutte le categorie</option>';
                this.categories.forEach(category => {
                    const option = document.createElement('option');
                    option.value = category.id;
                    option.textContent = category.name;
                    categoryFilter.appendChild(option);
                });
            }
            
            console.log('Categorie caricate per filtri:', this.categories.length);
        } catch (error) {
            console.error('❌ Errore caricamento categorie per filtri:', error);
        }
    }

    setupFilters() {
        const applyBtn = document.getElementById('apply-filters');
        const clearBtn = document.getElementById('clear-filters');
        const searchInput = document.getElementById('search-filter');
        
        applyBtn?.addEventListener('click', () => this.applyFilters());
        clearBtn?.addEventListener('click', () => this.clearFilters());
        
        // Ricerca solo su pressione di Invio
        searchInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.applyFilters();
            }
        });
        
        // Rimuovo l'applicazione automatica dei filtri sui dropdown
        // I filtri ora si applicano solo cliccando "Applica filtri" o premendo Invio sulla ricerca
    }

    async applyFilters() {
        console.log('Applicazione filtri...');
        
        const categoryEl = document.getElementById('category-filter');
        const difficultyEl = document.getElementById('difficulty-filter');
        const prepTimeEl = document.getElementById('prep-time-filter');
        const searchEl = document.getElementById('search-filter');
        
        if (!categoryEl || !difficultyEl || !prepTimeEl || !searchEl) {
            console.error('❌ Elementi del filtro non trovati!');
            return;
        }
        
        const filters = {
            category: categoryEl.value || null,
            difficulty: difficultyEl.value || null,
            prep_time: prepTimeEl.value || null,
            search: searchEl.value || ''
        };
        
        console.log('Filtri applicati:', filters);
        await this.loadRecipes(filters);
    }

    clearFilters() {
        document.getElementById('category-filter').value = '';
        document.getElementById('difficulty-filter').value = '';
        document.getElementById('prep-time-filter').value = '';
        document.getElementById('search-filter').value = '';
        
        this.loadRecipes();
    }

    async loadRecipes(filters = {}) {
        try {
            console.log('Caricamento ricette con filtri:', filters);
            const params = new URLSearchParams();
            Object.keys(filters).forEach(key => {
                if (filters[key]) params.append(key, filters[key]);
            });
            
            const response = await fetch(`/api/recipes?${params}`);
            
            if (!response.ok) {
                throw new Error('Errore nel caricamento');
            }
            
            const recipes = await response.json();
            console.log('Ricette caricate:', recipes.length);
            
            const grid = document.getElementById('recipes-grid');
            if (!grid) {
                console.error('Grid ricette non trovato!');
                return;
            }
            
            grid.innerHTML = '';
            
            if (recipes.length === 0) {
                grid.innerHTML = `
                    <div style="grid-column: 1/-1; text-align: center; padding: 3rem;">
                        <h3>😔 Nessuna ricetta trovata</h3>
                        <p>Prova a modificare i filtri di ricerca</p>
                        ${this.currentUser && (this.currentUser.role === 'chef' || this.currentUser.role === 'admin') ? 
                            '<button class="btn-primary" onclick="location.hash=\'add-recipe\'">Crea la prima ricetta</button>' : ''
                        }
                    </div>
                `;
            } else {
                recipes.forEach(recipe => {
                    const card = this.createRecipeCard(recipe);
                    grid.appendChild(card);
                });
                console.log('Ricette visualizzate:', recipes.length);
            }
        } catch (error) {
            console.error('❌ Errore nel caricamento delle ricette:', error);
            const grid = document.getElementById('recipes-grid');
            if (grid) {
                grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: red;">Errore nel caricamento delle ricette</p>';
            }
        }
    }

    createRecipeCard(recipe) {
        const card = document.createElement('div');
        card.className = 'recipe-card';
        
        // Placeholder SVG migliorato
        const placeholderSVG = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="200"%3E%3Crect fill="%23e5e7eb" width="400" height="200"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="Arial,sans-serif" font-size="18" fill="%23666"%3E🍽️ Nessuna immagine%3C/text%3E%3C/svg%3E';
        
        const imageUrl = recipe.image_url && recipe.image_url !== 'null' ? recipe.image_url : placeholderSVG;
        
        card.innerHTML = `
            <img src="${imageUrl}" alt="${recipe.title}" onerror="this.src='${placeholderSVG}'">
            <div class="recipe-card-content">
                <h3>${recipe.title}</h3>
                <p>${recipe.description || 'Nessuna descrizione disponibile'}</p>
                <div class="recipe-meta">
                    <span>👨‍🍳 ${recipe.chef_name || 'Anonimo'}</span>
                    <span>📂 ${recipe.category_name || 'Altro'}</span>
                    <span>⚡ ${recipe.difficulty || 'facile'}</span>
                    <span>⏱️ ${recipe.prep_time || 0} min</span>
                </div>
            </div>
        `;
        
        card.addEventListener('click', () => {
            this.navigate(`recipe/${recipe.id}`);
        });
        
        return card;
    }

    async renderRecipeDetail() {
        const recipeId = this.currentParams[0];
        if (!recipeId) return this.navigate('recipes');
        
        try {
            const response = await fetch(`/api/recipes/${recipeId}`);
            if (!response.ok) throw new Error('Ricetta non trovata');
            
            const recipe = await response.json();
            
            const template = document.getElementById('recipe-detail-template');
            const content = template.content.cloneNode(true);
            
            content.getElementById('recipe-title').textContent = recipe.title;
            content.getElementById('recipe-chef').textContent = `👨‍🍳 ${recipe.chef_name || 'Anonimo'}`;
            content.getElementById('recipe-category').textContent = `📂 ${recipe.category_name || 'Altro'}`;
            content.getElementById('recipe-difficulty').textContent = `⚡ ${recipe.difficulty || 'facile'}`;
            content.getElementById('prep-time').textContent = recipe.prep_time || 0;
            content.getElementById('cook-time').textContent = recipe.cook_time || 0;
            content.getElementById('servings').textContent = recipe.servings || 4;
            content.getElementById('instructions').innerHTML = recipe.instructions.replace(/\n/g, '<br>');
            content.getElementById('recipe-description').textContent = recipe.description || '';
            
            const recipeImage = content.getElementById('recipe-image');
            const placeholderSVG = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect fill="%23e5e7eb" width="400" height="300"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="Arial,sans-serif" font-size="24" fill="%23666"%3E🍽️ Nessuna immagine%3C/text%3E%3C/svg%3E';
            
            recipeImage.src = recipe.image_url && recipe.image_url !== 'null' ? recipe.image_url : placeholderSVG;
            recipeImage.alt = recipe.title;
            
            // Setup ingredienti con drag & drop
            this.setupIngredientsWithDragDrop(content, recipe.ingredients || []);
            
            // Setup azioni utente
            if (this.currentUser) {
                content.getElementById('favorite-btn').style.display = 'block';
                content.getElementById('favorite-btn').addEventListener('click', () => {
                    this.addToFavorites(recipe.id);
                });
                
                if (recipe.chef_id === this.currentUser.id || this.currentUser.role === 'admin') {
                    content.getElementById('recipe-owner-actions').style.display = 'flex';
                    content.getElementById('edit-recipe-btn').addEventListener('click', () => {
                        this.navigate(`edit-recipe/${recipe.id}`);
                    });
                    content.getElementById('delete-recipe-btn').addEventListener('click', () => {
                        this.deleteRecipe(recipe.id);
                    });
                }
                
                content.getElementById('add-review').style.display = 'block';
            }
            
            document.getElementById('app').innerHTML = '';
            document.getElementById('app').appendChild(content);
            
            if (this.currentUser) {
                this.setupReviewForm(recipe.id);
            }
            this.loadReviews(recipe.reviews || []);
            
        } catch (error) {
            console.error('Errore nel caricamento della ricetta:', error);
            alert('Errore nel caricamento della ricetta');
            this.navigate('recipes');
        }
    }

    // Gestione drag & drop per ingredienti
    setupIngredientsWithDragDrop(content, ingredients) {
        const ingredientsList = content.getElementById('ingredients-list');
        
        if (ingredients.length === 0) {
            ingredientsList.innerHTML = '<p>Nessun ingrediente specificato</p>';
            return;
        }
        
        // Verifica se l'utente può usare drag & drop (solo admin)
        const canDragDrop = this.currentUser && this.currentUser.role === 'admin';
        
        ingredients.forEach((ingredient, index) => {
            const item = document.createElement('div');
            item.className = 'ingredient-item';
            
            // Abilita drag & drop solo per admin
            if (canDragDrop) {
                item.draggable = true;
                item.dataset.index = index;
            }
            
            item.innerHTML = `
                <span><strong>${ingredient.name}</strong></span>
                <span>${ingredient.quantity} ${ingredient.unit}</span>
            `;
            
            // Event listeners per drag & drop - solo per admin
            if (canDragDrop) {
                item.addEventListener('dragstart', (e) => {
                    item.classList.add('dragging');
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', index);
                });
                
                item.addEventListener('dragend', () => {
                    item.classList.remove('dragging');
                    // Rimuovi tutti i drag-over alla fine
                    document.querySelectorAll('.ingredient-item').forEach(el => {
                        el.classList.remove('drag-over');
                    });
                });
                
                item.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    const afterElement = this.getDragAfterElement(ingredientsList, e.clientY);
                    const draggingElement = document.querySelector('.dragging');
                    if (afterElement == null) {
                        ingredientsList.appendChild(draggingElement);
                    } else {
                        ingredientsList.insertBefore(draggingElement, afterElement);
                    }
                });
                
                item.addEventListener('dragenter', (e) => {
                    e.preventDefault();
                    if (!item.classList.contains('dragging')) {
                        item.classList.add('drag-over');
                    }
                });
                
                item.addEventListener('dragleave', () => {
                    item.classList.remove('drag-over');
                });
                
                item.addEventListener('drop', (e) => {
                    e.preventDefault();
                    item.classList.remove('drag-over');
                });
            } else {
                // Per chef e utenti normali, aggiungi uno stile per indicare che non è draggable
                item.style.cursor = 'default';
            }
            
            ingredientsList.appendChild(item);
        });
        
        // Aggiungi un messaggio informativo solo per admin
        if (canDragDrop) {
            const hint = document.createElement('small');
            hint.style.cssText = 'display: block; margin-top: 0.5rem; color: #666; font-style: italic;';
            hint.textContent = '👑 Admin: Trascina gli ingredienti per riordinarli';
            hint.className = 'drag-hint';
            ingredientsList.appendChild(hint);
        }
    }

    getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.ingredient-item:not(.dragging)')];
        
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    async addToFavorites(recipeId) {
        try {
            const response = await fetch(`/api/recipes/${recipeId}/favorite`, {
                method: 'POST'
            });
            
            if (response.ok) {
                alert('✅ Ricetta aggiunta ai preferiti!');
                // Se siamo nella dashboard, ricarica i preferiti
                if (this.currentRoute === 'dashboard') {
                    await this.loadDashboardStats();
                    // Se la sezione preferiti è visibile, aggiornala
                    const section = document.getElementById('favorites-list');
                    if (section && section.style.display === 'block') {
                        await this.toggleFavorites(); // Chiude
                        await this.toggleFavorites(); // Riapre con dati aggiornati
                    }
                }
            } else {
                const error = await response.json();
                alert(error.error || 'Errore nell\'aggiunta ai preferiti');
            }
        } catch (error) {
            console.error('Errore:', error);
            alert('Errore nell\'aggiunta ai preferiti');
        }
    }

    setupReviewForm(recipeId) {
        const form = document.getElementById('review-form');
        const stars = document.querySelectorAll('.star');
        let selectedRating = 0;
        
        stars.forEach((star, index) => {
            star.addEventListener('click', () => {
                selectedRating = index + 1;
                stars.forEach((s, i) => {
                    s.classList.toggle('active', i < selectedRating);
                });
            });
            
            star.addEventListener('mouseover', () => {
                stars.forEach((s, i) => {
                    s.classList.toggle('active', i <= index);
                });
            });
        });
        
        document.getElementById('ingredients-list')?.addEventListener('mouseleave', () => {
            stars.forEach((s, i) => {
                s.classList.toggle('active', i < selectedRating);
            });
        });
        
        form?.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            if (selectedRating === 0) {
                alert('⭐ Seleziona una valutazione!');
                return;
            }
            
            const comment = document.getElementById('review-comment').value;
            
            try {
                const response = await fetch(`/api/recipes/${recipeId}/review`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ rating: selectedRating, comment })
                });
                
                if (response.ok) {
                    alert('✅ Recensione aggiunta con successo!');
                    this.navigate(`recipe/${recipeId}`);
                } else {
                    const error = await response.json();
                    alert(error.error || 'Errore nell\'aggiunta della recensione');
                }
            } catch (error) {
                console.error('Errore:', error);
                alert('Errore nell\'aggiunta della recensione');
            }
        });
    }

    loadReviews(reviews) {
        const reviewsList = document.getElementById('reviews-list');
        if (!reviewsList) return;
        
        reviewsList.innerHTML = '';
        
        if (reviews.length === 0) {
            reviewsList.innerHTML = '<p>Nessuna recensione ancora. Sii il primo a recensire!</p>';
            return;
        }
        
        reviews.forEach(review => {
            const reviewItem = document.createElement('div');
            reviewItem.className = 'review-item';
            reviewItem.innerHTML = `
                <div class="review-header" style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                    <strong>${review.user_name}</strong>
                    <div class="stars">
                        ${Array.from({length: 5}, (_, i) => 
                            `<span class="star ${i < review.rating ? 'active' : ''}">★</span>`
                        ).join('')}
                    </div>
                </div>
                <p>${review.comment || 'Nessun commento'}</p>
                <small style="color: #666;">${new Date(review.created_at).toLocaleDateString('it-IT')}</small>
            `;
            reviewsList.appendChild(reviewItem);
        });
    }

    async renderRecipeForm() {
        const isEdit = this.currentRoute === 'edit-recipe';
        const recipeId = isEdit ? this.currentParams[0] : null;
        
        if (!this.currentUser || (this.currentUser.role !== 'chef' && this.currentUser.role !== 'admin')) {
            alert('⚠️ Devi essere un cuoco per creare ricette!');
            return this.navigate('login');
        }
        
        const template = document.getElementById('recipe-form-template');
        const content = template.content.cloneNode(true);
        
        content.getElementById('form-title').textContent = isEdit ? 'Modifica Ricetta' : 'Nuova Ricetta';
        
        document.getElementById('app').innerHTML = '';
        document.getElementById('app').appendChild(content);
        
        await this.loadCategoriesForForm();
        await this.loadIngredientsForForm();
        
        // Setup form PRIMA di caricare i dati
        this.setupRecipeFormOnce(isEdit, recipeId);
        
        if (isEdit && recipeId) {
            await this.loadRecipeForEdit(recipeId);
        } else {
            // Aggiungi la prima riga solo per nuove ricette
            this.addIngredientRow();
        }
    }

    async loadCategoriesForForm() {
        const categorySelect = document.getElementById('category');
        if (!categorySelect) return;
        
        try {
            // Carica le categorie dall'API se non sono già caricate
            if (this.categories.length === 0) {
                const response = await fetch('/api/categories');
                this.categories = await response.json();
            }
            
            // Pulisci le opzioni esistenti (tranne la prima)
            categorySelect.innerHTML = '<option value="">Seleziona categoria</option>';
            
            this.categories.forEach(category => {
                const option = document.createElement('option');
                option.value = category.id;
                option.textContent = category.name;
                categorySelect.appendChild(option);
            });
            
            console.log('Categorie caricate nel form:', this.categories.length);
        } catch (error) {
            console.error('❌ Errore caricamento categorie:', error);
        }
    }

    async loadIngredientsForForm() {
        try {
            const response = await fetch('/api/ingredients');
            this.ingredients = await response.json();
        } catch (error) {
            console.error('Errore nel caricamento degli ingredienti:', error);
        }
    }

    addIngredientRow(ingredient = null) {
        console.log('Aggiunta riga ingrediente:', ingredient);
        
        const container = document.getElementById('ingredients-container');
        if (!container) {
            console.error('❌ Container ingredienti non trovato!');
            return;
        }
        
        const row = document.createElement('div');
        row.className = 'ingredient-row';
        
        // Costruisci le opzioni select
        const ingredientOptions = this.ingredients.map(ing => {
            const isSelected = ingredient && (
                ingredient.ingredient_id === ing.id || 
                ingredient.id === ing.id
            );
            
            return `<option value="${ing.id}" ${isSelected ? 'selected' : ''}>
                ${ing.name}
            </option>`;
        }).join('');
        
        row.innerHTML = `
            <select class="ingredient-select" required>
                <option value="">Seleziona ingrediente</option>
                ${ingredientOptions}
            </select>
            <input type="number" class="ingredient-quantity" placeholder="Quantità" value="${ingredient ? ingredient.quantity : ''}" required step="0.01" min="0">
            <input type="text" class="ingredient-unit" placeholder="Unità" value="${ingredient ? ingredient.unit : 'g'}" required>
            <button type="button" class="btn-danger remove-ingredient">✖️</button>
        `;
        
        // Event listener per rimuovere la riga - CON STOPPPROPAGATION
        const removeBtn = row.querySelector('.remove-ingredient');
        removeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Rimozione riga ingrediente');
            row.remove();
        });
        
        container.appendChild(row);
        console.log('Riga ingrediente aggiunta. Totale righe:', container.children.length);
    }

    setupRecipeFormOnce(isEdit, recipeId) {
        console.log('Setup form ricetta...');
        
        const form = document.getElementById('recipe-form');
        const addIngredientBtn = document.getElementById('add-ingredient');
        const cancelBtn = document.getElementById('cancel-form');
        const imageInput = document.getElementById('recipe-image');
        
        if (!form || !addIngredientBtn) {
            console.error('❌ Elementi del form non trovati!');
            return;
        }
        
        // Rimuovi eventuali listener precedenti clonando gli elementi
        const newAddBtn = addIngredientBtn.cloneNode(true);
        addIngredientBtn.parentNode.replaceChild(newAddBtn, addIngredientBtn);
        
        // Aggiungi listener per aggiungere ingredienti
        newAddBtn.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('Click su aggiungi ingrediente');
            this.addIngredientRow();
        });
        
        cancelBtn?.addEventListener('click', () => {
            this.navigate('recipes');
        });
        
        imageInput?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const preview = document.getElementById('image-preview');
                    const img = document.getElementById('preview-img');
                    img.src = event.target.result;
                    preview.style.display = 'block';
                };
                reader.readAsDataURL(file);
            }
        });
        
        // Setup submit del form
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const submitBtn = form.querySelector('button[type="submit"]');
            if (submitBtn.disabled) return;
            
            submitBtn.disabled = true;
            submitBtn.textContent = '⏳ Salvataggio...';
            
            try {
                await this.handleRecipeSubmit(isEdit, recipeId);
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = '💾 Salva Ricetta';
            }
        });
        
        console.log('Setup form completato');
    }

    async handleRecipeSubmit(isEdit, recipeId) {
        const form = document.getElementById('recipe-form');
        const formData = new FormData(form);
        
        const ingredients = [];
        const rows = document.querySelectorAll('.ingredient-row');
        rows.forEach(row => {
            const ingredientId = row.querySelector('.ingredient-select').value;
            const quantity = row.querySelector('.ingredient-quantity').value;
            const unit = row.querySelector('.ingredient-unit').value;
            
            if (ingredientId && quantity) {
                ingredients.push({
                    ingredient_id: parseInt(ingredientId),
                    quantity: parseFloat(quantity),
                    unit: unit || 'g'
                });
            }
        });
        
        let imageUrl = null;
        const imageFile = document.getElementById('recipe-image').files[0];
        
        if (imageFile) {
            console.log('Nuovo file immagine caricato:', imageFile.name, 'Dimensione:', imageFile.size);
            
            // Verifica dimensione file (max 1MB per Data URL)
            if (imageFile.size > 1000000) {
                alert('⚠️ Immagine troppo grande! Massimo 1MB. Dimensione attuale: ' + (imageFile.size / 1000000).toFixed(2) + 'MB');
                return;
            }
            
            const reader = new FileReader();
            imageUrl = await new Promise((resolve, reject) => {
                reader.onload = (e) => {
                    console.log('Immagine caricata, lunghezza:', e.target.result.length);
                    resolve(e.target.result);
                };
                reader.onerror = reject;
                reader.readAsDataURL(imageFile);
            });
        } else if (isEdit) {
            // Mantieni l'immagine esistente
            const previewImg = document.getElementById('preview-img');
            if (previewImg && previewImg.src && !previewImg.src.includes('placeholder')) {
                imageUrl = previewImg.src;
                console.log('Mantenimento immagine esistente');
            }
        }
        
        const recipeData = {
            title: formData.get('title'),
            description: formData.get('description'),
            category_id: parseInt(formData.get('category')),
            difficulty: formData.get('difficulty'),
            prep_time: parseInt(formData.get('prep-time')),
            cook_time: parseInt(formData.get('cook-time')),
            servings: parseInt(formData.get('servings')),
            instructions: formData.get('instructions'),
            image_url: imageUrl,
            ingredients: ingredients
        };
        
        console.log('Dati ricetta da inviare:', {
            ...recipeData,
            image_url: imageUrl ? `[Data URL ${imageUrl.substring(0, 30)}... lunghezza: ${imageUrl.length}]` : null
        });
        
        try {
            const url = isEdit ? `/api/recipes/${recipeId}` : '/api/recipes';
            const method = isEdit ? 'PUT' : 'POST';
            
            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(recipeData)
            });
            
            if (response.ok) {
                alert(isEdit ? '✅ Ricetta aggiornata!' : '✅ Ricetta creata!');
                this.navigate('recipes');
            } else {
                const error = await response.json();
                alert('❌ ' + (error.error || 'Errore nel salvataggio'));
            }
        } catch (error) {
            console.error('Errore:', error);
            alert('❌ Errore di connessione');
        }
    }

    async loadRecipeForEdit(recipeId) {
        try {
            const response = await fetch(`/api/recipes/${recipeId}`);
            if (!response.ok) throw new Error('Ricetta non trovata');
            
            const recipe = await response.json();
            
            document.getElementById('title').value = recipe.title;
            document.getElementById('description').value = recipe.description || '';
            document.getElementById('category').value = recipe.category_id;
            document.getElementById('difficulty').value = recipe.difficulty;
            document.getElementById('prep-time').value = recipe.prep_time;
            document.getElementById('cook-time').value = recipe.cook_time;
            document.getElementById('servings').value = recipe.servings;
            document.getElementById('instructions').value = recipe.instructions;
            
            // Gestisci preview immagine esistente
            if (recipe.image_url && recipe.image_url !== 'null') {
                const preview = document.getElementById('image-preview');
                const img = document.getElementById('preview-img');
                img.src = recipe.image_url;
                preview.style.display = 'block';
                console.log('Immagine esistente caricata nel form');
            }
            
            // SVUOTA il container prima di aggiungere gli ingredienti
            const container = document.getElementById('ingredients-container');
            container.innerHTML = '';
            
            if (recipe.ingredients && recipe.ingredients.length > 0) {
                recipe.ingredients.forEach(ing => {
                    this.addIngredientRow(ing);
                });
            } else {
                // Se non ci sono ingredienti, aggiungi almeno una riga vuota
                this.addIngredientRow();
            }
        } catch (error) {
            console.error('Errore nel caricamento della ricetta:', error);
            alert('Errore nel caricamento della ricetta');
            this.navigate('recipes');
        }
    }

    async renderDashboard() {
        if (!this.currentUser) {
            alert('⚠️ Devi effettuare il login!');
            return this.navigate('login');
        }
        
        const template = document.getElementById('dashboard-template');
        const content = template.content.cloneNode(true);
        
        content.getElementById('user-name').textContent = this.currentUser.name;
        
        // Mostra ruolo con icona appropriata
        const roleText = {
            'user': '👤 Utente (Visualizzazione e Preferiti)',
            'chef': '👨‍🍳 Chef (Può creare ricette)',
            'admin': '👑 Amministratore (Accesso completo)'
        };
        content.getElementById('user-role').textContent = roleText[this.currentUser.role] || this.currentUser.role;
        
        if (this.currentUser.role === 'chef' || this.currentUser.role === 'admin') {
            content.getElementById('chef-actions').style.display = 'block';
        }

        // Mostra card recensioni admin solo per admin
        if (this.currentUser.role === 'admin') {
            content.getElementById('admin-reviews-card').style.display = 'block';
        }
        
        document.getElementById('app').innerHTML = '';
        document.getElementById('app').appendChild(content);
        
        // Mostra capacità dell'utente
        this.displayUserCapabilities();
        
        // Carica statistiche
        await this.loadDashboardStats();
        
        document.getElementById('view-favorites')?.addEventListener('click', async () => {
            await this.toggleFavorites();
        });

        document.getElementById('view-my-reviews')?.addEventListener('click', async () => {
            await this.toggleMyReviews();
        });

        document.getElementById('view-all-reviews')?.addEventListener('click', async () => {
            await this.toggleAllReviews();
        });
    }

    displayUserCapabilities() {
        const capabilitiesList = document.getElementById('capabilities-list');
        if (!capabilitiesList) return;
        
        const capabilities = {
            'user': [
                '✅ Visualizzare tutte le ricette',
                '✅ Cercare ricette con filtri',
                '✅ Salvare ricette nei preferiti',
                '✅ Lasciare recensioni e valutazioni',
                '❌ Creare o modificare ricette',
                '❌ Gestire categorie e ingredienti'
            ],
            'chef': [
                '✅ Visualizzare tutte le ricette',
                '✅ Cercare ricette con filtri',
                '✅ Salvare ricette nei preferiti',
                '✅ Lasciare recensioni e valutazioni',
                '✅ Creare nuove ricette',
                '✅ Modificare ed eliminare le proprie ricette',
                '❌ Gestire categorie e ingredienti',
                '❌ Modificare ricette di altri chef'
            ],
            'admin': [
                '✅ Visualizzare tutte le ricette',
                '✅ Cercare ricette con filtri',
                '✅ Salvare ricette nei preferiti',
                '✅ Lasciare recensioni e valutazioni',
                '✅ Creare nuove ricette',
                '✅ Modificare ed eliminare TUTTE le ricette',
                '✅ Gestire categorie e ingredienti',
                '✅ Moderare contenuti e recensioni',
                '✅ Gestire utenti'
            ]
        };
        
        const userCapabilities = capabilities[this.currentUser.role] || capabilities['user'];
        
        capabilitiesList.innerHTML = userCapabilities.map(cap => 
            `<div class="capability-item">${cap}</div>`
        ).join('');
    }

    async loadDashboardStats() {
        try {
            if (this.currentUser.role === 'chef' || this.currentUser.role === 'admin') {
                const response = await fetch('/api/users/recipes');
                if (response.ok) {
                    const recipes = await response.json();
                    const countEl = document.getElementById('my-recipes-count');
                    if (countEl) {
                        countEl.textContent = `${recipes.length} ricette create`;
                    }
                }
            } else {
                // Nascondi sezione "Le mie ricette" per utenti normali
                const myRecipesSection = document.querySelector('.dashboard-card:first-child');
                if (myRecipesSection && myRecipesSection.textContent.includes('Le Mie Ricette')) {
                    myRecipesSection.style.display = 'none';
                }
            }
            
            // Carica i preferiti per tutti gli utenti
            const favResponse = await fetch('/api/users/favorites');
            if (favResponse.ok) {
                const favorites = await favResponse.json();
                const countEl = document.getElementById('favorites-count');
                if (countEl) {
                    countEl.textContent = `${favorites.length} ricette preferite`;
                }
            }

            // Carica le recensioni dell'utente
            const reviewsResponse = await fetch('/api/users/reviews');
            if (reviewsResponse.ok) {
                const reviews = await reviewsResponse.json();
                const countEl = document.getElementById('reviews-count');
                if (countEl) {
                    countEl.textContent = `${reviews.length} recensioni`;
                }
            }

            // Carica tutte le recensioni per admin
            if (this.currentUser.role === 'admin') {
                const allReviewsResponse = await fetch('/api/users/all-reviews');
                if (allReviewsResponse.ok) {
                    const allReviews = await allReviewsResponse.json();
                    const countEl = document.getElementById('all-reviews-count');
                    if (countEl) {
                        countEl.textContent = `${allReviews.length} recensioni totali`;
                    }
                }
            }
        } catch (error) {
            console.error('❌ Errore nel caricamento delle statistiche:', error);
        }
    }

    async toggleMyReviews() {
        const section = document.getElementById('my-reviews-list');
        const container = document.getElementById('my-reviews-container');
        
        if (section.style.display === 'none' || !section.style.display) {
            console.log('Apertura sezione recensioni...');
            try {
                const response = await fetch('/api/users/reviews');
                console.log('Response reviews:', response.status);
                
                if (!response.ok) {
                    throw new Error('Errore nel caricamento delle recensioni');
                }
                
                const reviews = await response.json();
                console.log('Recensioni ricevute:', reviews.length, reviews);
                
                container.innerHTML = '';
                
                if (reviews.length === 0) {
                    container.innerHTML = `
                        <div style="text-align: center; padding: 2rem;">
                            <h3>😔 Nessuna recensione ancora</h3>
                            <p>Lascia una recensione su una ricetta per vederla qui!</p>
                            <a href="#recipes" data-route="recipes" class="btn-primary" style="margin-top: 1rem; display: inline-block; text-decoration: none;">
                                Esplora Ricette
                            </a>
                        </div>
                    `;
                } else {
                    reviews.forEach(review => {
                        const reviewCard = this.createReviewCard(review);
                        container.appendChild(reviewCard);
                    });
                }
                
                section.style.display = 'block';
                console.log('Sezione recensioni aperta');
            } catch (error) {
                console.error('❌ Errore caricamento recensioni:', error);
                container.innerHTML = `
                    <div style="text-align: center; padding: 2rem; color: red;">
                        <h3>❌ Errore</h3>
                        <p>Impossibile caricare le recensioni: ${error.message}</p>
                    </div>
                `;
                section.style.display = 'block';
            }
        } else {
            console.log('Chiusura sezione recensioni');
            section.style.display = 'none';
        }
    }

    async toggleAllReviews() {
        const section = document.getElementById('all-reviews-list');
        const container = document.getElementById('all-reviews-container');
        
        if (section.style.display === 'none' || !section.style.display) {
            console.log('Apertura sezione tutte le recensioni (admin)...');
            try {
                const response = await fetch('/api/users/all-reviews');
                console.log('Response all reviews:', response.status);
                
                if (!response.ok) {
                    throw new Error('Errore nel caricamento delle recensioni');
                }
                
                const reviews = await response.json();
                console.log('Tutte le recensioni ricevute:', reviews.length, reviews);
                
                container.innerHTML = '';
                
                if (reviews.length === 0) {
                    container.innerHTML = `
                        <div style="text-align: center; padding: 2rem;">
                            <h3>😔 Nessuna recensione nel sistema</h3>
                            <p>Non ci sono ancora recensioni da moderare</p>
                        </div>
                    `;
                } else {
                    reviews.forEach(review => {
                        const reviewCard = this.createAdminReviewCard(review);
                        container.appendChild(reviewCard);
                    });
                }
                
                section.style.display = 'block';
                console.log('Sezione tutte le recensioni aperta');
            } catch (error) {
                console.error('❌ Errore caricamento tutte le recensioni:', error);
                container.innerHTML = `
                    <div style="text-align: center; padding: 2rem; color: red;">
                        <h3>❌ Errore</h3>
                        <p>Impossibile caricare le recensioni: ${error.message}</p>
                    </div>
                `;
                section.style.display = 'block';
            }
        } else {
            console.log('Chiusura sezione tutte le recensioni');
            section.style.display = 'none';
        }
    }

    createAdminReviewCard(review) {
        const card = document.createElement('div');
        card.className = 'review-card';
        card.style.cssText = 'border: 1px solid #ddd; border-radius: 8px; padding: 1.5rem; background: white; border-left: 4px solid #f59e0b;';
        
        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
                <div style="flex: 1;">
                    <div style="display: flex; gap: 1rem; align-items: center; margin-bottom: 0.5rem;">
                        <h4 style="margin: 0;">
                            <a href="#recipe/${review.recipe_id}" style="color: #2c5282; text-decoration: none;">
                                ${review.recipe_title}
                            </a>
                        </h4>
                        <span style="background: #e5e7eb; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.85rem;">
                            👤 ${review.user_name}
                        </span>
                        <span style="background: #fef3c7; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.85rem;">
                            📧 ${review.user_email}
                        </span>
                    </div>
                    <div class="stars" style="color: #f59e0b; font-size: 1.2rem;">
                        ${Array.from({length: 5}, (_, i) => 
                            `<span class="star ${i < review.rating ? 'active' : ''}" style="${i < review.rating ? 'color: #f59e0b;' : 'color: #d1d5db;'}">★</span>`
                        ).join('')}
                    </div>
                </div>
                <div style="display: flex; gap: 0.5rem;">
                    <button class="btn-warning btn-edit-review" data-review-id="${review.id}" data-recipe-id="${review.recipe_id}" data-rating="${review.rating}" data-comment="${(review.comment || '').replace(/"/g, '&quot;')}" style="padding: 0.5rem 1rem; font-size: 0.9rem;">
                        ✏️ Modifica
                    </button>
                    <button class="btn-danger btn-delete-review" data-review-id="${review.id}" style="padding: 0.5rem 1rem; font-size: 0.9rem;">
                        🗑️ Elimina
                    </button>
                </div>
            </div>
            <p style="margin: 0.5rem 0; color: #4a5568; padding: 1rem; background: #f9fafb; border-radius: 4px;">
                ${review.comment || '<em style="color: #9ca3af;">Nessun commento</em>'}
            </p>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.5rem;">
                <small style="color: #718096;">
                    📅 ${new Date(review.created_at).toLocaleDateString('it-IT', { 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    })}
                </small>
                <span style="background: #fecaca; color: #991b1b; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.85rem; font-weight: bold;">
                    👑 ADMIN MODERATION
                </span>
            </div>
        `;
        
        // Event listener per modifica
        const editBtn = card.querySelector('.btn-edit-review');
        if (editBtn) {
            editBtn.addEventListener('click', () => {
                this.editReview(review);
            });
        }
        
        // Event listener per eliminazione
        const deleteBtn = card.querySelector('.btn-delete-review');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', async () => {
                await this.deleteReview(review.id);
                // Ricarica anche la sezione admin dopo l'eliminazione
                if (this.currentUser.role === 'admin') {
                    const section = document.getElementById('all-reviews-list');
                    if (section && section.style.display === 'block') {
                        await this.toggleAllReviews(); // Chiude
                        await this.toggleAllReviews(); // Riapre
                    }
                }
            });
        }
        
        return card;
    }

    async editReview(review) {
        const newComment = prompt('Modifica il commento:', review.comment || '');
        if (newComment === null) return; // Annullato
        
        const newRating = prompt(`Valutazione attuale: ${review.rating}/5\nNuova valutazione (1-5):`, review.rating);
        if (newRating === null) return; // Annullato
        
        const rating = parseInt(newRating);
        if (rating < 1 || rating > 5 || isNaN(rating)) {
            alert('⚠️ Valutazione non valida! Deve essere tra 1 e 5.');
            return;
        }
        
        try {
            const response = await fetch(`/api/reviews/${review.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rating, comment: newComment })
            });
            
            if (response.ok) {
                alert('✅ Recensione aggiornata!');
                await this.loadDashboardStats();
                
                // Ricarica le sezioni aperte
                const myReviewsSection = document.getElementById('my-reviews-list');
                if (myReviewsSection && myReviewsSection.style.display === 'block') {
                    await this.toggleMyReviews();
                    await this.toggleMyReviews();
                }
                
                // Ricarica anche la sezione admin se siamo admin
                if (this.currentUser.role === 'admin') {
                    const allReviewsSection = document.getElementById('all-reviews-list');
                    if (allReviewsSection && allReviewsSection.style.display === 'block') {
                        await this.toggleAllReviews();
                        await this.toggleAllReviews();
                    }
                }
            } else {
                const error = await response.json();
                alert(`❌ ${error.error || 'Errore nell\'aggiornamento'}`);
            }
        } catch (error) {
            console.error('Errore:', error);
            alert('❌ Errore di connessione');
        }
    }

    async deleteReview(reviewId) {
        if (!confirm('⚠️ Sei sicuro di voler eliminare questa recensione?')) {
            return;
        }
        
        try {
            const response = await fetch(`/api/reviews/${reviewId}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                alert('✅ Recensione eliminata!');
                await this.loadDashboardStats();
                
                // Ricarica le sezioni aperte
                const myReviewsSection = document.getElementById('my-reviews-list');
                if (myReviewsSection && myReviewsSection.style.display === 'block') {
                    await this.toggleMyReviews();
                    await this.toggleMyReviews();
                }
                
                // Ricarica anche la sezione admin se siamo admin
                if (this.currentUser.role === 'admin') {
                    const allReviewsSection = document.getElementById('all-reviews-list');
                    if (allReviewsSection && allReviewsSection.style.display === 'block') {
                        await this.toggleAllReviews();
                        await this.toggleAllReviews();
                    }
                }
            } else {
                const error = await response.json();
                alert(`❌ ${error.error || 'Errore nell\'eliminazione'}`);
            }
        } catch (error) {
            console.error('Errore:', error);
            alert('❌ Errore di connessione');
        }
    }

    async renderLogin() {
        const template = document.getElementById('login-template');
        const content = template.content.cloneNode(true);
        
        document.getElementById('app').innerHTML = '';
        document.getElementById('app').appendChild(content);
        
        // Setup form login semplice
        const simpleForm = document.getElementById('simple-login-form');
        simpleForm?.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleSimpleLogin();
        });

        // Setup form registrazione
        const registerForm = document.getElementById('register-form');
        registerForm?.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleRegister();
        });

        // Setup toggle tra login e registrazione
        const showRegisterBtn = document.getElementById('show-register');
        const showLoginBtn = document.getElementById('show-login');
        const loginBox = document.querySelector('.login-box');
        const registerBox = document.getElementById('register-box');

        showRegisterBtn?.addEventListener('click', () => {
            loginBox.style.display = 'none';
            registerBox.style.display = 'block';
        });

        showLoginBtn?.addEventListener('click', () => {
            loginBox.style.display = 'block';
            registerBox.style.display = 'none';
        });
    }

    async handleRegister() {
        const name = document.getElementById('register-name').value;
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;
        const role = document.getElementById('register-role').value;
        
        // Validazioni client-side
        if (!name.trim()) {
            alert('⚠️ Inserisci il tuo nome completo');
            return;
        }
        
        if (!email.trim()) {
            alert('⚠️ Inserisci un indirizzo email valido');
            return;
        }
        
        if (password.length < 6) {
            alert('⚠️ La password deve essere di almeno 6 caratteri');
            return;
        }
        
        if (!role) {
            alert('⚠️ Seleziona il tipo di account');
            return;
        }
        
        console.log('Tentativo registrazione:', { name, email, role });
        
        try {
            const response = await fetch('/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password, role })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                alert('✅ Registrazione completata con successo! Ora puoi effettuare il login.');
                
                // Torna al form di login
                const loginBox = document.querySelector('.login-box');
                const registerBox = document.getElementById('register-box');
                loginBox.style.display = 'block';
                registerBox.style.display = 'none';
                
                // Pre-compila l'email nel login
                document.getElementById('login-email').value = email;
                document.getElementById('login-password').focus();
            } else {
                alert('❌ ' + (data.error || 'Errore durante la registrazione'));
            }
        } catch (error) {
            console.error('Errore registrazione:', error);
            alert('❌ Errore durante la registrazione');
        }
    }

    renderLogin() {
        const template = document.getElementById('login-template');
        const content = template.content.cloneNode(true);
        
        document.getElementById('app').innerHTML = '';
        document.getElementById('app').appendChild(content);
        
        // Setup form login semplice
        const simpleForm = document.getElementById('simple-login-form');
        simpleForm?.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleSimpleLogin();
        });

        // Setup form registrazione
        const registerForm = document.getElementById('register-form');
        registerForm?.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleRegister();
        });

        // Setup toggle tra login e registrazione
        const showRegisterBtn = document.getElementById('show-register');
        const showLoginBtn = document.getElementById('show-login');
        const loginBox = document.querySelector('.login-box');
        const registerBox = document.getElementById('register-box');

        showRegisterBtn?.addEventListener('click', () => {
            loginBox.style.display = 'none';
            registerBox.style.display = 'block';
        });

        showLoginBtn?.addEventListener('click', () => {
            loginBox.style.display = 'block';
            registerBox.style.display = 'none';
        });
    }

    async handleSimpleLogin() {
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        
        console.log('Tentativo login con:', email, password);
        
        try {
            const response = await fetch('/auth/simple-login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                this.currentUser = data.user;
                this.updateAuthUI();
                alert('✅ Login effettuato con successo!');
                this.navigate('home');
            } else {
                alert('❌ ' + (data.error || 'Credenziali non valide'));
            }
        } catch (error) {
            console.error('Errore login:', error);
            alert('❌ Errore durante il login');
        }
    }

    createReviewCard(review) {
        const card = document.createElement('div');
        card.className = 'review-card';
        card.style.cssText = 'border: 1px solid #ddd; border-radius: 8px; padding: 1.5rem; background: white;';
        
        const canEdit = this.currentUser && (review.user_id === this.currentUser.id || this.currentUser.role === 'admin');
        
        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
                <div style="flex: 1;">
                    <h4 style="margin: 0 0 0.5rem 0;">
                        <a href="#recipe/${review.recipe_id}" style="color: #2c5282; text-decoration: none;">
                            ${review.recipe_title}
                        </a>
                    </h4>
                    <div class="stars" style="color: #f59e0b; font-size: 1.2rem;">
                        ${Array.from({length: 5}, (_, i) => 
                            `<span class="star ${i < review.rating ? 'active' : ''}" style="${i < review.rating ? 'color: #f59e0b;' : 'color: #d1d5db;'}">★</span>`
                        ).join('')}
                    </div>
                </div>
                ${canEdit ? `
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="btn-warning btn-edit-review" data-review-id="${review.id}" data-recipe-id="${review.recipe_id}" data-rating="${review.rating}" data-comment="${(review.comment || '').replace(/"/g, '&quot;')}" style="padding: 0.5rem 1rem; font-size: 0.9rem;">
                            ✏️ Modifica
                        </button>
                        <button class="btn-danger btn-delete-review" data-review-id="${review.id}" style="padding: 0.5rem 1rem; font-size: 0.9rem;">
                            🗑️ Elimina
                        </button>
                    </div>
                ` : ''}
            </div>
            <p style="margin: 0.5rem 0; color: #4a5568;">${review.comment || '<em>Nessun commento</em>'}</p>
            <small style="color: #718096;">
                ${new Date(review.created_at).toLocaleDateString('it-IT', { year: 'numeric', month: 'long', day: 'numeric' })}
            </small>
        `;
        
        // Event listener per modifica
        const editBtn = card.querySelector('.btn-edit-review');
        if (editBtn) {
            editBtn.addEventListener('click', () => {
                this.editReview(review);
            });
        }
        
        // Event listener per eliminazione
        const deleteBtn = card.querySelector('.btn-delete-review');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                this.deleteReview(review.id);
            });
        }
        
        return card;
    }

    async toggleFavorites() {
        const section = document.getElementById('favorites-list');
        const grid = document.getElementById('favorites-grid');
        
        if (section.style.display === 'none' || !section.style.display) {
            console.log('Apertura sezione preferiti...');
            try {
                const response = await fetch('/api/users/favorites');
                console.log('Response favorites:', response.status);
                
                if (!response.ok) {
                    throw new Error('Errore nel caricamento dei preferiti');
                }
                
                const favorites = await response.json();
                console.log('Preferiti ricevuti:', favorites.length, favorites);
                
                grid.innerHTML = '';
                
                if (favorites.length === 0) {
                    grid.innerHTML = `
                        <div style="grid-column: 1/-1; text-align: center; padding: 2rem;">
                            <h3>😔 Nessuna ricetta nei preferiti</h3>
                            <p>Aggiungi ricette ai preferiti per vederle qui!</p>
                            <a href="#recipes" data-route="recipes" class="btn-primary" style="margin-top: 1rem; display: inline-block; text-decoration: none;">
                                Esplora Ricette
                            </a>
                        </div>
                    `;
                } else {
                    favorites.forEach(recipe => {
                        console.log('Creazione card per:', recipe.title);
                        const card = this.createFavoriteCard(recipe);
                        grid.appendChild(card);
                    });
                }
                
                section.style.display = 'block';
                console.log('Sezione preferiti aperta');
            } catch (error) {
                console.error('❌ Errore caricamento preferiti:', error);
                grid.innerHTML = `
                    <div style="grid-column: 1/-1; text-align: center; padding: 2rem; color: red;">
                        <h3>❌ Errore</h3>
                        <p>Impossibile caricare i preferiti: ${error.message}</p>
                    </div>
                `;
                section.style.display = 'block';
            }
        } else {
            console.log('Chiusura sezione preferiti');
            section.style.display = 'none';
        }
    }

    createFavoriteCard(recipe) {
        const card = document.createElement('div');
        card.className = 'recipe-card';
        card.style.position = 'relative';
        
        const placeholderSVG = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="200"%3E%3Crect fill="%23e5e7eb" width="400" height="200"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="Arial,sans-serif" font-size="18" fill="%23666"%3E🍽️ Nessuna immagine%3C/text%3E%3C/svg%3E';
        
        const imageUrl = recipe.image_url && recipe.image_url !== 'null' ? recipe.image_url : placeholderSVG;
        
        card.innerHTML = `
            <button class="btn-remove-favorite" data-recipe-id="${recipe.id}" style="position: absolute; top: 10px; right: 10px; background: #ef4444; color: white; border: none; border-radius: 50%; width: 36px; height: 36px; cursor: pointer; font-size: 18px; z-index: 10; box-shadow: 0 2px 4px rgba(0,0,0,0.2);" title="Rimuovi dai preferiti">
                ❤️
            </button>
            <img src="${imageUrl}" alt="${recipe.title}" onerror="this.src='${placeholderSVG}'">
            <div class="recipe-card-content">
                <h3>${recipe.title}</h3>
                <p>${recipe.description || 'Nessuna descrizione disponibile'}</p>
                <div class="recipe-meta">
                    <span>👨‍🍳 ${recipe.chef_name || 'Anonimo'}</span>
                    <span>📂 ${recipe.category_name || 'Altro'}</span>
                    <span>⚡ ${recipe.difficulty || 'facile'}</span>
                    <span>⏱️ ${recipe.prep_time || 0} min</span>
                </div>
            </div>
        `;
        
        // Click sulla card per aprire la ricetta
        const cardContent = card.querySelector('.recipe-card-content');
        const cardImage = card.querySelector('img');
        
        cardContent.addEventListener('click', () => {
            this.navigate(`recipe/${recipe.id}`);
        });
        
        cardImage.addEventListener('click', () => {
            this.navigate(`recipe/${recipe.id}`);
        });
        
        // Click sul pulsante rimuovi
        const removeBtn = card.querySelector('.btn-remove-favorite');
        removeBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            await this.removeFromFavorites(recipe.id);
        });
        
        return card;
    }

    async removeFromFavorites(recipeId) {
        if (!confirm('⚠️ Vuoi rimuovere questa ricetta dai preferiti?')) {
            return;
        }
        
        try {
            const response = await fetch(`/api/recipes/${recipeId}/favorite`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                alert('✅ Ricetta rimossa dai preferiti!');
                await this.loadDashboardStats();
                // Ricarica la sezione preferiti
                const section = document.getElementById('favorites-list');
                if (section && section.style.display === 'block') {
                    await this.toggleFavorites(); // Chiude
                    await this.toggleFavorites(); // Riapre
                }
            } else {
                const error = await response.json();
                alert(`❌ ${error.error || 'Errore nella rimozione'}`);
            }
        } catch (error) {
            console.error('Errore:', error);
            alert('❌ Errore di connessione');
        }
    }

    async deleteRecipe(recipeId) {
        if (!confirm('⚠️ Sei sicuro di voler eliminare questa ricetta? Questa azione è irreversibile!')) {
            return;
        }
        
        try {
            console.log('Eliminazione ricetta ID:', recipeId);
            
            const response = await fetch(`/api/recipes/${recipeId}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            
            if (response.ok) {
                alert('✅ Ricetta eliminata con successo!');
                // Torna alla lista ricette
                this.navigate('recipes');
            } else {
                const error = await response.json();
                alert(`❌ ${error.error || 'Errore nell\'eliminazione della ricetta'}`);
            }
        } catch (error) {
            console.error('❌ Errore nell\'eliminazione:', error);
            alert('❌ Errore di connessione durante l\'eliminazione');
        }
    }

    // Inizializza l'applicazione
}

// Inizializza l'applicazione quando il DOM è pronto
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM caricato, inizializzazione CookBook...');
    try {
        new RecipeApp();
    } catch (error) {
        console.error('❌ Errore critico nell\'inizializzazione:', error);
        document.getElementById('app').innerHTML = `
            <div style="text-align: center; padding: 3rem; color: red;">
                <h2>❌ Errore di Inizializzazione</h2>
                <p>L'applicazione non può essere avviata: ${error.message}</p>
                <p><small>Controlla la console del browser per maggiori dettagli</small></p>
                <button onclick="location.reload()" style="margin-top: 1rem; padding: 0.5rem 1rem;">
                    🔄 Ricarica Pagina
                </button>
            </div>
        `;
    }
});
