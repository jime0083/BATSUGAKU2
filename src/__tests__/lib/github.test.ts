// Mock expo-constants before importing the module
jest.mock('expo-constants', () => ({
  expoConfig: {
    extra: {
      githubClientId: 'test-github-client-id',
    },
  },
}));

import {
  getGitHubAuthConfig,
  fetchGitHubUser,
  fetchTodayPushEvents,
  hasPushedToday,
} from '../../lib/github';

// Mock fetch
global.fetch = jest.fn();

describe('GitHub Library', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getGitHubAuthConfig', () => {
    it('should return valid auth configuration', () => {
      const config = getGitHubAuthConfig();

      expect(config).toHaveProperty('clientId');
      expect(config).toHaveProperty('scopes');
      expect(config.scopes).toContain('read:user');
      expect(config.scopes).toContain('repo');
    });
  });

  describe('fetchGitHubUser', () => {
    it('should fetch user data with valid token', async () => {
      const mockUser = {
        id: 12345,
        login: 'testuser',
        avatar_url: 'https://github.com/avatar.png',
        name: 'Test User',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockUser,
      });

      const result = await fetchGitHubUser('valid-token');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.github.com/user',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer valid-token',
          }),
        })
      );
      expect(result).toEqual(mockUser);
    });

    it('should throw error with invalid token', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });

      await expect(fetchGitHubUser('invalid-token')).rejects.toThrow();
    });
  });

  describe('fetchTodayPushEvents', () => {
    it('should fetch push events for user', async () => {
      const mockEvents = [
        {
          id: '1',
          type: 'PushEvent',
          repo: { name: 'user/repo' },
          created_at: new Date().toISOString(),
          payload: {
            commits: [{ sha: 'abc123', message: 'test commit' }],
          },
        },
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockEvents,
      });

      const result = await fetchTodayPushEvents('testuser', 'valid-token');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.github.com/users/testuser/events',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer valid-token',
          }),
        })
      );
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('PushEvent');
    });

    it('should filter only PushEvents from today', async () => {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      const mockEvents = [
        {
          id: '1',
          type: 'PushEvent',
          repo: { name: 'user/repo1' },
          created_at: today.toISOString(),
          payload: { commits: [] },
        },
        {
          id: '2',
          type: 'PushEvent',
          repo: { name: 'user/repo2' },
          created_at: yesterday.toISOString(),
          payload: { commits: [] },
        },
        {
          id: '3',
          type: 'IssueEvent',
          repo: { name: 'user/repo3' },
          created_at: today.toISOString(),
          payload: {},
        },
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockEvents,
      });

      const result = await fetchTodayPushEvents('testuser', 'valid-token');

      // Only today's PushEvent should be returned
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('1');
    });
  });

  describe('hasPushedToday', () => {
    it('should return true when user has pushed today', async () => {
      const mockEvents = [
        {
          id: '1',
          type: 'PushEvent',
          repo: { name: 'user/repo' },
          created_at: new Date().toISOString(),
          payload: { commits: [{ sha: 'abc', message: 'test' }] },
        },
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockEvents,
      });

      const result = await hasPushedToday('testuser', 'valid-token');

      expect(result).toBe(true);
    });

    it('should return false when user has not pushed today', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      const result = await hasPushedToday('testuser', 'valid-token');

      expect(result).toBe(false);
    });
  });
});
