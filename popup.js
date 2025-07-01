// popup.js - UI logic for the Smart Web Scraper extension

class PopupManager {
  constructor() {
    this.isLoading = false;
    this.currentResults = null;
    this.settings = {
      gemmaEndpoint: 'http://localhost:11434/api/generate',
      gemmaModel: 'gemma3n:latest',
      maxResults: 20,
      enableCache: true
    };
    
    this.loadingMessages = [
      'Analyzing your query...',
      'Determining target website...',
      'Scraping web content...',
      'Extracting data with Gemma 3...',
      'Processing results...'
    ];
    
    this.init();
  }

  // Initialize the popup
  async init() {
    console.log('🚀 Popup initialized');
    this.setupEventListeners();
    this.loadSettings();
    await this.updateStatus();
    this.setupKeyboardShortcuts();
  }

  // Setup event listeners
  setupEventListeners() {
    // Search functionality
    document.getElementById('searchBtn').addEventListener('click', () => this.handleSearch());
    document.getElementById('queryInput').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.handleSearch();
    });

    // Quick action buttons
    document.querySelectorAll('.quick-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const query = e.target.dataset.query;
        document.getElementById('queryInput').value = query;
        this.handleSearch();
      });
    });

    // Footer actions
    document.getElementById('clearCacheBtn').addEventListener('click', () => this.clearCache());
    document.getElementById('settingsBtn').addEventListener('click', () => this.showSettings());

    // Settings modal
    document.getElementById('closeSettings').addEventListener('click', () => this.hideSettings());
    document.getElementById('saveSettings').addEventListener('click', () => this.saveSettings());

    // Modal background clicks
    document.getElementById('loadingModal').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) this.hideLoading();
    });
    document.getElementById('settingsModal').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) this.hideSettings();
    });
  }

  // Setup keyboard shortcuts
  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Escape key closes modals
      if (e.key === 'Escape') {
        this.hideLoading();
        this.hideSettings();
      }
      
      // Ctrl/Cmd + Enter for search
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        this.handleSearch();
      }
    });
  }

  // Load settings from storage
  async loadSettings() {
    try {
      const result = await chrome.storage.sync.get(this.settings);
      this.settings = { ...this.settings, ...result };
      this.updateSettingsUI();
    } catch (error) {
      console.warn('Failed to load settings:', error);
    }
  }

  // Update settings UI
  updateSettingsUI() {
    document.getElementById('gemmaEndpoint').value = this.settings.gemmaEndpoint;
    document.getElementById('gemmaModel').value = this.settings.gemmaModel;
    document.getElementById('maxResults').value = this.settings.maxResults;
    document.getElementById('enableCache').checked = this.settings.enableCache;
  }

  // Save settings to storage
  async saveSettings() {
    try {
      this.settings = {
        gemmaEndpoint: document.getElementById('gemmaEndpoint').value,
        gemmaModel: document.getElementById('gemmaModel').value,
        maxResults: parseInt(document.getElementById('maxResults').value),
        enableCache: document.getElementById('enableCache').checked
      };
      
      await chrome.storage.sync.set(this.settings);
      this.hideSettings();
      this.showNotification('Settings saved successfully!', 'success');
      
      // Update status after settings change
      setTimeout(() => this.updateStatus(), 500);
    } catch (error) {
      console.error('Failed to save settings:', error);
      this.showNotification('Failed to save settings', 'error');
    }
  }

  // Update extension status
  async updateStatus() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getStatus' });
      
      if (response.success) {
        const { activeRequests, cacheSize, gemmaConnected } = response.status;
        
        // Update status indicator
        const statusDot = document.querySelector('.status-dot');
        const statusText = document.querySelector('.status-text');
        
        if (gemmaConnected) {
          statusDot.className = 'status-dot connected';
          statusText.textContent = 'Connected';
        } else {
          statusDot.className = 'status-dot error';
          statusText.textContent = 'Offline';
        }
        
        // Update stats
        document.getElementById('activeRequests').textContent = activeRequests;
        document.getElementById('cacheSize').textContent = cacheSize;
      }
    } catch (error) {
      console.warn('Failed to update status:', error);
      document.querySelector('.status-dot').className = 'status-dot error';
      document.querySelector('.status-text').textContent = 'Error';
    }
  }

  // Handle search action
  async handleSearch() {
    const query = document.getElementById('queryInput').value.trim();
    
    if (!query) {
      this.showNotification('Please enter a search query', 'warning');
      return;
    }

    if (this.isLoading) {
      return;
    }

    try {
      this.setLoading(true);
      this.showLoading();
      
      console.log(`🔍 Searching for: "${query}"`);
      
      const response = await chrome.runtime.sendMessage({
        action: 'scrapeQuery',
        query: query
      });

      if (response.success) {
        this.currentResults = response.data;
        this.displayResults(response.data);
        this.showNotification(`Found ${response.data.total_results || 0} results`, 'success');
      } else {
        throw new Error(response.error || 'Search failed');
      }
    } catch (error) {
      console.error('Search error:', error);
      this.showError(error.message);
      this.showNotification('Search failed. Please try again.', 'error');
    } finally {
      this.setLoading(false);
      this.hideLoading();
      this.updateStatus();
    }
  }

  // Set loading state
  setLoading(loading) {
    this.isLoading = loading;
    const searchBtn = document.getElementById('searchBtn');
    
    if (loading) {
      searchBtn.classList.add('loading');
      searchBtn.disabled = true;
    } else {
      searchBtn.classList.remove('loading');
      searchBtn.disabled = false;
    }
  }

  // Show loading modal with rotating messages
  showLoading() {
    const modal = document.getElementById('loadingModal');
    const loadingText = document.getElementById('loadingText');
    
    modal.classList.add('show');
    
    let messageIndex = 0;
    loadingText.textContent = this.loadingMessages[messageIndex];
    
    this.loadingInterval = setInterval(() => {
      messageIndex = (messageIndex + 1) % this.loadingMessages.length;
      loadingText.textContent = this.loadingMessages[messageIndex];
    }, 2000);
  }

  // Hide loading modal
  hideLoading() {
    document.getElementById('loadingModal').classList.remove('show');
    if (this.loadingInterval) {
      clearInterval(this.loadingInterval);
      this.loadingInterval = null;
    }
  }

  // Display search results
  displayResults(data) {
    const resultsContent = document.getElementById('resultsContent');
    const resultsMeta = document.getElementById('resultsMeta');
    
    // Update meta information
    resultsMeta.textContent = `${data.total_results || 0} results • ${data.source || 'unknown'} • ${this.formatTimestamp(data.timestamp)}`;
    
    if (!data.extracted_data || data.extracted_data.length === 0) {
      resultsContent.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">😕</div>
          <p>No results found</p>
          <small>Try a different search query</small>
        </div>
      `;
      return;
    }

    // Generate result items HTML
    const resultsHTML = data.extracted_data.slice(0, this.settings.maxResults).map(item => {
      return `
        <div class="result-item" onclick="window.open('${this.escapeHtml(item.link || '#')}', '_blank')">
          <div class="result-title">${this.escapeHtml(item.title || 'No title')}</div>
          ${item.price && item.price !== 'Price not found' ? `<div class="result-price">${this.escapeHtml(item.price)}</div>` : ''}
          <div class="result-meta">
            <span class="result-source">${this.escapeHtml(data.strategy || 'general')}</span>
            ${item.rating && item.rating !== 'No rating' ? `<span class="result-rating">${this.escapeHtml(item.rating)}</span>` : ''}
          </div>
          ${item.description ? `<div class="result-description">${this.escapeHtml(item.description)}</div>` : ''}
        </div>
      `;
    }).join('');

    resultsContent.innerHTML = resultsHTML;
  }

  // Show error message
  showError(message) {
    const resultsContent = document.getElementById('resultsContent');
    resultsContent.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">❌</div>
        <p>Error occurred</p>
        <small>${this.escapeHtml(message)}</small>
      </div>
    `;
  }

  // Clear cache
  async clearCache() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'clearCache' });
      if (response.success) {
        this.showNotification('Cache cleared successfully!', 'success');
        this.updateStatus();
      } else {
        throw new Error(response.error);
      }
    } catch (error) {
      console.error('Failed to clear cache:', error);
      this.showNotification('Failed to clear cache', 'error');
    }
  }

  // Show settings modal
  showSettings() {
    document.getElementById('settingsModal').classList.add('show');
  }

  // Hide settings modal
  hideSettings() {
    document.getElementById('settingsModal').classList.remove('show');
  }

  // Show notification
  showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : type === 'warning' ? '#ffc107' : '#17a2b8'};
      color: white;
      padding: 12px 16px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      z-index: 10000;
      max-width: 300px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      transform: translateX(100%);
      transition: transform 0.3s ease;
    `;

    document.body.appendChild(notification);

    // Animate in
    setTimeout(() => {
      notification.style.transform = 'translateX(0)';
    }, 100);

    // Auto remove
    setTimeout(() => {
      notification.style.transform = 'translateX(100%)';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 3000);
  }

  // Utility functions
  escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return '';
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  formatTimestamp(timestamp) {
    if (!timestamp) return 'unknown time';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.popupManager = new PopupManager();
});

// Handle extension updates
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'updateStatus') {
    window.popupManager?.updateStatus();
  }
  return true;
});

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PopupManager };
}