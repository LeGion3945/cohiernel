/* Cohiernel et fils — petit script commun (menu mobile + recherche) */
(function () {
  // Menu mobile
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.getElementById('menu');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  // Recherche : filtre les cartes produits de la page d'accueil
  // (depuis les autres pages, le formulaire renvoie vers index.html?q=...)
  var cards = document.querySelectorAll('[data-search]');
  var input = document.getElementById('q');
  if (!cards.length || !input) return;
  var empty = document.getElementById('no-results');

  function normalize(s) {
    return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function filter() {
    var term = normalize(input.value.trim());
    var visible = 0;
    cards.forEach(function (card) {
      var match = !term || normalize(card.getAttribute('data-search')).indexOf(term) !== -1;
      card.hidden = !match;
      if (match) visible++;
    });
    if (empty) empty.hidden = visible !== 0;
  }

  var q = new URLSearchParams(window.location.search).get('q');
  if (q) input.value = q;
  input.addEventListener('input', filter);
  filter();
})();
/* ===================================================================
   PANIER — à coller À LA FIN de script.js (après le dernier "})();")
   =================================================================== */
(function () {
  var KEY = 'cohiernel-panier';
  var ORDER_EMAIL = 'contact@votre-domaine.fr'; // ← à remplacer par votre adresse

  var items = load();

  function load() {
    try {
      var data = JSON.parse(localStorage.getItem(KEY));
      if (!Array.isArray(data)) return [];
      return data.filter(function (it) {
        return it && it.id && isFinite(it.price) && it.qty >= 1;
      });
    } catch (e) { return []; }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(items)); } catch (e) {}
  }
  function euro(n) {
    return n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
  }
  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text) node.textContent = text;
    return node;
  }
  function mkBtn(label, aria, handler, cls) {
    var b = el('button', cls || 'cart-step', label);
    b.type = 'button';
    b.setAttribute('aria-label', aria);
    b.addEventListener('click', handler);
    return b;
  }

  /* ----- Création du bouton d'en-tête et du panneau ----- */
  var header = document.querySelector('.header-inner');
  var cartBtn = el('button', 'cart-btn');
  cartBtn.type = 'button';
  cartBtn.setAttribute('aria-label', 'Ouvrir le panier');
  cartBtn.innerHTML = '<span aria-hidden="true">🛒</span> <span class="cart-label">Panier</span> <span class="cart-count">0</span>';
  if (header) header.appendChild(cartBtn);

  var overlay = el('div', 'cart-overlay');
  var drawer = el('aside', 'cart-drawer');
  drawer.setAttribute('aria-label', 'Panier');
  drawer.setAttribute('aria-hidden', 'true');
  drawer.innerHTML =
    '<div class="cart-head"><h2>Mon panier</h2>' +
    '<button type="button" class="cart-close" aria-label="Fermer le panier">✕</button></div>' +
    '<ul class="cart-list"></ul>' +
    '<p class="cart-empty">Votre panier est vide.</p>' +
    '<div class="cart-foot">' +
      '<div class="cart-total"><span>Total</span><strong class="cart-total-value">0 €</strong></div>' +
      '<p class="cart-note">Prix indicatifs. Les frais de livraison et la confirmation vous sont envoyés par e-mail.</p>' +
      '<a class="btn cart-checkout" href="#">Envoyer ma commande</a>' +
      '<button type="button" class="cart-clear">Vider le panier</button>' +
    '</div>';
  document.body.appendChild(overlay);
  document.body.appendChild(drawer);

  var list = drawer.querySelector('.cart-list');
  var countEl = cartBtn.querySelector('.cart-count');
  var totalEl = drawer.querySelector('.cart-total-value');
  var checkout = drawer.querySelector('.cart-checkout');

  /* ----- Actions ----- */
  function find(id) {
    for (var i = 0; i < items.length; i++) if (items[i].id === id) return items[i];
    return null;
  }
  function add(product, qty) {
    var it = find(product.id);
    if (it) it.qty = Math.min(99, it.qty + qty);
    else items.push({ id: product.id, name: product.name, price: product.price, qty: qty });
    save(); render();
  }
  function change(id, delta) {
    var it = find(id);
    if (!it) return;
    it.qty = Math.min(99, it.qty + delta);
    if (it.qty < 1) items = items.filter(function (x) { return x.id !== id; });
    save(); render();
  }
  function remove(id) {
    items = items.filter(function (x) { return x.id !== id; });
    save(); render();
  }

  /* ----- Affichage ----- */
  function render() {
    list.textContent = '';
    var count = 0, total = 0;

    items.forEach(function (it) {
      count += it.qty;
      total += it.qty * it.price;

      var li = el('li', 'cart-item');
      var info = el('div', 'cart-item-info');
      info.appendChild(el('strong', '', it.name));
      info.appendChild(el('span', '', euro(it.price) + ' l\u2019unité'));

      var qty = el('div', 'cart-qty');
      qty.appendChild(mkBtn('−', 'Retirer un exemplaire : ' + it.name, function () { change(it.id, -1); }));
      qty.appendChild(el('span', 'cart-qty-n', String(it.qty)));
      qty.appendChild(mkBtn('+', 'Ajouter un exemplaire : ' + it.name, function () { change(it.id, 1); }));

      var rm = mkBtn('Supprimer', 'Supprimer du panier : ' + it.name, function () { remove(it.id); }, 'cart-remove');

      li.appendChild(info);
      li.appendChild(qty);
      li.appendChild(rm);
      list.appendChild(li);
    });

    countEl.textContent = count;
    cartBtn.setAttribute('aria-label', 'Ouvrir le panier (' + count + ' article' + (count > 1 ? 's' : '') + ')');
    totalEl.textContent = euro(total);
    drawer.classList.toggle('is-empty', items.length === 0);

    // Commande par e-mail (solution sans serveur)
    var lines = items.map(function (it) {
      return '- ' + it.qty + ' × ' + it.name + ' (' + euro(it.price) + ')';
    });
    var body = 'Bonjour,\n\nJe souhaite commander :\n' + lines.join('\n') +
      '\n\nTotal indicatif : ' + euro(total) +
      '\n\nNom :\nAdresse de livraison :\nTéléphone :\n';
    checkout.href = 'mailto:' + ORDER_EMAIL +
      '?subject=' + encodeURIComponent('Commande Cohiernel et fils') +
      '&body=' + encodeURIComponent(body);
  }

  /* ----- Ouverture / fermeture ----- */
  var lastFocus = null;
  function openCart() {
    lastFocus = document.activeElement;
    document.body.classList.add('cart-open');
    drawer.setAttribute('aria-hidden', 'false');
    drawer.querySelector('.cart-close').focus();
  }
  function closeCart() {
    document.body.classList.remove('cart-open');
    drawer.setAttribute('aria-hidden', 'true');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  cartBtn.addEventListener('click', openCart);
  overlay.addEventListener('click', closeCart);
  drawer.querySelector('.cart-close').addEventListener('click', closeCart);
  drawer.querySelector('.cart-clear').addEventListener('click', function () {
    items = []; save(); render();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && document.body.classList.contains('cart-open')) closeCart();
  });

  /* ----- Boutons « Ajouter au panier » (pages produits) ----- */
  document.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('[data-add-to-cart]') : null;
    if (!b) return;
    var qtyInput = document.getElementById('qty');
    var n = qtyInput ? parseInt(qtyInput.value, 10) : 1;
    if (!(n >= 1)) n = 1;
    if (n > 20) n = 20;
    add({ id: b.dataset.id, name: b.dataset.name, price: parseFloat(b.dataset.price) }, n);
    openCart();
  });

  // Garde plusieurs onglets synchronisés
  window.addEventListener('storage', function (e) {
    if (e.key === KEY) { items = load(); render(); }
  });

  render();
})();