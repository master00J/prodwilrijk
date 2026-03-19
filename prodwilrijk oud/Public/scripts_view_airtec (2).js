document.addEventListener("DOMContentLoaded", (event) => {
  let goodsData = [];
  let deletionQueue = []; // IDs pending deletion confirmation
  const loadingSpinner = document.getElementById("loadingSpinner");

  // Initialize Bootstrap Toast
  const toastEl = document.getElementById("toastNotification");
  const toast = new bootstrap.Toast(toastEl);

  // Show toast notifications
  function showToast(title, message) {
    document.getElementById("toastTitle").textContent = title;
    document.getElementById("toastBody").textContent = message;
    toast.show();
  }

  // Toggle loading spinner visibility
  function setLoading(isLoading) {
    loadingSpinner.style.display = isLoading ? "flex" : "none";
  }

  // Load header content from external file
  function loadHeader() {
    fetch("header.html")
      .then((response) => {
        if (!response.ok) throw new Error("Network response was not ok");
        return response.text();
      })
      .then((data) => {
        document.getElementById("header-placeholder").innerHTML = data;
      })
      .catch((error) => console.error("Error loading header:", error));
  }
  loadHeader();

  // Fetch goods data from API
  function fetchGoodsData() {
    setLoading(true);
    fetch("/api/incoming_goods_airtec")
      .then((response) => {
        if (!response.ok) throw new Error("Network response was not ok");
        return response.json();
      })
      .then((data) => {
        goodsData = data;
        displayGoodsData(goodsData);
        updateTotalQuantity(goodsData);
        setLoading(false);
      })
      .catch((error) => {
        console.error("Error fetching incoming goods:", error);
        showToast("Error", "Failed to fetch data.");
        setLoading(false);
      });
  }

  // Display goods data in the table
  function displayGoodsData(data) {
    const tableBody = document.getElementById("goods-table-body");
    tableBody.innerHTML = "";
    data.forEach((item) => {
      const datumOpgestuurd = item.datum_opgestuurd
        ? new Date(item.datum_opgestuurd).toLocaleDateString("nl-NL")
        : "";
      const row = document.createElement("tr");
      row.innerHTML = `
        <td class="col-checkbox text-center">
          <input type="checkbox" class="custom-checkbox item-checkbox" data-id="${item.id}">
        </td>
        <td class="col-id">${item.id}</td>
        <td class="col-beschrijving">${item.beschrijving}</td>
        <td class="col-item-number">${item.item_number}</td>
        <td class="col-lot-number">${item.lot_number || ""}</td>
        <td class="col-datum">${datumOpgestuurd}</td>
        <td class="col-kistnummer">${item.kistnummer}</td>
        <td class="col-divisie">${item.divisie || ""}</td>
        <td class="col-quantity">${item.quantity}</td>
        <td class="col-actions">
          <button class="btn btn-danger btn-sm delete-button" data-id="${item.id}" title="Delete">
            <i class="fas fa-trash"></i>
          </button>
        </td>
      `;
      tableBody.appendChild(row);
    });
  }

  // Update total quantity display
  function updateTotalQuantity(data) {
    const totalQuantity = data.reduce((sum, item) => sum + (item.quantity || 0), 0);
    document.getElementById("total-quantity").textContent = `Aantal inkomende goederen: ${totalQuantity}`;
  }

  // Filter table based on search input
  function filterTable() {
    const query = document.getElementById("search-box").value.toLowerCase();
    const filteredData = goodsData.filter((item) =>
      (item.beschrijving || "").toLowerCase().includes(query) ||
      (item.item_number || "").toLowerCase().includes(query) ||
      (item.lot_number || "").toLowerCase().includes(query) ||
      (item.kistnummer || "").toLowerCase().includes(query) ||
      (item.divisie || "").toLowerCase().includes(query) ||
      item.id.toString().includes(query)
    );
    displayGoodsData(filteredData);
    updateTotalQuantity(filteredData);
  }
  document.getElementById("search-box").addEventListener("input", filterTable);

  // Sort functionality based on item_number and lot_number
  document.getElementById("sort-button").addEventListener("click", () => {
    const sortedData = [...goodsData].sort((a, b) => {
      const cmp = a.item_number.localeCompare(b.item_number);
      return cmp !== 0 ? cmp : a.lot_number.localeCompare(b.lot_number);
    });
    displayGoodsData(sortedData);
    updateTotalQuantity(sortedData);
  });

  // Confirm checked items (for example, to mark them as confirmed)
  document.getElementById("confirm-button").addEventListener("click", () => {
    const checkedBoxes = document.querySelectorAll('input[type="checkbox"]:checked');
    const checkedIds = Array.from(checkedBoxes).map(cb => cb.getAttribute("data-id"));
    if (checkedIds.length === 0) {
      showToast("Warning", "No items selected for confirmation.");
      return;
    }
    fetch("/confirm_items_airtec", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: checkedIds })
    })
      .then(response => response.json())
      .then(result => {
        if (result.success) {
          showToast("Success", "Items confirmed.");
          fetchGoodsData();
        } else {
          showToast("Error", "Failed to confirm items.");
        }
      })
      .catch(error => {
        console.error("Error confirming items:", error);
        showToast("Error", "Failed to confirm items.");
      });
  });

  // Print functionality
  document.getElementById("print-button").addEventListener("click", () => {
    const headerContent = `
      <div style="display: flex; justify-content: space-between;">
        <div style="flex: 1;">
          <h2>AC verpakking binnengekomen</h2>
          <p>Blokpaletten : ...... stuks</p>
          <p>AC Ringen : ...... stuks</p>
          <p>AC Deksel : ...... stuks</p>
        </div>
        <div style="flex: 1;">
          <p>IJzeren Rekken : ...... stuks</p>
          <p>AC Paletten : ...... stuks</p>
          <p>Aantal Labels : ..........</p>
        </div>
      </div>
      <hr/>
    `;
    const tableContent = document.querySelector("table").outerHTML;
    const totalItemsContent = document.getElementById("total-quantity").textContent;
    const printContent = `
      ${headerContent}
      <h2>Inkomende goederen Airtec</h2>
      <div style="font-weight: bold;">${totalItemsContent}</div>
      ${tableContent}
    `;
    const printWindow = window.open("", "", "height=800,width=1000");
    printWindow.document.write("<html><head><title>Print Table</title>");
    printWindow.document.write(
      '<style>table { width: 100%; border-collapse: collapse; } th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; } body { font-family: Arial, sans-serif; }</style>'
    );
    printWindow.document.write("</head><body>");
    printWindow.document.write(printContent);
    printWindow.document.write("</body></html>");
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  });

  // Delete functionality via API using a confirmation modal
  function deleteGoods(ids) {
    setLoading(true);
    fetch("/api/incoming_goods_airtec", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: ids })
    })
      .then(response => response.json())
      .then(result => {
        setLoading(false);
        if (result.success) {
          showToast("Success", "Items deleted successfully.");
          fetchGoodsData();
        } else {
          showToast("Error", "Failed to delete items.");
        }
      })
      .catch(error => {
        console.error("Error deleting items:", error);
        setLoading(false);
        showToast("Error", "Failed to delete items.");
      });
  }

  // Open confirmation modal for individual deletion
  document.getElementById("goods-table-body").addEventListener("click", function (event) {
    const deleteBtn = event.target.closest(".delete-button");
    if (deleteBtn) {
      const id = deleteBtn.getAttribute("data-id");
      deletionQueue = [id];
      const modalEl = document.getElementById("confirmDeleteModal");
      const modal = new bootstrap.Modal(modalEl);
      modal.show();
    }
  });

  // "Delete Selected" button functionality
  document.getElementById("delete-selected-button").addEventListener("click", () => {
    const checkedBoxes = document.querySelectorAll(".item-checkbox:checked");
    const ids = Array.from(checkedBoxes).map(cb => cb.getAttribute("data-id"));
    if (ids.length === 0) {
      showToast("Warning", "No items selected for deletion.");
      return;
    }
    deletionQueue = ids;
    const modalEl = document.getElementById("confirmDeleteModal");
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
  });

  // Handle deletion confirmation from modal
  document.getElementById("modalDeleteConfirmButton").addEventListener("click", () => {
    const modalEl = document.getElementById("confirmDeleteModal");
    const modal = bootstrap.Modal.getInstance(modalEl);
    modal.hide();
    if (deletionQueue.length > 0) {
      deleteGoods(deletionQueue);
    }
  });

  // "Select all" functionality
  const selectAllCheckbox = document.getElementById("select-all");
  selectAllCheckbox.addEventListener("change", function () {
    const checkboxes = document.querySelectorAll(".item-checkbox");
    checkboxes.forEach((checkbox) => {
      checkbox.checked = selectAllCheckbox.checked;
    });
  });

  // New incoming goods submission
  const incomingGoodsForm = document.getElementById("incoming-goods-form");
  const beschrijvingInput = document.getElementById("beschrijving");
  const lotNumberInput = document.getElementById("lot_number");
  const divisieInput = document.getElementById("divisie");
  const itemNumberInput = document.getElementById("item_number");
  const kistnummerInput = document.getElementById("kistnummer");

  const toggleFields = () => {
    const beschrijvingValue = beschrijvingInput.value.toLowerCase();
    if (beschrijvingValue === "cooler") {
      lotNumberInput.disabled = true;
      lotNumberInput.value = "";
      divisieInput.disabled = true;
      divisieInput.value = "";
    } else {
      lotNumberInput.disabled = false;
      divisieInput.disabled = false;
    }
  };
  beschrijvingInput.addEventListener("input", toggleFields);

  incomingGoodsForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(incomingGoodsForm);
    const data = {
      beschrijving: formData.get("beschrijving"),
      item_number: formData.get("item_number"),
      lot_number: formData.get("lot_number"),
      datum_opgestuurd: formData.get("datum_opgestuurd"),
      kistnummer: formData.get("kistnummer"),
      divisie: formData.get("divisie"),
      quantity: formData.get("quantity"),
    };

    setLoading(true);
    fetch("/api/incoming_goods_airtec", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([data]),
    })
      .then(response => response.json())
      .then(result => {
        setLoading(false);
        document.getElementById("response-message").textContent =
          "Incoming goods recorded successfully!";
        document.getElementById("response-message").className = "alert alert-success";
        document.getElementById("response-message").style.display = "block";
        fetchGoodsData();
        incomingGoodsForm.reset();
        toggleFields();
        setTimeout(() => {
          document.getElementById("response-message").style.display = "none";
        }, 3000);
      })
      .catch(error => {
        console.error("Error:", error);
        setLoading(false);
        document.getElementById("response-message").textContent =
          "Failed to record incoming goods.";
        document.getElementById("response-message").className = "alert alert-danger";
        document.getElementById("response-message").style.display = "block";
        setTimeout(() => {
          document.getElementById("response-message").style.display = "none";
        }, 3000);
      });
  });

  itemNumberInput.addEventListener("blur", (event) => {
    const itemNumber = event.target.value;
    fetch(`/api/get_kistnummer?item_number=${itemNumber}`)
      .then(response => response.json())
      .then(data => {
        if (data.kistnummer) {
          kistnummerInput.value = data.kistnummer;
        }
      })
      .catch(error => console.error("Error fetching kistnummer:", error));
  });

  // (Optional) Column toggle functionality if needed
  function toggleColumn(columnIndex, isVisible) {
    const table = document.querySelector("table");
    const rows = table.rows;
    for (let row of rows) {
      const cell = row.cells[columnIndex];
      if (cell) {
        cell.style.display = isVisible ? "" : "none";
      }
    }
  }
  document.querySelectorAll(".column-toggle").forEach((checkbox) => {
    checkbox.addEventListener("change", (event) => {
      const columnIndex = event.target.getAttribute("data-column");
      const isVisible = event.target.checked;
      toggleColumn(columnIndex, isVisible);
    });
  });
  document.querySelectorAll(".column-toggle").forEach((checkbox) => {
    const columnIndex = checkbox.getAttribute("data-column");
    const isVisible = checkbox.checked;
    toggleColumn(columnIndex, isVisible);
  });

  // Initial fetch of goods data
  fetchGoodsData();
});
