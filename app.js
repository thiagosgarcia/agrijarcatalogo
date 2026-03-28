(function () {
  const catalog = window.AGRIJAR_CATALOG;

  if (!catalog || !Array.isArray(catalog.products) || !Array.isArray(catalog.brands)) {
    const main = document.querySelector(".main");
    if (main) {
      main.innerHTML = `
        <section class="empty-state">
          <h2>Catálogo indisponível</h2>
          <p>O arquivo de dados do catálogo ainda não foi gerado.</p>
        </section>
      `;
    }
    return;
  }

  const CART_STORAGE_KEY = "agrijar-cart-v1";
  const WHATSAPP_NUMBER = "5522991028282";

  const products = [...catalog.products];
  const brands = [...catalog.brands];
  const productById = new Map(products.map((product) => [product.id, product]));
  const brandOrder = new Map(brands.map((brand, index) => [brand.slug, index]));

  const elements = {
    cartToggle: document.getElementById("cart-toggle"),
    cartDrawer: document.getElementById("cart-drawer"),
    cartClose: document.getElementById("cart-close"),
    cartList: document.getElementById("cart-list"),
    cartEmpty: document.getElementById("cart-empty"),
    cartCount: document.getElementById("cart-count"),
    cartSummaryCount: document.getElementById("cart-summary-count"),
    cartTotal: document.getElementById("cart-total"),
    brandTotal: document.getElementById("brand-total"),
    productTotal: document.getElementById("product-total"),
    stickyAction: document.getElementById("sticky-action"),
    stickyCount: document.getElementById("sticky-count"),
    stickyWhatsapp: document.getElementById("sticky-whatsapp"),
    whatsappButton: document.getElementById("whatsapp-button"),
    clearCart: document.getElementById("clear-cart"),
    backdrop: document.getElementById("backdrop"),
    brandFilter: document.getElementById("brand-filter"),
    searchInput: document.getElementById("search-input"),
    resultsSummary: document.getElementById("results-summary"),
    productsGrid: document.getElementById("products-grid"),
    emptyState: document.getElementById("empty-state"),
    modal: document.getElementById("product-modal"),
    modalClose: document.getElementById("modal-close"),
    modalCloseBottom: document.getElementById("modal-close-bottom"),
    modalBrand: document.getElementById("modal-brand"),
    modalTitle: document.getElementById("product-modal-title"),
    modalGtin: document.getElementById("modal-gtin"),
    modalDescription: document.getElementById("modal-description"),
    modalSpecs: document.getElementById("modal-specs"),
    modalImage: document.getElementById("modal-image"),
    modalAdd: document.getElementById("modal-add"),
  };

  const state = {
    query: "",
    brand: "all",
    cart: loadCart(),
    drawerOpen: false,
    modalProductId: null,
  };

  elements.brandTotal.textContent = formatCount(brands.length);
  elements.productTotal.textContent = formatCount(products.length);

  renderBrandFilters();
  renderAll();
  bindEvents();

  function bindEvents() {
    elements.cartToggle.addEventListener("click", () => {
      openDrawer();
    });

    elements.cartClose.addEventListener("click", () => {
      closeDrawer();
    });

    elements.clearCart.addEventListener("click", () => {
      clearCart();
    });

    elements.whatsappButton.addEventListener("click", () => {
      openWhatsapp();
    });

    elements.stickyWhatsapp.addEventListener("click", () => {
      openWhatsapp();
    });

    elements.backdrop.addEventListener("click", () => {
      if (!elements.modal.classList.contains("hidden")) {
        closeModal();
        return;
      }
      closeDrawer();
    });

    elements.modalClose.addEventListener("click", closeModal);
    elements.modalCloseBottom.addEventListener("click", closeModal);

    elements.searchInput.addEventListener("input", (event) => {
      state.query = event.target.value;
      renderAll();
    });

    elements.brandFilter.addEventListener("click", (event) => {
      const button = event.target.closest("[data-brand]");
      if (!button) {
        return;
      }

      state.brand = button.dataset.brand;
      renderAll();
    });

    elements.productsGrid.addEventListener("click", (event) => {
      const action = event.target.closest("[data-action]");
      if (!action) {
        return;
      }

      const card = action.closest("[data-id]");
      if (!card) {
        return;
      }

      const product = productById.get(card.dataset.id);
      if (!product) {
        return;
      }

      const actionName = action.dataset.action;
      if (actionName === "add") {
        addToCart(product.id);
        renderAll();
        return;
      }

      if (actionName === "open") {
        openModal(product.id);
      }
    });

    elements.cartList.addEventListener("click", (event) => {
      const control = event.target.closest("[data-cart-action]");
      if (!control) {
        return;
      }

      const item = control.closest("[data-id]");
      if (!item) {
        return;
      }

      const productId = item.dataset.id;
      const action = control.dataset.cartAction;

      if (action === "inc") {
        addToCart(productId);
      } else if (action === "dec") {
        decrementCart(productId);
      } else if (action === "remove") {
        removeFromCart(productId);
      }

      renderAll();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") {
        return;
      }

      if (!elements.modal.classList.contains("hidden")) {
        closeModal();
        return;
      }

      if (state.drawerOpen) {
        closeDrawer();
      }
    });
  }

  function renderAll() {
    const visibleProducts = getVisibleProducts();
    renderBrandFilters();
    renderProducts(visibleProducts);
    renderCart();
    updateCounts();
    updateResultsSummary(visibleProducts);
    updateDrawerState();
    updateStickyAction();
    updateActionButtons();
  }

  function getVisibleProducts() {
    const query = normalizeText(state.query).trim();
    const activeBrand = state.brand;

    return products.filter((product) => {
      if (activeBrand !== "all" && product.brandSlug !== activeBrand) {
        return false;
      }

      if (!query) {
        return true;
      }

      return normalizeText(product.searchText || "").includes(query);
    });
  }

  function renderBrandFilters() {
    const chips = [
      {
        slug: "all",
        label: "Todas",
        count: products.length,
      },
      ...brands,
    ];

    elements.brandFilter.innerHTML = chips
      .map((chip) => {
        const active = chip.slug === state.brand ? "is-active" : "";
        return `
          <button
            type="button"
            class="chip ${active}"
            data-brand="${escapeHtml(chip.slug)}"
            aria-pressed="${chip.slug === state.brand ? "true" : "false"}"
          >
            <span>${escapeHtml(chip.label)}</span>
            <strong>${formatCount(chip.count)}</strong>
          </button>
        `;
      })
      .join("");
  }

  function renderProducts(visibleProducts) {
    if (!visibleProducts.length) {
      elements.productsGrid.innerHTML = "";
      elements.emptyState.classList.remove("hidden");
      return;
    }

    elements.emptyState.classList.add("hidden");

    elements.productsGrid.innerHTML = visibleProducts
      .map((product) => {
        const imageSrc = getProductImage(product);
        const inCart = state.cart[product.id] || 0;
        const specPreview = formatSpecifications(product.specificationsRaw).replace(/\n/g, " ");
        const snippet = truncateText(
          product.description || specPreview || "Informações disponíveis no catálogo.",
          140
        );

        return `
          <article class="product-card" data-id="${escapeHtml(product.id)}">
            <button
              type="button"
              class="product-card__media"
              data-action="open"
              aria-label="Ver detalhes de ${escapeHtml(product.name)}"
            >
              <img
                data-product-id="${escapeHtml(product.id)}"
                src="${escapeHtml(imageSrc)}"
                alt="${escapeHtml(`${product.brandLabel} - ${product.name}`)}"
                loading="lazy"
                decoding="async"
              />
            </button>

            <div class="product-card__content">
              <div class="product-card__meta">
                <span class="badge">${escapeHtml(product.brandLabel)}</span>
                <span class="gtin-chip">GTIN ${escapeHtml(product.gtin || "não informado")}</span>
              </div>

              <h3>${escapeHtml(product.name)}</h3>
              <p>${escapeHtml(snippet)}</p>

              <div class="product-card__actions">
                <button type="button" class="ghost-button ghost-button--small" data-action="open">
                  Detalhes
                </button>
                <button type="button" class="primary-button primary-button--small" data-action="add">
                  ${inCart > 0 ? `No carrinho (${formatCount(inCart)})` : "Adicionar"}
                </button>
              </div>
            </div>
          </article>
        `;
      })
      .join("");

    bindProductImageFallbacks();
  }

  function renderCart() {
    const cartItems = getCartItems();
    const totalQuantity = getCartTotalQuantity();

    elements.cartCount.textContent = formatCount(totalQuantity);
    elements.cartSummaryCount.textContent = formatCount(totalQuantity);
    elements.cartTotal.textContent = formatCount(totalQuantity);
    elements.stickyCount.textContent =
      totalQuantity === 0
        ? "0 itens no carrinho"
        : `${formatCount(totalQuantity)} item${totalQuantity === 1 ? "" : "s"} no carrinho`;
    elements.clearCart.disabled = cartItems.length === 0;
    elements.whatsappButton.disabled = totalQuantity === 0;
    elements.stickyWhatsapp.disabled = totalQuantity === 0;

    elements.cartEmpty.classList.toggle("hidden", cartItems.length > 0);

    elements.cartList.innerHTML = cartItems
      .map(({ product, quantity }) => {
        const imageSrc = getProductImage(product);

        return `
          <li class="cart-item" data-id="${escapeHtml(product.id)}">
            <img
              class="cart-item__media"
              data-product-id="${escapeHtml(product.id)}"
              src="${escapeHtml(imageSrc)}"
              alt="${escapeHtml(product.name)}"
              loading="lazy"
              decoding="async"
            />

            <div class="cart-item__content">
              <div class="cart-item__title">
                <span class="badge">${escapeHtml(product.brandLabel)}</span>
                <h3>${escapeHtml(product.name)}</h3>
                <span>GTIN ${escapeHtml(product.gtin || "não informado")}</span>
              </div>

              <div class="cart-item__footer">
                <div class="qty-controls" aria-label="Quantidade do produto">
                  <button type="button" data-cart-action="dec" aria-label="Diminuir quantidade">
                    −
                  </button>
                  <strong>${formatCount(quantity)}</strong>
                  <button type="button" data-cart-action="inc" aria-label="Aumentar quantidade">
                    +
                  </button>
                </div>

                <button type="button" class="remove-link" data-cart-action="remove">
                  Remover
                </button>
              </div>
            </div>
          </li>
        `;
      })
      .join("");

    bindCartImageFallbacks();
  }

  function updateCounts() {
    const totalQuantity = getCartTotalQuantity();
    elements.cartCount.textContent = formatCount(totalQuantity);
    elements.cartSummaryCount.textContent = formatCount(totalQuantity);
    elements.cartTotal.textContent = formatCount(totalQuantity);
    elements.stickyCount.textContent =
      totalQuantity === 0
        ? "0 itens no carrinho"
        : `${formatCount(totalQuantity)} item${totalQuantity === 1 ? "" : "s"} no carrinho`;
  }

  function updateResultsSummary(visibleProducts) {
    const query = state.query.trim();
    const activeBrand = state.brand;
    const brandLabel = activeBrand === "all"
      ? "todas as marcas"
      : (brands.find((brand) => brand.slug === activeBrand)?.label || activeBrand);

    const parts = [
      `Mostrando ${formatCount(visibleProducts.length)} de ${formatCount(products.length)} produtos`,
      `marca: ${brandLabel}`,
    ];

    if (query) {
      parts.push(`busca: "${query}"`);
    }

    elements.resultsSummary.textContent = parts.join(" • ");
  }

  function updateStickyAction() {
    const totalQuantity = getCartTotalQuantity();
    elements.stickyAction.classList.toggle("hidden", totalQuantity === 0);
  }

  function updateActionButtons() {
    const totalQuantity = getCartTotalQuantity();
    elements.whatsappButton.disabled = totalQuantity === 0;
    elements.stickyWhatsapp.disabled = totalQuantity === 0;
  }

  function updateDrawerState() {
    elements.cartDrawer.classList.toggle("is-open", state.drawerOpen);
    elements.backdrop.classList.toggle("hidden", !state.drawerOpen && elements.modal.classList.contains("hidden"));
    elements.cartDrawer.setAttribute("aria-hidden", state.drawerOpen ? "false" : "true");
    elements.cartToggle.setAttribute("aria-expanded", state.drawerOpen ? "true" : "false");
    document.body.classList.toggle(
      "no-scroll",
      state.drawerOpen || !elements.modal.classList.contains("hidden")
    );
  }

  function openDrawer() {
    state.drawerOpen = true;
    closeModal(false);
    updateDrawerState();
  }

  function closeDrawer() {
    state.drawerOpen = false;
    updateDrawerState();
  }

  function openModal(productId) {
    const product = productById.get(productId);
    if (!product) {
      return;
    }

    state.modalProductId = productId;
    state.drawerOpen = false;
    populateModal(product);
    elements.modal.classList.remove("hidden");
    elements.modal.setAttribute("aria-hidden", "false");
    updateDrawerState();
  }

  function closeModal(shouldUpdateState = true) {
    state.modalProductId = null;
    elements.modal.classList.add("hidden");
    elements.modal.setAttribute("aria-hidden", "true");

    if (shouldUpdateState) {
      updateDrawerState();
    }
  }

  function populateModal(product) {
    elements.modalBrand.textContent = product.brandLabel;
    elements.modalTitle.textContent = product.name;
    elements.modalGtin.textContent = product.gtin || "não informado";
    elements.modalDescription.textContent =
      product.description || "Descrição não informada no catálogo.";
    elements.modalSpecs.innerHTML =
      renderSpecificationsTable(product.specificationsRaw) ||
      '<p class="spec-empty">Especificações não informadas no catálogo.</p>';
    elements.modalImage.alt = `${product.brandLabel} - ${product.name}`;
    elements.modalImage.src = getProductImage(product, true);

    bindModalImageFallback(product);

    elements.modalAdd.onclick = () => {
      addToCart(product.id);
      renderAll();
    };
  }

  function clearCart() {
    state.cart = Object.create(null);
    persistCart();
    renderAll();
  }

  function addToCart(productId) {
    const current = state.cart[productId] || 0;
    state.cart[productId] = current + 1;
    persistCart();
  }

  function decrementCart(productId) {
    const current = state.cart[productId] || 0;
    if (current <= 1) {
      delete state.cart[productId];
      persistCart();
      return;
    }

    state.cart[productId] = current - 1;
    persistCart();
  }

  function removeFromCart(productId) {
    if (!(productId in state.cart)) {
      return;
    }

    delete state.cart[productId];
    persistCart();
  }

  function openWhatsapp() {
    const totalQuantity = getCartTotalQuantity();
    if (totalQuantity === 0) {
      return;
    }

    const items = getCartItems();
    const message = buildWhatsappMessage(items);
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function buildWhatsappMessage(items) {
    const lines = items.map(({ product, quantity }) => {
      const gtin = product.gtin || "sem GTIN";
      return `- ${formatCount(quantity)}x ${product.brandLabel} | ${product.name} | GTIN ${gtin}`;
    });

    return [
      "Olá AGRIJAR, segue pedido:",
      "",
      ...lines,
      "",
      `Total de itens: ${formatCount(getCartTotalQuantity())}`,
    ].join("\n");
  }

  function getCartItems() {
    return Object.entries(state.cart)
      .map(([productId, quantity]) => ({
        product: productById.get(productId),
        quantity,
      }))
      .filter((item) => item.product && item.quantity > 0)
      .sort((left, right) => compareProducts(left.product, right.product));
  }

  function getCartTotalQuantity() {
    return Object.values(state.cart).reduce((sum, quantity) => {
      const parsed = Number(quantity);
      return Number.isFinite(parsed) ? sum + parsed : sum;
    }, 0);
  }

  function compareProducts(left, right) {
    const leftBrand = brandOrder.get(left.brandSlug) ?? Number.MAX_SAFE_INTEGER;
    const rightBrand = brandOrder.get(right.brandSlug) ?? Number.MAX_SAFE_INTEGER;
    if (leftBrand !== rightBrand) {
      return leftBrand - rightBrand;
    }

    const byName = cleanText(left.name).localeCompare(cleanText(right.name), "pt-BR", {
      sensitivity: "base",
    });
    if (byName !== 0) {
      return byName;
    }

    return cleanText(left.gtin).localeCompare(cleanText(right.gtin), "pt-BR", {
      sensitivity: "base",
    });
  }

  function getProductImage(product, isModal = false) {
    if (product.imagePath) {
      return product.imagePath;
    }

    return buildFallbackImage(product, isModal);
  }

  function bindProductImageFallbacks() {
    elements.productsGrid.querySelectorAll("img[data-product-id]").forEach((image) => {
      image.addEventListener(
        "error",
        () => {
          const product = productById.get(image.dataset.productId);
          if (!product) {
            return;
          }

          image.src = buildFallbackImage(product, false);
        },
        { once: true }
      );
    });
  }

  function bindCartImageFallbacks() {
    elements.cartList.querySelectorAll("img[data-product-id]").forEach((image) => {
      image.addEventListener(
        "error",
        () => {
          const product = productById.get(image.dataset.productId);
          if (!product) {
            return;
          }

          image.src = buildFallbackImage(product, false);
        },
        { once: true }
      );
    });
  }

  function bindModalImageFallback(product) {
    elements.modalImage.onerror = () => {
      elements.modalImage.src = buildFallbackImage(product, true);
    };
  }

  function buildFallbackImage(product) {
    const brand = escapeHtml(product.brandLabel || "Agrijar");
    const name = escapeHtml(truncateText(product.name || "Produto", 36));
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="720" height="720" viewBox="0 0 720 720">
        <defs>
          <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stop-color="#0f7a39" />
            <stop offset="100%" stop-color="#0a5d2b" />
          </linearGradient>
        </defs>
        <rect width="720" height="720" rx="56" fill="url(#g)" />
        <circle cx="360" cy="300" r="136" fill="rgba(255,255,255,0.12)" />
        <text
          x="50%"
          y="41%"
          text-anchor="middle"
          font-family="Arial, Helvetica, sans-serif"
          font-size="34"
          font-weight="700"
          fill="#eaf4ec"
        >${brand}</text>
        <text
          x="50%"
          y="53%"
          text-anchor="middle"
          font-family="Arial, Helvetica, sans-serif"
          font-size="40"
          font-weight="800"
          fill="#ffffff"
        >${name}</text>
        <text
          x="50%"
          y="64%"
          text-anchor="middle"
          font-family="Arial, Helvetica, sans-serif"
          font-size="22"
          font-weight="600"
          fill="#d8ead9"
        >Imagem indisponível</text>
      </svg>
    `.trim();

    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  }

  function loadCart() {
    if (typeof localStorage === "undefined") {
      return Object.create(null);
    }

    let raw = null;
    try {
      raw = localStorage.getItem(CART_STORAGE_KEY);
    } catch (error) {
      console.warn("Não foi possível ler o carrinho salvo.", error);
      return Object.create(null);
    }

    if (!raw) {
      return Object.create(null);
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      console.warn("Carrinho salvo corrompido; iniciando sem itens.", error);
      return Object.create(null);
    }

    const cart = Object.create(null);
    for (const [productId, quantity] of Object.entries(parsed)) {
      const parsedQuantity = Number(quantity);
      if (!productById.has(productId) || !Number.isInteger(parsedQuantity) || parsedQuantity <= 0) {
        continue;
      }
      cart[productId] = parsedQuantity;
    }

    return cart;
  }

  function persistCart() {
    if (typeof localStorage === "undefined") {
      return;
    }

    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(state.cart));
    } catch (error) {
      console.warn("Não foi possível salvar o carrinho.", error);
    }
  }

  function normalizeText(value) {
    return String(value ?? "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }

  function cleanText(value) {
    return String(value ?? "").replace(/\s+/g, " ").trim();
  }

  function formatSpecifications(value) {
    const normalized = String(value ?? "").replace(/\s*\|\s*/g, "|").trim();
    if (!normalized) {
      return "";
    }

    const lines = normalized
      .split("||||")
      .map((line) => line.split("||").map((part) => cleanText(part)).filter(Boolean))
      .filter((parts) => parts.length > 0);

    if (!lines.length) {
      return "";
    }

    return lines
      .map((parts) => {
        if (parts.length === 1) {
          return parts[0];
        }

        return parts.join("\t\t");
      })
      .join("\n")
      .trim();
  }

  function renderSpecificationsTable(value) {
    const rows = parseSpecifications(value);
    if (!rows.length) {
      return "";
    }

    return rows
      .map((row) => {
        if (row.type === "note") {
          return `<p class="spec-note">${escapeHtml(row.text)}</p>`;
        }

        return `
          <div class="spec-row">
            <span class="spec-label">${escapeHtml(row.label)}</span>
            <span class="spec-value">${escapeHtml(row.value)}</span>
          </div>
        `;
      })
      .join("");
  }

  function parseSpecifications(value) {
    const normalized = String(value ?? "").replace(/\s*\|\s*/g, "|").trim();
    if (!normalized) {
      return [];
    }

    return normalized
      .split("||||")
      .map((line) => line.split("||").map((part) => cleanText(part)).filter(Boolean))
      .reduce((rows, parts) => {
        if (!parts.length) {
          return rows;
        }

        if (parts.length === 1) {
          if (normalizeText(parts[0]) === "especificacoes") {
            return rows;
          }

          rows.push({ type: "note", text: parts[0] });
          return rows;
        }

        const [label, ...rest] = parts;
        rows.push({
          type: "row",
          label,
          value: rest.join(" "),
        });
        return rows;
      }, []);
  }

  function truncateText(value, limit) {
    const text = cleanText(value);
    if (text.length <= limit) {
      return text;
    }

    const slice = text.slice(0, limit - 1);
    const breakPoint = slice.lastIndexOf(" ");
    return `${slice.slice(0, breakPoint > 24 ? breakPoint : slice.length)}…`;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatCount(value) {
    return new Intl.NumberFormat("pt-BR").format(Number(value) || 0);
  }
})();
