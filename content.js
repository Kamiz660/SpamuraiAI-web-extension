// Spam detection keywords
const SPAM_KEYWORDS = {
  highOverride: [
    'vitalii', 'Norman vitalii', 'Luna Rivers', 'Manifest the Unseen',
  ],// keywords that always override AI
  high: [
    'click here', 'subscribe to my channel', 'check out my channel', 'sub4sub',
    'whatsapp me', 'dm me', 'text me at','check out my video',
    'click link', 'check out my new video', 'vitalii', 'Buy crypto now!',
  ],
  medium: [
    'visit my', 'link in bio', 'click link', 'follow me',
    'sub back', 'bitcoin', 'crypto', 'discount code', 'giveaway',
    'free trial', 'work from home', 'side hustle', 'online job',
    'subscribe for updates','check out my similar content',
    'money investing for me'
  ]
};

// Classify comment based on keywords (TIER 1: Fast pre-filter)
function classifyByKeywords(text) {
  const lowerText = text.toLowerCase();

  // Check high-risk keywords
  for (const keyword of SPAM_KEYWORDS.high) {
    if (lowerText.includes(keyword.toLowerCase())) {  // ✅ FIXED
      return 'spam';
    }
  }
  
  // Check medium-risk keywords  
  for (const keyword of SPAM_KEYWORDS.medium) {
    if (lowerText.includes(keyword.toLowerCase())) {  // ✅ FIXED
      return 'suspicious';
    }
  }

  return 'safe';
}
// Check for high override keywords (always spam)
function isHighOverride(text) {
  const lowerText = text.toLowerCase();
  for (const keyword of SPAM_KEYWORDS.highOverride) {
    if (lowerText.includes(keyword.toLowerCase())) {
      return true;
    }
  }
  return false;
}


// Classify comment using AI (for suspicious cases only)
async function classifyWithAI(text, aiSession, aiAvailable) {
  if (!aiSession || !aiAvailable) {
    return 'suspicious'; // Fallback if AI unavailable
  }

  try {
    const result = await aiSession.prompt(
      `Using the spam-detection guidelines already provided, classify the following YouTube comment as either "spam" or "safe" \n\nComment: "${text}"\n\nAnswer:`
    );

    const response = result.toLowerCase().trim();

    // Parse AI response
    if (response.includes('spam')) {
      return 'spam';
    } else if (response.includes('safe')) {
      return 'safe';
    } else {
      return 'suspicious'; // Unclear response
    }

  } catch (error) {
    console.log('Spamurai: AI classification error:', error);
    return 'suspicious'; // Fallback on error
  }
}

// Hybrid classification: Keywords + AI
async function classifyComment(text, aiSession, aiAvailable) {
  // Check if this is an override keyword
  if (isHighOverride(text)) {
    return { classification: 'spam', usedAI: false }; // Always spam, never rewritten by AI
  }

  // TIER 1: Fast keyword check
  const keywordResult = classifyByKeywords(text);

  // If spam or safe, now uses AI for everything that's NOT override
  if ((keywordResult === 'spam' || keywordResult === 'suspicious') && aiAvailable) {
    // Ask AI to rewrite
    const aiResult = await classifyWithAI(text, aiSession, aiAvailable);
    return { classification: aiResult, usedAI: true };
  }

  // For 'safe' (and when no AI), fallback to keywordResult
  return { classification: keywordResult, usedAI: false };
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
  
//ignore: unused edit
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
        console.log(typeof LanguageModel);
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
        console.log('Spamurai: Gemini Nano model needs to be downloaded check readme for instruction https://github.com/Kamiz660/SpamuraiAI-web-extension/tree/main');
        console.log('Visit chrome://components/ and update "Optimization Guide On Device Model"');
        return false;
      }

      // Create AI session with spam detection prompt
      aiSession = await LanguageModel.create({
             temperature: 0.1,
             topK: 3,   // low creativity for consistent classification
             initialPrompts: [
          {
            role: 'system',
            content: `You are a comment moderation model for YouTube.\n\nYour job is to classify comments as either 'spam' or 'safe'. Follow these rules strictly:\n\n1. Mark as **spam** only if the comment tries to persuade readers to buy, invest, or follow someone for profit.\n2. Do **not** mark as spam if the comment merely debates, predicts, or discusses markets, politics, or opinions.\n3. 
            Mark as **spam** if the comment:\n   - Promotes or sells a product, service, channel, or person (for example: 'thanks to Mr. X', 'contact me on Telegram', 'my mentor helped me earn money').\n   - Uses testimonials or fake stories 
            (for example: 'I made 10x returns after reading *Manifest the Unseen*').\n4. 
            If uncertain, always choose **safe**.\n\nExamples:\n- 'Crypto market is becoming bigger than Indian economy. 
            Future is blockchain and AI!' → safe\n- 'Right now, people all over the world are changing their lives with *Manifest the Unseen* by Luna Rivers' → spam\n\nOutput strictly one word: either 'spam' or 'safe'. No punctuation, no explanation.`
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
  
// Check if comment is from channel owner
function isChannelOwnerComment(threadElement) {
  // YouTube marks channel owner comments with special badges/attributes
  // Check for creator badge
  const creatorBadge = threadElement.querySelector('ytd-author-comment-badge-renderer[creator]');
  if (creatorBadge) return true;

  // Check for creator attribute on comment renderer
  const commentRenderer = threadElement.querySelector('ytd-comment-renderer[is-creator]');
  if (commentRenderer) return true;

  // Alternative: Check for "creator" class on badge
  const anyCreatorBadge = threadElement.querySelector('[class*="creator"]');
  if (anyCreatorBadge && anyCreatorBadge.closest('#author-comment-badge')) {
    return true;
  }

  return false;
}

  // Analyze comments with instant keyword detection
  async function analyzeComments() {
    const threads = document.querySelectorAll('ytd-comment-thread-renderer');
    let newSuspicious = [];

    for (const thread of threads) {
        // Skips channel owner comments
      if (isChannelOwnerComment(thread)) {
        continue;
      }
      const commentEl = thread.querySelector('#content-text');
      const text = commentEl ? commentEl.textContent.trim() : null;

      if (!text) continue;

      // Skip if already analyzed
      if (analyzedComments.has(text)) {
        const existing = analyzedComments.get(text);
        // Re-apply highlight if needed
        highlightComment(thread, existing.classification);
        continue;
      }

      // INSTANT keyword classification (no await, no AI yet)
      const keywordResult = classifyByKeywords(text);

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
        highlightComment(thread, 'suspicious');
        // Queue for AI refinement
        if (aiAvailable || aiSession) {
          newSuspicious.push({ text, thread });
        }
      }
    }

    // Add new suspicious comments to queue
    if (newSuspicious.length > 0) {
      suspiciousComments = [...suspiciousComments, ...newSuspicious];
      // Process AI in background without blocking
      processSuspiciousWithAI();
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
          const aiResult =  await classifyWithAI(text, aiSession, aiAvailable);

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
 let runs = 0;
 const id = setInterval(() => {
  analyzeComments();
  runs++;
  if (runs >= 2) clearInterval(id);
}, 3000);

}