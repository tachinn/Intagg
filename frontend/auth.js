document.addEventListener('DOMContentLoaded', async () => {
  const authSection = document.getElementById('authSection');
  if (!authSection) return;

  try {
    const res = await fetch('/api/me');
    const data = await res.json();
    
    // Store globally for other scripts to check
    window.isUserLoggedIn = data.logged_in;
    window.currentUser = data.logged_in ? data : null;

    if (data.logged_in) {
      const initial = data.name.charAt(0).toUpperCase();
      authSection.innerHTML = `
        <div class="student-name" style="display:flex; flex-direction:column; align-items:flex-end;">
          <span>${data.name}</span>
          <span style="font-size:11px; cursor:pointer; color:var(--mid); margin-top:2px;" onclick="logout()">Logout</span>
        </div>
        <div class="avatar">${initial}</div>
      `;
      if (typeof window.fetchBookmarks === 'function') {
        window.fetchBookmarks();
      }
    } else {
      if (typeof window.renderBookmarks === 'function') {
        window.renderBookmarks();
      }
    }
  } catch (err) {
    console.error("Auth check failed:", err);
    window.isUserLoggedIn = false;
    if (typeof window.renderBookmarks === 'function') {
      window.renderBookmarks();
    }
  }
});

async function logout() {
  try {
    await fetch('/api/logout', { method: 'POST' });
    window.location.reload();
  } catch (err) {
    console.error("Logout failed:", err);
  }
}
