# 🔍 Smart Web Scraper with Gemma 3

An intelligent Chrome extension that leverages Gemma 3 AI to perform smart web scraping with real-time data extraction from various websites.

## 🚀 Features

### Core Functionality
- **AI-Powered Analysis**: Uses Gemma 3 to intelligently determine target websites and extraction strategies
- **Real Web Scraping**: Performs actual data extraction from live websites
- **Multi-Site Support**: Built-in support for Amazon, Google Flights, Zomato, Swiggy, Flipkart, and more
- **Context Menu Integration**: Right-click on selected text to scrape related content
- **Smart Caching**: Intelligent result caching to improve performance
- **Rate Limiting**: Built-in protection against excessive requests

### User Interface
- **Modern Popup Interface**: Beautiful, responsive design with real-time status indicators
- **Quick Actions**: One-click buttons for common searches (laptops, flights, restaurants, mobiles)
- **Loading Animations**: Informative progress indicators during scraping operations
- **Settings Panel**: Configurable Gemma endpoint, model selection, and caching options
- **Results Display**: Clean, organized presentation of scraped data

### Advanced Features
- **Element Highlighting**: Visual feedback showing which elements are being scraped
- **Visual Selection Tool**: Click and drag to select specific page areas for scraping
- **Structured Data Extraction**: Automatic detection of prices, ratings, titles, and links
- **Page Change Detection**: Automatic cleanup when pages change (SPA support)
- **Keyboard Shortcuts**: Efficient navigation with keyboard controls

## 📋 Prerequisites

### Required Software
1. **Google Chrome** (or Chromium-based browser)
2. **Ollama** with Gemma 3 model
3. **Node.js** (for development/testing - optional)

### Gemma 3 Setup
```bash
# Install Ollama (if not already installed)
curl -fsSL https://ollama.ai/install.sh | sh

# Pull Gemma 3 model
ollama pull gemma2:3b

# Start Ollama server
ollama serve
```

The Gemma API should be accessible at `http://localhost:11434/api/generate`

### Quick Setup Verification
```bash
# 1. Check if Ollama is running
curl http://localhost:11434/api/tags

# 2. If not running, start Ollama
ollama serve

# 3. Check available models
ollama list

# 4. If gemma2:3b not found, install it
ollama pull gemma2:3b

# 5. Test generate API
curl http://localhost:11434/api/generate -d '{
  "model": "gemma2:3b",
  "prompt": "Hello",
  "stream": false
}'
```

## 🛠️ Installation

### Method 1: Load Unpacked Extension (Development)
1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension directory
5. The extension icon should appear in your toolbar

### Method 2: Production Installation
1. Package the extension into a `.crx` file
2. Install via Chrome Web Store (when published)

## ⚙️ Configuration

### Initial Setup
1. Click the extension icon to open the popup
2. Click "Settings" to configure:
   - **Gemma API Endpoint**: Default is `http://localhost:11434/api/generate`
   - **Gemma Model**: Default is `gemma2:3b`
   - **Max Results**: Number of results to display (5-50)
   - **Enable Cache**: Toggle result caching on/off

### Status Indicators
- **🟢 Connected**: Gemma 3 is accessible and working
- **🟡 Connecting**: Testing connection to Gemma
- **🔴 Offline**: Cannot connect to Gemma (check if Ollama is running)

## 🎯 Usage Examples

### Basic Search
1. Click the extension icon
2. Enter a search query like:
   - "gaming laptop under 80000"
   - "flights to Mumbai"
   - "restaurants near me"
   - "phone under 25000"
3. Click "Search" or press Enter
4. View extracted results with prices, ratings, and links

### Quick Actions
Use the predefined buttons for common searches:
- 💻 Gaming Laptops
- ✈️ Flights
- 🍽️ Restaurants  
- 📱 Mobiles

### Context Menu Scraping
1. Select text on any webpage
2. Right-click and choose "Smart Scrape: [selected text]"
3. Results will open in the extension popup

### Visual Selection Tool
1. Open the extension popup
2. Click on a page element to activate selection mode
3. Drag to select specific areas of the page
4. Release to scrape selected elements

## 🏗️ Technical Architecture

### File Structure
```
smart-web-scraper/
├── manifest.json          # Extension configuration
├── background.js          # Main orchestration logic
├── popup.html            # Popup interface
├── popup.css             # Popup styling
├── popup.js              # Popup functionality
├── content.js            # Page interaction script
├── icons/                # Extension icons
└── README.md            # This file
```

### Key Components

#### Background Script (`background.js`)
- **WebScrapingOrchestrator**: Main class handling all scraping operations
- **Gemma Integration**: Direct communication with Gemma 3 API
- **Query Analysis**: AI-powered determination of scraping targets
- **Data Extraction**: Real web scraping with fallback mechanisms
- **Cache Management**: Intelligent result caching and rate limiting

#### Content Script (`content.js`)
- **Element Highlighting**: Visual feedback for scraped elements
- **Selection Tools**: Interactive page selection capabilities
- **Data Extraction**: Page-level data extraction helpers
- **Structured Data Detection**: Automatic identification of common data patterns

#### Popup Interface (`popup.html`, `popup.css`, `popup.js`)
- **Modern UI**: Responsive design with gradient styling
- **Real-time Status**: Live connection monitoring
- **Settings Management**: User configuration interface
- **Results Display**: Clean presentation of scraped data

## 🔧 Supported Websites

### E-commerce
- **Amazon India**: Product searches, prices, ratings
- **Flipkart**: Product listings and details
- **Myntra**: Fashion and lifestyle products

### Travel
- **Google Flights**: Flight search and pricing
- **General travel sites**: Via intelligent analysis

### Food & Restaurants
- **Zomato**: Restaurant search and ratings
- **Swiggy**: Food delivery options

### General
- **Google Search**: Fallback for general queries
- **Any website**: Via intelligent selector detection

## 🚨 Troubleshooting

### Common Issues

#### Extension Not Working
- Check if Ollama is running: `ollama serve`
- Verify Gemma model is installed: `ollama list`
- Check Chrome console for errors (F12 → Console)

#### No Results Found
- Try different search terms
- Check if the target website is responsive
- Clear cache and try again
- Verify internet connection

#### Gemma Connection Failed
- Ensure Ollama is running on port 11434: `ollama serve`
- Check if the model is installed: `ollama list`
- If model not found, install it: `ollama pull gemma2:3b`
- Check firewall settings
- Try restarting Ollama service
- Verify API endpoint in settings
- Test manually with: `curl http://localhost:11434/api/tags`

#### Slow Performance
- Enable caching in settings
- Reduce max results limit
- Check network connection
- Clear browser cache

### Debug Mode
Enable Chrome developer tools and check:
- Extension console: `chrome://extensions` → Details → Inspect views
- Background page logs for detailed error information
- Network tab for API call failures

## 🛡️ Privacy & Security

### Data Protection
- **No Data Storage**: Extension doesn't store personal data
- **Local Processing**: All AI processing via local Ollama
- **No Tracking**: No analytics or user tracking
- **Secure Communication**: HTTPS for all external requests

### Permissions Explained
- `activeTab`: Access current tab for scraping
- `tabs`: Create hidden tabs for scraping
- `scripting`: Inject content scripts
- `contextMenus`: Right-click menu integration
- `storage`: Save user settings locally
- `host_permissions`: Access websites for scraping

## 🤝 Contributing

### Development Setup
```bash
# Clone repository
git clone <repository-url>
cd smart-web-scraper

# Install development dependencies (optional)
npm install

# Load extension in Chrome for testing
# chrome://extensions → Developer mode → Load unpacked
```

### Adding New Websites
1. Update `URL_TEMPLATES` in `background.js`
2. Add website detection logic in `fallbackAnalysis()`
3. Create appropriate CSS selectors for data extraction
4. Test with various queries and edge cases

### Code Style
- Use ES6+ features and async/await
- Follow Chrome extension best practices
- Add comprehensive error handling
- Include detailed comments for complex logic

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- **Gemma 3**: Google's advanced language model
- **Ollama**: Local LLM serving platform
- **Chrome Extensions API**: Powerful browser integration capabilities

## 📞 Support

For issues, feature requests, or questions:
1. Check the troubleshooting section above
2. Search existing issues in the repository
3. Create a new issue with detailed information
4. Include browser version, OS, and error messages

---

**Happy Scraping! 🕷️✨**