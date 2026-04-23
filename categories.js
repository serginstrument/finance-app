let selectedCategoryId = null;
let selectedCategoryName = '';

const addCategoryBtn = document.getElementById('add-category-btn');
const addSubcategoryBtn = document.getElementById('add-subcategory-btn');

if (addCategoryBtn) {
  addCategoryBtn.addEventListener('click', addCategory);
}

if (addSubcategoryBtn) {
  addSubcategoryBtn.addEventListener('click', addSubcategory);
}

window.addEventListener('DOMContentLoaded', async () => {
  updateSubcategoriesHeading();
  await loadCategoriesForPage();
});

async function loadCategoriesForPage() {
  try {
    const res = await fetch('/categories');
    const categories = await res.json();

    renderCategories(categories);
    fillParentCategorySelect(categories);
  } catch (error) {
    console.error('Load categories page error:', error);
  }
}

function fillParentCategorySelect(categories) {
  const select = document.getElementById('parent-category');
  select.innerHTML = '<option value="" disabled selected hidden>Select category</option>';

  categories.forEach(category => {
    const option = document.createElement('option');
    option.value = category.id;
    option.textContent = `${category.name} (${category.type})`;
    select.appendChild(option);
  });
}

function renderCategories(categories) {
  const container = document.getElementById('categories-list');
  container.innerHTML = '';

  if (!categories.length) {
    container.innerHTML = '<div class="empty-state">No categories yet</div>';
    return;
  }

  categories.forEach(category => {
    const item = document.createElement('div');
    item.className = 'list-item';
    if (String(selectedCategoryId) === String(category.id)) {
      item.classList.add('list-item-selected');
    }

    item.innerHTML = `
      <div class="list-item-main">
        <div class="list-item-title">${escapeHtml(category.name)}</div>
        <div class="list-item-meta">${escapeHtml(category.type)}</div>
      </div>
      <button type="button" class="btn btn-small btn-delete">Delete</button>
    `;

    const main = item.querySelector('.list-item-main');
    const deleteBtn = item.querySelector('.btn-delete');

    main.addEventListener('click', () => {
      selectCategory(category.id, category.name);
    });

    deleteBtn.addEventListener('click', () => {
      deleteCategory(category.id);
    });

    container.appendChild(item);
  });
}

async function selectCategory(categoryId, categoryName) {
  selectedCategoryId = categoryId;
  selectedCategoryName = categoryName;
  updateSubcategoriesHeading(categoryName);
  await loadCategoriesForPage();

  try {
    const res = await fetch(`/subcategories?category_id=${categoryId}`);
    const subcategories = await res.json();

    renderSubcategories(subcategories, categoryName);
  } catch (error) {
    console.error('Load subcategories error:', error);
  }
}

function renderSubcategories(subcategories, categoryName) {
  const container = document.getElementById('subcategories-list');
  container.innerHTML = '';
  updateSubcategoriesHeading(categoryName);

  if (!subcategories.length) {
    container.innerHTML = `<div class="empty-state">No subcategories in ${escapeHtml(categoryName)}</div>`;
    return;
  }

  subcategories.forEach(subcategory => {
    const item = document.createElement('div');
    item.className = 'list-item';

    item.innerHTML = `
      <div class="list-item-main">
        <div class="list-item-title">${escapeHtml(subcategory.name)}</div>
      </div>
      <button type="button" class="btn btn-small btn-delete">Delete</button>
    `;

    const deleteBtn = item.querySelector('.btn-delete');

    deleteBtn.addEventListener('click', () => {
      deleteSubcategory(subcategory.id);
    });

    container.appendChild(item);
  });
}

async function addCategory() {
  const type = document.getElementById('new-category-type').value;
  const name = document.getElementById('new-category-name').value.trim();

  if (!type) {
    showMessage('category-message', 'Please select type', 'error');
    return;
  }

  if (!name) {
    showMessage('category-message', 'Please enter category name', 'error');
    return;
  }

  try {
    const res = await fetch('/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, type })
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || 'Error adding category');
    }

    document.getElementById('new-category-type').value = '';
    document.getElementById('new-category-name').value = '';

    showMessage('category-message', 'Category added', 'success');
    await loadCategoriesForPage();
  } catch (error) {
    console.error('Add category error:', error);
    showMessage('category-message', error.message || 'Error adding category', 'error');
  }
}

async function addSubcategory() {
  const categoryId = document.getElementById('parent-category').value;
  const name = document.getElementById('new-subcategory-name').value.trim();

  if (!categoryId) {
    showMessage('subcategory-message', 'Please select category', 'error');
    return;
  }

  if (!name) {
    showMessage('subcategory-message', 'Please enter subcategory name', 'error');
    return;
  }

  try {
    const res = await fetch('/subcategories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category_id: categoryId, name })
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || 'Error adding subcategory');
    }

    document.getElementById('new-subcategory-name').value = '';

    showMessage('subcategory-message', 'Subcategory added', 'success');
    await loadCategoriesForPage();

    if (selectedCategoryId && String(selectedCategoryId) === String(categoryId)) {
      await selectCategory(categoryId, selectedCategoryName);
    }
  } catch (error) {
    console.error('Add subcategory error:', error);
    showMessage('subcategory-message', error.message || 'Error adding subcategory', 'error');
  }
}

async function deleteCategory(id) {
  if (!confirm('Delete this category?')) return;

  try {
    const res = await fetch(`/categories/${id}`, { method: 'DELETE' });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || 'Error deleting category');
    }

    if (selectedCategoryId === id) {
      selectedCategoryId = null;
      selectedCategoryName = '';
      updateSubcategoriesHeading();
      document.getElementById('subcategories-list').innerHTML =
        '<div class="empty-state">Select a category to view subcategories</div>';
    }

    await loadCategoriesForPage();
    showDeleteMessage('Category deleted', 'success');
  } catch (error) {
    console.error('Delete category error:', error);
    showDeleteMessage(getDeleteErrorMessage(error, 'category'), 'error');
  }
}

async function deleteSubcategory(id) {
  if (!confirm('Delete this subcategory?')) return;

  try {
    const res = await fetch(`/subcategories/${id}`, { method: 'DELETE' });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || 'Error deleting subcategory');
    }

    if (selectedCategoryId) {
      await selectCategory(selectedCategoryId, selectedCategoryName);
    }

    showDeleteMessage('Subcategory deleted', 'success');
  } catch (error) {
    console.error('Delete subcategory error:', error);
    showDeleteMessage(getDeleteErrorMessage(error, 'subcategory'), 'error');
  }
}

function getDeleteErrorMessage(error, entity) {
  const msg = String(error.message || '').toLowerCase();

  if (msg.includes('foreign key') || msg.includes('constraint')) {
    if (entity === 'category') {
      return 'Cannot delete category because one of its subcategories is used in transactions.';
    }

    if (entity === 'subcategory') {
      return 'Cannot delete subcategory because it is used in transactions.';
    }
  }

  return error.message || `Error deleting ${entity}`;
}

function showDeleteMessage(text, type) {
  const el = document.getElementById('delete-message');
  el.textContent = text;
  el.className = type === 'success' ? 'success-message' : 'error-message';

  setTimeout(() => {
    if (el.textContent === text) {
      el.textContent = '';
      el.className = '';
    }
  }, 3000);
}

function showMessage(id, text, type) {
  const el = document.getElementById(id);
  el.textContent = text;
  el.className = type === 'success' ? 'success-message' : 'error-message';

  setTimeout(() => {
    if (el.textContent === text) {
      el.textContent = '';
      el.className = '';
    }
  }, 2500);
}

function updateSubcategoriesHeading(categoryName = '') {
  const heading = document.getElementById('subcategories-heading');
  if (!heading) return;

  heading.textContent = categoryName
    ? `Subcategories for: ${categoryName}`
    : 'Subcategories';
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
