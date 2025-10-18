(function () {
    const state = {
        user: null,
        categories: [],
        ingredients: [],
        selectedRating: 0
    };

    document.addEventListener('DOMContentLoaded', init);

    async function init() {
        try {
            await loadAuthStatus();
            updateAuthLinks();

            const page = document.body.dataset.page || 'home';
            switch (page) {
                case 'home':
                    await renderHome();
                    break;
                case 'recipes':
                    await renderRecipesPage();
                    break;
                case 'recipe-detail':
                    await renderRecipeDetailPage();
                    break;
                case 'recipe-form':
                    await renderRecipeFormPage();
                    break;
                case 'login':
                    setupLoginPage();
                    break;
                case 'dashboard':
                    await renderDashboardPage();
                    break;
                default:
                    console.warn('Pagina non riconosciuta:', page);
            }
        } catch (error) {
            console.error('Errore durante l\'inizializzazione della pagina:', error);
        }
    }

    async function loadAuthStatus() {
        try {
            const response = await fetch('/auth/status', { credentials: 'include' });
            if (response.ok) {
                const data = await response.json();
                state.user = data.authenticated ? data.user : null;
            } else {
                state.user = null;
            }
        } catch (error) {
            console.error('Errore nel recupero stato autenticazione:', error);
            state.user = null;
        }
    }

    function updateAuthLinks() {
        const container = document.getElementById('auth-links');
        if (!container) return;

        if (state.user) {
            container.innerHTML = `
                <span class="auth-greeting">Ciao, ${state.user.name}</span>
                <a href="/dashboard">Dashboard</a>
                <button id="logout-btn" class="link-button">Logout</button>
            `;

            document.getElementById('logout-btn').addEventListener('click', async (event) => {
                event.preventDefault();
                await logout();
            });
        } else {
            container.innerHTML = '<a href="/login">Login</a>';
        }
    }

    async function logout() {
        try {
            await fetch('/auth/logout', { method: 'POST', credentials: 'include' });
        } catch (error) {
            console.error('Errore durante il logout:', error);
        }
        window.location.href = '/';
    }

    async function renderHome() {
        const grid = document.getElementById('featured-recipes-grid');
        if (!grid) return;

        try {
            const recipes = await fetchRecipes();
            grid.innerHTML = '';

            if (recipes.length === 0) {
                grid.innerHTML = `
                    <div class="empty-state" style="grid-column: 1 / -1;">
                        <h3>😔 Nessuna ricetta disponibile</h3>
                        <p>Quando saranno aggiunte ricette appariranno qui.</p>
                    </div>
                `;
                return;
            }

            recipes.slice(0, 6).forEach((recipe) => {
                const card = createRecipeCard(recipe, { removable: false });
                grid.appendChild(card);
            });
        } catch (error) {
            console.error('Errore nel caricamento ricette in evidenza:', error);
            grid.innerHTML = `
                <div class="empty-state" style="grid-column: 1 / -1; color: red;">
                    <h3>❌ Impossibile caricare le ricette</h3>
                    <p>${error.message || 'Errore imprevisto'}</p>
                </div>
            `;
        }
    }

    async function renderRecipesPage() {
        const filters = {
            search: document.getElementById('search-filter'),
            category: document.getElementById('category-filter'),
            difficulty: document.getElementById('difficulty-filter'),
            prepTime: document.getElementById('prep-time-filter')
        };
        const applyBtn = document.getElementById('apply-filters');
        const clearBtn = document.getElementById('clear-filters');
        const grid = document.getElementById('recipes-grid');
        const authActions = document.getElementById('authenticated-actions');

        if (!grid) return;

        if (state.user && (state.user.role === 'chef' || state.user.role === 'admin') && authActions) {
            authActions.style.display = 'flex';
        }

        await ensureTaxonomiesLoaded();
        populateSelect(filters.category, state.categories, 'name', 'id', { defaultOptionLabel: 'Tutte le categorie' });

        async function loadAndRender() {
            try {
                const params = new URLSearchParams();
                const searchValue = (filters.search?.value || '').trim();
                const categoryValue = filters.category?.value || '';
                const difficultyValue = filters.difficulty?.value || '';
                const prepTimeValue = filters.prepTime?.value || '';

                if (searchValue) params.set('search', searchValue);
                if (categoryValue) params.set('category', categoryValue);
                if (difficultyValue) params.set('difficulty', difficultyValue);
                if (prepTimeValue) params.set('prep_time', prepTimeValue);

                const endpoint = params.toString() ? `/api/recipes?${params.toString()}` : '/api/recipes';
                const response = await fetch(endpoint);
                if (!response.ok) throw new Error('Errore nel caricamento delle ricette');
                const recipes = await response.json();

                grid.innerHTML = '';
                if (recipes.length === 0) {
                    grid.innerHTML = `
                        <div class="empty-state" style="grid-column: 1 / -1;">
                            <h3>😔 Nessuna ricetta trovata</h3>
                            <p>Prova a modificare i filtri di ricerca.</p>
                        </div>
                    `;
                    return;
                }

                recipes.forEach((recipe) => {
                    const card = createRecipeCard(recipe, { removable: true });
                    grid.appendChild(card);
                });
            } catch (error) {
                console.error('Errore caricamento ricette:', error);
                grid.innerHTML = `
                    <div class="empty-state" style="grid-column: 1 / -1; color: red;">
                        <h3>❌ Errore</h3>
                        <p>${error.message || 'Impossibile recuperare le ricette'}</p>
                    </div>
                `;
            }
        }

        applyBtn?.addEventListener('click', loadAndRender);
        clearBtn?.addEventListener('click', () => {
            if (filters.search) filters.search.value = '';
            if (filters.category) filters.category.value = '';
            if (filters.difficulty) filters.difficulty.value = '';
            if (filters.prepTime) filters.prepTime.value = '';
            loadAndRender();
        });

        await loadAndRender();
    }

    async function renderRecipeDetailPage() {
        const params = new URLSearchParams(window.location.search);
        const recipeId = params.get('id');
        if (!recipeId) {
            window.location.href = '/recipes';
            return;
        }

        try {
            const response = await fetch(`/api/recipes/${recipeId}`);
            if (!response.ok) throw new Error('Ricetta non trovata');
            const recipe = await response.json();

            fillRecipeDetail(recipe);
            setupIngredientDragAndDrop();
            setupRecipeActions(recipe);
            renderReviews(recipe);
        } catch (error) {
            console.error('Errore caricamento ricetta:', error);
            const header = document.querySelector('.recipe-detail');
            if (header) {
                header.innerHTML = `
                    <div class="empty-state">
                        <h2>❌ Ricetta non disponibile</h2>
                        <p>${error.message || 'Errore imprevisto'}</p>
                        <a class="btn-primary" href="/recipes">Torna all\'elenco</a>
                    </div>
                `;
            }
        }
    }

    function fillRecipeDetail(recipe) {
        const placeholder = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect fill="%23e5e7eb" width="400" height="300"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="Arial,sans-serif" font-size="24" fill="%23666"%3E🍽️ Nessuna immagine%3C/text%3E%3C/svg%3E';
        document.getElementById('recipe-title').textContent = recipe.title;
        document.getElementById('recipe-description').textContent = recipe.description || '';
        document.getElementById('recipe-chef').textContent = `👨‍🍳 ${recipe.chef_name || 'Anonimo'}`;
        document.getElementById('recipe-category').textContent = `📂 ${recipe.category_name || 'Altro'}`;
        document.getElementById('recipe-difficulty').textContent = `⚡ ${recipe.difficulty || 'facile'}`;
        document.getElementById('prep-time').textContent = recipe.prep_time || 0;
        document.getElementById('cook-time').textContent = recipe.cook_time || 0;
        document.getElementById('servings').textContent = recipe.servings || 1;

        const image = document.getElementById('recipe-image');
        image.src = recipe.image_url && recipe.image_url !== 'null' ? recipe.image_url : placeholder;
        image.alt = recipe.title;

        const instructions = document.getElementById('instructions');
        instructions.innerHTML = (recipe.instructions || '').split('\n').map(line => `<p>${line}</p>`).join('') || '<p>Nessuna istruzione fornita.</p>';

        const ingredientsList = document.getElementById('ingredients-list');
        ingredientsList.innerHTML = '';
        (recipe.ingredients || []).forEach((ingredient) => {
            const item = document.createElement('div');
            item.className = 'ingredient-item';
            item.textContent = `${ingredient.quantity || ''} ${ingredient.unit || ''} - ${ingredient.name}`.trim();
            item.setAttribute('draggable', 'true');
            ingredientsList.appendChild(item);
        });
    }

    function setupIngredientDragAndDrop() {
        const list = document.getElementById('ingredients-list');
        if (!list) return;

        let draggedItem = null;
        list.querySelectorAll('.ingredient-item').forEach((item) => {
            item.addEventListener('dragstart', (event) => {
                if (!state.user || state.user.role !== 'admin') {
                    event.preventDefault();
                    return;
                }
                draggedItem = item;
                item.classList.add('dragging');
            });

            item.addEventListener('dragend', () => {
                item.classList.remove('dragging');
                draggedItem = null;
            });
        });

        list.addEventListener('dragover', (event) => {
            if (!draggedItem) return;
            event.preventDefault();
            const afterElement = getDragAfterElement(list, event.clientY);
            if (afterElement == null) {
                list.appendChild(draggedItem);
            } else {
                list.insertBefore(draggedItem, afterElement);
            }
        });
    }

    function getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.ingredient-item:not(.dragging)')];
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element || null;
    }

    function setupRecipeActions(recipe) {
        const favoriteBtn = document.getElementById('favorite-btn');
        const ownerActions = document.getElementById('recipe-owner-actions');
        const editBtn = document.getElementById('edit-recipe-btn');
        const deleteBtn = document.getElementById('delete-recipe-btn');

        if (state.user) {
            favoriteBtn.style.display = 'inline-flex';
            favoriteBtn.addEventListener('click', async () => {
                try {
                    const response = await fetch(`/api/recipes/${recipe.id}/favorite`, { method: 'POST', credentials: 'include' });
                    if (!response.ok) throw new Error('Impossibile aggiungere ai preferiti');
                    favoriteBtn.textContent = '✅ Nei preferiti';
                    favoriteBtn.disabled = true;
                } catch (error) {
                    alert(error.message || 'Errore durante l\'aggiunta ai preferiti');
                }
            });
        }

        if (state.user && (state.user.id === recipe.chef_id || state.user.role === 'admin')) {
            ownerActions.style.display = 'flex';
            editBtn.href = `/recipe-form?id=${recipe.id}`;
            deleteBtn.addEventListener('click', async () => {
                if (!confirm('Vuoi davvero eliminare questa ricetta?')) return;
                try {
                    const response = await fetch(`/api/recipes/${recipe.id}`, { method: 'DELETE', credentials: 'include' });
                    if (!response.ok) throw new Error('Impossibile eliminare la ricetta');
                    window.location.href = '/recipes';
                } catch (error) {
                    alert(error.message || 'Errore durante l\'eliminazione');
                }
            });
        }

        const reviewSection = document.getElementById('add-review');
        if (state.user) {
            reviewSection.style.display = 'block';
            state.selectedRating = state.selectedRating || 5;
            highlightStars(state.selectedRating);
            const stars = document.querySelectorAll('.stars .star');
            stars.forEach((star, index) => {
                star.addEventListener('click', () => {
                    state.selectedRating = index + 1;
                    highlightStars(state.selectedRating);
                });
            });

            const reviewForm = document.getElementById('review-form');
            reviewForm.addEventListener('submit', async (event) => {
                event.preventDefault();
                const rating = state.selectedRating || 5;
                const comment = document.getElementById('review-comment').value.trim();
                try {
                    const response = await fetch(`/api/recipes/${recipe.id}/review`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({ rating, comment })
                    });
                    if (!response.ok) throw new Error('Impossibile inviare la recensione');
                    window.location.reload();
                } catch (error) {
                    alert(error.message || 'Errore durante l\'invio della recensione');
                }
            });
        }
    }

    function highlightStars(rating) {
        document.querySelectorAll('.stars .star').forEach((star, index) => {
            star.classList.toggle('active', index < rating);
        });
    }

    function renderReviews(recipe) {
        const list = document.getElementById('reviews-list');
        if (!list) return;
        list.innerHTML = '';

        if (!recipe.reviews || recipe.reviews.length === 0) {
            list.innerHTML = '<p>Nessuna recensione al momento.</p>';
            return;
        }

        recipe.reviews.forEach((review) => {
            const item = document.createElement('article');
            item.className = 'review-item';
            item.innerHTML = `
                <header>
                    <strong>${review.user_name || 'Anonimo'}</strong>
                    <span>${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)}</span>
                </header>
                <p>${review.comment || ''}</p>
            `;

            if (state.user && (state.user.id === review.user_id || state.user.role === 'admin')) {
                const actions = document.createElement('div');
                actions.className = 'review-actions';
                const editBtn = document.createElement('button');
                editBtn.textContent = 'Modifica';
                editBtn.className = 'btn-secondary';
                const deleteBtn = document.createElement('button');
                deleteBtn.textContent = 'Elimina';
                deleteBtn.className = 'btn-danger';

                editBtn.addEventListener('click', async () => {
                    const newComment = prompt('Modifica recensione', review.comment || '');
                    if (newComment === null) return;
                    const newRating = parseInt(prompt('Aggiorna voto (1-5)', review.rating), 10) || review.rating;
                    try {
                        const response = await fetch(`/api/reviews/${review.id}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            credentials: 'include',
                            body: JSON.stringify({ comment: newComment, rating: newRating })
                        });
                        if (!response.ok) throw new Error('Impossibile aggiornare la recensione');
                        window.location.reload();
                    } catch (error) {
                        alert(error.message || 'Errore durante la modifica');
                    }
                });

                deleteBtn.addEventListener('click', async () => {
                    if (!confirm('Eliminare la recensione?')) return;
                    try {
                    const response = await fetch(`/api/reviews/${review.id}`, { method: 'DELETE', credentials: 'include' });
                        if (!response.ok) throw new Error('Impossibile eliminare la recensione');
                        window.location.reload();
                    } catch (error) {
                        alert(error.message || 'Errore durante l\'eliminazione');
                    }
                });

                actions.appendChild(editBtn);
                actions.appendChild(deleteBtn);
                item.appendChild(actions);
            }

            list.appendChild(item);
        });
    }

    async function renderRecipeFormPage() {
        if (!state.user || (state.user.role !== 'chef' && state.user.role !== 'admin')) {
            window.location.href = '/login';
            return;
        }

        await ensureTaxonomiesLoaded();
        populateSelect(document.getElementById('category'), state.categories, 'name', 'id', { defaultOptionLabel: 'Seleziona categoria' });
        populateIngredientsEditor();

        const params = new URLSearchParams(window.location.search);
        const recipeId = params.get('id');
        const title = document.getElementById('form-title');

        if (recipeId) {
            title.textContent = 'Modifica Ricetta';
            document.getElementById('recipe-id').value = recipeId;
            await loadRecipeInForm(recipeId);
        }

        document.getElementById('add-ingredient-btn').addEventListener('click', () => {
            addIngredientRow();
        });

        document.getElementById('recipe-form').addEventListener('submit', async (event) => {
            event.preventDefault();
            const payload = collectRecipeFormData();
            if (!payload.ingredients.length) {
                alert('Aggiungi almeno un ingrediente');
                return;
            }

            try {
                const method = recipeId ? 'PUT' : 'POST';
                const endpoint = recipeId ? `/api/recipes/${recipeId}` : '/api/recipes';
                const response = await fetch(endpoint, {
                    method,
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.error || 'Impossibile salvare la ricetta');
                }

                window.location.href = '/recipes';
            } catch (error) {
                alert(error.message || 'Errore durante il salvataggio');
            }
        });
    }

    async function loadRecipeInForm(recipeId) {
        try {
            const response = await fetch(`/api/recipes/${recipeId}`);
            if (!response.ok) throw new Error('Ricetta non trovata');
            const recipe = await response.json();

            document.getElementById('title').value = recipe.title;
            document.getElementById('description').value = recipe.description || '';
            document.getElementById('category').value = recipe.category_id || '';
            document.getElementById('difficulty').value = recipe.difficulty || 'facile';
            document.getElementById('prepTime').value = recipe.prep_time || '';
            document.getElementById('cookTime').value = recipe.cook_time || '';
            document.getElementById('servings').value = recipe.servings || '';
            document.getElementById('image').value = recipe.image_url || '';
            document.getElementById('instructions-input').value = recipe.instructions || '';

            const container = document.getElementById('ingredients-container');
            container.innerHTML = '';
            (recipe.ingredients || []).forEach((item) => addIngredientRow(item));
        } catch (error) {
            alert(error.message || 'Impossibile caricare la ricetta');
            window.location.href = '/recipes';
        }
    }

    function populateIngredientsEditor() {
        const container = document.getElementById('ingredients-container');
        container.innerHTML = '';
        addIngredientRow();
    }

    function addIngredientRow(data = {}) {
        const container = document.getElementById('ingredients-container');
        const row = document.createElement('div');
        row.className = 'ingredient-row';
        row.innerHTML = `
            <input type="text" class="ingredient-name" placeholder="Ingrediente" value="${data.name || ''}" required>
            <input type="text" class="ingredient-quantity" placeholder="Quantità" value="${data.quantity || ''}">
            <input type="text" class="ingredient-unit" placeholder="Unità" value="${data.unit || ''}">
            <button type="button" class="btn-danger remove-ingredient">🗑️</button>
        `;

        row.querySelector('.remove-ingredient').addEventListener('click', () => {
            removeElementWithAnimation(row);
        });

        container.appendChild(row);
    }

    function removeElementWithAnimation(element) {
        element.classList.add('removing');
        setTimeout(() => element.remove(), 250);
    }

    function collectRecipeFormData() {
        const ingredients = Array.from(document.querySelectorAll('#ingredients-container .ingredient-row')).map((row) => ({
            name: row.querySelector('.ingredient-name').value.trim(),
            quantity: row.querySelector('.ingredient-quantity').value.trim(),
            unit: row.querySelector('.ingredient-unit').value.trim()
        })).filter((item) => item.name);

        return {
            title: document.getElementById('title').value.trim(),
            description: document.getElementById('description').value.trim() || null,
            category_id: (() => {
                const value = document.getElementById('category').value;
                return value ? parseInt(value, 10) : null;
            })(),
            difficulty: document.getElementById('difficulty').value,
            prep_time: parseInt(document.getElementById('prepTime').value || '0', 10),
            cook_time: parseInt(document.getElementById('cookTime').value || '0', 10),
            servings: parseInt(document.getElementById('servings').value || '1', 10),
            image_url: document.getElementById('image').value.trim() || null,
            instructions: document.getElementById('instructions-input').value.trim(),
            ingredients
        };
    }

    function setupLoginPage() {
        const tabs = document.querySelectorAll('.auth-tab');
        const forms = document.querySelectorAll('.auth-form');
        const loginForm = document.getElementById('login-form');
        const registerForm = document.getElementById('register-form');
        const googleBtn = document.getElementById('google-login');

        tabs.forEach((tab) => {
            tab.addEventListener('click', () => {
                const target = tab.dataset.authTab;
                tabs.forEach((t) => t.classList.toggle('active', t === tab));
                forms.forEach((form) => {
                    form.classList.toggle('hidden', form.dataset.authPanel !== target);
                });
            });
        });

        loginForm?.addEventListener('submit', async (event) => {
            event.preventDefault();
            const email = document.getElementById('login-email').value.trim();
            const password = document.getElementById('login-password').value.trim();
            try {
                const response = await fetch('/auth/simple-login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ email, password })
                });
                if (!response.ok) throw new Error('Credenziali non valide');
                window.location.href = '/';
            } catch (error) {
                alert(error.message || 'Errore durante il login');
            }
        });

        registerForm?.addEventListener('submit', async (event) => {
            event.preventDefault();
            const name = document.getElementById('register-name').value.trim();
            const email = document.getElementById('register-email').value.trim();
            const password = document.getElementById('register-password').value.trim();
            const role = document.getElementById('register-role').value;

            try {
                const response = await fetch('/auth/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, email, password, role })
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.error || 'Registrazione non riuscita');
                }

                alert('Account creato! Ora puoi effettuare il login.');
                window.location.href = '/login';
            } catch (error) {
                alert(error.message || 'Errore durante la registrazione');
            }
        });

        googleBtn?.addEventListener('click', () => {
            window.location.href = '/auth/google';
        });
    }

    async function renderDashboardPage() {
        if (!state.user) {
            window.location.href = '/login';
            return;
        }

        const welcome = document.getElementById('dashboard-welcome');
        welcome.textContent = `Bentornato, ${state.user.name || 'utente'}!`;

        const container = document.getElementById('dashboard-sections');
        container.innerHTML = '<p>Caricamento dati...</p>';

        try {
            const [profile, favorites, recipes, reviews] = await Promise.all([
                fetchJson('/api/users/profile'),
                fetchJson('/api/users/favorites'),
                fetchJson('/api/users/recipes'),
                fetchJson('/api/users/reviews')
            ]);

            const sections = [];
            sections.push(createDashboardSection('👤 Profilo', `
                <p><strong>Nome:</strong> ${profile.name}</p>
                <p><strong>Email:</strong> ${profile.email}</p>
                <p><strong>Ruolo:</strong> ${profile.role}</p>
            `));

            sections.push(createDashboardSection('❤️ Preferiti', renderFavoritesList(favorites)));
            sections.push(createDashboardSection('👨‍🍳 Le mie ricette', renderOwnRecipes(recipes)));
            sections.push(createDashboardSection('📝 Le mie recensioni', renderOwnReviews(reviews)));

            if (state.user.role === 'admin') {
                const allReviews = await fetchJson('/api/users/all-reviews');
                sections.push(createDashboardSection('🛡️ Moderazione recensioni', renderAllReviews(allReviews)));
            }

            container.innerHTML = '';
            sections.forEach((section) => container.appendChild(section));
        } catch (error) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>❌ Errore</h3>
                    <p>${error.message || 'Impossibile caricare la dashboard'}</p>
                </div>
            `;
        }
    }

    function createDashboardSection(title, content) {
        const section = document.createElement('section');
        section.className = 'dashboard-section';
        section.innerHTML = `
            <header><h3>${title}</h3></header>
            <div class="dashboard-body">${content}</div>
        `;
        return section;
    }

    function renderFavoritesList(favorites = []) {
        if (!favorites.length) {
            return '<p>Nessun preferito ancora.</p>';
        }
        return `
            <ul class="simple-list">
                ${favorites.map((fav) => `<li><a href="/recipe?id=${fav.recipe_id}">${fav.title}</a></li>`).join('')}
            </ul>
        `;
    }

    function renderOwnRecipes(recipes = []) {
        if (!recipes.length) {
            return '<p>Non hai ancora creato ricette.</p>';
        }
        return `
            <ul class="simple-list">
                ${recipes.map((recipe) => `
                    <li>
                        <a href="/recipe?id=${recipe.id}">${recipe.title}</a>
                        <a href="/recipe-form?id=${recipe.id}" class="btn-secondary btn-inline">Modifica</a>
                    </li>
                `).join('')}
            </ul>
        `;
    }

    function renderOwnReviews(reviews = []) {
        if (!reviews.length) {
            return '<p>Nessuna recensione scritta.</p>';
        }
        return `
            <ul class="simple-list">
                ${reviews.map((review) => `
                    <li>
                        <strong>${review.recipe_title}</strong> - ${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)}
                        <p>${review.comment || ''}</p>
                    </li>
                `).join('')}
            </ul>
        `;
    }

    function renderAllReviews(reviews = []) {
        if (!reviews.length) {
            return '<p>Nessuna recensione da moderare.</p>';
        }
        return `
            <ul class="simple-list">
                ${reviews.map((review) => `
                    <li>
                        <strong>${review.user_name}</strong> su <em>${review.recipe_title}</em>
                        <div>${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)}</div>
                        <p>${review.comment || ''}</p>
                    </li>
                `).join('')}
            </ul>
        `;
    }

    function createRecipeCard(recipe, { removable }) {
        const card = document.createElement('article');
        card.className = 'recipe-card';
        const placeholder = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="200"%3E%3Crect fill="%23e5e7eb" width="400" height="200"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="Arial,sans-serif" font-size="18" fill="%23666"%3E🍽️ Nessuna immagine%3C/text%3E%3C/svg%3E';
        const imageUrl = recipe.image_url && recipe.image_url !== 'null' ? recipe.image_url : placeholder;

        card.innerHTML = `
            <img src="${imageUrl}" alt="${recipe.title}" onerror="this.src='${placeholder}'">
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

        card.addEventListener('click', (event) => {
            if (event.target.closest('[data-remove-card]')) return;
            window.location.href = `/recipe?id=${recipe.id}`;
        });

        if (removable) {
            const removeBtn = document.createElement('button');
            removeBtn.textContent = 'Nascondi carta';
            removeBtn.className = 'btn-secondary remove-card-btn';
            removeBtn.setAttribute('data-remove-card', 'true');
            removeBtn.addEventListener('click', (event) => {
                event.stopPropagation();
                removeElementWithAnimation(card);
            });
            card.querySelector('.recipe-card-content').appendChild(removeBtn);
        }

        return card;
    }

    async function ensureTaxonomiesLoaded() {
        if (state.categories.length && state.ingredients.length) return;
        const [categories, ingredients] = await Promise.all([
            fetchJson('/api/categories'),
            fetchJson('/api/ingredients')
        ]);
        state.categories = categories;
        state.ingredients = ingredients;
    }

    function populateSelect(select, values, labelKey, valueKey, { defaultOptionLabel = 'Seleziona', includeEmpty = true } = {}) {
        if (!select) return;
        const selected = select.value;
        select.innerHTML = '';
        if (includeEmpty) {
            const placeholder = document.createElement('option');
            placeholder.value = '';
            placeholder.textContent = defaultOptionLabel;
            select.appendChild(placeholder);
        }
        values.forEach((item) => {
            const option = document.createElement('option');
            option.value = item[valueKey];
            option.textContent = item[labelKey];
            select.appendChild(option);
        });
        if (selected) {
            select.value = selected;
        }
    }

    async function fetchRecipes() {
        const response = await fetch('/api/recipes');
        if (!response.ok) throw new Error('Impossibile caricare le ricette');
        return response.json();
    }

    async function fetchJson(url, options = {}) {
        const response = await fetch(url, { credentials: 'include', ...options });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Richiesta fallita (${response.status})`);
        }
        return response.json();
    }
})();
