let editingRecurringId = null;

let recurringCurrentPage = 1;
const recurringLimit = 10;
let recurringHasNextPage = false;

const recurringForm = document.getElementById('recurring-form');
const recurringTypeEl = document.getElementById('recurring-type');
const recurringCategoryEl = document.getElementById('recurring-category');
const recurringSubcategoryEl = document.getElementById('recurring-subcategory');
const recurringSubmitBtn = document.getElementById('recurring-submit-btn');
const recurringCancelBtn = document.getElementById('recurring-cancel-btn');
const recurringPrevBtn = document.getElementById('recurring-prev-btn');
const recurringNextBtn = document.getElementById('recurring-next-btn');
const recurringSearchTitleEl = document.getElementById('recurring-search-title');
const recurringFilterTypeEl = document.getElementById('recurring-filter-type');
const recurringFilterCategoryEl = document.getElementById('recurring-filter-category');
const recurringFilterStatusEl = document.getElementById('recurring-filter-status');
const recurringApplyFiltersBtn = document.getElementById('recurring-apply-filters-btn');
const recurringResetFiltersBtn = document.getElementById('recurring-reset-filters-btn');

if (recurringPrevBtn) {
  recurringPrevBtn.addEventListener('click', recurringPrevPage);
}

if (recurringNextBtn) {
  recurringNextBtn.addEventListener('click', recurringNextPage);
}

if (recurringApplyFiltersBtn) {
  recurringApplyFiltersBtn.addEventListener('click', applyRecurringFilters);
}

if (recurringResetFiltersBtn) {
  recurringResetFiltersBtn.addEventListener('click', resetRecurringFilters);
}


if (recurringCancelBtn) recurringCancelBtn.addEventListener('click', cancelRecurringEdit);
if (recurringForm) recurringForm.addEventListener('submit', async e => { e.preventDefault(); await addRecurringTransaction(); });
if (recurringTypeEl) recurringTypeEl.addEventListener('change', handleRecurringTypeChange);
if (recurringCategoryEl) recurringCategoryEl.addEventListener('change', handleRecurringCategoryChange);

window.addEventListener('DOMContentLoaded', async () => {
  setTodayDates();
  await loadRecurringFilterCategories();
  await loadRecurringTransactions();
  
});

function setTodayDates() {
  const today = new Date().toISOString().slice(0, 10);
  document.getElementById('recurring-start-date').value = today;
  document.getElementById('recurring-next-date').value = today;
  const reminderEl = document.getElementById('reminder_days');
  if (reminderEl && !reminderEl.value) reminderEl.value = '3';
}

async function handleRecurringTypeChange() {
  const type = recurringTypeEl.value;

  recurringCategoryEl.innerHTML = '<option value="" disabled selected hidden>Select category</option>';
  recurringSubcategoryEl.innerHTML = '<option value="" disabled selected hidden>Select subcategory</option>';
  recurringSubcategoryEl.disabled = true;

  if (!type) {
    recurringCategoryEl.disabled = true;
    return;
  }

  try {
    const res = await fetch(`/categories?type=${encodeURIComponent(type)}`);
    const categories = await res.json();
    categories.forEach(item => {
      const option = document.createElement('option');
      option.value = item.id;
      option.textContent = item.name;
      recurringCategoryEl.appendChild(option);
    });
    recurringCategoryEl.disabled = false;
  } catch (error) {
    console.error('Recurring categories error:', error);
  }
}

async function handleRecurringCategoryChange() {
  const categoryId = recurringCategoryEl.value;
  recurringSubcategoryEl.innerHTML = '<option value="" disabled selected hidden>Select subcategory</option>';

  if (!categoryId) {
    recurringSubcategoryEl.disabled = true;
    return;
  }

  try {
    const res = await fetch(`/subcategories?category_id=${encodeURIComponent(categoryId)}`);
    const subcategories = await res.json();
    subcategories.forEach(item => {
      const option = document.createElement('option');
      option.value = item.id;
      option.textContent = item.name;
      recurringSubcategoryEl.appendChild(option);
    });
    recurringSubcategoryEl.disabled = false;
  } catch (error) {
    console.error('Recurring subcategories error:', error);
  }
}

async function addRecurringTransaction() {
  const title = document.getElementById('recurring-title').value.trim();
  const type = recurringTypeEl.value;
  const categoryId = recurringCategoryEl.value;
  const subcategoryId = recurringSubcategoryEl.value;
  const amount = document.getElementById('recurring-amount').value;
  const frequency = document.getElementById('recurring-frequency').value;
  const startDate = document.getElementById('recurring-start-date').value;
  const nextDueDate = document.getElementById('recurring-next-date').value;
  const reminderDays = document.getElementById('reminder_days').value;
  const comment = document.getElementById('recurring-comment').value.trim();

  const category = recurringCategoryEl.options[recurringCategoryEl.selectedIndex]?.text || '';
  const subcategory = recurringSubcategoryEl.options[recurringSubcategoryEl.selectedIndex]?.text || '';

  if (!title) return showRecurringMessage('Please enter title', 'error');
  if (!type) return showRecurringMessage('Please select type', 'error');
  if (!categoryId) return showRecurringMessage('Please select category', 'error');
  if (!subcategoryId) return showRecurringMessage('Please select subcategory', 'error');
  if (!amount || Number(amount) <= 0) return showRecurringMessage('Amount must be greater than 0', 'error');
  if (!frequency) return showRecurringMessage('Please select frequency', 'error');
  if (!startDate) return showRecurringMessage('Please select start date', 'error');
  if (!nextDueDate) return showRecurringMessage('Please select next due date', 'error');

  try {
    const url = editingRecurringId ? `/recurring-transactions/${editingRecurringId}` : '/recurring-transactions';
    const method = editingRecurringId ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        type,
        category,
        subcategory,
        subcategory_id: subcategoryId,
        amount,
        frequency,
        start_date: startDate,
        next_due_date: nextDueDate,
        reminder_days: Number(reminderDays),
        comment
      })
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || 'Error saving recurring transaction');
    }

    const successMessage = editingRecurringId ? 'Recurring transaction updated' : 'Recurring transaction added';
    editingRecurringId = null;
    recurringForm.reset();
    recurringCategoryEl.innerHTML = '<option value="" disabled selected hidden>Select category</option>';
    recurringSubcategoryEl.innerHTML = '<option value="" disabled selected hidden>Select subcategory</option>';
    recurringCategoryEl.disabled = true;
    recurringSubcategoryEl.disabled = true;
    recurringSubmitBtn.innerText = 'Add Recurring';
    recurringCancelBtn.style.display = 'none';
    setTodayDates();
    document.getElementById('reminder_days').value = '3';

    showRecurringMessage(successMessage, 'success');
    recurringCurrentPage = 1;
    await loadRecurringTransactions();
  } catch (error) {
    console.error('Save recurring error:', error);
    showRecurringMessage(error.message || 'Error saving recurring transaction', 'error');
  }
}

async function startRecurringEdit(item) {
  editingRecurringId = item.id;

  document.getElementById('recurring-title').value = item.title || '';
  document.getElementById('recurring-type').value = item.type || '';
  document.getElementById('recurring-amount').value = item.amount || '';
  document.getElementById('recurring-frequency').value = item.frequency || '';
  document.getElementById('recurring-start-date').value = toInputDate(item.start_date);
  document.getElementById('recurring-next-date').value = toInputDate(item.next_due_date);
  document.getElementById('reminder_days').value = item.reminder_days ?? 3;
  document.getElementById('recurring-comment').value = item.comment || '';

  await handleRecurringTypeChange();

  window.scrollTo({ top: 0, behavior: 'smooth' });

  const categoryOptions = Array.from(recurringCategoryEl.options);
  const categoryMatch = categoryOptions.find(opt => opt.text === item.category);

  if (categoryMatch) {
    recurringCategoryEl.value = categoryMatch.value;
    await handleRecurringCategoryChange();
  }

  const subcategoryOptions = Array.from(recurringSubcategoryEl.options);
  const subcategoryMatch = subcategoryOptions.find(opt => opt.text === item.subcategory);
  if (subcategoryMatch) recurringSubcategoryEl.value = subcategoryMatch.value;

  recurringSubmitBtn.innerText = 'Update Recurring';
  recurringCancelBtn.style.display = 'inline-flex';
}

function cancelRecurringEdit() {
  editingRecurringId = null;
  recurringForm.reset();
  recurringCategoryEl.innerHTML = '<option value="" disabled selected hidden>Select category</option>';
  recurringSubcategoryEl.innerHTML = '<option value="" disabled selected hidden>Select subcategory</option>';
  recurringCategoryEl.disabled = true;
  recurringSubcategoryEl.disabled = true;
  recurringSubmitBtn.innerText = 'Add Recurring';
  recurringCancelBtn.style.display = 'none';
  setTodayDates();
  document.getElementById('reminder_days').value = '3';
}

function toInputDate(dateString) {
  if (!dateString) return '';
  const d = new Date(dateString);
  if (isNaN(d)) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getRecurringStatus(item) {
  if (!item.active) return 'Inactive';
  if (!item.next_due_date) return 'No date';

  const today = new Date();
  const dueDate = new Date(item.next_due_date);
  today.setHours(0, 0, 0, 0);
  dueDate.setHours(0, 0, 0, 0);

  const diffMs = dueDate - today;
  const daysUntilDue = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const reminderDays = Number(item.reminder_days || 0);

  if (daysUntilDue < 0) return 'Overdue';
  if (daysUntilDue <= reminderDays) return 'Due Soon';
  return 'Upcoming';
}

function getStatusClass(status) {
  if (status === 'Overdue') return 'row-status-overdue';
  if (status === 'Due Soon') return 'row-status-due-soon';
  if (status === 'Upcoming') return 'row-status-upcoming';
  return 'row-status-inactive';
}

function getPillClass(status) {
  if (status === 'Overdue') return 'status-overdue';
  if (status === 'Due Soon') return 'status-due-soon';
  if (status === 'Upcoming') return 'status-upcoming';
  return 'status-inactive';
}

async function loadRecurringTransactions() {
  try {
    const res = await fetch('/recurring-transactions');
    const data = await res.json();

    const tbody = document.getElementById('recurring-list');
    tbody.innerHTML = '';


const searchValue = recurringSearchTitleEl?.value.trim().toLowerCase() || '';
const typeValue = recurringFilterTypeEl?.value || '';
const categoryValue = recurringFilterCategoryEl?.value || '';
const statusValue = recurringFilterStatusEl?.value || '';

const filteredData = data.filter(item => {
  const status = getRecurringStatus(item);

  const matchesTitle = !searchValue ||
    String(item.title || '').toLowerCase().includes(searchValue);

  const matchesType = !typeValue || item.type === typeValue;
  const matchesCategory = !categoryValue || item.category === categoryValue;
  const matchesStatus = !statusValue || status === statusValue;

  return matchesTitle && matchesType && matchesCategory && matchesStatus;
});

if (!filteredData.length) {
  tbody.innerHTML = `
    <tr>
      <td colspan="10" class="empty-table-cell">No recurring transactions found</td>
    </tr>
  `;
  recurringHasNextPage = false;
  recurringCurrentPage = 1;
  updateRecurringPagination(0);
  return;
}

    const sortedData = [...filteredData].sort((a, b) => {
      const statusA = getRecurringStatus(a);
      const statusB = getRecurringStatus(b);
      const order = { Overdue: 1, 'Due Soon': 2, Upcoming: 3, Inactive: 4 };
      const statusDiff = order[statusA] - order[statusB];
      if (statusDiff !== 0) return statusDiff;

      const dateA = new Date(a.next_due_date || '9999-12-31');
      const dateB = new Date(b.next_due_date || '9999-12-31');
      return dateA - dateB;
    });

    const startIndex = (recurringCurrentPage - 1) * recurringLimit;
const endIndex = startIndex + recurringLimit;
const pagedData = sortedData.slice(startIndex, endIndex);

recurringHasNextPage = endIndex < sortedData.length;
updateRecurringPagination(sortedData.length);

    pagedData.forEach(item => {
      const tr = document.createElement('tr');
      const status = getRecurringStatus(item);
      const rowClass = getStatusClass(status);
      const pillClass = getPillClass(status);
      tr.classList.add(rowClass);

      tr.innerHTML = `
        <td>${escapeHtml(item.title || '')}</td>
        <td class="${item.type === 'income' ? 'income' : 'expense'}">${escapeHtml(item.type || '')}</td>
        <td>${escapeHtml(item.category || '')}</td>
        <td>${escapeHtml(item.subcategory || '')}</td>
        <td>${Number(item.amount).toFixed(2)}</td>
        <td>${escapeHtml(item.frequency || '')}</td>
        <td>${formatDate(item.start_date)}</td>
        <td>${formatDate(item.next_due_date)}</td>
        <td>
          <div class="status-cell-wrap">
            <span class="status-pill ${pillClass}">${status}</span>
            <button type="button" class="btn btn-small btn-toggle recurring-toggle-btn">
              ${item.active ? 'Disable' : 'Enable'}
            </button>
          </div>
        </td>
        <td class="actions-cell">
          <button type="button" class="btn btn-icon btn-edit recurring-edit-btn" title="Edit">✏️</button>
          ${item.active ? `<button type="button" class="btn btn-icon btn-primary recurring-pay-btn" title="Pay Now">💰</button>` : ''}
          <button type="button" class="btn btn-icon btn-delete recurring-delete-btn" title="Delete">🗑</button>
        </td>
      `;

      const editBtn = tr.querySelector('.recurring-edit-btn');
      const payBtn = tr.querySelector('.recurring-pay-btn');
      const toggleBtn = tr.querySelector('.recurring-toggle-btn');
      const deleteBtn = tr.querySelector('.recurring-delete-btn');

      editBtn.addEventListener('click', async () => { await startRecurringEdit(item); });
      if (payBtn) payBtn.addEventListener('click', async () => { await payRecurringNow(item.id); });
      toggleBtn.addEventListener('click', async () => { await toggleRecurring(item.id); });
      deleteBtn.addEventListener('click', async () => { await deleteRecurring(item.id); });

      tbody.appendChild(tr);
    });
  } catch (error) {
    console.error('Load recurring transactions error:', error);
  }
}

async function toggleRecurring(id) {
  try {
    const res = await fetch(`/recurring-transactions/${id}/toggle`, { method: 'PUT' });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || 'Error updating recurring transaction');
    }
    recurringCurrentPage = 1;
    await loadRecurringTransactions();
  } catch (error) {
    console.error('Toggle recurring error:', error);
    showRecurringMessage(error.message || 'Error updating recurring transaction', 'error');
  }
}

async function deleteRecurring(id) {
  if (!confirm('Delete this recurring transaction?')) return;

  try {
    const res = await fetch(`/recurring-transactions/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || 'Error deleting recurring transaction');
    }
    showRecurringMessage('Recurring transaction deleted', 'success');
    recurringCurrentPage = 1;
    await loadRecurringTransactions();
  } catch (error) {
    console.error('Delete recurring error:', error);
    showRecurringMessage(error.message || 'Error deleting recurring transaction', 'error');
  }
}

async function payRecurringNow(id) {
  try {
    const res = await fetch(`/recurring-transactions/${id}/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'early' })
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || 'Error recording payment');
    }

    showRecurringMessage('Payment recorded', 'success');
    if (recurringCurrentPage > 1) {
  recurringCurrentPage = 1;
}
    await loadRecurringTransactions();
  } catch (error) {
    console.error('Pay recurring now error:', error);
    showRecurringMessage(error.message || 'Error recording payment', 'error');
  }
}

function showRecurringMessage(text, type) {
  const el = document.getElementById('recurring-message');
  el.textContent = text;
  el.className = type === 'success' ? 'success-message' : 'error-message';
  setTimeout(() => {
    if (el.textContent === text) {
      el.textContent = '';
      el.className = '';
    }
  }, 3000);
}

function formatDate(dateString) {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function updateRecurringPagination(totalItems = 0) {
  const pageInfo = document.getElementById('recurring-page-info');
  const prevBtn = document.getElementById('recurring-prev-btn');
  const nextBtn = document.getElementById('recurring-next-btn');
  const paginationBar = document.getElementById('recurring-pagination-bar');
  const totalCount = document.getElementById('recurring-total-count');

  if (pageInfo) {
    pageInfo.innerText = `Page ${recurringCurrentPage}`;
  }

  if (prevBtn) {
    prevBtn.disabled = recurringCurrentPage === 1;
  }

  if (nextBtn) {
    nextBtn.disabled = !recurringHasNextPage;
  }

  if (paginationBar) {
    paginationBar.style.display = totalItems > recurringLimit ? 'flex' : 'none';
  }

  if (totalCount) {
    totalCount.innerText = totalItems;
  }
}

function recurringNextPage() {
  if (!recurringHasNextPage) return;
  recurringCurrentPage++;
  loadRecurringTransactions();
}

function recurringPrevPage() {
  if (recurringCurrentPage <= 1) return;
  recurringCurrentPage--;
  loadRecurringTransactions();
}

async function loadRecurringFilterCategories() {
  try {
    const res = await fetch('/categories');
    const categories = await res.json();

    recurringFilterCategoryEl.innerHTML = '<option value="">All categories</option>';

    categories.forEach(item => {
      const option = document.createElement('option');
      option.value = item.name;
      option.textContent = item.name;
      recurringFilterCategoryEl.appendChild(option);
    });
  } catch (error) {
    console.error('Recurring filter categories error:', error);
  }
}

function applyRecurringFilters() {
  recurringCurrentPage = 1;
  loadRecurringTransactions();
}

function resetRecurringFilters() {
  if (recurringSearchTitleEl) recurringSearchTitleEl.value = '';
  if (recurringFilterTypeEl) recurringFilterTypeEl.value = '';
  if (recurringFilterCategoryEl) recurringFilterCategoryEl.value = '';
  if (recurringFilterStatusEl) recurringFilterStatusEl.value = '';

  recurringCurrentPage = 1;
  loadRecurringTransactions();
}

