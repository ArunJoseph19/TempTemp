// background.js - Main orchestration with Gemma 3 integration for real web scraping

// Gemma 3 API configuration (replace with actual endpoint)
const GEMMA_API_ENDPOINT = 'http://localhost:11434/api/generate'; // Ollama local endpoint
const GEMMA_MODEL = 'gemma2:3b';

// URL Templates for fallback
const URL_TEMPLATES = {
  amazon: 'https://www.amazon.in/s?k={QUERY}',
  flights: 'https://www.google.com/travel/flights?q={QUERY}',
  tracking: 'https://www.bluedart.com/tracking',
  google: 'https://www.google.com/search?q={QUERY}',
  shopping: 'https://shopping.google.com/search?q={QUERY}',
  flipkart: 'https://www.flipkart.com/search?q={QUERY}',
  myntra: 'https://www.myntra.com/{QUERY}',
  zomato: 'https://www.zomato.com/search?q={QUERY}',
  swiggy: 'https://www.swiggy.com/search?q={QUERY}'
};

// Gemma 3 Prompts
const QUERY_ANALYZER_PROMPT = `
You are a query analyzer for a web scraping extension. Your job is to determine the target website and construct the exact URL to scrape real data from.

CRITICAL RULE: You only help determine WHERE to scrape real data. You NEVER generate or make up any product prices, flight times, or other information.

Given a user query, analyze it and respond with ONLY a JSON object in this exact format:
{
  "website": "amazon|flights|tracking|google|shopping|flipkart|myntra|zomato|swiggy",
  "url": "complete_url_to_scrape",
  "scraping_strategy": "product_list|flight_search|tracking_info|general_search|restaurant_search",
  "selectors": {
    "primary": "css_selector_for_main_content",
    "secondary": "css_selector_for_additional_data"
  }
}

Examples:
- "laptop under 50000" → amazon search
- "flights to Mumbai" → flights search
- "track package ABC123" → tracking page
- "restaurants near me" → zomato/swiggy search

User Query: {QUERY}
`;

const DATA_EXTRACTOR_PROMPT = `
You are a data extraction specialist. Given HTML content from a webpage, extract ONLY the real, actual data present in the HTML.

CRITICAL RULES:
1. ONLY extract data that is actually present in the HTML
2. NEVER make up prices, ratings, or any information
3. If data is not found, mark it as "not_found"
4. Preserve original formatting and text

Extract data and respond with ONLY a JSON object:
{
  "extracted_data": [
    {
      "title": "actual_title_from_html",
      "price": "actual_price_or_not_found",
      "rating": "actual_rating_or_not_found",
      "additional_info": "any_other_relevant_data"
    }
  ],
  "total_results": number,
  "source_url": "url_scraped"
}

HTML Content: {HTML_CONTENT}
`;

// Class for managing scraping operations
class WebScrapingOrchestrator {
  constructor() {
    this.activeRequests = new Map();
    this.cache = new Map();
    this.rateLimiter = new Map();
  }

  // Initialize the orchestrator
  async initialize() {
    console.log('🚀 Web Scraping Orchestrator initialized');
    this.setupMessageListeners();
    this.setupContextMenus();
  }

  // Setup message listeners for communication with popup/content scripts
  setupMessageListeners() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender, sendResponse);
      return true; // Keep message channel open for async response
    });
  }

  // Setup context menus for right-click functionality
  setupContextMenus() {
    chrome.contextMenus.create({
      id: 'scrapeSelection',
      title: 'Smart Scrape: "%s"',
      contexts: ['selection']
    });

    chrome.contextMenus.onClicked.addListener((info, tab) => {
      if (info.menuItemId === 'scrapeSelection') {
        this.processQuery(info.selectionText, tab);
      }
    });
  }

  // Main message handler
  async handleMessage(request, sender, sendResponse) {
    try {
      switch (request.action) {
        case 'scrapeQuery':
          const result = await this.processQuery(request.query, sender.tab);
          sendResponse({ success: true, data: result });
          break;

        case 'getStatus':
          sendResponse({ 
            success: true, 
            status: {
              activeRequests: this.activeRequests.size,
              cacheSize: this.cache.size,
              gemmaConnected: await this.testGemmaConnection()
            }
          });
          break;

        case 'clearCache':
          this.cache.clear();
          sendResponse({ success: true, message: 'Cache cleared' });
          break;

        default:
          sendResponse({ success: false, error: 'Unknown action' });
      }
    } catch (error) {
      console.error('❌ Error handling message:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  // Test Gemma 3 connection
  async testGemmaConnection() {
    try {
      const response = await fetch(GEMMA_API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: GEMMA_MODEL,
          prompt: 'Test connection',
          stream: false
        })
      });
      return response.ok;
    } catch (error) {
      console.warn('⚠️ Gemma connection test failed:', error);
      return false;
    }
  }

  // Rate limiting check
  checkRateLimit(key) {
    const now = Date.now();
    const limit = this.rateLimiter.get(key);
    
    if (limit && now - limit < 2000) { // 2 second cooldown
      return false;
    }
    
    this.rateLimiter.set(key, now);
    return true;
  }

  // Main query processing function
  async processQuery(query, tab) {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // Check rate limiting
      if (!this.checkRateLimit(query)) {
        throw new Error('Rate limit exceeded. Please wait before making another request.');
      }

      // Check cache first
      const cacheKey = `query_${query.toLowerCase().trim()}`;
      if (this.cache.has(cacheKey)) {
        console.log('📦 Returning cached result for:', query);
        return this.cache.get(cacheKey);
      }

      this.activeRequests.set(requestId, { query, startTime: Date.now() });

      console.log(`🔍 Processing query: "${query}"`);

      // Step 1: Analyze query with Gemma 3
      const analysisResult = await this.analyzeQueryWithGemma(query);
      
      // Step 2: Perform actual web scraping
      const scrapingResult = await this.performScraping(analysisResult);
      
      // Step 3: Extract and structure data with Gemma 3
      const extractedData = await this.extractDataWithGemma(scrapingResult);

      // Cache the result
      this.cache.set(cacheKey, extractedData);
      
      // Clean up
      this.activeRequests.delete(requestId);

      console.log('✅ Query processed successfully:', query);
      return extractedData;

    } catch (error) {
      console.error(`❌ Error processing query "${query}":`, error);
      this.activeRequests.delete(requestId);
      throw error;
    }
  }

  // Analyze query using Gemma 3
  async analyzeQueryWithGemma(query) {
    try {
      const prompt = QUERY_ANALYZER_PROMPT.replace('{QUERY}', query);
      
      const response = await fetch(GEMMA_API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: GEMMA_MODEL,
          prompt: prompt,
          stream: false,
          options: {
            temperature: 0.1,
            top_p: 0.9,
            max_tokens: 500
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Gemma API error: ${response.status}`);
      }

      const data = await response.json();
      const analysisText = data.response || data.text || '';
      
      // Parse JSON response from Gemma
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return this.fallbackAnalysis(query);
      }

      const analysis = JSON.parse(jsonMatch[0]);
      console.log('🧠 Gemma analysis:', analysis);
      return analysis;

    } catch (error) {
      console.warn('⚠️ Gemma analysis failed, using fallback:', error);
      return this.fallbackAnalysis(query);
    }
  }

  // Fallback analysis when Gemma is not available
  fallbackAnalysis(query) {
    const lowerQuery = query.toLowerCase();
    
    // Simple keyword matching for fallback
    if (lowerQuery.includes('laptop') || lowerQuery.includes('phone') || lowerQuery.includes('product')) {
      return {
        website: 'amazon',
        url: URL_TEMPLATES.amazon.replace('{QUERY}', encodeURIComponent(query)),
        scraping_strategy: 'product_list',
        selectors: {
          primary: '[data-component-type="s-search-result"]',
          secondary: '.s-price, .a-price-whole'
        }
      };
    }
    
    if (lowerQuery.includes('flight') || lowerQuery.includes('travel')) {
      return {
        website: 'flights',
        url: URL_TEMPLATES.flights.replace('{QUERY}', encodeURIComponent(query)),
        scraping_strategy: 'flight_search',
        selectors: {
          primary: '.gws-flights-results__result',
          secondary: '.gws-flights-results__price'
        }
      };
    }
    
    if (lowerQuery.includes('track') || lowerQuery.includes('package')) {
      return {
        website: 'tracking',
        url: URL_TEMPLATES.tracking,
        scraping_strategy: 'tracking_info',
        selectors: {
          primary: '.tracking-info',
          secondary: '.status'
        }
      };
    }

    if (lowerQuery.includes('restaurant') || lowerQuery.includes('food')) {
      return {
        website: 'zomato',
        url: URL_TEMPLATES.zomato.replace('{QUERY}', encodeURIComponent(query)),
        scraping_strategy: 'restaurant_search',
        selectors: {
          primary: '.search-result',
          secondary: '.rating, .cost'
        }
      };
    }
    
    // Default to Google search
    return {
      website: 'google',
      url: URL_TEMPLATES.google.replace('{QUERY}', encodeURIComponent(query)),
      scraping_strategy: 'general_search',
      selectors: {
        primary: '.g',
        secondary: '.r a'
      }
    };
  }

  // Perform actual web scraping
  async performScraping(analysisResult) {
    try {
      console.log(`🌐 Scraping: ${analysisResult.url}`);

      // Create a new tab for scraping
      const tab = await chrome.tabs.create({ 
        url: analysisResult.url, 
        active: false 
      });

      // Wait for page to load
      await this.waitForTabLoad(tab.id);

      // Inject content script and extract data
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: this.extractPageContent,
        args: [analysisResult.selectors]
      });

      // Close the scraping tab
      await chrome.tabs.remove(tab.id);

      return {
        url: analysisResult.url,
        strategy: analysisResult.scraping_strategy,
        html: results[0].result.html,
        data: results[0].result.data
      };

    } catch (error) {
      console.error('❌ Scraping failed:', error);
      throw new Error(`Scraping failed: ${error.message}`);
    }
  }

  // Wait for tab to finish loading
  waitForTabLoad(tabId) {
    return new Promise((resolve) => {
      const listener = (changedTabId, changeInfo) => {
        if (changedTabId === tabId && changeInfo.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          // Additional wait for dynamic content
          setTimeout(resolve, 2000);
        }
      };
      chrome.tabs.onUpdated.addListener(listener);
    });
  }

  // Content extraction function (injected into target page)
  extractPageContent(selectors) {
    try {
      const data = [];
      const elements = document.querySelectorAll(selectors.primary);
      
      elements.forEach((element, index) => {
        if (index >= 20) return; // Limit to first 20 results
        
        const item = {
          title: element.querySelector('h3, h2, h1, .title, [title]')?.textContent?.trim() || 'No title',
          price: element.querySelector(selectors.secondary)?.textContent?.trim() || 'Price not found',
          link: element.querySelector('a')?.href || '',
          description: element.querySelector('.description, p')?.textContent?.trim()?.substring(0, 200) || '',
          rating: element.querySelector('.rating, .stars, [data-rating]')?.textContent?.trim() || 'No rating'
        };
        
        data.push(item);
      });

      return {
        html: document.documentElement.outerHTML.substring(0, 50000), // Limit HTML size
        data: data,
        timestamp: Date.now(),
        url: window.location.href
      };
    } catch (error) {
      return {
        html: '',
        data: [],
        error: error.message,
        timestamp: Date.now(),
        url: window.location.href
      };
    }
  }

  // Extract and structure data using Gemma 3
  async extractDataWithGemma(scrapingResult) {
    try {
      // If we already have structured data from scraping, enhance it with Gemma
      if (scrapingResult.data && scrapingResult.data.length > 0) {
        return {
          success: true,
          source: 'direct_scraping',
          url: scrapingResult.url,
          strategy: scrapingResult.strategy,
          extracted_data: scrapingResult.data,
          total_results: scrapingResult.data.length,
          timestamp: Date.now()
        };
      }

      // If no structured data, try Gemma extraction
      const prompt = DATA_EXTRACTOR_PROMPT
        .replace('{HTML_CONTENT}', scrapingResult.html.substring(0, 10000)); // Limit HTML size for Gemma

      const response = await fetch(GEMMA_API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: GEMMA_MODEL,
          prompt: prompt,
          stream: false,
          options: {
            temperature: 0.1,
            top_p: 0.9,
            max_tokens: 1000
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Gemma extraction error: ${response.status}`);
      }

      const data = await response.json();
      const extractionText = data.response || data.text || '';
      
      // Parse JSON response from Gemma
      const jsonMatch = extractionText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No valid JSON found in Gemma response');
      }

      const extractedData = JSON.parse(jsonMatch[0]);
      
      return {
        success: true,
        source: 'gemma_extraction',
        ...extractedData,
        timestamp: Date.now()
      };

    } catch (error) {
      console.warn('⚠️ Gemma extraction failed:', error);
      
      // Return raw scraping result as fallback
      return {
        success: false,
        source: 'fallback',
        url: scrapingResult.url,
        strategy: scrapingResult.strategy,
        extracted_data: scrapingResult.data || [],
        total_results: scrapingResult.data?.length || 0,
        error: error.message,
        timestamp: Date.now()
      };
    }
  }
}

// Initialize the orchestrator
const orchestrator = new WebScrapingOrchestrator();

// Chrome extension event listeners
chrome.runtime.onInstalled.addListener((details) => {
  console.log('🔧 Extension installed/updated:', details.reason);
  orchestrator.initialize();
});

chrome.runtime.onStartup.addListener(() => {
  console.log('🚀 Extension startup');
  orchestrator.initialize();
});

// Service worker keep-alive
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // This will keep the service worker alive during processing
  return true;
});

// Export for testing (if needed)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { WebScrapingOrchestrator, URL_TEMPLATES };
}