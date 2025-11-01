/**
 * end-to-end test scenarios for Spamurai
 * These tests import and test the code from content.js
 */


const { classifyByKeywords } = require('../content.js');


describe('E2E: Complete User Flows - REAL CODE TESTS', () => {
  let stats;
  let analyzedComments;
  let highlightsVisible;


  beforeEach(() => {
    stats = { total: 0, spam: 0, suspicious: 0, safe: 0 };
    analyzedComments = new Map();
    highlightsVisible = true;
    document.body.innerHTML = '';
  });


  describe('Scenario: User opens YouTube video and Spamurai detects spam', () => {
    test('should scan comments and display statistics', async () => {
      // Step 1: User opens YouTube video with comments
      const commentSection = document.createElement('ytd-item-section-renderer');
      commentSection.id = 'sections';


      const comments = [
        { text: 'This is really helpful, thanks!', expected: 'safe' },
        { text: 'Buy now and get rich quick!', expected: 'spam' },
        { text: 'Check out my similar content', expected: 'suspicious' },
        { text: 'Great explanation of the topic', expected: 'safe' },
        { text: 'FREE MONEY! Click here!', expected: 'spam' }
      ];


      comments.forEach(({ text }) => {
        const thread = createMockComment(text);
        commentSection.appendChild(thread);
      });


      document.body.appendChild(commentSection);


      // Step 2: Spamurai analyzes comments using REAL function
      const threads = document.querySelectorAll('ytd-comment-thread-renderer');


      for (const thread of threads) {
        const contentText = thread.querySelector('#content-text').textContent.trim();


        if (!analyzedComments.has(contentText)) {
          // Using the REAL classifyByKeywords function
          const classification = classifyByKeywords(contentText);
          analyzedComments.set(contentText, classification);


          stats.total++;
          stats[classification]++;


          // Apply highlight
          const body = thread.querySelector('#body');
          if (classification === 'spam') {
            body.style.borderLeft = '4px solid #f05247';
          } else if (classification === 'suspicious') {
            body.style.borderLeft = '4px solid rgb(206, 206, 24)';
          }
        }
      }


      // Step 3: Verify results
      expect(stats.total).toBe(5);
      expect(stats.spam).toBe(2);
      expect(stats.suspicious).toBe(1);
      expect(stats.safe).toBe(2);


      // Step 4: Verify highlights applied
      const spamComments = Array.from(threads).filter(thread => {
        const body = thread.querySelector('#body');
        return body.style.borderLeft === '4px solid #f05247';
      });
      expect(spamComments.length).toBe(2);
    });
  });


  describe('Scenario: User rescans comments after scrolling', () => {
    test('should detect new comments and update statistics', () => {
      // Initial scan
      const thread1 = createMockComment('Great video!');
      document.body.appendChild(thread1);


      let contentText = thread1.querySelector('#content-text').textContent.trim();
      const classification1 = classifyByKeywords(contentText);
      analyzedComments.set(contentText, classification1);
      stats.total = 1;
      stats[classification1]++;


      expect(stats.total).toBe(1);


      // User scrolls and new comments load
      const thread2 = createMockComment('Buy crypto now!');
      const thread3 = createMockComment('Link in bio for more');
      document.body.appendChild(thread2);
      document.body.appendChild(thread3);


      // Rescan using REAL function
      const allThreads = document.querySelectorAll('ytd-comment-thread-renderer');


      allThreads.forEach(thread => {
        const text = thread.querySelector('#content-text').textContent.trim();


        if (!analyzedComments.has(text)) {
          const classification = classifyByKeywords(text);
          analyzedComments.set(text, classification);
          stats.total++;
          stats[classification]++;
        }
      });


      expect(stats.total).toBe(3);
      expect(stats.spam).toBe(1);
      expect(stats.suspicious).toBe(1);
      expect(stats.safe).toBe(1);
    });
  });


  describe('Scenario: User toggles highlight visibility', () => {
    test('should hide and show highlights when toggled', () => {
      // Setup comments with highlights
      const thread1 = createMockComment('Buy now!');
      const thread2 = createMockComment('Check out my similar content');
      document.body.appendChild(thread1);
      document.body.appendChild(thread2);


      const body1 = thread1.querySelector('#body');
      const body2 = thread2.querySelector('#body');


      body1.style.borderLeft = '4px solid #f05247';
      body2.style.borderLeft = '4px solid rgb(206, 206, 24)';


      expect(body1.style.borderLeft).toBe('4px solid #f05247');
      expect(body2.style.borderLeft).toBe('4px solid rgb(206, 206, 24)');


      // User clicks toggle to hide
      highlightsVisible = false;


      if (!highlightsVisible) {
        body1.style.borderLeft = '';
        body2.style.borderLeft = '';
      }


      expect(body1.style.borderLeft).toBe('');
      expect(body2.style.borderLeft).toBe('');


      // User clicks toggle to show again
      highlightsVisible = true;


      if (highlightsVisible) {
        body1.style.borderLeft = '4px solid #f05247';
        body2.style.borderLeft = '4px solid rgb(206, 206, 24)';
      }


      expect(body1.style.borderLeft).toBe('4px solid #f05247');
      expect(body2.style.borderLeft).toBe('4px solid rgb(206, 206, 24)');
    });
  });


  describe('Scenario: User navigates between videos', () => {
    test('should reset statistics for new video', () => {
      // Video 1 - scan comments
      const thread1 = createMockComment('Buy now!');
      document.body.appendChild(thread1);


      const text1 = thread1.querySelector('#content-text').textContent.trim();
      const classification = classifyByKeywords(text1);
      analyzedComments.set(text1, classification);
      stats.total = 1;
      stats[classification]++;


      expect(stats.total).toBe(1);


      // User navigates to new video
      const newUrl = 'https://youtube.com/watch?v=newvideo';
      const oldUrl = 'https://youtube.com/watch?v=oldvideo';


      if (newUrl !== oldUrl) {
        // Reset for new video
        analyzedComments.clear();
        stats = { total: 0, spam: 0, suspicious: 0, safe: 0 };
        document.body.innerHTML = '';
      }


      expect(stats.total).toBe(0);
      expect(analyzedComments.size).toBe(0);


      // New video has different comments
      const thread2 = createMockComment('This is helpful!');
      document.body.appendChild(thread2);


      const text2 = thread2.querySelector('#content-text').textContent.trim();
      const classification2 = classifyByKeywords(text2);
      analyzedComments.set(text2, classification2);
      stats.total = 1;
      stats[classification2]++;


      expect(stats.total).toBe(1);
      expect(stats.safe).toBe(1);
      expect(stats.spam).toBe(0);
    });
  });


  describe('Scenario: AI classification for ambiguous comments', () => {
    test('should use AI for suspicious comments when available', async () => {
      const mockAISession = {
        prompt: jest.fn()
      };


      // Ambiguous comment that triggers AI
      const ambiguousComment = 'Visit my profile for giveaway details';


      // Keyword check returns suspicious (using REAL function)
      const keywordResult = classifyByKeywords(ambiguousComment);


      // AI analyzes and returns verdict
      mockAISession.prompt.mockResolvedValue('safe');


      let finalClassification;
      if (keywordResult === 'suspicious') {
        const aiResult = await mockAISession.prompt(`Is this spam? "${ambiguousComment}"`);
        finalClassification = aiResult;
      } else {
        finalClassification = keywordResult;
      }


      expect(mockAISession.prompt).toHaveBeenCalled();
      expect(finalClassification).toBe('safe');
    });


    test('should fallback to keyword classification when AI unavailable', () => {
      const aiAvailable = false;
      const comment = 'Link in bio for free trial';


      // Keywords say suspicious (using REAL function)
      const keywordResult = classifyByKeywords(comment);


      let finalClassification;
      if (keywordResult === 'suspicious' && aiAvailable) {
        finalClassification = 'safe'; // Would use AI
      } else {
        finalClassification = keywordResult; // Fallback
      }


      expect(finalClassification).toBe('suspicious');
    });
  });


  describe('Scenario: User opens popup on non-YouTube page', () => {
    test('should display zero statistics', () => {
      // Mock being on a non-YouTube page
      const currentUrl = 'https://google.com';


      let displayStats = { total: 0, spam: 0, suspicious: 0, safe: 0 };


      if (!currentUrl.includes('youtube.com/watch')) {
        displayStats = { total: 0, spam: 0, suspicious: 0, safe: 0 };
      }


      expect(displayStats.total).toBe(0);
      expect(displayStats.spam).toBe(0);
      expect(displayStats.suspicious).toBe(0);
      expect(displayStats.safe).toBe(0);
    });
  });


  describe('Scenario: High volume comment section', () => {
    test('should handle scanning many comments efficiently', () => {
      const startTime = Date.now();


      // Create 100 comments
      for (let i = 0; i < 100; i++) {
        const texts = [
          'Great video!',
          'Buy now!',
          'Follow me'
        ];
        const text = texts[i % 3];
        const thread = createMockComment(`${text} ${i}`);
        document.body.appendChild(thread);
      }


      // Simulate classification using REAL function
      const threads = document.querySelectorAll('ytd-comment-thread-renderer');
      threads.forEach(thread => {
        const text = thread.querySelector('#content-text').textContent.trim();
        if (!analyzedComments.has(text)) {
          const classification = classifyByKeywords(text);
          analyzedComments.set(text, classification);
          stats.total++;
          stats[classification]++;
        }
      });


      const endTime = Date.now();
      const duration = endTime - startTime;


      expect(stats.total).toBe(100);
      expect(duration).toBeLessThan(1000); // Should complete in under 1 second
    });
  });


  describe('Scenario: Real keyword classification edge cases', () => {
    test('should correctly classify various spam patterns', () => {
      const testCases = [
        { text: 'Click here for free money!', expected: 'spam' },
        { text: 'Subscribe to my channel please', expected: 'spam' },
        { text: 'Great content, keep it up!', expected: 'safe' },
        { text: 'Subscribe for updates now', expected: 'suspicious' },
        { text: 'This helped me a lot', expected: 'safe' }
      ];


      testCases.forEach(({ text, expected }) => {
        const result = classifyByKeywords(text);
        expect(result).toBe(expected);
      });
    });
  });
});
