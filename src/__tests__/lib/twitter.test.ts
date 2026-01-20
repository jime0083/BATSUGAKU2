// Mock expo-constants before importing the module
jest.mock('expo-constants', () => ({
  expoConfig: {
    extra: {
      xClientId: 'test-x-client-id',
    },
  },
}));

import {
  getXAuthConfig,
  postTweet,
  refreshXToken,
} from '../../lib/twitter';

// Mock fetch
global.fetch = jest.fn();

describe('Twitter (X) Library', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getXAuthConfig', () => {
    it('should return valid auth configuration with PKCE', () => {
      const config = getXAuthConfig();

      expect(config).toHaveProperty('clientId');
      expect(config).toHaveProperty('scopes');
      expect(config).toHaveProperty('usePKCE');
      expect(config.usePKCE).toBe(true);
      expect(config.scopes).toContain('tweet.read');
      expect(config.scopes).toContain('tweet.write');
      expect(config.scopes).toContain('users.read');
      expect(config.scopes).toContain('offline.access');
    });
  });

  describe('postTweet', () => {
    it('should post a tweet successfully', async () => {
      const mockResponse = {
        data: {
          id: '123456789',
          text: 'Test tweet',
        },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await postTweet('valid-token', 'Test tweet');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.twitter.com/2/tweets',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer valid-token',
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify({ text: 'Test tweet' }),
        })
      );
      expect(result).toEqual(mockResponse);
    });

    it('should throw error when tweet fails', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });

      await expect(postTweet('invalid-token', 'Test tweet')).rejects.toThrow();
    });

    it('should throw error when tweet text is too long', async () => {
      const longText = 'a'.repeat(281);
      await expect(postTweet('valid-token', longText)).rejects.toThrow('Tweet text exceeds 280 characters');
    });

    it('should throw error when tweet text is empty', async () => {
      await expect(postTweet('valid-token', '')).rejects.toThrow('Tweet text cannot be empty');
    });
  });

  describe('refreshXToken', () => {
    it('should refresh token successfully', async () => {
      const mockResponse = {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_in: 7200,
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await refreshXToken('old-refresh-token', 'client-id');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.twitter.com/2/oauth2/token',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/x-www-form-urlencoded',
          }),
        })
      );
      expect(result).toHaveProperty('access_token', 'new-access-token');
      expect(result).toHaveProperty('refresh_token', 'new-refresh-token');
    });

    it('should throw error when refresh fails', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
      });

      await expect(refreshXToken('invalid-token', 'client-id')).rejects.toThrow();
    });
  });
});
