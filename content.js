// Spam detection keywords
const SPAM_KEYWORDS = {
  high: [
    'vitali',
  ],
  medium: [
    'buy now', 'click here', 'free money', 'make money fast', 'earn cash',
    'get rich', 'claim your prize', 'limited time offer',
    'act now', 'subscribe to my channel', 'check out my channel', 'sub4sub',
    'onlyfans', 'telegram', 'whatsapp me', 'dm me', 'text me at',
    'check out', 'visit my', 'link in bio', 'click link', 'follow me',
    'thanks for sharing', 'great info', 'nice video', 'awesome content',
    'check my channel', 'new video', 'subscribe', 'sub back'
  ]
};

// Classify comment based on keywords (TIER 1: Fast pre-filter)
function classifyByKeywords(text) {
  const lowerText = text.toLowerCase();

  // Check high-risk keywords
  for (const keyword of SPAM_KEYWORDS.high) {
    if (lowerText.includes(keyword)) {
      return 'spam';
    }
  }

  // Check medium-risk keywords
  for (const keyword of SPAM_KEYWORDS.medium) {
    if (lowerText.includes(keyword)) {
      return 'suspicious';
    }
  }

  return 'safe';
}

// Classify comment using AI (for suspicious cases only)
async function classifyWithAI(text, aiSession, aiAvailable) {
  if (!aiSession || !aiAvailable) {
    return 'suspicious'; // Fallback if AI unavailable
  }

  try {
    console.log(`Spamurai: Sending to AI: "${text.substring(0, 60)}..."`);
    
    const result = await aiSession.prompt(
      `Is this YouTube comment on its on spam?\n\nComment: "${text}"\n\nAnswer:`
    );

    const response = result.toLowerCase().trim();
    
    // Log the raw AI response
    console.log(`Spamurai: Raw AI response: "${response}"`);

    // Parse AI response
    if (response.includes('spam')) {
      console.log(`Spamurai: AI classified as SPAM`);
      return 'spam';
    } else if (response.includes('safe')) {
      console.log(`Spamurai: AI classified as SAFE`);
      return 'safe';
    } else {
      console.log(`Spamurai: AI response unclear, defaulting to SUSPICIOUS`);
      return 'suspicious'; // Unclear response
    }

  } catch (error) {
    console.log('Spamurai: AI classification error:', error);
    return 'suspicious'; // Fallback on error
  }
}

// Hybrid classification: Keywords + AI
async function classifyComment(text, aiSession, aiAvailable) {
  // TIER 1: Fast keyword check
  const keywordResult = classifyByKeywords(text);

  // If obviously spam or safe, return immediately
  if (keywordResult === 'spam' || keywordResult === 'safe') {
    return { classification: keywordResult, usedAI: false };
  }

  // TIER 2: Use AI for ambiguous "suspicious" cases
  if (keywordResult === 'suspicious' && aiAvailable) {
    const aiResult = await classifyWithAI(text, aiSession, aiAvailable);
    return { classification: aiResult, usedAI: true };
  }

  // Fallback: No AI available
  return { classification: 'suspicious', usedAI: false };
}

// ============================================
// UTILITY FUNCTIONS (Testable)
// ============================================

// Extract video ID from URL
function getVideoId(url) {
  // Only process YouTube URLs - anchor to start and check for proper domain boundaries
  if (!url.match(/^(?:https?:\/\/)?(?:(?:www|m|music)\.)?(?:youtube\.com|youtu\.be)(?:\/|$|\?|#)/)) {
    return null;
  }
  // Match regular video
  let match = url.match(/[?&]v=([a-zA-Z0-9_-]{11})(?:[&\s#]|$)/);
  if (match) return match[1];

  // Match Shorts
  match = url.match(/\/shorts\/([a-zA-Z0-9_-]{11})/);
  if (match) return match[1];

  return null;
}
// Check if URL is a Shorts video
function isShorts(url) {
  return url.includes('/shorts/');
}

// Get comment section selectors based on video type
function getCommentSectionSelectors(isShortsVideo) {
  if (isShortsVideo) {
    return [
      'ytd-comments#comments',
      'ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-comments-section"]',
      '#comments'
    ];
  } else {
    return [
      'ytd-item-section-renderer#sections',
      'ytd-comments#comments'
    ];
  }
}

// Find comment section in DOM
function findCommentSection(url) {
  const shorts = isShorts(url);
  const selectors = getCommentSectionSelectors(shorts);

  for (const selector of selectors) {
    const section = document.querySelector(selector);
    if (section) return section;
  }

  return null;
}

// Export for testing (only in test environment)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    SPAM_KEYWORDS,
    classifyByKeywords,
    classifyWithAI,
    classifyComment,
    getVideoId,
    isShorts,
    getCommentSectionSelectors,
    findCommentSection
  };
}

// ============================================
// BROWSER-ONLY CODE (Content Script)
// ============================================

// Only run in browser context
if (typeof chrome !== 'undefined' && chrome.runtime) {
  // Track analyzed comments - use Set for faster lookups
  const analyzedComments = new Map(); // commentText -> { classification, element }
  let suspiciousComments = []; // Comments waiting for AI analysis
  let stats = { total: 0, spam: 0, suspicious: 0, safe: 0 };
  let highlightsVisible = true;
  let aiSession = null;
  let aiAvailable = false;
  let analysisTimeout;
  let isProcessingAI = false; // Prevent duplicate AI processing

  // Initialize AI session (non-blocking)
  async function initAI() {
    try {
      // Check if the API exists
      if (typeof LanguageModel === 'undefined') {
        console.log('Spamurai: LanguageModel API not available');
        return false;
      }

      // Check availability
      const availability = await LanguageModel.availability();
      console.log('Spamurai: AI availability:', availability);

      if (availability === 'no') {
        console.log('Spamurai: Gemini Nano not available on this device');
        return false;
      }

      if (availability === 'after-download') {
        console.log('Spamurai: Gemini Nano model needs to be downloaded');
        console.log('Visit chrome://components/ and update "Optimization Guide On Device Model"');
        return false;
      }

      // Create AI session with spam detection prompt
      aiSession = await LanguageModel.create({
        initialPrompts: [
          {
            role: 'system',
            content: `Detect scam indicators in YouTube comment section. Check for: pressure/urgency, fake testimonial followed by a product or person's name, vague/unrealistic promises, requests for sensitive data, false crypto claims, specific trader names, robotic tone. Respond with only: "spam" or "safe"`
          }
        ],
        expectedInputs: [
          { type: "text", languages: ["en"] }
        ],
        expectedOutputs: [
          { type: "text", languages: ["en"] }
        ]
      });

      aiAvailable = true;
      console.log('Spamurai: AI classification enabled!');
      return true;

    } catch (error) {
      console.log('Spamurai: AI initialization failed:', error.message);
      return false;
    }
  }

  // Highlight comment based on classification
  function highlightComment(threadElement, classification) {
    if (!highlightsVisible) return;

    // Target the main comment body container
    const commentBody = threadElement.querySelector('#body') ||
                        threadElement.querySelector('#comment') ||
                        threadElement;

    if (!commentBody) return;

    // Remove existing highlights
    commentBody.style.borderLeft = '';
    commentBody.style.backgroundColor = '';
    commentBody.style.paddingLeft = '';

    // Apply new highlight - using left border
    switch (classification) {
      case 'spam':
        commentBody.style.borderLeft = '4px solid #f05247';
        commentBody.style.backgroundColor = 'rgba(240, 82, 71, 0.05)';
        commentBody.style.paddingLeft = '12px';
        break;
      case 'suspicious':
        commentBody.style.borderLeft = '4px solid rgb(206, 206, 24)';
        commentBody.style.backgroundColor = 'rgba(206, 206, 24, 0.05)';
        commentBody.style.paddingLeft = '12px';
        break;
      case 'safe':
        // No highlight for safe comments
        break;
    }
  }

  // Remove all highlights
  function removeAllHighlights() {
    const threads = document.querySelectorAll('ytd-comment-thread-renderer');
    threads.forEach(thread => {
      const commentBody = thread.querySelector('#body') ||
                          thread.querySelector('#comment') ||
                          thread;
      if (commentBody) {
        commentBody.style.borderLeft = '';
        commentBody.style.backgroundColor = '';
        commentBody.style.paddingLeft = '';
      }
    });
  }

  // Analyze comments with instant keyword detection
  async function analyzeComments() {
    const threads = document.querySelectorAll('ytd-comment-thread-renderer');
    console.log(`Spamurai: Found ${threads.length} comment threads`);
    let newSuspicious = [];

    for (const thread of threads) {
        const commentEl = thread.querySelector('#content-text');
        const text = commentEl ? commentEl.textContent.trim() : null;
  
        // Skip empty/null comments
        if (!text) continue;
        
        console.log(`Spamurai: Analyzing comment: "${text.substring(0, 60)}..."`);

      // Skip if already analyzed
      if (analyzedComments.has(text)) {
        const existing = analyzedComments.get(text);
        // Re-apply highlight if needed
        highlightComment(thread, existing.classification);
        continue;
      }

      // INSTANT keyword classification (no await, no AI yet)
      const keywordResult = classifyByKeywords(text);
      console.log(`Spamurai: Keyword classification = ${keywordResult}`);

      // Store with element reference
      analyzedComments.set(text, {
        classification: keywordResult,
        element: thread,
        text: text
      });

      // Update stats immediately
      stats.total++;
      stats[keywordResult]++;

      // Apply highlight IMMEDIATELY for spam and safe
      if (keywordResult === 'spam' || keywordResult === 'safe') {
        highlightComment(thread, keywordResult);
      } else if (keywordResult === 'suspicious') {
        // Apply suspicious highlight immediately
        console.log(`Spamurai: Comment marked SUSPICIOUS - queuing for AI`);
        highlightComment(thread, 'suspicious');
        // Queue for AI refinement
        if (aiAvailable || aiSession) {
          newSuspicious.push({ text, thread });
          console.log(`Spamurai: AI available = ${aiAvailable}, adding to queue`);
        } else {
          console.log(`Spamurai: AI not available (aiSession=${!!aiSession}, aiAvailable=${aiAvailable})`);
        }
      }
    }

    // Add new suspicious comments to queue
    if (newSuspicious.length > 0) {
      console.log(`Spamurai: ${newSuspicious.length} new suspicious comments to process with AI`);
      suspiciousComments = [...suspiciousComments, ...newSuspicious];
      // Process AI in background without blocking
      processSuspiciousWithAI();
    } else {
      console.log(`Spamurai: No suspicious comments found in this batch`);
    }

    // Send stats to popup immediately
    updatePopupStats();
  }

  // Process suspicious comments with AI in parallel batches
  async function processSuspiciousWithAI() {
    // Prevent duplicate processing
    if (isProcessingAI || !aiAvailable || suspiciousComments.length === 0) {
      return;
    }

    isProcessingAI = true;

    // Process in batches of 5 for better performance
    const BATCH_SIZE = 5;

    while (suspiciousComments.length > 0) {
      const batch = suspiciousComments.splice(0, BATCH_SIZE);

      // Process batch in parallel
      await Promise.all(batch.map(async ({ text, thread }) => {
        try {
          const aiResult = await classifyWithAI(text, aiSession, aiAvailable);

          // Update stored classification
          const stored = analyzedComments.get(text);
          if (stored) {
            // Update stats (remove old, add new)
            stats[stored.classification]--;
            stats[aiResult]++;

            stored.classification = aiResult;

            // Update highlight
            highlightComment(thread, aiResult);

            console.log(`Spamurai AI: "${text.substring(0, 50)}..." → ${aiResult}`);
          }
        } catch (error) {
          console.log('Spamurai: AI error for comment:', error);
        }
      }));

      // Update popup after each batch
      updatePopupStats();

      // Small delay between batches to avoid overwhelming
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    isProcessingAI = false;
  }

  // Re-analyze suspicious comments when AI becomes available
  async function reanalyzeSuspiciousComments() {
    // Find all suspicious comments
    suspiciousComments = [];

    for (const [text, data] of analyzedComments.entries()) {
      if (data.classification === 'suspicious' && data.element) {
        suspiciousComments.push({ text, thread: data.element });
      }
    }

    if (suspiciousComments.length > 0) {
      console.log(`Spamurai: Re-analyzing ${suspiciousComments.length} suspicious comments with AI`);
      await processSuspiciousWithAI();
    }
  }

  // Update popup with current stats
  function updatePopupStats() {
    try {
      chrome.runtime.sendMessage({
        action: 'updateStats',
        stats: stats,
        aiEnabled: aiAvailable
      });
    } catch (error) {
      // Extension context invalidated - happens when extension reloads
      // Silently ignore, will reinitialize on page refresh
    }
  }

  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getStats') {
      sendResponse({ stats: stats, aiEnabled: aiAvailable });
    } else if (request.action === 'rescan') {
      // Reset everything
      analyzedComments.clear();
      suspiciousComments = [];
      stats = { total: 0, spam: 0, suspicious: 0, safe: 0 };
      removeAllHighlights();
      analyzeComments().then(() => {
        sendResponse({ success: true });
      });
      return true; // Keep channel open for async response
    } else if (request.action === 'toggleHighlights') {
      highlightsVisible = !highlightsVisible;
      if (highlightsVisible) {
        analyzeComments(); // Re-apply highlights
      } else {
        removeAllHighlights();
      }
      sendResponse({ highlightsVisible: highlightsVisible });
    }
    return true;
  });

  // Watch for new comments
  let spamuraiObserver = null;

  function observeComments() {
    // Use the utility function to find comment section
    const commentSection = findCommentSection(window.location.href);

    if (!commentSection) {
      const shorts = isShorts(window.location.href);
      console.log(`Spamurai: Comment section not loaded yet (${shorts ? 'Shorts' : 'Video'}), retrying...`);
      // 500ms retry
      setTimeout(observeComments, 500);
      return;
    }

    const shorts = isShorts(window.location.href);
    console.log(`Spamurai: Found comment section for ${shorts ? 'Shorts' : 'Video'}`);

    // Initial scan
    analyzeComments();

    // Clear any previous observer
    if (spamuraiObserver) {
      spamuraiObserver.disconnect();
    }

    // Watch for changes
    spamuraiObserver = new MutationObserver(() => {
      clearTimeout(analysisTimeout);
      analysisTimeout = setTimeout(() => {
        analyzeComments();
      }, 300); // Reduced from 400ms
    });

    spamuraiObserver.observe(commentSection, { childList: true, subtree: true });
    console.log('Spamurai: Continuous spam detection active');
  }

  // Start observing, AI loads in parallel
  observeComments();

  // Initialize AI in background - re-analyze suspicious when ready
  initAI().then(() => {
    if (aiAvailable) {
      console.log('Spamurai: AI ready, re-analyzing suspicious comments');
      reanalyzeSuspiciousComments();
    }
  });

  // Track current video
  let currentVideoId = getVideoId(location.href);

  // Listen to YouTube's native navigation event
  window.addEventListener('yt-navigate-finish', () => {
    const newVideoId = getVideoId(location.href);

    // Only reset if switching to a different video
    if (newVideoId && newVideoId !== currentVideoId) {
      currentVideoId = newVideoId;
      console.log('Spamurai: New video detected:', newVideoId);

      // Reset stats for new video
      analyzedComments.clear();
      suspiciousComments = [];
      stats = { total: 0, spam: 0, suspicious: 0, safe: 0 };
      removeAllHighlights();

      // Restart observation (wait for comments to load)
      setTimeout(() => {
        observeComments();
      }, 400);
    }
  }, true);

  // Periodic re-scan every 3s
  setInterval(() => {
    analyzeComments();
  }, 3000);
}