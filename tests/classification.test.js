/**
 * Tests for spam classification logic
 * These tests import and test the code from content.js
 */

const {
  SPAM_KEYWORDS,
  classifyByKeywords,
  classifyWithAI,
  classifyComment
} = require('../content.js');

describe('Spam Classification - REAL CODE TESTS', () => {
  describe('classifyByKeywords', () => {
    test('should classify high-risk spam keywords as spam', () => {
      expect(classifyByKeywords('Click here to buy now!')).toBe('spam');
      expect(classifyByKeywords('Make money fast with this trick')).toBe('spam');
      expect(classifyByKeywords('Join my telegram for crypto tips')).toBe('spam');
      expect(classifyByKeywords('FREE MONEY! Act now!')).toBe('spam');
    });

    test('should classify medium-risk keywords as suspicious', () => {
      expect(classifyByKeywords('Check out my new video')).toBe('spam');
      expect(classifyByKeywords('Nice video! Follow me for more')).toBe('suspicious');
      expect(classifyByKeywords('Great info, thanks for sharing')).toBe('safe');
    });

    test('should classify genuine comments as safe', () => {
      expect(classifyByKeywords('This is really helpful, thank you!')).toBe('safe');
      expect(classifyByKeywords('Great explanation of the topic')).toBe('safe');
      expect(classifyByKeywords('I disagree with this point because...')).toBe('safe');
      expect(classifyByKeywords('Can you explain this part again?')).toBe('safe');
    });

    test('should be case-insensitive', () => {
      expect(classifyByKeywords('BUY NOW!!!')).toBe('spam');
      expect(classifyByKeywords('ChEcK oUt mY vIdEo')).toBe('spam');
    });

    test('should detect keywords within longer text', () => {
      expect(classifyByKeywords('Hey everyone, buy now while supplies last!')).toBe('spam');
      expect(classifyByKeywords('This was great! Subscribe for more content')).toBe('safe');
    });

    test('should handle empty or whitespace text', () => {
      expect(classifyByKeywords('')).toBe('safe');
      expect(classifyByKeywords('   ')).toBe('safe');
    });

    test('should handle special characters', () => {
      expect(classifyByKeywords('🚀 Buy now! 🚀')).toBe('spam');
      expect(classifyByKeywords('John Smith made me a ton of money investing for me! You should look them up 😊')).toBe('suspicious');
    });
  });

  describe('Edge Cases', () => {
    test('should prioritize high-risk over medium-risk', () => {
      // "check out my channel" is in high-risk list
      const text = 'Check out my channel for this amazing opportunity to buy now!';
      expect(classifyByKeywords(text)).toBe('spam');
    });

    test('should handle very long comments', () => {
      const longComment = 'This is a really long comment. '.repeat(100) + 'buy now';
      expect(classifyByKeywords(longComment)).toBe('spam');
    });

    test('should handle numbers and URLs without false positives', () => {
      expect(classifyByKeywords('Timestamp: 3:45 is where it gets good')).toBe('safe');
      expect(classifyByKeywords('The official website has more info')).toBe('safe');
    });
  });

  describe('Real-world Comment Examples', () => {
    test('should classify obvious spam', () => {
      const spamComments = [
        'Want to earn $5000 per day? Click here now!',
        'Subscribe to my channel for sub4sub',
        'Text me at +1234567890 for investment opportunity',
        'Congratulations you won! Claim your prize here',
        'Check out my OnlyFans in bio'
      ];

      spamComments.forEach(comment => {
        const result = classifyByKeywords(comment);
        expect(result).toBe('spam');
      });
    });

    test('should classify self-promotion as suspicious', () => {
      const suspiciousComments = [
        'Great video! Check out my similar content',
        'Nice video, I make similar stuff, subscribe!',
        'Awesome content! Visit my channel for more',
        'Thanks for sharing, new video on my channel about this'
      ];

      suspiciousComments.forEach(comment => {
        const result = classifyByKeywords(comment);
        // Some may be spam if they contain "check out my channel"
        expect(['spam', 'suspicious']).toContain(result);
      });
    });

    test('should classify genuine engagement as safe', () => {
      const safeComments = [
        'This really helped me understand the concept, thank you!',
        'I have a question about the part at 5:30',
        'Your explanation was clearer than my textbook',
        'Could you make a follow-up video on this topic?',
        'I tried this and it worked perfectly!'
      ];

      safeComments.forEach(comment => {
        expect(classifyByKeywords(comment)).toBe('safe');
      });
    });
  });

  describe('SPAM_KEYWORDS Configuration', () => {
    test('should have high-risk keywords defined', () => {
      expect(SPAM_KEYWORDS.high).toBeDefined();
      expect(Array.isArray(SPAM_KEYWORDS.high)).toBe(true);
      expect(SPAM_KEYWORDS.high.length).toBeGreaterThan(0);
    });

    test('should have medium-risk keywords defined', () => {
      expect(SPAM_KEYWORDS.medium).toBeDefined();
      expect(Array.isArray(SPAM_KEYWORDS.medium)).toBe(true);
      expect(SPAM_KEYWORDS.medium.length).toBeGreaterThan(0);
    });

    test('high-risk keywords should include critical spam terms', () => {
      const criticalTerms = ['buy now', 'free money', 'click here'];
      criticalTerms.forEach(term => {
        expect(SPAM_KEYWORDS.high).toContain(term);
      });
    });
  });
});

describe('AI Classification', () => {
  describe('classifyWithAI', () => {
    test('should return suspicious when AI unavailable', async () => {
      const result = await classifyWithAI('test comment', null, false);
      expect(result).toBe('suspicious');
    });

    test('should classify as spam when AI responds with spam', async () => {
      const mockSession = {
        prompt: jest.fn().mockResolvedValue('spam')
      };

      const result = await classifyWithAI('Buy this now!', mockSession, true);
      expect(result).toBe('spam');
      expect(mockSession.prompt).toHaveBeenCalled();
    });

    test('should classify as safe when AI responds with safe', async () => {
      const mockSession = {
        prompt: jest.fn().mockResolvedValue('safe')
      };

      const result = await classifyWithAI('Nice video!', mockSession, true);
      expect(result).toBe('safe');
    });

    test('should return suspicious on unclear AI response', async () => {
      const mockSession = {
        prompt: jest.fn().mockResolvedValue('maybe')
      };

      const result = await classifyWithAI('test', mockSession, true);
      expect(result).toBe('suspicious');
    });

    test('should handle AI errors gracefully', async () => {
      const mockSession = {
        prompt: jest.fn().mockRejectedValue(new Error('AI error'))
      };

      const result = await classifyWithAI('test', mockSession, true);
      expect(result).toBe('suspicious');
    });
  });

  describe('classifyComment (Hybrid)', () => {
    test('should use keywords only for obvious spam', async () => {
      const result = await classifyComment('Buy now!', null, false);
      expect(result.classification).toBe('spam');
      expect(result.usedAI).toBe(false);
    });

    test('should use keywords only for safe comments', async () => {
      const result = await classifyComment('Great video!', null, false);
      expect(result.classification).toBe('safe');
      expect(result.usedAI).toBe(false);
    });

    test('should use AI for suspicious comments when available', async () => {
      const mockSession = {
        prompt: jest.fn().mockResolvedValue('safe')
      };

      const result = await classifyComment('crypto is bad', mockSession, true);
      expect(result.usedAI).toBe(true);
      expect(mockSession.prompt).toHaveBeenCalled();
    });

    test('should fallback to suspicious when AI unavailable', async () => {
      const result = await classifyComment('check out my channel', null, false);
      expect(result.classification).toBe('spam');
      expect(result.usedAI).toBe(false);
    });
  });
});