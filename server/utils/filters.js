function buildFilters(query, options = {}) {
  const { allowCategory = false } = options;
  const { type, category, subcategory, comment, from, to } = query;
  const conditions = [];
  const values = [];

  if (type) {
    conditions.push('type = ?');
    values.push(type);
  }

  if (allowCategory && category) {
    conditions.push('category = ?');
    values.push(category);
  }

  if (subcategory) {
    conditions.push('subcategory = ?');
    values.push(subcategory);
  }

  if (comment) {
    conditions.push('comment LIKE ?');
    values.push(`%${comment}%`);
  }

  if (from) {
    conditions.push('date >= ?');
    values.push(from);
  }

  if (to) {
    conditions.push('date <= ?');
    values.push(to);
  }

  return {
    whereClause: conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '',
    values
  };
}

module.exports = {
  buildFilters
};
