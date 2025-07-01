// content.js - Content script for enhanced page interaction

class ContentScriptManager {
  constructor() {
    this.isInjected = false;
    this.highlightStyles = null;
    this.observing = false;
    this.init();
  }

  // Initialize content script
  init() {
    // Avoid multiple injections on the same page
    if (window.smartScraperContentScript) {
      return;
    }
    window.smartScraperContentScript = true;

    console.log('🌐 Smart Scraper content script loaded on:', window.location.hostname);
    
    this.setupMessageListeners();
    this.injectHighlightStyles();
    this.setupSelectionHandler();
    this.observePageChanges();
  }

  // Setup message listeners
  setupMessageListeners() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender, sendResponse);
      return true;
    });
  }

  // Handle messages from background/popup
  async handleMessage(request, sender, sendResponse) {
    try {
      switch (request.action) {
        case 'highlightElements':
          this.highlightElements(request.selectors);
          sendResponse({ success: true });
          break;

        case 'removeHighlights':
          this.removeHighlights();
          sendResponse({ success: true });
          break;

        case 'extractPageData':
          const data = this.extractPageData(request.selectors);
          sendResponse({ success: true, data: data });
          break;

        case 'getPageInfo':
          const pageInfo = this.getPageInfo();
          sendResponse({ success: true, data: pageInfo });
          break;

        case 'injectSelectionTool':
          this.injectSelectionTool();
          sendResponse({ success: true });
          break;

        default:
          sendResponse({ success: false, error: 'Unknown action' });
      }
    } catch (error) {
      console.error('Content script error:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  // Inject CSS for highlighting elements
  injectHighlightStyles() {
    if (this.highlightStyles) return;

    this.highlightStyles = document.createElement('style');
    this.highlightStyles.textContent = `
      .smart-scraper-highlight {
        outline: 3px solid #667eea !important;
        outline-offset: 2px !important;
        background-color: rgba(102, 126, 234, 0.1) !important;
        position: relative !important;
        z-index: 9999 !important;
      }
      
      .smart-scraper-highlight::before {
        content: "🔍 Scraped";
        position: absolute !important;
        top: -25px !important;
        left: 0 !important;
        background: #667eea !important;
        color: white !important;
        padding: 2px 8px !important;
        font-size: 12px !important;
        font-weight: bold !important;
        border-radius: 3px !important;
        z-index: 10000 !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      }

      .smart-scraper-selection-overlay {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        width: 100% !important;
        height: 100% !important;
        background: rgba(0, 0, 0, 0.3) !important;
        z-index: 999999 !important;
        cursor: crosshair !important;
      }

      .smart-scraper-hover {
        outline: 2px dashed #ffc107 !important;
        outline-offset: 2px !important;
        background-color: rgba(255, 193, 7, 0.1) !important;
      }

      .smart-scraper-tooltip {
        position: absolute !important;
        background: #333 !important;
        color: white !important;
        padding: 8px 12px !important;
        border-radius: 6px !important;
        font-size: 12px !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
        z-index: 1000000 !important;
        pointer-events: none !important;
        max-width: 300px !important;
        word-wrap: break-word !important;
      }
    `;
    
    document.head.appendChild(this.highlightStyles);
  }

  // Highlight elements based on selectors
  highlightElements(selectors) {
    this.removeHighlights();
    
    if (!selectors || (!selectors.primary && !selectors.secondary)) {
      return;
    }

    // Highlight primary elements
    if (selectors.primary) {
      const primaryElements = document.querySelectorAll(selectors.primary);
      primaryElements.forEach(element => {
        element.classList.add('smart-scraper-highlight');
        element.setAttribute('data-scraper-type', 'primary');
      });
      console.log(`🎯 Highlighted ${primaryElements.length} primary elements`);
    }

    // Highlight secondary elements with different style
    if (selectors.secondary) {
      const secondaryElements = document.querySelectorAll(selectors.secondary);
      secondaryElements.forEach(element => {
        if (!element.classList.contains('smart-scraper-highlight')) {
          element.classList.add('smart-scraper-highlight');
          element.setAttribute('data-scraper-type', 'secondary');
        }
      });
      console.log(`🎯 Highlighted ${secondaryElements.length} secondary elements`);
    }
  }

  // Remove all highlights
  removeHighlights() {
    const highlighted = document.querySelectorAll('.smart-scraper-highlight');
    highlighted.forEach(element => {
      element.classList.remove('smart-scraper-highlight');
      element.removeAttribute('data-scraper-type');
    });

    const hovers = document.querySelectorAll('.smart-scraper-hover');
    hovers.forEach(element => {
      element.classList.remove('smart-scraper-hover');
    });

    // Remove tooltips
    const tooltips = document.querySelectorAll('.smart-scraper-tooltip');
    tooltips.forEach(tooltip => tooltip.remove());
  }

  // Extract page data using selectors
  extractPageData(selectors) {
    const data = {
      url: window.location.href,
      title: document.title,
      timestamp: Date.now(),
      elements: []
    };

    if (selectors.primary) {
      const elements = document.querySelectorAll(selectors.primary);
      elements.forEach((element, index) => {
        if (index >= 50) return; // Limit to 50 elements

        const item = {
          index: index,
          type: 'primary',
          tagName: element.tagName,
          text: element.textContent?.trim() || '',
          html: element.innerHTML?.substring(0, 1000) || '', // Limit HTML size
          attributes: {},
          boundingRect: element.getBoundingClientRect()
        };

        // Extract useful attributes
        ['id', 'class', 'href', 'src', 'alt', 'title', 'data-price', 'data-rating'].forEach(attr => {
          const value = element.getAttribute(attr);
          if (value) item.attributes[attr] = value;
        });

        // Try to extract structured data
        const structuredData = this.extractStructuredData(element);
        if (structuredData) {
          item.structuredData = structuredData;
        }

        data.elements.push(item);
      });
    }

    return data;
  }

  // Extract structured data from element
  extractStructuredData(element) {
    const data = {};

    // Try to find price
    const priceSelectors = [
      '.price', '[class*="price"]', '[data-price]', 
      '.cost', '[class*="cost"]', '.amount'
    ];
    
    for (const selector of priceSelectors) {
      const priceEl = element.querySelector(selector);
      if (priceEl) {
        data.price = priceEl.textContent?.trim();
        break;
      }
    }

    // Try to find rating
    const ratingSelectors = [
      '.rating', '[class*="rating"]', '[data-rating]',
      '.stars', '[class*="star"]', '.score'
    ];
    
    for (const selector of ratingSelectors) {
      const ratingEl = element.querySelector(selector);
      if (ratingEl) {
        data.rating = ratingEl.textContent?.trim();
        break;
      }
    }

    // Try to find title/name
    const titleSelectors = [
      'h1', 'h2', 'h3', '.title', '[class*="title"]',
      '.name', '[class*="name"]', '.product-name'
    ];
    
    for (const selector of titleSelectors) {
      const titleEl = element.querySelector(selector);
      if (titleEl) {
        data.title = titleEl.textContent?.trim();
        break;
      }
    }

    // Try to find link
    const linkEl = element.querySelector('a[href]');
    if (linkEl) {
      data.link = linkEl.href;
    }

    return Object.keys(data).length > 0 ? data : null;
  }

  // Get page information
  getPageInfo() {
    return {
      url: window.location.href,
      title: document.title,
      hostname: window.location.hostname,
      pathname: window.location.pathname,
      timestamp: Date.now(),
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      },
      scroll: {
        x: window.scrollX,
        y: window.scrollY
      },
      meta: {
        description: document.querySelector('meta[name="description"]')?.content || '',
        keywords: document.querySelector('meta[name="keywords"]')?.content || '',
        author: document.querySelector('meta[name="author"]')?.content || ''
      },
      structuredData: this.findStructuredData()
    };
  }

  // Find structured data on page (JSON-LD, microdata, etc.)
  findStructuredData() {
    const structured = [];

    // JSON-LD
    const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
    jsonLdScripts.forEach(script => {
      try {
        const data = JSON.parse(script.textContent);
        structured.push({ type: 'json-ld', data });
      } catch (e) {
        // Invalid JSON, skip
      }
    });

    // OpenGraph
    const ogTags = document.querySelectorAll('meta[property^="og:"]');
    const openGraph = {};
    ogTags.forEach(tag => {
      const property = tag.getAttribute('property');
      const content = tag.getAttribute('content');
      if (property && content) {
        openGraph[property] = content;
      }
    });
    if (Object.keys(openGraph).length > 0) {
      structured.push({ type: 'opengraph', data: openGraph });
    }

    return structured;
  }

  // Setup text selection handler
  setupSelectionHandler() {
    document.addEventListener('mouseup', (e) => {
      const selection = window.getSelection();
      const selectedText = selection.toString().trim();
      
      if (selectedText && selectedText.length > 3) {
        // Store selected text for potential scraping
        this.lastSelection = {
          text: selectedText,
          timestamp: Date.now(),
          element: selection.anchorNode?.parentElement
        };
      }
    });
  }

  // Observe page changes (for SPA navigation)
  observePageChanges() {
    if (this.observing) return;

    const observer = new MutationObserver((mutations) => {
      let significantChange = false;
      
      mutations.forEach(mutation => {
        // Check if significant DOM changes occurred
        if (mutation.type === 'childList' && mutation.addedNodes.length > 5) {
          significantChange = true;
        }
      });

      if (significantChange) {
        // Remove old highlights as page structure changed
        setTimeout(() => this.removeHighlights(), 1000);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: false
    });

    this.observing = true;
  }

  // Inject visual selection tool
  injectSelectionTool() {
    // Remove existing tool
    this.removeSelectionTool();

    const overlay = document.createElement('div');
    overlay.className = 'smart-scraper-selection-overlay';
    overlay.id = 'smart-scraper-overlay';

    let isSelecting = false;
    let startX, startY, endX, endY;
    let selectionBox = null;

    // Mouse down - start selection
    overlay.addEventListener('mousedown', (e) => {
      isSelecting = true;
      startX = e.clientX;
      startY = e.clientY;
      
      // Create selection box
      selectionBox = document.createElement('div');
      selectionBox.style.cssText = `
        position: fixed;
        border: 2px dashed #667eea;
        background: rgba(102, 126, 234, 0.1);
        z-index: 1000000;
        pointer-events: none;
      `;
      document.body.appendChild(selectionBox);
      
      e.preventDefault();
    });

    // Mouse move - update selection
    overlay.addEventListener('mousemove', (e) => {
      if (!isSelecting || !selectionBox) return;
      
      endX = e.clientX;
      endY = e.clientY;
      
      const left = Math.min(startX, endX);
      const top = Math.min(startY, endY);
      const width = Math.abs(endX - startX);
      const height = Math.abs(endY - startY);
      
      selectionBox.style.left = left + 'px';
      selectionBox.style.top = top + 'px';
      selectionBox.style.width = width + 'px';
      selectionBox.style.height = height + 'px';
    });

    // Mouse up - finish selection
    overlay.addEventListener('mouseup', (e) => {
      if (!isSelecting) return;
      
      isSelecting = false;
      
      // Find elements in selection area
      const selectedElements = this.getElementsInArea(startX, startY, endX, endY);
      
      // Notify background script
      chrome.runtime.sendMessage({
        action: 'elementsSelected',
        elements: selectedElements,
        area: { startX, startY, endX, endY }
      });

      // Cleanup
      this.removeSelectionTool();
    });

    // Escape key cancels selection
    const escapeHandler = (e) => {
      if (e.key === 'Escape') {
        this.removeSelectionTool();
        document.removeEventListener('keydown', escapeHandler);
      }
    };
    document.addEventListener('keydown', escapeHandler);

    document.body.appendChild(overlay);
  }

  // Remove selection tool
  removeSelectionTool() {
    const overlay = document.getElementById('smart-scraper-overlay');
    if (overlay) {
      overlay.remove();
    }

    const selectionBoxes = document.querySelectorAll('[style*="border: 2px dashed"]');
    selectionBoxes.forEach(box => {
      if (box.style.zIndex === '1000000') {
        box.remove();
      }
    });
  }

  // Get elements within selection area
  getElementsInArea(startX, startY, endX, endY) {
    const elements = [];
    const allElements = document.querySelectorAll('*');
    
    const selectionLeft = Math.min(startX, endX);
    const selectionTop = Math.min(startY, endY);
    const selectionRight = Math.max(startX, endX);
    const selectionBottom = Math.max(startY, endY);

    allElements.forEach(element => {
      const rect = element.getBoundingClientRect();
      
      // Check if element overlaps with selection
      if (rect.left < selectionRight && 
          rect.right > selectionLeft && 
          rect.top < selectionBottom && 
          rect.bottom > selectionTop) {
        
        elements.push({
          tagName: element.tagName,
          className: element.className,
          id: element.id,
          text: element.textContent?.trim().substring(0, 100) || '',
          selector: this.generateSelector(element),
          rect: rect
        });
      }
    });

    return elements;
  }

  // Generate CSS selector for element
  generateSelector(element) {
    if (element.id) {
      return `#${element.id}`;
    }
    
    if (element.className) {
      const classes = element.className.split(' ').filter(c => c).slice(0, 3);
      if (classes.length > 0) {
        return `${element.tagName.toLowerCase()}.${classes.join('.')}`;
      }
    }
    
    // Fallback to tag name
    return element.tagName.toLowerCase();
  }
}

// Initialize content script
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new ContentScriptManager();
  });
} else {
  new ContentScriptManager();
}