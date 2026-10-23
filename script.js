
document.addEventListener("DOMContentLoaded", () => {
  const flavorCards = [...document.querySelectorAll(".flavor-card")];
  const mixCards = [...document.querySelectorAll(".mix-card")];
  const allCards = [...flavorCards, ...mixCards];

  const searchInput = document.querySelector(".search-box input");
  const navbar = document.querySelector(".navbar");
  const navLinks = document.querySelector(".nav-links");

  let cart = {};
  let toastTimer;

  // Automatically update the copyright year.
  const year = document.querySelector("#current-year");
  if (year) year.textContent = new Date().getFullYear();

  // Toast notifications.
  const toast = document.createElement("div");
  toast.className = "ss-toast";
  toast.setAttribute("role", "status");
  toast.setAttribute("aria-live", "polite");
  document.body.appendChild(toast);

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("is-visible");

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove("is-visible");
    }, 2200);
  }

  // Live search.
  const flavorContainer = document.querySelector(".flavor-container");
  const mixContainer = document.querySelector(".mix-container");

  function createEmptyMessage(container, message) {
    const element = document.createElement("p");
    element.className = "search-empty";
    element.textContent = message;
    element.hidden = true;
    container?.appendChild(element);
    return element;
  }

  const flavorEmpty = createEmptyMessage(
    flavorContainer,
    "No matching flavors found."
  );

  const mixEmpty = createEmptyMessage(
    mixContainer,
    "No matching combinations found."
  );

  function filterCards() {
    const query = (searchInput?.value || "").trim().toLowerCase();

    flavorCards.forEach(card => {
      card.hidden = !card.textContent.toLowerCase().includes(query);
    });

    mixCards.forEach(card => {
      card.hidden = !card.textContent.toLowerCase().includes(query);
    });

    flavorEmpty.hidden =
      query === "" || flavorCards.some(card => !card.hidden);

    mixEmpty.hidden =
      query === "" || mixCards.some(card => !card.hidden);
  }

  searchInput?.addEventListener("input", filterCards);

  // Favorites saved in this browser.
  let favorites = new Set();

  try {
    favorites = new Set(
      JSON.parse(localStorage.getItem("sweetScoopFavorites") || "[]")
    );
  } catch {
    favorites = new Set();
  }

  function saveFavorites() {
    try {
      localStorage.setItem(
        "sweetScoopFavorites",
        JSON.stringify([...favorites])
      );
    } catch {
      // Favorites still work temporarily if storage is unavailable.
    }
  }

  allCards.forEach(card => {
    const heading = card.querySelector("h3");
    const name = heading?.textContent.trim() || "item";
    const type = card.classList.contains("flavor-card") ? "flavor" : "mix";
    const id = `${type}-${name}`;

    const favoriteButton = document.createElement("button");
    favoriteButton.type = "button";
    favoriteButton.className = "favorite-button";
    favoriteButton.textContent = favorites.has(id) ? "♥" : "♡";
    favoriteButton.classList.toggle("is-favorite", favorites.has(id));
    favoriteButton.setAttribute(
      "aria-pressed",
      String(favorites.has(id))
    );
    favoriteButton.setAttribute(
      "aria-label",
      `Toggle favorite for ${name}`
    );

    favoriteButton.addEventListener("click", () => {
      if (favorites.has(id)) {
        favorites.delete(id);
        favoriteButton.textContent = "♡";
        favoriteButton.classList.remove("is-favorite");
        favoriteButton.setAttribute("aria-pressed", "false");
        showToast("Removed from favorites");
      } else {
        favorites.add(id);
        favoriteButton.textContent = "♥";
        favoriteButton.classList.add("is-favorite");
        favoriteButton.setAttribute("aria-pressed", "true");
        showToast("Added to favorites ❤️");
      }

      saveFavorites();
    });

    card.appendChild(favoriteButton);
  });

  // Create the floating cart button.
  const launcher = document.createElement("button");
  launcher.type = "button";
  launcher.className = "cart-launcher";
  launcher.innerHTML = '🛒 Cart <span class="cart-count">0</span>';
  launcher.setAttribute("aria-label", "Open shopping cart");
  document.body.appendChild(launcher);

  // Create the cart panel.
  const overlay = document.createElement("div");
  overlay.className = "cart-overlay";

  overlay.innerHTML = `
    <aside class="cart-panel"
      role="dialog"
      aria-modal="true"
      aria-label="Shopping cart">

      <div class="cart-header">
        <h2>Your Cart 🛒</h2>
        <button class="cart-close"
          type="button"
          aria-label="Close cart">✕</button>
      </div>

      <div class="cart-items"></div>

      <div class="cart-total">
        <span>Total</span>
        <span class="cart-total-value">₹0</span>
      </div>

      <button class="cart-checkout" type="button">
        Place Order
      </button>
    </aside>
  `;

  document.body.appendChild(overlay);

  const cartItems = overlay.querySelector(".cart-items");
  const cartCount = launcher.querySelector(".cart-count");
  const cartTotal = overlay.querySelector(".cart-total-value");
  const closeCartButton = overlay.querySelector(".cart-close");

  function openCart() {
    overlay.classList.add("is-open");
    closeCartButton.focus();
  }

  function closeCart() {
    overlay.classList.remove("is-open");
    launcher.focus();
  }

  launcher.addEventListener("click", openCart);
  closeCartButton.addEventListener("click", closeCart);

  overlay.addEventListener("click", event => {
    if (event.target === overlay) closeCart();
  });

  document.addEventListener("keydown", event => {
    if (
      event.key === "Escape" &&
      overlay.classList.contains("is-open")
    ) {
      closeCart();
    }
  });

  // Read the product name and rupee price from its card.
  function getItemDetails(button) {
    const card = button.closest(
      ".flavor-card, .mix-card, .offer-card"
    );

    if (!card) return null;

    const heading = card.querySelector("h3");
    const priceMatch = button.textContent.match(/₹\s*([\d,]+)/);

    if (!heading || !priceMatch) return null;

    const name = heading.textContent.trim();
    const price = Number(priceMatch[1].replace(/,/g, ""));

    return {
      id: `${name}-${price}`,
      name,
      price
    };
  }

  // Add an item or increase its quantity.
  function addToCart(item) {
    if (!item || !Number.isFinite(item.price)) {
      showToast("Couldn't read the item price.");
      return;
    }

    if (cart[item.id]) {
      cart[item.id].quantity += 1;
    } else {
      cart[item.id] = { ...item, quantity: 1 };
    }

    renderCart();
    showToast(`${item.name} added to cart!`);
  }

  // Render the cart and calculate its total.
  function renderCart() {
    cartItems.replaceChildren();

    let totalQuantity = 0;
    let totalPrice = 0;

    Object.values(cart).forEach(item => {
      totalQuantity += item.quantity;
      totalPrice += item.price * item.quantity;

      const row = document.createElement("div");
      row.className = "cart-item";

      const details = document.createElement("div");

      const name = document.createElement("p");
      name.className = "cart-item-name";
      name.textContent = item.name;

      const price = document.createElement("p");
      price.className = "cart-item-price";
      price.textContent = `₹${item.price} × ${item.quantity}`;

      const controls = document.createElement("div");
      controls.className = "quantity-controls";

      const minus = document.createElement("button");
      minus.type = "button";
      minus.className = "quantity-button";
      minus.textContent = "−";
      minus.setAttribute("aria-label", `Decrease ${item.name}`);

      minus.addEventListener("click", () => {
        item.quantity -= 1;

        if (item.quantity <= 0) {
          delete cart[item.id];
        }

        renderCart();
      });

      const quantity = document.createElement("span");
      quantity.textContent = item.quantity;

      const plus = document.createElement("button");
      plus.type = "button";
      plus.className = "quantity-button";
      plus.textContent = "+";
      plus.setAttribute("aria-label", `Increase ${item.name}`);

      plus.addEventListener("click", () => {
        item.quantity += 1;
        renderCart();
      });

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "remove-item";
      remove.textContent = "Remove";

      remove.addEventListener("click", () => {
        delete cart[item.id];
        renderCart();
        showToast("Item removed");
      });

      controls.append(minus, quantity, plus, remove);
      details.append(name, price, controls);
      row.appendChild(details);
      cartItems.appendChild(row);
    });

    if (totalQuantity === 0) {
      const empty = document.createElement("p");
      empty.className = "cart-empty";
      empty.textContent =
        "Your cart is empty 🍨 Add something delicious!";
      cartItems.appendChild(empty);
    }

    cartCount.textContent = totalQuantity;
    cartTotal.textContent = `₹${totalPrice}`;
  }

  // Connect all flavor, combination, and offer buttons.
  document.querySelectorAll(".price-button").forEach(button => {
    button.addEventListener("click", () => {
      addToCart(getItemDetails(button));
    });
  });

  // Demo checkout only; no actual order or payment is submitted.
  overlay.querySelector(".cart-checkout").addEventListener("click", () => {
    if (Object.keys(cart).length === 0) {
      showToast("Your cart is empty!");
      return;
    }

    showToast("Cart ready! A backend is needed to submit an order.");
  });

  // Mobile navigation.
  if (navbar && navLinks) {
    const menuButton = document.createElement("button");
    menuButton.type = "button";
    menuButton.className = "mobile-menu-toggle";
    menuButton.textContent = "☰ Menu";
    menuButton.setAttribute("aria-expanded", "false");

    navbar.insertBefore(menuButton, navLinks);

    function updateMenuForScreen() {
      if (window.innerWidth > 700) {
        navLinks.classList.remove(
          "mobile-collapsed",
          "mobile-expanded"
        );
      } else {
        navLinks.classList.remove("mobile-expanded");
        navLinks.classList.add("mobile-collapsed");
      }

      menuButton.setAttribute("aria-expanded", "false");
      menuButton.textContent = "☰ Menu";
    }

    menuButton.addEventListener("click", () => {
      const expanded = navLinks.classList.contains("mobile-expanded");

      navLinks.classList.toggle("mobile-expanded", !expanded);
      navLinks.classList.toggle("mobile-collapsed", expanded);

      menuButton.setAttribute("aria-expanded", String(!expanded));
      menuButton.textContent = expanded ? "☰ Menu" : "✕ Close";
    });

    navLinks.querySelectorAll("a").forEach(link => {
      link.addEventListener("click", () => {
        if (window.innerWidth <= 700) {
          navLinks.classList.remove("mobile-expanded");
          navLinks.classList.add("mobile-collapsed");
          menuButton.setAttribute("aria-expanded", "false");
          menuButton.textContent = "☰ Menu";
        }
      });
    });

    window.addEventListener("resize", updateMenuForScreen);
    updateMenuForScreen();
  }

  // The navigation Order Now button scrolls to the flavors.
  document.querySelector(".nav-order-button")?.addEventListener("click", () => {
    document.querySelector("#flavors")?.scrollIntoView({
      behavior: "smooth"
    });
  });

  renderCart();
});
