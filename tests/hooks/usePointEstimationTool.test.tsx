import { renderHook, act } from '@testing-library/react';
import { usePointEstimationTool } from '../../components/point-estimation-tool/usePointEstimationTool';
import { TemplateType } from '../../types/estimation';

// Mock 子 hooks
jest.mock('../../components/point-estimation-tool/hooks', () => ({
  useUserState: jest.fn(),
  useSessionState: jest.fn(),
  useSessionActions: jest.fn(),
  useUIState: jest.fn(),
  useComputedValues: jest.fn(),
}));

// Mock persistence
jest.mock('../../lib/persistence', () => ({
  getUserData: jest.fn(),
}));

const mockUseUserState = require('../../components/point-estimation-tool/hooks').useUserState;
const mockUseSessionState = require('../../components/point-estimation-tool/hooks').useSessionState;
const mockUseSessionActions = require('../../components/point-estimation-tool/hooks').useSessionActions;
const mockUseUIState = require('../../components/point-estimation-tool/hooks').useUIState;
const mockUseComputedValues = require('../../components/point-estimation-tool/hooks').useComputedValues;
const mockGetUserData = require('../../lib/persistence').getUserData;

describe('usePointEstimationTool', () => {
  // 默认的 mock 数据
  const defaultUserState = {
    currentUser: '',
    userName: 'TestUser',
    sessionId: 'test-session-123',
    selectedRole: 'participant',
    selectedVote: null,
    isRestoring: false,
    setCurrentUser: jest.fn(),
    setSessionId: jest.fn(),
    setIsJoined: jest.fn(),
    setUserName: jest.fn(),
    setSelectedRole: jest.fn(),
    setSelectedVote: jest.fn(),
    clearUserState: jest.fn(),
  };

  const defaultSessionState = {
    session: null,
    isJoined: false,
    isConnected: true,
    isLoading: false,
    pollSession: null,
    setSession: jest.fn(),
    setIsJoined: jest.fn(),
    setIsConnected: jest.fn(),
    setIsLoading: jest.fn(),
  };

  const defaultSessionActions = {
    handleCreateSession: jest.fn(),
    handleJoinSession: jest.fn(),
    handleCastVote: jest.fn(),
    handleRevealVotes: jest.fn(),
    handleResetVotes: jest.fn(),
    handleTemplateChange: jest.fn(),
    handleCustomCardsChange: jest.fn(),
    handleLogout: jest.fn(),
  };

  const defaultUIState = {
    copied: false,
    showSessionErrorModal: false,
    updateURL: jest.fn(),
    setShowSessionErrorModal: jest.fn(),
    clearURL: jest.fn(),
    copyShareLink: jest.fn(),
  };

  const defaultComputedValues = {
    stats: null,
    allUsersVoted: false,
    isHost: false,
    canVote: true,
    currentUserData: undefined,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // 设置默认的 mock 返回值
    mockUseUserState.mockReturnValue(defaultUserState);
    mockUseSessionState.mockReturnValue(defaultSessionState);
    mockUseSessionActions.mockReturnValue(defaultSessionActions);
    mockUseUIState.mockReturnValue(defaultUIState);
    mockUseComputedValues.mockReturnValue(defaultComputedValues);
    mockGetUserData.mockResolvedValue({ sessionId: 'test-session-123' });
  });

  describe('基本状态', () => {
    it('应该返回正确的状态和处理器', () => {
      const { result } = renderHook(() => usePointEstimationTool());

      expect(result.current.currentUser).toBe('');
      expect(result.current.userName).toBe('TestUser');
      expect(result.current.sessionId).toBe('test-session-123');
      expect(result.current.selectedRole).toBe('participant');
      expect(result.current.session).toBeNull();
      expect(result.current.selectedVote).toBeNull();
      expect(result.current.isJoined).toBe(false);
      expect(result.current.isConnected).toBe(true);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.copied).toBe(false);
      expect(result.current.isRestoring).toBe(false);
      expect(result.current.showSessionErrorModal).toBe(false);
      expect(result.current.stats).toBeNull();
      expect(result.current.allUsersVoted).toBe(false);
      expect(result.current.isHost).toBe(false);
      expect(result.current.canVote).toBe(true);
      expect(result.current.currentUserData).toBeUndefined();
    });

    it('应该包含所有必要的处理器函数', () => {
      const { result } = renderHook(() => usePointEstimationTool());

      expect(typeof result.current.handleCreateSession).toBe('function');
      expect(typeof result.current.handleJoinSession).toBe('function');
      expect(typeof result.current.handleCastVote).toBe('function');
      expect(typeof result.current.handleRevealVotes).toBe('function');
      expect(typeof result.current.handleResetVotes).toBe('function');
      expect(typeof result.current.handleTemplateChange).toBe('function');
      expect(typeof result.current.handleCustomCardsChange).toBe('function');
      expect(typeof result.current.handleLogout).toBe('function');
      expect(typeof result.current.handleBackToHost).toBe('function');
      expect(typeof result.current.copyShareLink).toBe('function');
      expect(typeof result.current.setUserName).toBe('function');
      expect(typeof result.current.setSelectedRole).toBe('function');
      expect(typeof result.current.setShowSessionErrorModal).toBe('function');
    });
  });

  describe('URL 更新', () => {
    it('应该在 sessionId 或 isJoined 变化时更新 URL', () => {
      renderHook(() => usePointEstimationTool());

      expect(defaultUIState.updateURL).toHaveBeenCalledWith('test-session-123', false);
    });
  });

  describe('handleCreateSession', () => {
    it('应该成功创建会话', async () => {
      const mockHandleCreateSession = jest.fn().mockResolvedValue(true);
      mockUseSessionActions.mockReturnValue({
        ...defaultSessionActions,
        handleCreateSession: mockHandleCreateSession,
      });

      const { result } = renderHook(() => usePointEstimationTool());

      await act(async () => {
        await result.current.handleCreateSession();
      });

      expect(defaultSessionState.setIsLoading).toHaveBeenCalledWith(true);
      expect(mockHandleCreateSession).toHaveBeenCalledWith('TestUser', expect.stringMatching(/TestUser-\d+/));
      expect(defaultUserState.setCurrentUser).toHaveBeenCalled();
      expect(mockGetUserData).toHaveBeenCalled();
      expect(defaultUserState.setSessionId).toHaveBeenCalledWith('test-session-123');
      expect(defaultUserState.setIsJoined).toHaveBeenCalledWith(true);
      expect(defaultSessionState.setIsConnected).toHaveBeenCalledWith(true);
      expect(defaultSessionState.setIsLoading).toHaveBeenCalledWith(false);
    });

    it('当用户名为空时不应该创建会话', async () => {
      mockUseUserState.mockReturnValue({
        ...defaultUserState,
        userName: '',
      });

      const { result } = renderHook(() => usePointEstimationTool());

      await act(async () => {
        await result.current.handleCreateSession();
      });

      expect(defaultSessionState.setIsLoading).not.toHaveBeenCalled();
    });

    it('当创建会话失败时应该设置连接状态为 false', async () => {
      const mockHandleCreateSession = jest.fn().mockResolvedValue(false);
      mockUseSessionActions.mockReturnValue({
        ...defaultSessionActions,
        handleCreateSession: mockHandleCreateSession,
      });

      const { result } = renderHook(() => usePointEstimationTool());

      await act(async () => {
        await result.current.handleCreateSession();
      });

      expect(defaultSessionState.setIsConnected).toHaveBeenCalledWith(false);
    });

    it('当创建会话抛出异常时应该设置连接状态为 false', async () => {
      const mockHandleCreateSession = jest.fn().mockRejectedValue(new Error('Network error'));
      mockUseSessionActions.mockReturnValue({
        ...defaultSessionActions,
        handleCreateSession: mockHandleCreateSession,
      });

      const { result } = renderHook(() => usePointEstimationTool());

      await act(async () => {
        await result.current.handleCreateSession();
      });

      expect(defaultSessionState.setIsConnected).toHaveBeenCalledWith(false);
    });
  });

  describe('handleJoinSession', () => {
    it('应该成功加入会话', async () => {
      const mockHandleJoinSession = jest.fn().mockResolvedValue(true);
      mockUseSessionActions.mockReturnValue({
        ...defaultSessionActions,
        handleJoinSession: mockHandleJoinSession,
      });

      const { result } = renderHook(() => usePointEstimationTool());

      await act(async () => {
        await result.current.handleJoinSession();
      });

      expect(defaultSessionState.setIsLoading).toHaveBeenCalledWith(true);
      expect(mockHandleJoinSession).toHaveBeenCalledWith(
        'TestUser',
        'test-session-123',
        'participant',
        expect.stringMatching(/TestUser-\d+/)
      );
      expect(defaultUserState.setCurrentUser).toHaveBeenCalled();
      expect(defaultUserState.setSessionId).toHaveBeenCalledWith('test-session-123');
      expect(defaultUserState.setIsJoined).toHaveBeenCalledWith(true);
      expect(defaultSessionState.setIsConnected).toHaveBeenCalledWith(true);
      expect(defaultSessionState.setIsLoading).toHaveBeenCalledWith(false);
    });

    it('当用户名为空时不应该加入会话', async () => {
      mockUseUserState.mockReturnValue({
        ...defaultUserState,
        userName: '',
      });

      const { result } = renderHook(() => usePointEstimationTool());

      await act(async () => {
        await result.current.handleJoinSession();
      });

      expect(defaultSessionState.setIsLoading).not.toHaveBeenCalled();
    });

    it('当 sessionId 为空时不应该加入会话', async () => {
      mockUseUserState.mockReturnValue({
        ...defaultUserState,
        sessionId: '',
      });

      const { result } = renderHook(() => usePointEstimationTool());

      await act(async () => {
        await result.current.handleJoinSession();
      });

      expect(defaultSessionState.setIsLoading).not.toHaveBeenCalled();
    });

    it('当加入会话失败时应该显示错误模态框', async () => {
      const mockHandleJoinSession = jest.fn().mockResolvedValue(false);
      mockUseSessionActions.mockReturnValue({
        ...defaultSessionActions,
        handleJoinSession: mockHandleJoinSession,
      });

      const { result } = renderHook(() => usePointEstimationTool());

      await act(async () => {
        await result.current.handleJoinSession();
      });

      expect(defaultSessionState.setIsConnected).toHaveBeenCalledWith(false);
      expect(defaultUIState.setShowSessionErrorModal).toHaveBeenCalledWith(true);
    });
  });

  describe('handleCastVote', () => {
    it('应该成功投票', async () => {
      const mockSession = {
        id: 'test-session-123',
        users: [],
        votes: {},
        revealed: false,
        template: { type: 'fibonacci' },
        createdAt: Date.now(),
        hostId: 'host-123',
      };

      mockUseSessionState.mockReturnValue({
        ...defaultSessionState,
        session: mockSession,
      });

      mockUseUserState.mockReturnValue({
        ...defaultUserState,
        currentUser: 'user-123',
      });

      const mockHandleCastVote = jest.fn().mockResolvedValue(undefined);
      mockUseSessionActions.mockReturnValue({
        ...defaultSessionActions,
        handleCastVote: mockHandleCastVote,
      });

      const { result } = renderHook(() => usePointEstimationTool());

      await act(async () => {
        await result.current.handleCastVote('5');
      });

      expect(defaultUserState.setSelectedVote).toHaveBeenCalledWith('5');
      expect(mockHandleCastVote).toHaveBeenCalledWith(
        'test-session-123',
        'user-123',
        '5',
        mockSession,
        true
      );
    });

    it('当没有会话时不应该投票', async () => {
      const { result } = renderHook(() => usePointEstimationTool());

      await act(async () => {
        await result.current.handleCastVote('5');
      });

      expect(defaultUserState.setSelectedVote).not.toHaveBeenCalled();
    });

    it('当没有当前用户时不应该投票', async () => {
      const mockSession = {
        id: 'test-session-123',
        users: [],
        votes: {},
        revealed: false,
        template: { type: 'fibonacci' },
        createdAt: Date.now(),
        hostId: 'host-123',
      };

      mockUseSessionState.mockReturnValue({
        ...defaultSessionState,
        session: mockSession,
      });

      const { result } = renderHook(() => usePointEstimationTool());

      await act(async () => {
        await result.current.handleCastVote('5');
      });

      expect(defaultUserState.setSelectedVote).not.toHaveBeenCalled();
    });

    it('当不能投票时不应该投票', async () => {
      const mockSession = {
        id: 'test-session-123',
        users: [],
        votes: {},
        revealed: false,
        template: { type: 'fibonacci' },
        createdAt: Date.now(),
        hostId: 'host-123',
      };

      mockUseSessionState.mockReturnValue({
        ...defaultSessionState,
        session: mockSession,
      });

      mockUseUserState.mockReturnValue({
        ...defaultUserState,
        currentUser: 'user-123',
      });

      mockUseComputedValues.mockReturnValue({
        ...defaultComputedValues,
        canVote: false,
      });

      const { result } = renderHook(() => usePointEstimationTool());

      await act(async () => {
        await result.current.handleCastVote('5');
      });

      expect(defaultUserState.setSelectedVote).not.toHaveBeenCalled();
    });
  });

  describe('handleRevealVotes', () => {
    it('应该成功显示投票', async () => {
      const mockSession = {
        id: 'test-session-123',
        users: [],
        votes: {},
        revealed: false,
        template: { type: 'fibonacci' },
        createdAt: Date.now(),
        hostId: 'host-123',
      };

      mockUseSessionState.mockReturnValue({
        ...defaultSessionState,
        session: mockSession,
      });

      mockUseComputedValues.mockReturnValue({
        ...defaultComputedValues,
        isHost: true,
      });

      const mockHandleRevealVotes = jest.fn().mockResolvedValue(undefined);
      mockUseSessionActions.mockReturnValue({
        ...defaultSessionActions,
        handleRevealVotes: mockHandleRevealVotes,
      });

      const { result } = renderHook(() => usePointEstimationTool());

      await act(async () => {
        await result.current.handleRevealVotes();
      });

      expect(mockHandleRevealVotes).toHaveBeenCalledWith(
        'test-session-123',
        '',
        mockSession,
        true
      );
    });

    it('当没有会话时不应该显示投票', async () => {
      const { result } = renderHook(() => usePointEstimationTool());

      await act(async () => {
        await result.current.handleRevealVotes();
      });

      expect(defaultSessionActions.handleRevealVotes).not.toHaveBeenCalled();
    });

    it('当不是主持人时不应该显示投票', async () => {
      const mockSession = {
        id: 'test-session-123',
        users: [],
        votes: {},
        revealed: false,
        template: { type: 'fibonacci' },
        createdAt: Date.now(),
        hostId: 'host-123',
      };

      mockUseSessionState.mockReturnValue({
        ...defaultSessionState,
        session: mockSession,
      });

      const { result } = renderHook(() => usePointEstimationTool());

      await act(async () => {
        await result.current.handleRevealVotes();
      });

      expect(defaultSessionActions.handleRevealVotes).not.toHaveBeenCalled();
    });
  });

  describe('handleResetVotes', () => {
    it('应该成功重置投票', async () => {
      const mockSession = {
        id: 'test-session-123',
        users: [],
        votes: {},
        revealed: false,
        template: { type: 'fibonacci' },
        createdAt: Date.now(),
        hostId: 'host-123',
      };

      mockUseSessionState.mockReturnValue({
        ...defaultSessionState,
        session: mockSession,
        pollSession: null,
      });

      mockUseComputedValues.mockReturnValue({
        ...defaultComputedValues,
        isHost: true,
      });

      const mockHandleResetVotes = jest.fn().mockResolvedValue(undefined);
      mockUseSessionActions.mockReturnValue({
        ...defaultSessionActions,
        handleResetVotes: mockHandleResetVotes,
      });

      const { result } = renderHook(() => usePointEstimationTool());

      await act(async () => {
        await result.current.handleResetVotes();
      });

      expect(mockHandleResetVotes).toHaveBeenCalledWith(
        'test-session-123',
        '',
        mockSession,
        true,
        defaultUserState.setSelectedVote,
        null
      );
    });
  });

  describe('handleTemplateChange', () => {
    it('应该成功更改模板', async () => {
      const mockSession = {
        id: 'test-session-123',
        users: [],
        votes: {},
        revealed: false,
        template: { type: 'fibonacci' },
        createdAt: Date.now(),
        hostId: 'host-123',
      };

      mockUseSessionState.mockReturnValue({
        ...defaultSessionState,
        session: mockSession,
        pollSession: null,
      });

      mockUseComputedValues.mockReturnValue({
        ...defaultComputedValues,
        isHost: true,
      });

      const mockHandleTemplateChange = jest.fn().mockResolvedValue(undefined);
      mockUseSessionActions.mockReturnValue({
        ...defaultSessionActions,
        handleTemplateChange: mockHandleTemplateChange,
      });

      const { result } = renderHook(() => usePointEstimationTool());

      await act(async () => {
        await result.current.handleTemplateChange('tShirt' as TemplateType);
      });

      expect(mockHandleTemplateChange).toHaveBeenCalledWith(
        'test-session-123',
        '',
        mockSession,
        true,
        'tShirt',
        defaultUserState.setSelectedVote,
        null
      );
    });
  });

  describe('handleCustomCardsChange', () => {
    it('应该成功更改自定义卡片', async () => {
      const mockSession = {
        id: 'test-session-123',
        users: [],
        votes: {},
        revealed: false,
        template: { type: 'fibonacci' },
        createdAt: Date.now(),
        hostId: 'host-123',
      };

      mockUseSessionState.mockReturnValue({
        ...defaultSessionState,
        session: mockSession,
        pollSession: null,
      });

      mockUseComputedValues.mockReturnValue({
        ...defaultComputedValues,
        isHost: true,
      });

      const mockHandleCustomCardsChange = jest.fn().mockResolvedValue(undefined);
      mockUseSessionActions.mockReturnValue({
        ...defaultSessionActions,
        handleCustomCardsChange: mockHandleCustomCardsChange,
      });

      const { result } = renderHook(() => usePointEstimationTool());

      await act(async () => {
        await result.current.handleCustomCardsChange('1,2,3,5,8');
      });

      expect(mockHandleCustomCardsChange).toHaveBeenCalledWith(
        'test-session-123',
        '',
        mockSession,
        true,
        '1,2,3,5,8',
        defaultUserState.setSelectedVote,
        null
      );
    });
  });

  describe('handleLogout', () => {
    it('应该成功登出', async () => {
      const mockHandleLogout = jest.fn().mockResolvedValue(undefined);
      mockUseSessionActions.mockReturnValue({
        ...defaultSessionActions,
        handleLogout: mockHandleLogout,
      });

      const { result } = renderHook(() => usePointEstimationTool());

      await act(async () => {
        await result.current.handleLogout();
      });

      expect(mockHandleLogout).toHaveBeenCalledWith(
        'test-session-123',
        '',
        false
      );
      expect(defaultUserState.clearUserState).toHaveBeenCalled();
      expect(defaultSessionState.setSession).toHaveBeenCalledWith(null);
      expect(defaultSessionState.setIsJoined).toHaveBeenCalledWith(false);
      expect(defaultSessionState.setIsConnected).toHaveBeenCalledWith(true);
      expect(defaultSessionState.setIsLoading).toHaveBeenCalledWith(false);
      expect(defaultUIState.clearURL).toHaveBeenCalled();
    });
  });

  describe('handleBackToHost', () => {
    it('应该成功返回主机', () => {
      const { result } = renderHook(() => usePointEstimationTool());

      act(() => {
        result.current.handleBackToHost();
      });

      expect(defaultUIState.setShowSessionErrorModal).toHaveBeenCalledWith(false);
      expect(defaultUserState.clearUserState).toHaveBeenCalled();
      expect(defaultSessionState.setSession).toHaveBeenCalledWith(null);
      expect(defaultSessionState.setIsJoined).toHaveBeenCalledWith(false);
      expect(defaultSessionState.setIsConnected).toHaveBeenCalledWith(true);
      expect(defaultUIState.clearURL).toHaveBeenCalled();
    });
  });

  describe('copyShareLink', () => {
    it('应该调用 UI 状态的 copyShareLink 方法', () => {
      const { result } = renderHook(() => usePointEstimationTool());

      act(() => {
        result.current.copyShareLink();
      });

      expect(defaultUIState.copyShareLink).toHaveBeenCalledWith('test-session-123');
    });
  });

  describe('状态设置器', () => {
    it('应该正确设置用户名', () => {
      const { result } = renderHook(() => usePointEstimationTool());

      act(() => {
        result.current.setUserName('NewUserName');
      });

      expect(defaultUserState.setUserName).toHaveBeenCalledWith('NewUserName');
    });

    it('应该正确设置角色', () => {
      const { result } = renderHook(() => usePointEstimationTool());

      act(() => {
        result.current.setSelectedRole('host');
      });

      expect(defaultUserState.setSelectedRole).toHaveBeenCalledWith('host');
    });

    it('应该正确设置错误模态框显示状态', () => {
      const { result } = renderHook(() => usePointEstimationTool());

      act(() => {
        result.current.setShowSessionErrorModal(true);
      });

      expect(defaultUIState.setShowSessionErrorModal).toHaveBeenCalledWith(true);
    });
  });

  describe('计算值', () => {
    it('应该正确返回计算值', () => {
      const mockStats = { average: 5, median: 5, min: 1, max: 8 };
      const mockCurrentUserData = { id: 'user-123', name: 'TestUser', role: 'participant' };

      mockUseComputedValues.mockReturnValue({
        stats: mockStats,
        allUsersVoted: true,
        isHost: true,
        canVote: false,
        currentUserData: mockCurrentUserData,
      });

      const { result } = renderHook(() => usePointEstimationTool());

      expect(result.current.stats).toEqual(mockStats);
      expect(result.current.allUsersVoted).toBe(true);
      expect(result.current.isHost).toBe(true);
      expect(result.current.canVote).toBe(false);
      expect(result.current.currentUserData).toEqual(mockCurrentUserData);
    });
  });
}); 