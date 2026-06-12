// =============================================================
// Sociale Kaart Purmerend - App Logic
// =============================================================

(function () {
    'use strict';

    // --- Categorieën ---
    const CATEGORIEEN = {
        'GGZ': ['BGGZ', 'SGGZ', 'ADHD', 'Verslavingszorg', 'Eetstoornissen', 'Relatie- en systeemtherapie', 'Seksuologie', 'ALK', 'Psychotrauma', 'Psychiatrie en crisisopvang', 'Overig'],
        'Jeugdzorg': ['Jeugdzorg en jeugdhulp', 'Consultatiebureaus en jeugdgezondheidszorg', 'Jongerenwerk', 'Opvoedondersteuning'],
        'Gehandicaptenzorg': [],
        'Verpleging, verzorging en thuiszorg (VVT)': ['Thuiszorg', 'Wonen met zorg', 'ELV en respijtverblijf', 'Huishoudelijke hulp'],
        'Sociaal domein': ['Sociale wijkteams', 'Welzijn en ontmoeting', 'Maatschappelijk werk', 'Mantelzorg en informele zorg', 'Geld, werk en recht', 'Jeugd en gezin', 'Wonen en toegankelijkheid'],
        'Paramedische zorg': ['Fysiotherapie', 'Diëtetiek', 'Logopedie', 'Podotherapie en voetzorg', 'Ergotherapie'],
        'Apotheek': [],
        'Verloskundige': [],
        'Overig': []
    };

    // Geeft een CSS-klasse terug die de categorie een eigen kleur uit het regenboogpalet geeft
    function getCategoryColorClass(categorie) {
        const index = Object.keys(CATEGORIEEN).indexOf(categorie);
        return 'cat-color-' + (index >= 0 ? index : 0);
    }

    // --- State ---
    let db = null;
    let allProviders = [];
    let allDocuments = [];
    let activeCategory = null;
    let activeSubcategory = null;
    let searchQuery = '';
    let currentDetailId = null;
    let currentView = 'cards'; // 'cards', 'list', 'map', 'docs'
    let map = null;
    let mapMarkers = [];
    let currentDocLabels = [];

    // --- DOM refs ---
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    // --- Init ---
    document.addEventListener('DOMContentLoaded', init);

    function init() {
        // Check session
        if (sessionStorage.getItem('sk_auth') === 'true') {
            showApp();
        }

        setupLoginForm();
        setupEventListeners();
        renderCategoryFilters();
        renderCategorieSelect();
    }

    // =========================================================
    // AUTH
    // =========================================================
    function setupLoginForm() {
        $('#login-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const pw = $('#password-input').value;
            const hash = await hashPassword(pw);

            if (hash === PASSWORD_HASH) {
                sessionStorage.setItem('sk_auth', 'true');
                $('#login-error').classList.add('hidden');
                showApp();
            } else {
                $('#login-error').classList.remove('hidden');
                $('#password-input').value = '';
                $('#password-input').focus();
            }
        });
    }

    async function hashPassword(password) {
        const encoder = new TextEncoder();
        const data = encoder.encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    function showApp() {
        $('#login-screen').classList.add('hidden');
        $('#app').classList.remove('hidden');
        initFirebase();
    }

    // =========================================================
    // FIREBASE
    // =========================================================
    function initFirebase() {
        try {
            if (!firebase.apps.length) {
                firebase.initializeApp(firebaseConfig);
            }
            db = firebase.firestore();
            loadProviders();
            loadDocuments();
        } catch (err) {
            console.error('Firebase init error:', err);
            showToast('Fout bij verbinden met database. Controleer firebase-config.js');
        }
    }

    function loadProviders() {
        if (!db) return;

        db.collection('zorgverleners')
            .orderBy('naam')
            .onSnapshot((snapshot) => {
                allProviders = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                renderCurrentView();
                // Als detail-modal open is, herrender de notities met verse data
                if (currentDetailId) {
                    const open = allProviders.find(p => p.id === currentDetailId);
                    if (open) renderComments(open);
                }
            }, (err) => {
                console.error('Firestore error:', err);
                showToast('Fout bij laden van zorgverleners');
            });
    }

    // =========================================================
    // RENDERING
    // =========================================================
    function renderCategoryFilters() {
        const container = $('#category-filters');
        const allChip = document.createElement('button');
        allChip.className = 'category-chip active';
        allChip.textContent = 'Alles';
        allChip.addEventListener('click', () => {
            activeCategory = null;
            activeSubcategory = null;
            updateCategoryChips();
            renderSubcategoryFilters();
            renderCurrentView();
        });
        container.appendChild(allChip);

        Object.keys(CATEGORIEEN).forEach(cat => {
            const chip = document.createElement('button');
            chip.className = 'category-chip';
            chip.textContent = cat;
            chip.dataset.category = cat;
            chip.addEventListener('click', () => {
                if (activeCategory === cat) {
                    activeCategory = null;
                } else {
                    activeCategory = cat;
                }
                activeSubcategory = null;
                updateCategoryChips();
                renderSubcategoryFilters();
                renderCurrentView();
            });
            container.appendChild(chip);
        });
    }

    function updateCategoryChips() {
        $$('.category-chip').forEach(chip => {
            if (!chip.dataset.category) {
                // "Alles" chip
                chip.classList.toggle('active', activeCategory === null);
            } else {
                chip.classList.toggle('active', chip.dataset.category === activeCategory);
            }
        });
    }

    function renderSubcategoryFilters() {
        const container = $('#subcategory-filters');
        container.innerHTML = '';

        const subs = activeCategory ? (CATEGORIEEN[activeCategory] || []) : [];
        if (subs.length === 0) {
            container.classList.add('hidden');
            return;
        }
        container.classList.remove('hidden');

        subs.forEach(sub => {
            const chip = document.createElement('button');
            chip.className = 'subcategory-chip';
            chip.textContent = sub;
            chip.dataset.subcategory = sub;
            chip.classList.toggle('active', activeSubcategory === sub);
            chip.addEventListener('click', () => {
                activeSubcategory = activeSubcategory === sub ? null : sub;
                updateSubcategoryChips();
                renderCurrentView();
            });
            container.appendChild(chip);
        });
    }

    function updateSubcategoryChips() {
        $$('.subcategory-chip').forEach(chip => {
            chip.classList.toggle('active', chip.dataset.subcategory === activeSubcategory);
        });
    }

    function renderCurrentView() {
        const filtered = filterProviders();
        $('#results-count').textContent = `${filtered.length} zorgverlener${filtered.length !== 1 ? 's' : ''} gevonden`;

        // Hide all containers
        $('#cards-container').classList.add('hidden');
        $('#list-container').classList.add('hidden');
        $('#map-container').classList.add('hidden');
        $('#empty-state').classList.add('hidden');

        if (filtered.length === 0) {
            $('#empty-state').classList.remove('hidden');
            return;
        }

        switch (currentView) {
            case 'cards':
                renderCards();
                break;
            case 'list':
                renderList();
                break;
            case 'map':
                renderMap();
                break;
        }
    }

    function renderCategorieSelect() {
        [['#provider-categorie', 1], ['#document-categorie', 1]].forEach(([sel, keep]) => {
            const select = $(sel);
            if (!select) return;
            while (select.options.length > keep) select.remove(keep);
            Object.keys(CATEGORIEEN).forEach(cat => {
                const opt = document.createElement('option');
                opt.value = cat;
                opt.textContent = cat;
                select.appendChild(opt);
            });
        });
    }

    function updateProviderSubcategorieOptions(selectedValue) {
        const group = $('#provider-subcategorie-group');
        const select = $('#provider-subcategorie');
        const cat = $('#provider-categorie').value;
        const subs = CATEGORIEEN[cat] || [];

        while (select.options.length > 1) select.remove(1);

        if (subs.length === 0) {
            group.classList.add('hidden');
            select.value = '';
            return;
        }

        group.classList.remove('hidden');
        subs.forEach(sub => {
            const opt = document.createElement('option');
            opt.value = sub;
            opt.textContent = sub;
            select.appendChild(opt);
        });
        select.value = selectedValue && subs.includes(selectedValue) ? selectedValue : '';
    }

    function renderCards() {
        const container = $('#cards-container');
        const filtered = filterProviders();

        container.innerHTML = '';
        container.classList.remove('hidden');

        filtered.forEach(provider => {
            container.appendChild(createCard(provider));
        });
    }

    function renderList() {
        const container = $('#list-container');
        const filtered = filterProviders();

        container.innerHTML = '';
        container.classList.remove('hidden');

        filtered.forEach(provider => {
            container.appendChild(createListItem(provider));
        });
    }

    function createListItem(provider) {
        const item = document.createElement('div');
        item.className = 'list-item';
        item.addEventListener('click', () => openDetail(provider.id));

        const commentCount = (provider.opmerkingen || []).length;

        let infoHtml = '';
        if (provider.telefoon) infoHtml += `<span>📞 ${escapeHtml(provider.telefoon)}</span>`;
        if (provider.adres) infoHtml += `<span>📍 ${escapeHtml(provider.adres.split(',')[0])}</span>`;

        item.innerHTML = `
            <div class="list-item-main">
                <div class="list-item-naam">${escapeHtml(provider.naam)}</div>
                <div class="list-item-info">${infoHtml}</div>
            </div>
            <span class="list-item-categorie ${getCategoryColorClass(provider.categorie)}">${escapeHtml(provider.categorie)}${provider.subcategorie ? ' · ' + escapeHtml(provider.subcategorie) : ''}</span>
            <div class="list-item-comments">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                ${commentCount}
            </div>
        `;

        return item;
    }

    function renderMap() {
        const container = $('#map-container');
        container.classList.remove('hidden');

        // Initialize map if not already done
        if (!map) {
            map = L.map('map').setView([52.5050, 4.9500], 13); // Purmerend centrum

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            }).addTo(map);
        }

        // Clear existing markers
        mapMarkers.forEach(marker => map.removeLayer(marker));
        mapMarkers = [];

        const filtered = filterProviders();

        // Geocode addresses and add markers
        filtered.forEach(provider => {
            if (provider.adres) {
                geocodeAndAddMarker(provider);
            }
        });

        // Trigger resize to fix display issues
        setTimeout(() => map.invalidateSize(), 100);
    }

    // Simple geocoding using Nominatim (free OpenStreetMap geocoder)
    async function geocodeAndAddMarker(provider) {
        const address = provider.adres + ', Nederland';

        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`);
            const data = await response.json();

            if (data && data.length > 0) {
                const lat = parseFloat(data[0].lat);
                const lon = parseFloat(data[0].lon);

                const marker = L.marker([lat, lon]).addTo(map);

                const popupContent = `
                    <div class="map-popup">
                        <h4>${escapeHtml(provider.naam)}</h4>
                        <span class="map-popup-categorie ${getCategoryColorClass(provider.categorie)}">${escapeHtml(provider.categorie)}${provider.subcategorie ? ' · ' + escapeHtml(provider.subcategorie) : ''}</span>
                        <p>📍 ${escapeHtml(provider.adres)}</p>
                        ${provider.telefoon ? `<p>📞 ${escapeHtml(provider.telefoon)}</p>` : ''}
                        <button class="map-popup-btn" onclick="window._openDetail('${provider.id}')">Details bekijken</button>
                    </div>
                `;

                marker.bindPopup(popupContent);
                mapMarkers.push(marker);
            }
        } catch (err) {
            console.error('Geocoding error:', err);
        }
    }

    // Expose openDetail for map popup buttons
    window._openDetail = (id) => openDetail(id);

    function switchView(view) {
        currentView = view;

        // Weergave-knoppen (kaartjes/lijst/kaart)
        $('#btn-view-cards').classList.toggle('active', view === 'cards');
        $('#btn-view-list').classList.toggle('active', view === 'list');
        $('#btn-view-map').classList.toggle('active', view === 'map');

        // Documenten-knop in de header
        $('#btn-view-docs').classList.toggle('active', view === 'docs');

        // Zoek- en filterbalk: verberg bij docs, toon bij rest
        const isDocsView = view === 'docs';
        $('#category-filters').classList.toggle('hidden', isDocsView);
        if (isDocsView) {
            $('#subcategory-filters').classList.add('hidden');
        } else {
            renderSubcategoryFilters();
        }
        $('#results-count').parentElement.classList.toggle('hidden', isDocsView);

        // Add-knop: label + zichtbaarheid
        const btnAdd = $('#btn-add');
        const btnLabel = $('#btn-add .btn-label');
        if (isDocsView) {
            if (btnLabel) btnLabel.textContent = 'Document';
            btnAdd.title = 'Document toevoegen';
        } else {
            if (btnLabel) btnLabel.textContent = 'Toevoegen';
            btnAdd.title = 'Zorgverlener toevoegen';
        }

        if (isDocsView) {
            $('#cards-container').classList.add('hidden');
            $('#list-container').classList.add('hidden');
            $('#map-container').classList.add('hidden');
            $('#empty-state').classList.add('hidden');
            renderDocuments();
        } else {
            $('#docs-container').classList.add('hidden');
            renderCurrentView();
        }
    }

    function filterProviders() {
        let results = allProviders;

        if (activeCategory) {
            results = results.filter(p => p.categorie === activeCategory);
        }

        if (activeSubcategory) {
            results = results.filter(p => p.subcategorie === activeSubcategory);
        }

        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            results = results.filter(p => {
                const naam = (p.naam || '').toLowerCase();
                const cat = (p.categorie || '').toLowerCase();
                const subcat = (p.subcategorie || '').toLowerCase();
                const adres = (p.adres || '').toLowerCase();
                const labels = (p.labels || []).join(' ').toLowerCase();
                const opmerkingen = (p.opmerkingen || []).map(o => o.tekst).join(' ').toLowerCase();

                return naam.includes(q) || cat.includes(q) || subcat.includes(q) || adres.includes(q) ||
                    labels.includes(q) || opmerkingen.includes(q);
            });
        }

        return results;
    }

    function createCard(provider) {
        const card = document.createElement('div');
        card.className = 'card';
        card.addEventListener('click', () => openDetail(provider.id));

        const commentCount = (provider.opmerkingen || []).length;

        let contactHtml = '';
        if (provider.adres) contactHtml += `<span>📍 ${escapeHtml(provider.adres)}</span>`;
        if (provider.telefoon) contactHtml += `<span>📞 ${escapeHtml(provider.telefoon)}</span>`;

        let labelsHtml = '';
        if (provider.labels && provider.labels.length > 0) {
            labelsHtml = '<div class="card-labels">' +
                provider.labels.map(l => `<span class="label-tag">${escapeHtml(l)}</span>`).join('') +
                '</div>';
        }

        card.innerHTML = `
            <div class="card-header">
                <span class="card-naam">${escapeHtml(provider.naam)}</span>
                <span class="card-categorie ${getCategoryColorClass(provider.categorie)}">${escapeHtml(provider.categorie)}${provider.subcategorie ? ' · ' + escapeHtml(provider.subcategorie) : ''}</span>
            </div>
            ${contactHtml ? `<div class="card-contact">${contactHtml}</div>` : ''}
            ${labelsHtml}
            <div class="card-footer">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                ${commentCount} opmerking${commentCount !== 1 ? 'en' : ''}
            </div>
        `;

        return card;
    }

    // =========================================================
    // DETAIL MODAL
    // =========================================================
    function openDetail(id) {
        const provider = allProviders.find(p => p.id === id);
        if (!provider) return;

        currentDetailId = id;

        $('#detail-naam').textContent = provider.naam;
        $('#detail-categorie').textContent = provider.categorie + (provider.subcategorie ? ' · ' + provider.subcategorie : '');
        $('#detail-categorie').className = 'detail-categorie ' + getCategoryColorClass(provider.categorie);

        // Contact info
        let contactHtml = '';
        if (provider.adres) contactHtml += `<div>📍 ${escapeHtml(provider.adres)}</div>`;
        if (provider.telefoon) contactHtml += `<div>📞 <a href="tel:${escapeHtml(provider.telefoon)}">${escapeHtml(provider.telefoon)}</a></div>`;
        if (provider.email) contactHtml += `<div>✉️ <a href="mailto:${escapeHtml(provider.email)}">${escapeHtml(provider.email)}</a></div>`;
        if (provider.website) contactHtml += `<div>🌐 <a href="${escapeHtml(provider.website)}" target="_blank" rel="noopener">${escapeHtml(provider.website)}</a></div>`;
        $('#detail-contact').innerHTML = contactHtml;

        // Labels
        const labelsContainer = $('#detail-labels');
        labelsContainer.innerHTML = '';
        if (provider.labels && provider.labels.length > 0) {
            provider.labels.forEach(l => {
                const tag = document.createElement('span');
                tag.className = 'label-tag';
                tag.textContent = l;
                tag.style.cursor = 'pointer';
                tag.addEventListener('click', (e) => {
                    e.stopPropagation();
                    closeModal('modal-detail');
                    searchQuery = l;
                    $('#search-input').value = l;
                    $('#search-clear').classList.remove('hidden');
                    renderCurrentView();
                });
                labelsContainer.appendChild(tag);
            });
        }

        // Comments
        renderComments(provider);

        openModal('modal-detail');
    }

    function renderComments(provider) {
        const list = $('#comments-list');
        const opmerkingen = provider.opmerkingen || [];

        $('#comments-count').textContent = opmerkingen.length;

        if (opmerkingen.length === 0) {
            list.innerHTML = '<div class="no-comments">Nog geen opmerkingen. Voeg de eerste toe!</div>';
            return;
        }

        list.innerHTML = '';

        // Maak een gesorteerde kopie met originele indices
        const gesorteerd = opmerkingen
            .map((o, i) => ({ ...o, _origIndex: i }))
            .sort((a, b) => new Date(b.datum) - new Date(a.datum));

        gesorteerd.forEach((opmerking) => {
            const div = document.createElement('div');
            div.className = 'comment';
            div.innerHTML = `
                <div class="comment-text">${escapeHtml(opmerking.tekst)}</div>
                <div class="comment-meta">
                    <span>${escapeHtml(opmerking.auteur || 'Anoniem')} · ${formatDate(opmerking.datum)}</span>
                    <button class="comment-delete" data-index="${opmerking._origIndex}" title="Verwijderen">✕</button>
                </div>
            `;
            list.appendChild(div);
        });

        list.querySelectorAll('.comment-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                deleteComment(parseInt(btn.dataset.index));
            });
        });
    }

    // =========================================================
    // PLACE SEARCH (Nominatim / OpenStreetMap)
    // =========================================================
    async function searchPlaces(query) {
        const resultsDiv = $('#search-place-results');
        resultsDiv.classList.remove('hidden');
        resultsDiv.innerHTML = '<div class="search-place-loading">Zoeken...</div>';

        try {
            // Zoek in Nederland, focus op Purmerend regio
            const searchQuery = `${query}, Purmerend, Nederland`;
            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&addressdetails=1&limit=5&countrycodes=nl`,
                { headers: { 'Accept-Language': 'nl' } }
            );
            const data = await response.json();

            if (data.length === 0) {
                // Probeer bredere zoekopdracht zonder Purmerend
                const broaderResponse = await fetch(
                    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query + ', Nederland')}&addressdetails=1&limit=5&countrycodes=nl`,
                    { headers: { 'Accept-Language': 'nl' } }
                );
                const broaderData = await broaderResponse.json();
                renderPlaceResults(broaderData);
            } else {
                renderPlaceResults(data);
            }
        } catch (err) {
            console.error('Place search error:', err);
            resultsDiv.innerHTML = '<div class="search-place-empty">Fout bij zoeken. Probeer opnieuw.</div>';
        }
    }

    function renderPlaceResults(places) {
        const resultsDiv = $('#search-place-results');

        if (places.length === 0) {
            resultsDiv.innerHTML = '<div class="search-place-empty">Geen resultaten gevonden. Probeer een andere zoekterm.</div>';
            return;
        }

        resultsDiv.innerHTML = '';
        places.forEach(place => {
            const item = document.createElement('div');
            item.className = 'search-place-item';

            const name = place.name || place.display_name.split(',')[0];
            const address = place.display_name;

            item.innerHTML = `
                <div class="search-place-item-name">${escapeHtml(name)}</div>
                <div class="search-place-item-address">${escapeHtml(address)}</div>
            `;

            item.addEventListener('click', () => {
                selectPlace(place);
            });

            resultsDiv.appendChild(item);
        });
    }

    function selectPlace(place) {
        // Vul de formuliervelden in
        const name = place.name || place.display_name.split(',')[0];
        $('#provider-naam').value = name;

        // Bouw adres op uit addressdetails
        const addr = place.address || {};
        let adresStr = '';
        if (addr.road) {
            adresStr = addr.road;
            if (addr.house_number) adresStr += ' ' + addr.house_number;
        }
        if (addr.postcode || addr.city || addr.town || addr.village) {
            if (adresStr) adresStr += ', ';
            if (addr.postcode) adresStr += addr.postcode + ' ';
            adresStr += addr.city || addr.town || addr.village || '';
        }
        if (adresStr) {
            $('#provider-adres').value = adresStr.trim();
        } else {
            $('#provider-adres').value = place.display_name;
        }

        // Verberg resultaten en leeg zoekveld
        $('#search-place-results').classList.add('hidden');
        $('#search-place').value = '';

        showToast('Gegevens ingevuld! Controleer en vul aan.');
    }

    // =========================================================
    // CRUD OPERATIONS
    // =========================================================
    async function saveProvider(data) {
        if (!db) return;

        try {
            if (data.id) {
                const { id, ...rest } = data;
                await db.collection('zorgverleners').doc(id).update(rest);
                showToast('Zorgverlener bijgewerkt');
            } else {
                await db.collection('zorgverleners').add(data);
                showToast('Zorgverlener toegevoegd');
            }
        } catch (err) {
            console.error('Save error:', err);
            showToast('Fout bij opslaan');
        }
    }

    async function deleteProvider(id) {
        if (!db) return;

        try {
            await db.collection('zorgverleners').doc(id).delete();
            showToast('Zorgverlener verwijderd');
        } catch (err) {
            console.error('Delete error:', err);
            showToast('Fout bij verwijderen');
        }
    }

    async function addComment(providerId, tekst, auteur) {
        if (!db) return;

        const provider = allProviders.find(p => p.id === providerId);
        if (!provider) return;

        if (!provider.opmerkingen) provider.opmerkingen = [];
        const nieuw = {
            tekst,
            auteur: auteur || 'Anoniem',
            datum: new Date().toISOString().split('T')[0]
        };
        provider.opmerkingen.push(nieuw);

        // Meteen tonen in de modal
        renderComments(provider);

        try {
            await db.collection('zorgverleners').doc(providerId).update({ opmerkingen: provider.opmerkingen });
        } catch (err) {
            console.error('Comment error:', err);
            showToast('Fout bij plaatsen opmerking');
            provider.opmerkingen.pop(); // terugdraaien bij fout
            renderComments(provider);
        }
    }

    async function deleteComment(commentIndex) {
        if (!db || !currentDetailId) return;

        const provider = allProviders.find(p => p.id === currentDetailId);
        if (!provider || !provider.opmerkingen) return;

        // Verwijder uit de lokale array en toon meteen
        const verwijderd = provider.opmerkingen.splice(commentIndex, 1);
        renderComments(provider);

        try {
            await db.collection('zorgverleners').doc(currentDetailId).update({ opmerkingen: provider.opmerkingen });
        } catch (err) {
            console.error('Delete comment error:', err);
            showToast('Fout bij verwijderen opmerking');
            provider.opmerkingen.splice(commentIndex, 0, ...verwijderd); // terugdraaien bij fout
            renderComments(provider);
        }
    }

    // =========================================================
    // EVENT LISTENERS
    // =========================================================
    function setupEventListeners() {
        // Search
        const searchInput = $('#search-input');
        const searchClear = $('#search-clear');
        let searchTimeout;

        searchInput.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                searchQuery = searchInput.value.trim();
                searchClear.classList.toggle('hidden', !searchQuery);
                renderCurrentView();
            }, 200);
        });

        searchClear.addEventListener('click', () => {
            searchInput.value = '';
            searchQuery = '';
            searchClear.classList.add('hidden');
            renderCurrentView();
            searchInput.focus();
        });

        // View toggle buttons
        $('#btn-view-cards').addEventListener('click', () => switchView('cards'));
        $('#btn-view-list').addEventListener('click', () => switchView('list'));
        $('#btn-view-map').addEventListener('click', () => switchView('map'));
        $('#btn-view-docs').addEventListener('click', () => switchView('docs'));

        // Add button — context-aware
        $('#btn-add').addEventListener('click', () => {
            if (currentView === 'docs') openDocumentModal();
            else openProviderModal();
        });

        // Place search in form
        $('#btn-search-place').addEventListener('click', () => {
            const query = $('#search-place').value.trim();
            if (query.length >= 3) {
                searchPlaces(query);
            } else {
                showToast('Typ minimaal 3 tekens om te zoeken');
            }
        });

        $('#search-place').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const query = $('#search-place').value.trim();
                if (query.length >= 3) {
                    searchPlaces(query);
                }
            }
        });

        // Logout
        $('#btn-logout').addEventListener('click', () => {
            sessionStorage.removeItem('sk_auth');
            $('#app').classList.add('hidden');
            $('#login-screen').classList.remove('hidden');
            $('#password-input').value = '';
            $('#password-input').focus();
        });

        // Categorie change -> update subcategorie options
        $('#provider-categorie').addEventListener('change', () => {
            updateProviderSubcategorieOptions('');
        });

        // Provider form
        $('#form-provider').addEventListener('submit', (e) => {
            e.preventDefault();
            const data = {
                naam: $('#provider-naam').value.trim(),
                categorie: $('#provider-categorie').value,
                subcategorie: $('#provider-subcategorie').value,
                adres: $('#provider-adres').value.trim(),
                telefoon: $('#provider-telefoon').value.trim(),
                email: $('#provider-email').value.trim(),
                website: $('#provider-website').value.trim(),
                labels: currentLabels,
                opmerkingen: []
            };

            const id = $('#provider-id').value;
            if (id) {
                // Behoud bestaande opmerkingen bij bewerken
                const existing = allProviders.find(p => p.id === id);
                data.opmerkingen = existing ? existing.opmerkingen || [] : [];
                data.id = id;
            }

            saveProvider(data);
            closeModal('modal-provider');
        });

        // Labels input
        let currentLabels = [];
        const labelsInput = $('#provider-labels');
        const labelsList = $('#provider-labels-list');

        labelsInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const label = labelsInput.value.trim();
                if (label && !currentLabels.includes(label)) {
                    currentLabels.push(label);
                    renderLabelsList(labelsList, currentLabels);
                }
                labelsInput.value = '';
            }
        });

        // Expose currentLabels for form submit
        Object.defineProperty(window, '_currentLabels', {
            get: () => currentLabels,
            set: (v) => { currentLabels = v; }
        });

        // Edit button in detail
        $('#btn-edit-provider').addEventListener('click', () => {
            const provider = allProviders.find(p => p.id === currentDetailId);
            if (!provider) return;
            closeModal('modal-detail');
            openProviderModal(provider);
        });

        // Delete button in detail
        $('#btn-delete-provider').addEventListener('click', () => {
            showConfirm('Weet je zeker dat je deze zorgverlener wilt verwijderen?', () => {
                deleteProvider(currentDetailId);
                closeModal('modal-detail');
            });
        });

        // Comment form
        $('#form-comment').addEventListener('submit', (e) => {
            e.preventDefault();
            const tekst = $('#comment-text').value.trim();
            if (!tekst) return;

            const auteur = $('#comment-author').value.trim();
            addComment(currentDetailId, tekst, auteur);
            $('#comment-text').value = '';
        });

        // Modal close buttons
        $$('[data-close]').forEach(btn => {
            btn.addEventListener('click', () => {
                closeModal(btn.dataset.close);
            });
        });

        // Backdrop click
        $$('.modal-backdrop').forEach(backdrop => {
            backdrop.addEventListener('click', () => {
                const modal = backdrop.closest('.modal');
                if (modal) modal.classList.add('hidden');
            });
        });

        // Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                $$('.modal:not(.hidden)').forEach(modal => {
                    modal.classList.add('hidden');
                });
            }
        });
    }

    // =========================================================
    // PROVIDER MODAL HELPERS
    // =========================================================
    function openProviderModal(provider = null) {
        const isEdit = !!provider;

        // Reset place search
        $('#search-place').value = '';
        $('#search-place-results').classList.add('hidden');
        $('#search-place-results').innerHTML = '';

        $('#modal-provider-title').textContent = isEdit ? 'Zorgverlener bewerken' : 'Zorgverlener toevoegen';
        $('#provider-id').value = isEdit ? provider.id : '';
        $('#provider-naam').value = isEdit ? provider.naam : '';
        $('#provider-categorie').value = isEdit ? provider.categorie : '';
        updateProviderSubcategorieOptions(isEdit ? provider.subcategorie : '');
        $('#provider-adres').value = isEdit ? provider.adres || '' : '';
        $('#provider-telefoon').value = isEdit ? provider.telefoon || '' : '';
        $('#provider-email').value = isEdit ? provider.email || '' : '';
        $('#provider-website').value = isEdit ? provider.website || '' : '';

        window._currentLabels = isEdit ? [...(provider.labels || [])] : [];
        renderLabelsList($('#provider-labels-list'), window._currentLabels);

        openModal('modal-provider');
        $('#provider-naam').focus();
    }

    function renderLabelsList(container, labels) {
        container.innerHTML = '';
        labels.forEach((label, index) => {
            const tag = document.createElement('span');
            tag.className = 'label-tag-editable';
            tag.innerHTML = `${escapeHtml(label)} <button type="button" data-index="${index}">&times;</button>`;
            tag.querySelector('button').addEventListener('click', () => {
                labels.splice(index, 1);
                renderLabelsList(container, labels);
            });
            container.appendChild(tag);
        });
    }

    // =========================================================
    // CONFIRM DIALOG
    // =========================================================
    let confirmCallback = null;

    function showConfirm(message, onConfirm) {
        $('#confirm-message').textContent = message;
        confirmCallback = onConfirm;
        openModal('modal-confirm');
    }

    $('#btn-confirm-ok')?.addEventListener('click', () => {
        closeModal('modal-confirm');
        if (confirmCallback) confirmCallback();
        confirmCallback = null;
    });

    // =========================================================
    // MODAL HELPERS
    // =========================================================
    function openModal(id) {
        $(`#${id}`).classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }

    function closeModal(id) {
        $(`#${id}`).classList.add('hidden');
        // Check if any other modals are open
        if ($$('.modal:not(.hidden)').length === 0) {
            document.body.style.overflow = '';
        }
    }

    // =========================================================
    // UTILITIES
    // =========================================================
    function escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function formatDate(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' });
    }

    // =========================================================
    // DOCUMENTEN
    // =========================================================
    function loadDocuments() {
        if (!db) return;
        db.collection('documenten')
            .orderBy('datum', 'desc')
            .onSnapshot((snapshot) => {
                allDocuments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                if (currentView === 'docs') renderDocuments();
            }, (err) => {
                console.error('Documenten error:', err);
            });
    }

    function renderDocuments() {
        const container = $('#docs-container');
        container.innerHTML = '';
        container.classList.remove('hidden');

        const q = searchQuery.toLowerCase();
        const filtered = allDocuments.filter(doc => {
            if (!q) return true;
            return (doc.titel || '').toLowerCase().includes(q) ||
                   (doc.organisatie || '').toLowerCase().includes(q) ||
                   (doc.beschrijving || '').toLowerCase().includes(q) ||
                   (doc.tags || []).join(' ').toLowerCase().includes(q);
        });

        if (filtered.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'docs-empty-state';
            empty.innerHTML = `
                <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="9" y1="13" x2="15" y2="13"/>
                    <line x1="9" y1="17" x2="13" y2="17"/>
                </svg>
                <h3>${q ? 'Geen documenten gevonden' : 'Nog geen documenten'}</h3>
                <p>${q ? 'Pas je zoekopdracht aan.' :
                    'Voeg overzichtsdocumenten toe, zoals bereikbaarheidslijsten, protocollen of verwijswijzers van zorgorganisaties.<br><br>Klik op <strong>+ Document</strong> om te beginnen.'}</p>
            `;
            container.appendChild(empty);
            return;
        }

        filtered.forEach(doc => container.appendChild(createDocCard(doc)));
    }

    const DOC_ICONS = {
        excel: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>`,
        pdf:   `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`,
        word:  `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/></svg>`,
        link:  `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>`,
        overig:`<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`
    };

    function createDocCard(doc) {
        const card = document.createElement('div');
        card.className = 'doc-card';

        const type = doc.bestandstype || 'overig';
        const icon = DOC_ICONS[type] || DOC_ICONS.overig;
        const tags = (doc.tags || []).map(t =>
            `<span class="label-tag">${escapeHtml(t)}</span>`
        ).join('');

        card.innerHTML = `
            <div class="doc-card-top">
                <div class="doc-icon doc-icon-${type}">${icon}</div>
                <div class="doc-card-info">
                    <div class="doc-titel">${escapeHtml(doc.titel)}</div>
                    ${doc.organisatie ? `<div class="doc-organisatie">${escapeHtml(doc.organisatie)}</div>` : ''}
                </div>
            </div>
            ${doc.beschrijving ? `<div class="doc-beschrijving">${escapeHtml(doc.beschrijving)}</div>` : ''}
            ${tags ? `<div class="doc-tags">${tags}</div>` : ''}
            <div class="doc-card-footer">
                <span class="doc-cat-badge">${escapeHtml(doc.categorie || 'Overig')}</span>
                <div class="doc-footer-right">
                    ${doc.link ? `<a href="${escapeHtml(doc.link)}" target="_blank" rel="noopener" class="doc-open-btn">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                        Openen
                    </a>` : ''}
                    <button class="doc-action-btn" title="Bewerken" data-edit-doc="${doc.id}">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button class="doc-action-btn danger" title="Verwijderen" data-del-doc="${doc.id}">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                    </button>
                </div>
            </div>
        `;

        card.querySelector('[data-edit-doc]')?.addEventListener('click', () => {
            const d = allDocuments.find(x => x.id === doc.id);
            if (d) openDocumentModal(d);
        });

        card.querySelector('[data-del-doc]')?.addEventListener('click', () => {
            showConfirm('Weet je zeker dat je dit document wilt verwijderen?', () => {
                deleteDocument(doc.id);
            });
        });

        return card;
    }

    function openDocumentModal(doc = null) {
        const isEdit = !!doc;
        $('#modal-document-title').textContent = isEdit ? 'Document bewerken' : 'Document toevoegen';
        $('#document-id').value = isEdit ? doc.id : '';
        $('#document-titel').value = isEdit ? doc.titel || '' : '';
        $('#document-organisatie').value = isEdit ? doc.organisatie || '' : '';
        $('#document-categorie').value = isEdit ? doc.categorie || '' : '';
        $('#document-beschrijving').value = isEdit ? doc.beschrijving || '' : '';
        $('#document-link').value = isEdit ? doc.link || '' : '';
        $('#document-type').value = isEdit ? doc.bestandstype || 'overig' : 'excel';

        currentDocLabels = isEdit ? [...(doc.tags || [])] : [];
        renderLabelsList($('#document-tags-list'), currentDocLabels);

        openModal('modal-document');
        $('#document-titel').focus();
    }

    async function saveDocument(data) {
        if (!db) return;
        try {
            if (data.id) {
                const { id, ...rest } = data;
                await db.collection('documenten').doc(id).update(rest);
                showToast('Document bijgewerkt');
            } else {
                await db.collection('documenten').add(data);
                showToast('Document toegevoegd');
            }
        } catch (err) {
            console.error('Document save error:', err);
            showToast('Fout bij opslaan');
        }
    }

    async function deleteDocument(id) {
        if (!db) return;
        try {
            await db.collection('documenten').doc(id).delete();
            showToast('Document verwijderd');
        } catch (err) {
            console.error('Document delete error:', err);
            showToast('Fout bij verwijderen');
        }
    }

    // Form submit voor documenten
    document.addEventListener('DOMContentLoaded', () => {
        const formDoc = document.getElementById('form-document');
        if (!formDoc) return;

        // Tags input
        const tagsInput = document.getElementById('document-tags-input');
        tagsInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const tag = tagsInput.value.trim();
                if (tag && !currentDocLabels.includes(tag)) {
                    currentDocLabels.push(tag);
                    renderLabelsList(document.getElementById('document-tags-list'), currentDocLabels);
                }
                tagsInput.value = '';
            }
        });

        formDoc.addEventListener('submit', (e) => {
            e.preventDefault();
            const data = {
                titel: document.getElementById('document-titel').value.trim(),
                organisatie: document.getElementById('document-organisatie').value.trim(),
                categorie: document.getElementById('document-categorie').value,
                beschrijving: document.getElementById('document-beschrijving').value.trim(),
                link: document.getElementById('document-link').value.trim(),
                bestandstype: document.getElementById('document-type').value,
                tags: [...currentDocLabels],
                datum: new Date().toISOString().split('T')[0]
            };
            const id = document.getElementById('document-id').value;
            if (id) data.id = id;
            saveDocument(data);
            closeModal('modal-document');
        });
    });

    function showToast(message) {
        // Remove existing toast
        const existing = document.querySelector('.toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        document.body.appendChild(toast);

        requestAnimationFrame(() => {
            toast.classList.add('show');
        });

        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
})();
