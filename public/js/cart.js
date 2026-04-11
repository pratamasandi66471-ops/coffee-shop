(() => {
  const formatter = new Intl.NumberFormat("id-ID");
  const cartContent = document.getElementById("cartContent");
  const emptyState = document.getElementById("emptyState");
  const feedback = document.getElementById("cartFeedback");
  const totalItemsEl = document.getElementById("totalItems");
  const totalPriceEl = document.getElementById("totalPrice");
  const cartRowCountEl = document.getElementById("cartRowCount");
  const cartTableBody = document.getElementById("cartTableBody");
  const csrfToken = document.getElementById("csrfToken")?.value || "";

  function ensureCsrfToken() {
    if (csrfToken) return true;
    showFeedback("Sesi keamanan tidak valid. Muat ulang halaman.");
    return false;
  }

  function formatRupiah(value) {
    return `Rp ${formatter.format(value)}`;
  }

  function getRows() {
    return Array.from(document.querySelectorAll(".cart-row"));
  }

  function showFeedback(message, type = "danger") {
    if (!feedback) return;
    feedback.className = `alert alert-${type}`;
    feedback.textContent = message;
    feedback.classList.remove("d-none");
    window.setTimeout(() => {
      feedback.classList.add("d-none");
    }, 2500);
  }

  function getRow(cartId) {
    return document.querySelector(`.cart-row[data-cart-id="${cartId}"]`);
  }

  function setRowQty(row, quantity) {
    const qtyInput = row.querySelector(".js-qty-input");
    const subtotalEl = row.querySelector(".js-subtotal");
    const price = Number(row.dataset.price) || 0;
    row.dataset.qty = String(quantity);
    if (qtyInput) qtyInput.value = quantity;
    if (subtotalEl) subtotalEl.textContent = formatRupiah(price * quantity);
  }

  function setRowDisabled(row, disabled) {
    const controls = row.querySelectorAll(".js-qty-btn, .js-remove-btn");
    controls.forEach((control) => {
      control.disabled = disabled;
    });
  }

  function refreshSummary() {
    const rows = getRows();
    const rowCount = rows.length;

    if (cartRowCountEl) {
      cartRowCountEl.textContent = rowCount;
    }

    let totalItems = 0;
    let totalPrice = 0;

    rows.forEach((row) => {
      const qty = Number(row.dataset.qty) || 0;
      const price = Number(row.dataset.price) || 0;
      totalItems += qty;
      totalPrice += qty * price;
    });

    if (totalItemsEl) totalItemsEl.textContent = `${totalItems} item`;
    if (totalPriceEl) totalPriceEl.textContent = formatRupiah(totalPrice);

    if (rowCount === 0) {
      if (cartContent) cartContent.classList.add("d-none");
      if (emptyState) emptyState.classList.remove("d-none");
    } else {
      if (cartContent) cartContent.classList.remove("d-none");
      if (emptyState) emptyState.classList.add("d-none");
    }
  }

  async function readErrorMessage(response, fallbackMessage) {
    try {
      const payload = await response.json();
      if (payload && typeof payload.message === "string" && payload.message.trim()) {
        return payload.message;
      }
    } catch (_) {
      // Ignore JSON parsing error and use fallback.
    }
    return fallbackMessage;
  }

  async function handleQtyChange(button) {
    const cartId = button.dataset.cartId;
    if (!cartId) return;

    const row = getRow(cartId);
    if (!row) return;

    const action = button.dataset.action;
    const currentQty = Number(row.dataset.qty) || 1;
    const nextQty = action === "decrease" ? Math.max(1, currentQty - 1) : currentQty + 1;

    if (nextQty === currentQty) return;
    if (!ensureCsrfToken()) return;

    setRowQty(row, nextQty);
    refreshSummary();
    setRowDisabled(row, true);

    try {
      const response = await fetch(`/orders/cart/update/${cartId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfToken,
        },
        body: JSON.stringify({ quantity: nextQty }),
      });

      if (!response.ok) {
        const errorMessage = await readErrorMessage(response, "Gagal memperbarui jumlah item.");
        throw new Error(errorMessage);
      }
    } catch (error) {
      setRowQty(row, currentQty);
      refreshSummary();
      showFeedback(error.message || "Terjadi kesalahan saat memperbarui item.");
    } finally {
      setRowDisabled(row, false);
    }
  }

  async function handleRemove(button) {
    const cartId = button.dataset.cartId;
    if (!cartId) return;

    const row = getRow(cartId);
    if (!row) return;

    if (!window.confirm("Hapus item ini?")) {
      return;
    }
    if (!ensureCsrfToken()) return;

    setRowDisabled(row, true);

    try {
      const response = await fetch(`/orders/cart/remove/${cartId}`, {
        method: "DELETE",
        headers: {
          "x-csrf-token": csrfToken,
        },
      });

      if (!response.ok) {
        const errorMessage = await readErrorMessage(response, "Gagal menghapus item.");
        throw new Error(errorMessage);
      }

      row.remove();
      refreshSummary();
      showFeedback("Item berhasil dihapus.", "success");
    } catch (error) {
      setRowDisabled(row, false);
      showFeedback(error.message || "Terjadi kesalahan saat menghapus item.");
    }
  }

  if (cartTableBody) {
    cartTableBody.addEventListener("click", (event) => {
      const qtyButton = event.target.closest(".js-qty-btn");
      if (qtyButton) {
        handleQtyChange(qtyButton);
        return;
      }

      const removeButton = event.target.closest(".js-remove-btn");
      if (removeButton) {
        handleRemove(removeButton);
      }
    });
  }

  refreshSummary();
})();
