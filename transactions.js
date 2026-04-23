let editingId = null;
let selectedSubcategoryId = null;
let currentPage = 1;
const limit = 10;
let totalItems = 0;
let totalPages = 1;
let hasNextPage = false;
let quickManageLoaded = false;

document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') cancelEdit();
});

const applyFiltersBtn = document.getElementById('apply-filters-btn');
const clearFiltersBtn = document.getElementById('clear-filters-btn');
const transactionFormEl = document.getElementById('transaction-form');
const cancelBtnEl = document.getElementById('cancel-btn');
const filtersToggleBtnEl = document.getElementById('filters-toggle-btn');
const prevBtnEl = document.getElementById('prev-btn');
const nextBtnEl = document.getElementById('next-btn');
const typeEl = document.getElementById('type');
const categoryEl = document.getElementById('category');
const filterTypeEl = document.getElementById('filter-type');
const filterCategoryEl = document.getElementById('filter-category');
const searchCommentEl = document.getElementById('search-comment');
const filterFromEl = document.getElementById('filter-from');
const filterToEl = document.getElementById('filter-to');
const exportTransactionsBtn = document.getElementById('export-transactions-btn');

const quickManageToggleBtn = document.getElementById('quick-manage-toggle-btn');
const quickManagePanel = document.getElementById('quick-manage-panel');
const quickTemplateForm = document.getElementById('quick-template-form');
const quickTypeEl = document.getElementById('quick-type');
const quickCategoryEl = document.getElementById('quick-category');
const quickSubcategoryEl = document.getElementById('quick-subcategory');

if (exportTransactionsBtn) {
  exportTransactionsBtn.addEventListener('click', exportTransactions);
}

if (transactionFormEl) transactionFormEl.addEventListener('submit', async e => { e.preventDefault(); await addTransaction(); });
if (applyFiltersBtn) applyFiltersBtn.addEventListener('click', applyFilters);
if (clearFiltersBtn) clearFiltersBtn.addEventListener('click', clearFilters);
if (cancelBtnEl) cancelBtnEl.addEventListener('click', cancelEdit);
if (filtersToggleBtnEl) filtersToggleBtnEl.addEventListener('click', toggleFilters);
if (prevBtnEl) prevBtnEl.addEventListener('click', prevPage);
if (nextBtnEl) nextBtnEl.addEventListener('click', nextPage);
if (typeEl) typeEl.addEventListener('change', handleTypeChange);
if (categoryEl) categoryEl.addEventListener('change', handleCategoryChange);
if (filterTypeEl) filterTypeEl.addEventListener('change', handleFilterTypeChange);
if (filterCategoryEl) filterCategoryEl.addEventListener('change', handleFilterCategoryChange);
if (searchCommentEl) searchCommentEl.addEventListener('input', handleSearch);

if (filterFromEl) {
  filterFromEl.addEventListener('change', function () {
    const fromDate = this.value;
    const toInput = document.getElementById('filter-to');
    if (toInput) {
      toInput.min = fromDate;
      if (toInput.value && toInput.value < fromDate) toInput.value = '';
    }
  });
}

if (filterToEl) {
  filterToEl.addEventListener('change', function () {
    const toDate = this.value;
    const fromInput = document.getElementById('filter-from');
    if (fromInput) {
      fromInput.max = toDate;
      if (fromInput.value && fromInput.value > toDate) fromInput.value = '';
    }
  });
}

if (quickManageToggleBtn) {
  quickManageToggleBtn.addEventListener('click', toggleQuickManagePanel);
}

if (quickTemplateForm) {
  quickTemplateForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    await addQuickTemplate();
  });
}

if (quickTypeEl) {
  quickTypeEl.addEventListener('change', handleQuickTypeChange);
}

if (quickCategoryEl) {
  quickCategoryEl.addEventListener('change', handleQuickCategoryChange);
}

async function loadQuickAddTemplates() {
  try {
    const res = await fetch('/quick-add-templates');
    const templates = await res.json();
    renderQuickAddButtons(templates);
  } catch (error) {
    console.error('Quick add templates error:', error);
  }
}

async function handleQuickTypeChange() {
  const type = quickTypeEl.value;

  quickCategoryEl.innerHTML = '<option value="" disabled selected hidden>Select category</option>';
  quickSubcategoryEl.innerHTML = '<option value="" disabled selected hidden>Select subcategory</option>';
  quickSubcategoryEl.disabled = true;

  if (!type) {
    quickCategoryEl.disabled = true;
    return;
  }

  try {
    const res = await fetch(`/categories?type=${encodeURIComponent(type)}`);
    const categories = await res.json();

    categories.forEach(item => {
      const option = document.createElement('option');
      option.value = item.id;
      option.textContent = item.name;
      quickCategoryEl.appendChild(option);
    });

    quickCategoryEl.disabled = false;
  } catch (error) {
    console.error('Quick add categories error:', error);
  }
}

async function handleQuickCategoryChange() {
  const categoryId = quickCategoryEl.value;

  quickSubcategoryEl.innerHTML = '<option value="" disabled selected hidden>Select subcategory</option>';

  if (!categoryId) {
    quickSubcategoryEl.disabled = true;
    return;
  }

  try {
    const res = await fetch(`/subcategories?category_id=${encodeURIComponent(categoryId)}`);
    const subcategories = await res.json();

    subcategories.forEach(item => {
      const option = document.createElement('option');
      option.value = item.id;
      option.textContent = item.name;
      quickSubcategoryEl.appendChild(option);
    });

    quickSubcategoryEl.disabled = false;
  } catch (error) {
    console.error('Quick add subcategories error:', error);
  }
}

async function loadQuickTemplatesManage() {
  try {
    const res = await fetch('/quick-add-templates/manage');
    const templates = await res.json();
    renderQuickTemplatePreview(templates);
  } catch (error) {
    console.error('Load quick templates manage error:', error);
  }
}

function renderQuickTemplatePreview(templates) {
  const container = document.getElementById('quick-template-preview');
  if (!container) return;

  container.innerHTML = '';

  if (!templates.length) {
    container.innerHTML = '<div class="empty-state quick-add-empty">No quick add buttons yet</div>';
    return;
  }

  templates.forEach(template => {
    const item = document.createElement('div');
    item.className = 'quick-template-chip';

    const amountText =
      template.amount !== null && template.amount !== undefined && template.amount !== ''
        ? ` • $${Number(template.amount).toFixed(2)}`
        : '';

    item.innerHTML = `
      <div class="quick-template-chip-text">
        <strong>${escapeHtml(template.title || '')}</strong>
        <span>${escapeHtml(template.category || '')} / ${escapeHtml(template.subcategory || '')}${amountText}</span>
      </div>
      <button type="button" class="btn btn-icon btn-delete quick-template-delete-btn" title="Delete">🗑</button>
    `;

    const deleteBtn = item.querySelector('.quick-template-delete-btn');
    deleteBtn.addEventListener('click', async () => {
      await deleteQuickTemplate(template.id);
    });

    container.appendChild(item);
  });
}

async function addQuickTemplate() {
  const title = document.getElementById('quick-title').value.trim();
  const type = quickTypeEl.value;
  const categoryId = quickCategoryEl.value;
  const subcategoryId = quickSubcategoryEl.value;
  const amountValue = document.getElementById('quick-amount').value;
  const comment = document.getElementById('quick-comment').value.trim();

  const category = quickCategoryEl.options[quickCategoryEl.selectedIndex]?.text || '';
  const subcategory = quickSubcategoryEl.options[quickSubcategoryEl.selectedIndex]?.text || '';

  if (!title) return showQuickTemplateMessage('Please enter button name', 'error');
  if (!type) return showQuickTemplateMessage('Please select type', 'error');
  if (!categoryId) return showQuickTemplateMessage('Please select category', 'error');
  if (!subcategoryId) return showQuickTemplateMessage('Please select subcategory', 'error');

  try {
    const res = await fetch('/quick-add-templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        type,
        category,
        subcategory,
        subcategory_id: subcategoryId,
        amount: amountValue ? Number(amountValue) : null,
        comment
      })
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || 'Error adding quick add button');
    }

    quickTemplateForm.reset();
    quickCategoryEl.innerHTML = '<option value="" disabled selected hidden>Select category</option>';
    quickSubcategoryEl.innerHTML = '<option value="" disabled selected hidden>Select subcategory</option>';
    quickCategoryEl.disabled = true;
    quickSubcategoryEl.disabled = true;

    showQuickTemplateMessage('Quick add button added', 'success');

    await loadQuickTemplatesManage();
    await loadQuickAddTemplates();
  } catch (error) {
    console.error('Add quick template error:', error);
    showQuickTemplateMessage(error.message || 'Error adding quick add button', 'error');
  }
}

async function deleteQuickTemplate(id) {
  if (!confirm('Delete this quick add button?')) return;

  try {
    const res = await fetch(`/quick-add-templates/${id}`, {
      method: 'DELETE'
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || 'Error deleting quick add button');
    }

    showQuickTemplateMessage('Quick add button deleted', 'success');

    await loadQuickTemplatesManage();
    await loadQuickAddTemplates();
  } catch (error) {
    console.error('Delete quick template error:', error);
    showQuickTemplateMessage(error.message || 'Error deleting quick add button', 'error');
  }
}

function showQuickTemplateMessage(text, type) {
  const el = document.getElementById('quick-template-message');
  if (!el) return;

  el.textContent = text;
  el.className = type === 'success' ? 'success-message' : 'error-message';

  setTimeout(() => {
    if (el.textContent === text) {
      el.textContent = '';
      el.className = '';
    }
  }, 3000);
}

async function toggleQuickManagePanel() {
  if (!quickManagePanel || !quickManageToggleBtn) return;

  const isHidden = quickManagePanel.classList.contains('filters-hidden');

  if (isHidden) {
    quickManagePanel.classList.remove('filters-hidden');
    quickManagePanel.classList.add('filters-visible');
    quickManageToggleBtn.innerText = 'Manage Quick Add Buttons ▲';

    if (!quickManageLoaded) {
      await loadQuickTemplatesManage();
      quickManageLoaded = true;
    }
  } else {
    quickManagePanel.classList.remove('filters-visible');
    quickManagePanel.classList.add('filters-hidden');
    quickManageToggleBtn.innerText = 'Manage Quick Add Buttons ▼';
  }
}

function renderQuickAddButtons(templates) {
  const container = document.getElementById('quick-add-list');
  if (!container) return;
  container.innerHTML = '';
  if (!templates.length) {
    container.innerHTML = '<div class="empty-state quick-add-empty">No quick add buttons yet</div>';
    return;
  }
  templates.forEach(template => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'quick-add-btn';
    btn.textContent = template.title;
    btn.addEventListener('click', async () => { await applyQuickTemplate(template); });
    container.appendChild(btn);
  });
    container.classList.remove('quick-add-loading');
  container.classList.add('quick-add-ready');
}

async function applyQuickTemplate(template) {
  clearFormMessage();
  document.getElementById('date').value = getTodayDate();
  document.getElementById('type').value = template.type;
  document.getElementById('comment').value = template.comment || '';

  await loadCategories(template.type);

  const categorySelect = document.getElementById('category');
  categorySelect.disabled = false;

  const categoryOption = Array.from(categorySelect.options).find(option => option.text === template.category);
  if (!categoryOption) {
    showErrorMessage(`Category "${template.category}" not found`);
    return;
  }

  categorySelect.value = categoryOption.value;
  await loadSubcategories(categoryOption.value);

  const subcategorySelect = document.getElementById('subcategory');
  subcategorySelect.disabled = false;

  const subcategoryOption = Array.from(subcategorySelect.options).find(option => option.text === template.subcategory);
  if (!subcategoryOption) {
    showErrorMessage(`Subcategory "${template.subcategory}" not found`);
    return;
  }

  subcategorySelect.value = subcategoryOption.value;

  if (template.amount !== null && template.amount !== undefined && template.amount !== '') {
    document.getElementById('amount').value = template.amount;
  } else {
    document.getElementById('amount').value = '';
  }

  document.getElementById('amount').focus();
}

async function loadCategories(type = '') {
  try {
    const url = type ? `/categories?type=${encodeURIComponent(type)}` : '/categories';
    const res = await fetch(url);
    const data = await res.json();

    const categorySelect = document.getElementById('category');
    categorySelect.innerHTML = '<option value="" disabled hidden selected>Select category</option>';

    data.forEach(item => {
      const option = document.createElement('option');
      option.value = item.id;
      option.textContent = item.name;
      categorySelect.appendChild(option);
    });
  } catch (error) {
    console.error('Categories error:', error);
  }
}

async function loadSubcategories(categoryId, selectedId = '') {
  try {
    const subcategorySelect = document.getElementById('subcategory');
    if (!categoryId) {
      subcategorySelect.innerHTML = '<option value="" disabled hidden selected>Select subcategory</option>';
      return;
    }
    const res = await fetch(`/subcategories?category_id=${encodeURIComponent(categoryId)}`);
    const data = await res.json();

    subcategorySelect.innerHTML = '<option value="" disabled hidden selected>Select subcategory</option>';
    data.forEach(item => {
      const option = document.createElement('option');
      option.value = item.id;
      option.textContent = item.name;
      if (String(item.id) === String(selectedId)) option.selected = true;
      subcategorySelect.appendChild(option);
    });
  } catch (error) {
    console.error('Subcategories error:', error);
  }
}

async function handleCategoryChange() {
  const categoryId = document.getElementById('category').value;
  await loadSubcategories(categoryId);
  document.getElementById('subcategory').disabled = false;
}

async function findCategoryIdByName(name, type) {
  if (!name) return '';
  try {
    const res = await fetch(`/categories?type=${encodeURIComponent(type)}`);
    const data = await res.json();
    const match = data.find(item => item.name === name);
    return match ? match.id : '';
  } catch (error) {
    console.error('Find category error:', error);
    return '';
  }
}

async function findSubcategoryIdByName(categoryId, name) {
  if (!categoryId || !name) return '';
  try {
    const res = await fetch(`/subcategories?category_id=${encodeURIComponent(categoryId)}`);
    const data = await res.json();
    const match = data.find(item => item.name === name);
    return match ? match.id : '';
  } catch (error) {
    console.error('Find subcategory error:', error);
    return '';
  }
}

async function loadFilterCategories(type = '') {
  try {
    const categorySelect = document.getElementById('filter-category');
    if (!type) {
      categorySelect.innerHTML = '<option value="">All categories</option>';
      categorySelect.disabled = true;
      return;
    }
    const res = await fetch(`/categories?type=${encodeURIComponent(type)}`);
    const data = await res.json();

    categorySelect.innerHTML = '<option value="">All categories</option>';
    data.forEach(item => {
      const option = document.createElement('option');
      option.value = item.id;
      option.textContent = item.name;
      categorySelect.appendChild(option);
    });
    categorySelect.disabled = false;
  } catch (error) {
    console.error('Filter categories error:', error);
  }
}

async function loadFilterSubcategories(categoryId = '') {
  try {
    const subcategorySelect = document.getElementById('filter-subcategory');
    if (!categoryId) {
      subcategorySelect.innerHTML = '<option value="">All subcategories</option>';
      subcategorySelect.disabled = true;
      return;
    }
    const res = await fetch(`/subcategories?category_id=${encodeURIComponent(categoryId)}`);
    const data = await res.json();

    subcategorySelect.innerHTML = '<option value="">All subcategories</option>';
    data.forEach(item => {
      const option = document.createElement('option');
      option.value = item.name;
      option.textContent = item.name;
      subcategorySelect.appendChild(option);
    });
    subcategorySelect.disabled = false;
  } catch (error) {
    console.error('Filter subcategories error:', error);
  }
}

async function handleFilterTypeChange() {
  const type = document.getElementById('filter-type').value;
  await loadFilterCategories(type);
  document.getElementById('filter-subcategory').innerHTML = '<option value="">All subcategories</option>';
  document.getElementById('filter-subcategory').disabled = true;
}

async function handleFilterCategoryChange() {
  const categoryId = document.getElementById('filter-category').value;
  await loadFilterSubcategories(categoryId);
}

async function loadTransactions() {
  try {
    const query = getFiltersQuery();
    const search = document.getElementById('search-comment').value;
    const params = new URLSearchParams(query);
    if (search) params.append('comment', search);
    params.append('page', currentPage);
    params.append('limit', limit);

    const finalQuery = params.toString();
    const res = await fetch(finalQuery ? `/transactions?${finalQuery}` : '/transactions');
    const result = await res.json();
    const items = result.items || [];
    totalItems = Number(result.total || 0);
    hasNextPage = Boolean(result.hasNextPage);
    totalPages = Math.max(1, Math.ceil(totalItems / limit));

    if (!items.length && totalItems > 0 && currentPage > 1) {
      currentPage--;
      await loadTransactions();
      return;
    }

    const tbody = document.getElementById('transactions-body');
    tbody.innerHTML = '';

    if (!items.length) {
  tbody.innerHTML = `
    <tr>
      <td colspan="8" class="empty-table-cell">No transactions found</td>
    </tr>
  `;
  hasNextPage = false;
  totalPages = 1;
  updatePageInfo(totalItems);
  return;
}

    items.forEach((item, index) => {
      const tr = document.createElement('tr');
      const typeClass = item.type === 'income' ? 'income' : 'expense';
      const rowNumber = (currentPage - 1) * limit + index + 1;

      tr.innerHTML = `
        <td>${rowNumber}</td>
        <td>${formatDate(item.date)}</td>
        <td>${escapeHtml(item.category || '')}</td>
        <td>${escapeHtml(item.subcategory || '')}</td>
        <td class="${typeClass}">${item.type}</td>
        <td class="${typeClass}">${Number(item.amount).toFixed(2)}</td>
        <td>${escapeHtml(item.comment || '')}</td>
        <td class="actions-cell">
          <button type="button" class="btn btn-small btn-edit">Edit</button>
          <button type="button" class="btn btn-small btn-delete">Delete</button>
        </td>
      `;

      tbody.appendChild(tr);
      const editBtn = tr.querySelector('.btn-edit');
      const deleteBtn = tr.querySelector('.btn-delete');

      editBtn.addEventListener('click', () => {
        startEdit({
          id: item.id,
          date: item.date,
          category: item.category || '',
          subcategory: item.subcategory || '',
          amount: item.amount,
          type: item.type,
          comment: item.comment || ''
        });
      });

      deleteBtn.addEventListener('click', () => deleteTransaction(item.id));
    });

    updatePageInfo(totalItems);
  } catch (error) {
    console.error('Transactions error:', error);
  }
}

function updatePaginationButtons() {
  document.getElementById('prev-btn').disabled = currentPage <= 1;
 document.getElementById('next-btn').disabled = currentPage >= totalPages;
}

let searchTimeout = null;

function handleSearch() {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    currentPage = 1;
    loadTransactions();
  }, 300);
}

function getFiltersQuery() {
  const fromInput = document.getElementById('filter-from');
  const toInput = document.getElementById('filter-to');
  const typeInput = document.getElementById('filter-type');
  const categorySelect = document.getElementById('filter-category');
  const subcategorySelect = document.getElementById('filter-subcategory');

  const from = fromInput ? fromInput.value : '';
  const to = toInput ? toInput.value : '';
  const type = typeInput ? typeInput.value : '';

  const category = categorySelect && categorySelect.value
    ? categorySelect.options[categorySelect.selectedIndex]?.text || ''
    : '';

  const subcategory = subcategorySelect && subcategorySelect.value
    ? subcategorySelect.options[subcategorySelect.selectedIndex]?.text || ''
    : '';

  const params = new URLSearchParams();
  if (from) params.append('from', from);
  if (to) params.append('to', to);
  if (type) params.append('type', type);
  if (category) params.append('category', category);
  if (subcategory) params.append('subcategory', subcategory);
  return params.toString();
}

async function applyFilters() {
  currentPage = 1;
  updatePageInfo();
  await loadTransactions();
}

async function clearFilters() {
  document.getElementById('filter-from').value = '';
  document.getElementById('filter-to').value = '';
  document.getElementById('filter-to').min = '';
  document.getElementById('filter-from').max = '';
  document.getElementById('filter-type').value = '';
  document.getElementById('search-comment').value = '';
  document.getElementById('filter-category').innerHTML = '<option value="">All categories</option>';
  document.getElementById('filter-category').disabled = true;
  document.getElementById('filter-subcategory').innerHTML = '<option value="">All subcategories</option>';
  document.getElementById('filter-subcategory').disabled = true;

  currentPage = 1;
  updatePageInfo();
  await loadTransactions();
}

function formatDate(dateString) {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString();
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

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

async function handleTypeChange() {
  const type = document.getElementById('type').value;
  const categorySelect = document.getElementById('category');
  const subcategorySelect = document.getElementById('subcategory');

  if (!type) {
    categorySelect.innerHTML = '<option value="" disabled hidden selected>Select category</option>';
    subcategorySelect.innerHTML = '<option value="" disabled hidden selected>Select subcategory</option>';
    categorySelect.disabled = true;
    subcategorySelect.disabled = true;
    return;
  }

  await loadCategories(type);
  categorySelect.disabled = false;
  subcategorySelect.innerHTML = '<option value="" disabled hidden selected>Select subcategory</option>';
  subcategorySelect.disabled = true;
}

async function startEdit(item) {
  editingId = item.id;

  document.getElementById('date').value = toInputDate(item.date);
  document.getElementById('amount').value = item.amount;
  document.getElementById('type').value = item.type;
  document.getElementById('comment').value = item.comment;

  const categoryId = await findCategoryIdByName(item.category, item.type);
  await loadCategories(item.type);

  document.getElementById('category').disabled = false;
  document.getElementById('category').value = categoryId || '';

  const subcategoryId = await findSubcategoryIdByName(categoryId, item.subcategory);
  await loadSubcategories(categoryId, subcategoryId);

  document.getElementById('subcategory').disabled = false;
  selectedSubcategoryId = subcategoryId || null;

  document.getElementById('submit-btn').innerText = 'Update';
  document.getElementById('cancel-btn').style.display = 'inline-flex';
}

async function cancelEdit() {
  editingId = null;
  await resetForm();
}

async function resetForm() {
  document.getElementById('date').value = getTodayDate();
  document.getElementById('amount').value = '';
  document.getElementById('type').value = '';
  document.getElementById('comment').value = '';
  document.getElementById('category').innerHTML = '<option value="" disabled hidden selected>Select category</option>';
  document.getElementById('subcategory').innerHTML = '<option value="" disabled hidden selected>Select subcategory</option>';
  document.getElementById('category').disabled = true;
  document.getElementById('subcategory').disabled = true;
  selectedSubcategoryId = null;
  document.getElementById('submit-btn').innerText = 'Add Transaction';
  document.getElementById('cancel-btn').style.display = 'none';
}

function validateTransactionForm() {
  const amount = document.getElementById('amount').value;
  const type = document.getElementById('type').value;
  const category = document.getElementById('category').value;
  const subcategory = document.getElementById('subcategory').value;

  if (!amount) {
    showErrorMessage('Please enter amount');
    document.getElementById('amount').focus();
    return false;
  }
  if (Number(amount) <= 0) {
    showErrorMessage('Amount must be greater than 0');
    document.getElementById('amount').focus();
    return false;
  }
  if (!type) {
    showErrorMessage('Please select type');
    document.getElementById('type').focus();
    return false;
  }
  if (!category) {
    showErrorMessage('Please select category');
    document.getElementById('category').focus();
    return false;
  }
  if (!subcategory) {
    showErrorMessage('Please select subcategory');
    document.getElementById('subcategory').focus();
    return false;
  }

  clearFormMessage();
  return true;
}

async function addTransaction() {
  const submitBtn = document.getElementById('submit-btn');

  try {
    if (!validateTransactionForm()) return;

    submitBtn.disabled = true;
    submitBtn.textContent = editingId ? 'Updating...' : 'Adding...';

    const date = document.getElementById('date').value || new Date().toISOString().slice(0, 10);
    const amount = document.getElementById('amount').value;
    const categorySelect = document.getElementById('category');
    const subcategorySelect = document.getElementById('subcategory');
    const type = document.getElementById('type').value;
    const comment = document.getElementById('comment').value.trim();

    const subcategory_id = subcategorySelect.value;
    const category = categorySelect.options[categorySelect.selectedIndex]?.text || '';
    const subcategory = subcategorySelect.options[subcategorySelect.selectedIndex]?.text || '';

    const url = editingId ? `/transactions/${editingId}` : '/transactions';
    const method = editingId ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date,
        section: 'budget',
        category,
        subcategory,
        subcategory_id,
        type,
        amount,
        comment
      })
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || 'Request failed');
    }

    const successMessage = editingId ? 'Transaction updated' : 'Transaction added';
    editingId = null;
    await resetForm();
    showSuccessMessage(successMessage);

    await loadTransactions();

  } catch (error) {
    console.error('Add/update error:', error);
    showErrorMessage('Error saving transaction');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Add Transaction';
  }
}

async function deleteTransaction(id) {
  try {
    if (!confirm('Are you sure you want to delete this transaction?')) return;
    const res = await fetch(`/transactions/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || 'Delete failed');
    }

    if (editingId === id) {
      editingId = null;
      await resetForm();
    }

    await loadTransactions();
    showSuccessMessage('Transaction deleted');
  } catch (error) {
    console.error('Delete error:', error);
    showErrorMessage('Error deleting transaction');
  }
}

function updatePageInfo(totalItems = 0) {
  const pageInfo = document.getElementById('page-info');
  const paginationBar = document.getElementById('transactions-pagination-bar');
  const totalCount = document.getElementById('transactions-total-count');

  if (pageInfo) {
    pageInfo.innerText = `Page ${currentPage} of ${totalPages}`;
  }

  if (paginationBar) {
    const shouldShowPagination = totalItems > limit;
    paginationBar.style.display = shouldShowPagination ? 'flex' : 'none';
  }

  if (totalCount) {
    totalCount.innerText = totalItems;
  }

  updatePaginationButtons();
}

function nextPage() {
  if (currentPage >= totalPages) return;
  currentPage++;
  loadTransactions();
}

function prevPage() {
  if (currentPage > 1) {
    currentPage--;
    loadTransactions();
  }
}

function showErrorMessage(message) {
  const messageEl = document.getElementById('form-message');
  messageEl.innerText = message;
  messageEl.classList.remove('success-message');
  messageEl.classList.add('error-message');
}

function showSuccessMessage(message) {
  const messageEl = document.getElementById('form-message');
  messageEl.innerText = message;
  messageEl.classList.remove('error-message');
  messageEl.classList.add('success-message');
  setTimeout(() => {
    if (messageEl.innerText === message) clearFormMessage();
  }, 2500);
}

function clearFormMessage() {
  const messageEl = document.getElementById('form-message');
  messageEl.innerText = '';
  messageEl.classList.remove('error-message', 'success-message');
}

function toggleFilters() {
  const panel = document.getElementById('filters-panel');
  const button = document.getElementById('filters-toggle-btn');
  if (panel.classList.contains('filters-hidden')) {
    panel.classList.remove('filters-hidden');
    panel.classList.add('filters-visible');
    button.innerText = 'Hide Filters';
  } else {
    panel.classList.remove('filters-visible');
    panel.classList.add('filters-hidden');
    button.innerText = 'Filters';
  }
}

function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

async function exportTransactions() {
  try {
    const query = getFiltersQuery();
    const search = document.getElementById('search-comment').value;

    const params = new URLSearchParams(query);

    if (search) {
      params.append('comment', search);
    }

    const exportUrl = `/transactions/export?${params.toString()}`;

    const res = await fetch(exportUrl);

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || 'Export failed');
    }

const blob = await res.blob();
const url = window.URL.createObjectURL(blob);

const contentDisposition = res.headers.get('Content-Disposition') || '';
let fileName = 'transactions_export.xlsx';

const match = contentDisposition.match(/filename="([^"]+)"/);
if (match && match[1]) {
  fileName = match[1];
}

const a = document.createElement('a');
a.href = url;
a.download = fileName;

document.body.appendChild(a);
a.click();
a.remove();

window.URL.revokeObjectURL(url);

  } catch (error) {
    console.error('Export transactions error:', error);
    showErrorMessage('Error exporting transactions');
  }
}

window.addEventListener('DOMContentLoaded', async () => {
  try {
    await resetForm();
    clearFormMessage();
    updatePageInfo();
    await loadTransactions();
    await loadQuickAddTemplates();
  } catch (error) {
    console.error('Init error:', error);
  }
});
