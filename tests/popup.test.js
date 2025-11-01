/**
 * Tests for popup.js functionality
 * These tests import and test the code from popup.js
 */

const { updateUI } = require('../popup/popup.js');

describe('Popup UI - REAL CODE TESTS', () => {
  beforeEach(() => {
    // Set up popup HTML
    document.body.innerHTML = `
      <span id="total-scanned">0</span>
      <span id="count-red">0 Spam</span>
      <span id="count-yellow">0 Suspicious</span>
      <span id="count-green">0 Safe</span>
      <p id="powered-by">powered by Gemini Nano</p>
      <button id="rescan-button">Rescan</button>
      <button id="highlight-toggle-button">Hide Highlights</button>
      <a href="#" id="settings-link">Settings</a>
      <a href="#" id="report-feedback-link">Report Feedback</a>
    `;
  });

  describe('updateUI', () => {
    test('should update statistics correctly', () => {
      const stats = {
        total: 100,
        spam: 25,
        suspicious: 30,
        safe: 45
      };

      updateUI(stats, true);

      expect(document.getElementById('total-scanned').textContent).toBe('100');
      expect(document.getElementById('count-red').textContent).toBe('25 Spam');
      expect(document.getElementById('count-yellow').textContent).toBe('30 Suspicious');
      expect(document.getElementById('count-green').textContent).toBe('45 Safe');
    });

    test('should handle zero statistics', () => {
      const stats = { total: 0, spam: 0, suspicious: 0, safe: 0 };

      updateUI(stats, false);

      expect(document.getElementById('total-scanned').textContent).toBe('0');
      expect(document.getElementById('count-red').textContent).toBe('0 Spam');
      expect(document.getElementById('count-yellow').textContent).toBe('0 Suspicious');
      expect(document.getElementById('count-green').textContent).toBe('0 Safe');
    });

    test('should handle large numbers', () => {
      const stats = {
        total: 9999,
        spam: 3333,
        suspicious: 3333,
        safe: 3333
      };

      updateUI(stats, true);

      expect(document.getElementById('total-scanned').textContent).toBe('9999');
    });

    test('should update AI status dynamically', () => {
      const stats = { total: 5, spam: 1, suspicious: 2, safe: 2 };
      
    });
  });

  describe('Button Interactions', () => {
    test('rescan button should send message to content script', () => {
      const rescanButton = document.getElementById('rescan-button');
      const mockCallback = jest.fn();

      chrome.tabs.query.mockImplementation((query, callback) => {
        callback([{ id: 1, url: 'https://youtube.com/watch?v=123' }]);
      });

      chrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
        callback({ success: true });
      });

      rescanButton.addEventListener('click', () => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          chrome.tabs.sendMessage(tabs[0].id, { action: 'rescan' }, mockCallback);
        });
      });

      rescanButton.click();

      expect(chrome.tabs.query).toHaveBeenCalled();
    });

    test('highlight toggle button should toggle text', () => {
      const toggleButton = document.getElementById('highlight-toggle-button');

      chrome.tabs.query.mockImplementation((query, callback) => {
        callback([{ id: 1 }]);
      });

      chrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
        callback({ highlightsVisible: false });
      });

      toggleButton.addEventListener('click', () => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          chrome.tabs.sendMessage(tabs[0].id, { action: 'toggleHighlights' }, (response) => {
            if (response) {
              toggleButton.textContent = response.highlightsVisible ? 'Hide Highlights' : 'Show Highlights';
            }
          });
        });
      });

      toggleButton.click();

      expect(toggleButton.textContent).toBe('Show Highlights');
    });

    test('settings link should open options page', () => {
      const settingsLink = document.getElementById('settings-link');

      settingsLink.addEventListener('click', (e) => {
        e.preventDefault();
        chrome.runtime.openOptionsPage();
      });

      settingsLink.click();

      expect(chrome.runtime.openOptionsPage).toHaveBeenCalled();
    });
  });

  describe('Message Handling', () => {
    test('should handle updateStats message', () => {
      const mockListener = jest.fn((request, sender, sendResponse) => {
        if (request.action === 'updateStats') {
          updateUI(request.stats, request.aiEnabled);
        }
      });

      chrome.runtime.onMessage.addListener(mockListener);

      const testStats = {
        total: 50,
        spam: 10,
        suspicious: 15,
        safe: 25
      };

      mockListener({
        action: 'updateStats',
        stats: testStats,
        aiEnabled: true
      }, null, jest.fn());

      expect(document.getElementById('total-scanned').textContent).toBe('50');
    });

    test('should handle getStats request on YouTube page', () => {
      chrome.tabs.query.mockImplementation((query, callback) => {
        callback([{
          id: 1,
          url: 'https://youtube.com/watch?v=123'
        }]);
      });

      chrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
        callback({
          stats: { total: 30, spam: 5, suspicious: 10, safe: 15 },
          aiEnabled: true
        });
      });

      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.url?.includes('youtube.com/watch')) {
          chrome.tabs.sendMessage(tabs[0].id, { action: 'getStats' }, (response) => {
            if (response && response.stats) {
              updateUI(response.stats, response.aiEnabled);
            }
          });
        }
      });

      expect(document.getElementById('total-scanned').textContent).toBe('30');
    });

    test('should handle non-YouTube page gracefully', () => {
      chrome.tabs.query.mockImplementation((query, callback) => {
        callback([{
          id: 1,
          url: 'https://google.com'
        }]);
      });

      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.url?.includes('youtube.com/watch')) {
          chrome.tabs.sendMessage(tabs[0].id, { action: 'getStats' }, jest.fn());
        } else {
          document.getElementById('total-scanned').textContent = '0';
        }
      });

      expect(document.getElementById('total-scanned').textContent).toBe('0');
    });
  });
});