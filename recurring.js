let editingRecurringId = null;

const recurringForm = document.getElementById('recurring-form');
const recurringTypeEl = document.getElementById('recurring-type');
const recurringCategoryEl = document.getElementById('recurring-category');
const recurringSubcategoryEl = document.getElementById('recurring-subcategory');
const recurringSubmitBtn = document.getElementById('recurring-submit-btn');
const recurringCancelBtn = document.getElementById('recurring-cancel-btn');


if (recurringCancelBtn) {
  recurringCancelBtn.addEventListener('click', cancelRecurringEdit);
}

if (recurringForm) {
  recurringForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    await addRecurringTransaction();
  });
}

if (recurringTypeEl) {
  recurringTypeEl.addEventListener('change', handleRecurringTypeChange);
}

if (recurringCategoryEl) {
  recurringCategoryEl.addEventListener('change', handleRecurringCategoryChange);
}

window.addEventListener('DOMContentLoaded', async () => {
  setTodayDates();
  await loadRecurringTransactions();
});

function setTodayDates() {
  const today = new Date().toISOString().slice(0, 10);
  document.getElementById('recurring-start-date').value = today;
  document.getElementById('recurring-next-date').value = today;
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
  const comment = document.getElementById('recurring-comment').value.trim();

  const category =
    recurringCategoryEl.options[recurringCategoryEl.selectedIndex]?.text || '';

  const subcategory =
    recurringSubcategoryEl.options[recurringSubcategoryEl.selectedIndex]?.text || '';

  if (!title) return showRecurringMessage('Please enter title', 'error');
  if (!type) return showRecurringMessage('Please select type', 'error');
  if (!categoryId) return showRecurringMessage('Please select category', 'error');
  if (!subcategoryId) return showRecurringMessage('Please select subcategory', 'error');
  if (!amount || Number(amount) <= 0) return showRecurringMessage('Amount must be greater than 0', 'error');
  if (!frequency) return showRecurringMessage('Please select frequency', 'error');
  if (!startDate) return showRecurringMessage('Please select start date', 'error');
  if (!nextDueDate) return showRecurringMessage('Please select next due date', 'error');

  try {
const url = editingRecurringId
  ? `/recurring-transactions/${editingRecurringId}`
  : '/recurring-transactions';

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
        comment
      })
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || 'Error adding recurring transaction');
    }

const successMessage = editingRecurringId
  ? 'Recurring transaction updated'
  : 'Recurring transaction added';

editingRecurringId = null;
recurringForm.reset();
recurringCategoryEl.innerHTML = '<option value="" disabled selected hidden>Select category</option>';
recurringSubcategoryEl.innerHTML = '<option value="" disabled selected hidden>Select subcategory</option>';
recurringCategoryEl.disabled = true;
recurringSubcategoryEl.disabled = true;
recurringSubmitBtn.innerText = 'Add Recurring';
recurringCancelBtn.style.display = 'none';
setTodayDates();

showRecurringMessage(successMessage, 'success');
await loadRecurringTransactions();
  } catch (error) {
    console.error('Add recurring error:', error);
    showRecurringMessage(error.message || 'Error adding recurring transaction', 'error');
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
  document.getElementById('recurring-comment').value = item.comment || '';

  await handleRecurringTypeChange();

  const categoryOptions = Array.from(recurringCategoryEl.options);
  const categoryMatch = categoryOptions.find(opt => opt.text === item.category);

  if (categoryMatch) {
    recurringCategoryEl.value = categoryMatch.value;
    await handleRecurringCategoryChange();
  }

  const subcategoryOptions = Array.from(recurringSubcategoryEl.options);
  const subcategoryMatch = subcategoryOptions.find(opt => opt.text === item.subcategory);

  if (subcategoryMatch) {
    recurringSubcategoryEl.value = subcategoryMatch.value;
  }

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

async function loadRecurringTransactions() {
  try {
    const res = await fetch('/recurring-transactions');
    const data = await res.json();

    const tbody = document.getElementById('recurring-list');
    tbody.innerHTML = '';

    if (!data.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="10" class="empty-table-cell">No recurring transactions yet</td>
        </tr>
      `;
      return;
    }

    data.forEach(item => {
      const tr = document.createElement('tr');

      tr.innerHTML = `
        <td>${escapeHtml(item.title || '')}</td>
        <td class="${item.type === 'income' ? 'income' : 'expense'}">${escapeHtml(item.type || '')}</td>
        <td>${escapeHtml(item.category || '')}</td>
        <td>${escapeHtml(item.subcategory || '')}</td>
        <td>${Number(item.amount).toFixed(2)}</td>
        <td>${escapeHtml(item.frequency || '')}</td>
        <td>${formatDate(item.start_date)}</td>
        <td>${formatDate(item.next_due_date)}</td>
        <td>${item.active ? 'Active' : 'Inactive'}</td>
<td class="actions-cell">
  <button type="button" class="btn btn-small btn-edit recurring-edit-btn">
    Edit
  </button>
  <button type="button" class="btn btn-small btn-primary recurring-pay-btn">
    Pay Now
  </button>
  <button type="button" class="btn btn-small btn-edit recurring-toggle-btn">
    ${item.active ? 'Disable' : 'Enable'}
  </button>
  <button type="button" class="btn btn-small btn-delete recurring-delete-btn">
    Delete
  </button>
</td>
      `;

const editBtn = tr.querySelector('.recurring-edit-btn');
const payBtn = tr.querySelector('.recurring-pay-btn');
const toggleBtn = tr.querySelector('.recurring-toggle-btn');
const deleteBtn = tr.querySelector('.recurring-delete-btn');

payBtn.addEventListener('click', async () => {
  await payRecurringNow(item.id);
});

editBtn.addEventListener('click', async () => {
  await startRecurringEdit(item);
});

      toggleBtn.addEventListener('click', async () => {
        await toggleRecurring(item.id);
      });

      deleteBtn.addEventListener('click', async () => {
        await deleteRecurring(item.id);
      });

      tbody.appendChild(tr);
    });
  } catch (error) {
    console.error('Load recurring transactions error:', error);
  }
}

async function toggleRecurring(id) {
  try {
    const res = await fetch(`/recurring-transactions/${id}/toggle`, {
      method: 'PUT'
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || 'Error updating recurring transaction');
    }

    await loadRecurringTransactions();
  } catch (error) {
    console.error('Toggle recurring error:', error);
    showRecurringMessage(error.message || 'Error updating recurring transaction', 'error');
  }
}

async function deleteRecurring(id) {
  if (!confirm('Delete this recurring transaction?')) return;

  try {
    const res = await fetch(`/recurring-transactions/${id}`, {
      method: 'DELETE'
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || 'Error deleting recurring transaction');
    }

    showRecurringMessage('Recurring transaction deleted', 'success');
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