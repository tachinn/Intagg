// ─── STATE ───
let internships = []; 
let bookmarkedJobsMap = new Map(); 
let currentPage = 1;
const itemsPerPage = 20;
let totalPages = 1;

let isSorting = false;
let sortAsc = false;

// New Advanced Filter State
let selectedProfiles = [];
let selectedLocations = [];

window.isFetchingBookmarks = false;

// ─── INITIALIZATION ───
document.addEventListener("DOMContentLoaded", () => {
  fetchInternships();
});

// ─── ADVANCED FILTERS LOGIC ───

function addProfile() {
  const select = document.getElementById('filterProfile');
  const val = select.value;
  if (val && !selectedProfiles.includes(val)) {
    if (selectedProfiles.length >= 5) {
      alert("You can select up to 5 profiles.");
    } else {
      selectedProfiles.push(val);
      renderFilterTags();
      applyFilters();
    }
  }
  select.value = ""; // reset to placeholder
}

function removeProfile(index) {
  selectedProfiles.splice(index, 1);
  renderFilterTags();
  applyFilters();
}

function addLocation() {
  const select = document.getElementById('filterLocation');
  const val = select.value;
  if (val && !selectedLocations.includes(val)) {
    if (selectedLocations.length >= 5) {
      alert("You can select up to 5 locations.");
    } else {
      selectedLocations.push(val);
      renderFilterTags();
      applyFilters();
    }
  }
  select.value = ""; // reset to placeholder
}

function removeLocation(index) {
  selectedLocations.splice(index, 1);
  renderFilterTags();
  applyFilters();
}

function renderFilterTags() {
  // Profiles
  const profilesContainer = document.getElementById('activeProfiles');
  if (profilesContainer) {
    profilesContainer.innerHTML = '';
    selectedProfiles.forEach((p, i) => {
      const div = document.createElement('div');
      div.className = 'active-tag';
      div.innerHTML = `${p} <span class="tag-remove" onclick="removeProfile(${i})">✕</span>`;
      profilesContainer.appendChild(div);
    });
  }

  // Locations
  const locationsContainer = document.getElementById('activeLocations');
  if (locationsContainer) {
    locationsContainer.innerHTML = '';
    selectedLocations.forEach((loc, i) => {
      const div = document.createElement('div');
      div.className = 'active-tag';
      div.innerHTML = `${loc} <span class="tag-remove" onclick="removeLocation(${i})">✕</span>`;
      locationsContainer.appendChild(div);
    });
  }
}

function updateStipendLabel() {
  const stipendEl = document.getElementById('filterStipend');
  const labelEl = document.getElementById('stipendLabel');
  if (stipendEl && labelEl) {
    const val = parseInt(stipendEl.value);
    if (val === 0) {
      labelEl.innerText = '₹0+';
    } else {
      // Format to 1,00,000+ or 5,000+
      labelEl.innerText = `₹${val.toLocaleString()}+`;
    }
  }
}

function applyFilters() {
  currentPage = 1; 
  fetchInternships();
}

function toggleSort() {
  isSorting = !isSorting;
  sortAsc = isSorting ? false : sortAsc;
  document.getElementById('sortBtn').classList.toggle('active', isSorting);
  applyFilters();
}

// ─── FETCH FROM BACKEND ───
async function fetchInternships() {
  try {
    const stipendEl = document.getElementById('filterStipend');
    const stipend = stipendEl ? parseInt(stipendEl.value) || 0 : 0;

    const params = new URLSearchParams();
    params.append('page', currentPage);
    params.append('limit', itemsPerPage);
    
    if (selectedProfiles.length > 0) {
      params.append('profile', selectedProfiles.join(','));
    }
    if (selectedLocations.length > 0) {
      params.append('location', selectedLocations.join(','));
    }
    if (stipend > 0) {
      params.append('stipend', stipend);
    }
    if (isSorting) {
      params.append('sort', sortAsc ? 'stipend_asc' : 'stipend_desc');
    }

    // Show loading spinner
    const container = document.getElementById('cardContainer');
    if (container) {
      container.innerHTML = `
        <div class="loader-container">
          <div class="spinner"></div>
        </div>
      `;
    }

    const response = await fetch(`https://intagg-backend.onrender.com/api/internships?${params.toString()}`);
    const data = await response.json();
    
    if (data.error) throw new Error(data.error);

    internships = data.jobs.map(job => ({
      id: job.source_url, 
      title: job.title,
      company: job.company_name,
      location: job.location,
      stipend: job.stipend_amount,
      duration: job.duration ? `${job.duration} Months` : 'Unspecified',
      platform: job.source_platform,
      source_url: job.source_url,
      profile: job.category || 'Other',
      posted: 'Recently'
    }));

    totalPages = Math.ceil(data.total / itemsPerPage);
    
    renderCards();
    renderBookmarks();

  } catch (error) {
    console.error("Error fetching live jobs:", error);
    const container = document.getElementById('cardContainer');
    if (container) {
      container.innerHTML = `<p style="color:red; text-align:center;">Failed to load internships. Make sure your Flask backend is running.</p>`;
    }
  }
}

// ─── HELPERS ───

function getPlatformIcon(name) {
  if (!name) return null;
  const cleanName = name.trim().toLowerCase();
  const map = { 
    'linkedin': 'media/platform_icons/linkedin.png', 
    'internshala': 'media/platform_icons/internshala.png', 
    'naukri': 'media/platform_icons/naukri.png', 
    'unstop': 'media/platform_icons/unstop.png',
    'indeed': 'media/platform_icons/indeed.png' 
  };
  return map[cleanName] || null; 
}

function getPlatformAbbr(name) {
  const iconUrl = getPlatformIcon(name);
  if (iconUrl) {
    return `<img src="${iconUrl}" alt="${name}" style="width:100%; height:100%; object-fit:cover;">`;
  }
  return name ? name.substring(0, 2).toUpperCase() : '??';
}

window.fetchBookmarks = async function() {
  window.isFetchingBookmarks = true;
  const container = document.getElementById('bookmarksContainer');
  if (container) {
    container.innerHTML = `
      <div class="loader-container">
        <div class="spinner"></div>
      </div>
    `;
  }
  try {
    const res = await fetch('/api/bookmarks');
    const data = await res.json();
    if (data.bookmarks) {
      bookmarkedJobsMap.clear();
      data.bookmarks.forEach(job => {
        bookmarkedJobsMap.set(job.source_url, {
          id: job.source_url, 
          title: job.title,
          company: job.company_name,
          location: job.location,
          stipend: job.stipend_amount,
          duration: job.duration ? `${job.duration} Months` : 'Unspecified',
          platform: job.source_platform,
          source_url: job.source_url,
          profile: job.category || 'Other',
          posted: 'Recently'
        });
      });
      window.isFetchingBookmarks = false;
      renderCards();
      renderBookmarks();
    }
  } catch (err) {
    console.error("Failed to fetch bookmarks:", err);
    window.isFetchingBookmarks = false;
  }
};

async function toggleBookmark(urlEncoded) {
  if (window.isUserLoggedIn === false) {
    showLoginModal();
    return;
  }
  
  const url = decodeURIComponent(urlEncoded);
  let action = 'add';
  
  if (bookmarkedJobsMap.has(url)) {
    bookmarkedJobsMap.delete(url);
    action = 'remove';
  } else {
    const job = internships.find(j => j.id === url);
    if (job) bookmarkedJobsMap.set(url, job);
  }
  renderCards(); 
  renderBookmarks(); 
  
  try {
    await fetch('/api/bookmarks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: action, job_url: url })
    });
  } catch (err) {
    console.error("Failed to persist bookmark:", err);
  }
}

// ─── RENDER MAIN CARDS ───
function renderCards() {
  const container = document.getElementById('cardContainer');
  if(!container) return;
  
  const noResults = document.getElementById('noResults');
  container.innerHTML = '';

  if (internships.length === 0) {
    if(noResults) noResults.classList.add('show');
    renderPagination(0);
    return;
  }
  if(noResults) noResults.classList.remove('show');

  internships.forEach(job => {
    const isBookmarked = bookmarkedJobsMap.has(job.id);
    const platAbbr = getPlatformAbbr(job.platform);
    
    const bookmarkSvg = isBookmarked 
      ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>`
      : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>`;

    const card = document.createElement('div');
    card.className = 'feed-card';
    card.innerHTML = `
      <div class="card-left">
        <div class="card-title">${job.title}</div>
        <div class="card-company">${job.company}</div>
        
        <div class="card-details">
          <div class="detail-row">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle>
            </svg>
            ${job.location}
          </div>
          <div class="inline-details">
            <div class="detail-row">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline>
              </svg>
              ${job.duration}
            </div>
            <div class="detail-row">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="2" y="6" width="20" height="12" rx="2"></rect><path d="M12 12h.01"></path><path d="M17 12h.01"></path><path d="M7 12h.01"></path>
              </svg>
              ₹${job.stipend.toLocaleString()} / month
            </div>
          </div>
        </div>

        <div class="card-footer">
          <span class="posted-time">Posted ${job.posted}</span>
          <button class="btn-bookmark ${isBookmarked ? 'active' : ''}" onclick="toggleBookmark('${encodeURIComponent(job.id)}')" title="Save Internship">
            ${bookmarkSvg}
          </button>
        </div>
      </div>

      <div class="card-right">
        <div>
          <p class="disclaimer">
            <strong>Disclaimer:</strong> This listing does not belong to us. We hold no rights to this posting, only the intent to share publicly available information.
          </p>
          <a href="disclaimer.html" class="click-more" style="text-decoration: none;">Click here to know more</a>
        </div>
        
        <div class="apply-container">
          <div class="platform-logo" title="${job.platform}">${platAbbr}</div>
          <button class="apply-btn" onclick="trackAndApply('${job.source_url}')">Apply Now</button>
        </div>
      </div>
    `;
    container.appendChild(card);
  });

  renderPagination(totalPages);
}

function renderPagination(totalPages) {
  const pagination = document.getElementById('pagination');
  if (!pagination) return;

  if (totalPages <= 1) {
    pagination.style.display = 'none';
    return;
  }
  
  pagination.style.display = 'flex';
  pagination.innerHTML = '';

  const prevBtn = document.createElement('button');
  prevBtn.className = `page-text-btn ${currentPage === 1 ? 'disabled' : ''}`;
  prevBtn.innerHTML = '&lt; Previous';
  prevBtn.onclick = () => { if (currentPage > 1) { currentPage--; fetchInternships(); window.scrollTo({top: 0, behavior: 'smooth'}); } };
  pagination.appendChild(prevBtn);

  let startPage = Math.max(1, currentPage - 2);
  let endPage = Math.min(totalPages, currentPage + 2);

  if (currentPage <= 3) endPage = Math.min(totalPages, 5);
  if (currentPage >= totalPages - 2) startPage = Math.max(1, totalPages - 4);

  if (startPage > 1) {
    pagination.appendChild(createPageBtn(1));
    if (startPage > 2) {
      const ellipsis = document.createElement('span');
      ellipsis.className = 'page-ellipsis';
      ellipsis.innerText = '...';
      pagination.appendChild(ellipsis);
    }
  }

  for (let i = startPage; i <= endPage; i++) {
    pagination.appendChild(createPageBtn(i));
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      const ellipsis = document.createElement('span');
      ellipsis.className = 'page-ellipsis';
      ellipsis.innerText = '...';
      pagination.appendChild(ellipsis);
    }
    pagination.appendChild(createPageBtn(totalPages));
  }

  const nextBtn = document.createElement('button');
  nextBtn.className = `page-text-btn ${currentPage === totalPages ? 'disabled' : ''}`;
  nextBtn.innerHTML = 'Next &gt;';
  nextBtn.onclick = () => { if (currentPage < totalPages) { currentPage++; fetchInternships(); window.scrollTo({top: 0, behavior: 'smooth'}); } };
  pagination.appendChild(nextBtn);
}

function createPageBtn(page) {
  const btn = document.createElement('button');
  btn.className = `page-btn ${page === currentPage ? 'active' : ''}`;
  btn.innerText = page;
  btn.onclick = () => { currentPage = page; fetchInternships(); window.scrollTo({top: 0, behavior: 'smooth'}); };
  return btn;
}

// ─── RENDER BOOKMARKS PANEL ───
function renderBookmarks() {
  const container = document.getElementById('bookmarksContainer');
  if (!container) return; 

  if (window.isFetchingBookmarks) return;
  if (window.isUserLoggedIn === undefined) return;
  
  container.innerHTML = '';

  if (window.isUserLoggedIn === false) {
    container.innerHTML = `
      <div class="bookmarks-locked-container">
        <div class="bookmarks-dummy-list">
          <div class="dummy-card">
            <div class="dummy-title"></div>
            <div class="dummy-company"></div>
            <div class="dummy-details"></div>
          </div>
          <div class="dummy-card">
            <div class="dummy-title" style="width: 80%"></div>
            <div class="dummy-company" style="width: 60%"></div>
            <div class="dummy-details" style="width: 85%"></div>
          </div>
        </div>
        <div class="locked-overlay">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
          <div class="locked-overlay-text">Sign up or Log in to unlock your saved roles</div>
          <a href="signup.html" class="btn-signup">Sign up to unlock</a>
        </div>
      </div>
    `;
    return;
  }

  if (bookmarkedJobsMap.size === 0) {
    container.innerHTML = `
      <div class="bookmarks-empty">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
        </svg>
        <div class="bookmarks-empty-text">Click the bookmark icon on<br>an internship to save it here.</div>
      </div>
    `;
    return;
  }

  const bookmarkedJobs = Array.from(bookmarkedJobsMap.values());

  bookmarkedJobs.forEach(job => {
    const platAbbr = getPlatformAbbr(job.platform);
    const bookmarkSvg = `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>`;

    const card = document.createElement('div');
    card.className = 'feed-card'; 
    card.innerHTML = `
      <div class="card-left" style="margin-bottom: 0;">
        <div class="card-title">${job.title}</div>
        <div class="card-company">${job.company}</div>
        
        <div class="card-details" style="margin-bottom: 0;">
          <div class="detail-row">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle>
            </svg>
            ${job.location}
          </div>
          <div class="inline-details">
            <div class="detail-row">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline>
              </svg>
              ${job.duration}
            </div>
            <div class="detail-row">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="2" y="6" width="20" height="12" rx="2"></rect><path d="M12 12h.01"></path><path d="M17 12h.01"></path><path d="M7 12h.01"></path>
              </svg>
              ₹${job.stipend.toLocaleString()} / mo
            </div>
          </div>
        </div>
      </div>

      <div class="card-right">
        <div class="action-row">
          <div class="platform-logo" title="${job.platform}">${platAbbr}</div>
          <button class="apply-btn" onclick="trackAndApply('${job.source_url}')">Apply Now</button>
          <button class="btn-bookmark active" onclick="toggleBookmark('${encodeURIComponent(job.id)}')" title="Remove Bookmark">
            ${bookmarkSvg}
          </button>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

window.showLoginModal = function() {
  let overlay = document.getElementById('customLoginModal');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'customLoginModal';
    overlay.className = 'custom-modal-overlay';
    overlay.innerHTML = `
      <div class="custom-modal-box">
        <button class="custom-modal-close" onclick="closeLoginModal()">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
        <div class="custom-modal-title">Sign In Required</div>
        <div class="custom-modal-text">Sign up or Log in to save your favorite internships and access them later.</div>
        <div class="custom-modal-actions">
          <a href="login.html" class="btn-login">Log in</a>
          <a href="signup.html" class="btn-signup">Sign up</a>
        </div>
        <div style="margin-top: 20px; font-size: 13px;">
          <a href="#" onclick="closeLoginModal(); return false;" style="color: var(--mid); text-decoration: none; transition: color 0.2s;" onmouseover="this.style.color='var(--white)'" onmouseout="this.style.color='var(--mid)'">Continue as Guest</a>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
  }
  // Small delay to allow DOM to render before adding 'show' class for transition
  setTimeout(() => overlay.classList.add('show'), 10);
};

window.closeLoginModal = function() {
  const overlay = document.getElementById('customLoginModal');
  if (overlay) {
    overlay.classList.remove('show');
  }
};

// --- ANALYTICS TRACKING ---
document.addEventListener("DOMContentLoaded", () => {
  // 1. Visit Tracking
  const todayStr = new Date().toDateString();
  if (localStorage.getItem('visit_tracked_today') !== todayStr) {
    fetch('/api/track/visit', { method: 'POST' }).catch(e => console.error(e));
    localStorage.setItem('visit_tracked_today', todayStr);
  }

  // 2. Session Tracking
  window.sessionStartTime = Date.now();
  let sessionTracked = false;

  const trackSession = () => {
    if (sessionTracked) return;
    const duration = Math.floor((Date.now() - window.sessionStartTime) / 1000);
    if (duration > 0) {
      const data = JSON.stringify({ duration });
      navigator.sendBeacon('/api/track/session', new Blob([data], { type: 'application/json' }));
      sessionTracked = true;
    }
  };

  window.addEventListener('beforeunload', trackSession);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      trackSession();
    }
  });
});

window.trackAndApply = function(url) {
  fetch('/api/track/apply', { method: 'POST' }).catch(e => console.error(e));
  window.open(url, '_blank');
};