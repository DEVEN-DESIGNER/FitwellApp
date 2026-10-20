
import { useCallback, useEffect, useState } from "react";
import "./Categories.css";
import Pagination from "./Pagination";

const API = "http://localhost:5000/api/categories";

export default function Categories() {
  const [categories, setCategories] = useState([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const loadCategories = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(API);
      if (!response.ok) throw new Error("Could not load categories.");

      setCategories(await response.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [setCategories, setError, setLoading]);

  useEffect(() => {
    const timer = window.setTimeout(loadCategories, 0);
    return () => window.clearTimeout(timer);
  }, [loadCategories]);

  function resetForm() {
    setName("");
    setDescription("");
    setEditingId(null);
    setError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!name.trim()) {
      setError("Category name is required.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const response = await fetch(
        editingId ? `${API}/${editingId}` : API,
        {
          method: editingId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            description: description.trim(),
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Unable to save category.");
      }

      resetForm();
      await loadCategories();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function startEdit(category) {
    setEditingId(category._id);
    setName(category.name);
    setDescription(category.description || "");
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function deactivateCategory(id) {
    if (!window.confirm("Deactivate this category?")) return;

    try {
      const response = await fetch(`${API}/${id}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Unable to deactivate category.");
      }

      await loadCategories();
    } catch (err) {
      setError(err.message);
    }
  }

  const activeCategories = categories.filter((category) => category.isActive);
  const paginatedCategories = categories.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="category-page">
      <div className="category-heading">
        <div>
          <span className="category-eyebrow">PRODUCT MANAGEMENT</span>
          <h2>Categories</h2>
          <p>Create and manage your sanitary fittings categories.</p>
        </div>
        <div className="category-count">
          {activeCategories.length} Active
        </div>
      </div>

      <form className="category-form" onSubmit={handleSubmit}>
        <h3>{editingId ? "Edit Category" : "Add New Category"}</h3>

        <label htmlFor="category-name">Category Name *</label>
        <input
          id="category-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="e.g. Connection Pipe"
          maxLength={100}
          required
        />

        <label htmlFor="category-description">Description</label>
        <textarea
          id="category-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Enter category details (optional)"
          rows={3}
          maxLength={500}
        />

        {error && <div className="category-error">{error}</div>}

        <div className="category-actions">
          <button className="category-save" disabled={saving}>
            {saving
              ? "Saving..."
              : editingId
                ? "Update Category"
                : "Save Category"}
          </button>

          {editingId && (
            <button
              className="category-cancel"
              type="button"
              onClick={resetForm}
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      <div className="category-table-panel">
        <h3>Category List</h3>

        {loading ? (
          <p>Loading categories...</p>
        ) : categories.length === 0 ? (
          <div className="category-empty">
            <h4>No categories yet</h4>
            <p>Create your first category using the form above.</p>
          </div>
        ) : (
          <div className="category-table-scroll">
            <table className="category-table">
              <thead>
                <tr>
                  <th>NAME</th>
                  <th>DESCRIPTION</th>
                  <th>STATUS</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {paginatedCategories.map((category) => (
                  <tr key={category._id}>
                    <td><strong>{category.name}</strong></td>
                    <td>{category.description || "—"}</td>
                    <td>
                      <span
                        className={
                          category.isActive
                            ? "category-status active"
                            : "category-status inactive"
                        }
                      >
                        {category.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td>
                      <div className="category-row-actions">
                        {category.isActive && (
                          <>
                            <button
                              type="button"
                              onClick={() => startEdit(category)}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="category-delete"
                              onClick={() => deactivateCategory(category._id)}
                            >
                              Deactivate
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && <Pagination total={categories.length} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />}
      </div>
    </div>
  );
}
