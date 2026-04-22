const overdueBadgeBtn = document.getElementById('overdue-badge-btn');
const overdueBadgeCountEl = document.getElementById('overdue-badge-count');
const dueSoonBadgeBtn = document.getElementById('due-soon-badge-btn');
const dueSoonBadgeCountEl = document.getElementById('due-soon-badge-count');

if (overdueBadgeBtn) {
  overdueBadgeBtn.addEventListener('click', () => {
    const overdueSection = document.querySelector('.overdue-card');
    if (overdueSection) {
      overdueSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
}

if (dueSoonBadgeBtn) {
  dueSoonBadgeBtn.addEventListener('click', () => {
    const dueSoonSection = document.querySelector('.due-soon-card');
    if (dueSoonSection) {
      dueSoonSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
}

async function loadSummary() {
  try {
    const res = await fetch('/summary');
    const data = await res.json();

    document.getElementById('total-income').innerText = `$${Number(data.total_income || 0).toFixed(2)}`;
    document.getElementById('total-expense').innerText = `$${Number(data.total_expense || 0).toFixed(2)}`;
    document.getElementById('balance').innerText = `$${Number(data.balance || 0).toFixed(2)}`;
  } catch (error) {
    console.error('Summary error:', error);
  }
}

async function loadOverduePayments() {
  try {
    const res = await fetch('/recurring-transactions/overdue');
    const data = await res.json();

    const tbody = document.getElementById('overdue-list');
    const countEl = document.getElementById('overdue-count');

    if (!tbody || !countEl) return;

    countEl.innerText = data.length;

    if (overdueBadgeCountEl) {
      overdueBadgeCountEl.innerText = data.length;
    }

    if (overdueBadgeBtn) {
      overdueBadgeBtn.classList.toggle('zero', data.length === 0);
      overdueBadgeBtn.style.opacity = data.length > 0 ? '1' : '0.55';
    }

    tbody.innerHTML = '';

    if (!data.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="empty-table-cell">No overdue payments</td>
        </tr>
      `;
      return;
    }

    data.forEach(item => {
      const tr = document.createElement('tr');
      const daysOverdue = getDaysOverdue(item.next_due_date);

      tr.innerHTML = `
        <td>${escapeHtml(item.title || '')}</td>
        <td class="${item.type === 'income' ? 'income' : 'expense'}">${escapeHtml(item.type || '')}</td>
        <td>${escapeHtml(item.category || '')}</td>
        <td>${escapeHtml(item.subcategory || '')}</td>
        <td>${Number(item.amount).toFixed(2)}</td>
        <td>${formatDate(item.next_due_date)}</td>
        <td>${daysOverdue}</td>
        <td class="actions-cell">
          <button type="button" class="btn btn-small btn-edit overdue-pay-btn">Record Payment</button>
        </td>
      `;

      tbody.appendChild(tr);

      const payBtn = tr.querySelector('.overdue-pay-btn');
      payBtn.addEventListener('click', async () => {
        await recordRecurringPayment(item.id);
      });
    });
  } catch (error) {
    console.error('Overdue payments error:', error);
  }
}

async function loadDueSoonPayments() {
  try {
    const res = await fetch('/recurring-transactions/due-soon');
    const data = await res.json();

    const tbody = document.getElementById('due-soon-list');
    const countEl = document.getElementById('due-soon-count');

    if (!tbody || !countEl) return;

    countEl.innerText = data.length;

    if (dueSoonBadgeCountEl) {
      dueSoonBadgeCountEl.innerText = data.length;
    }

    if (dueSoonBadgeBtn) {
      dueSoonBadgeBtn.classList.toggle('zero', data.length === 0);
      dueSoonBadgeBtn.style.opacity = data.length > 0 ? '1' : '0.55';
    }

    tbody.innerHTML = '';

    if (!data.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="empty-table-cell">No upcoming payments</td>
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
        <td>${formatDate(item.next_due_date)}</td>
        <td>${Number(item.days_until_due)}</td>
        <td class="actions-cell">
          <button type="button" class="btn btn-small btn-edit due-soon-pay-btn">Record Payment</button>
        </td>
      `;

      tbody.appendChild(tr);

      const payBtn = tr.querySelector('.due-soon-pay-btn');
      payBtn.addEventListener('click', async () => {
        await recordRecurringPayment(item.id);
      });
    });
  } catch (error) {
    console.error('Due soon payments error:', error);
  }
}

async function recordRecurringPayment(id) {
  try {
    const res = await fetch(`/recurring-transactions/${id}/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || 'Error recording payment');
    }

    await loadSummary();
    await loadOverduePayments();
    await loadDueSoonPayments();
  } catch (error) {
    console.error('Record recurring payment error:', error);
  }
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

function getDaysOverdue(dateString) {
  if (!dateString) return '';

  const dueDate = new Date(dateString);
  const today = new Date();

  dueDate.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  const diffMs = today - dueDate;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  return diffDays > 0 ? diffDays : 0;
}

window.addEventListener('DOMContentLoaded', async () => {
  await loadSummary();
  await loadOverduePayments();
  await loadDueSoonPayments();
});
