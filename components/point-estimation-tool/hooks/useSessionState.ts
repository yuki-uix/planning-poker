import { useState, useCallback, useEffect, useRef } from "react";
import { Session } from "@/types/estimation";
import { getSessionData, heartbeat } from "@/app/actions";
import { updateSessionState } from "@/lib/persistence";
import { ConnectionStabilityEnhancer } from "@/lib/connection-stability-enhancer";

export interface SessionState {
  session: Session | null;
  isJoined: boolean;
  isConnected: boolean;
  isLoading: boolean;
}

export interface SessionStateHandlers {
  setSession: (session: Session | null) => void;
  setIsJoined: (joined: boolean) => void;
  setIsConnected: (connected: boolean) => void;
  setIsLoading: (loading: boolean) => void;
  pollSession: () => Promise<void>;
  sendHeartbeat: () => Promise<void>;
}

export function useSessionState(
  sessionId: string,
  currentUser: string,
  isJoined: boolean,
  isRestoring: boolean,
  setIsJoined: (joined: boolean) => void
): SessionState & SessionStateHandlers {
  const [session, setSession] = useState<Session | null>(null);
  const [isConnected, setIsConnected] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  
  // 连接稳定性增强器
  const stabilityEnhancerRef = useRef<ConnectionStabilityEnhancer | null>(null);

  // 初始化连接稳定性增强器
  useEffect(() => {
    if (sessionId && currentUser && isJoined && !isRestoring) {
      stabilityEnhancerRef.current = new ConnectionStabilityEnhancer({
        sessionId,
        userId: currentUser,
        maxConsecutiveFailures: 3,
        healthCheckInterval: 30000,
        recoveryDelay: 5000
      });
      
      stabilityEnhancerRef.current.startHealthCheck();
      
      return () => {
        stabilityEnhancerRef.current?.destroy();
        stabilityEnhancerRef.current = null;
      };
    }
  }, [sessionId, currentUser, isJoined, isRestoring]);

  // 同步isJoined状态
  useEffect(() => {
    setIsJoined(isJoined);
  }, [isJoined, setIsJoined]);

  const pollSession = useCallback(async () => {
    console.log("pollSession", { sessionId, currentUser }); // 调试日志
    if (!sessionId || !currentUser) return;
    
    const startTime = Date.now();
    
    // 使用智能重连策略
    let retryCount = 0;
    const maxRetries = 3;
    
    while (retryCount < maxRetries) {
      try {
        const result = await getSessionData(sessionId);
        console.log("getSessionData result", result); // 调试日志
        
        const responseTime = Date.now() - startTime;
        
        if (result.success && result.session) {
          setSession(result.session);
          setIsConnected(true);
          await updateSessionState(sessionId, {
            revealed: result.session.revealed,
            template: result.session.template,
          });
          
          // 记录成功
          stabilityEnhancerRef.current?.recordSuccess('poll', responseTime);
          
          // 记录质量指标
          if (typeof window !== 'undefined') {
            // 在浏览器环境中记录
            const { connectionQualityMonitor } = await import('@/lib/connection-quality-monitor');
            connectionQualityMonitor.recordMetrics(responseTime, true);
          }
          
          return; // 成功获取数据，退出重试循环
        } else {
          // 会话不存在或获取失败
          console.warn("Session data not available:", result.error);
          stabilityEnhancerRef.current?.recordFailure(result.error || 'Session not found', 'poll');
          setIsConnected(false);
          return;
        }
      } catch (error) {
        retryCount++;
        console.error(`Poll session attempt ${retryCount} failed:`, error);
        
        const responseTime = Date.now() - startTime;
        stabilityEnhancerRef.current?.recordFailure(
          error instanceof Error ? error.message : 'Poll failed',
          'poll'
        );
        
        // 记录质量指标
        if (typeof window !== 'undefined') {
          const { connectionQualityMonitor } = await import('@/lib/connection-quality-monitor');
          connectionQualityMonitor.recordMetrics(responseTime, false);
        }
        
        if (retryCount >= maxRetries) {
          setIsConnected(false);
          return;
        }
        
        // 使用智能重连延迟
        const delay = retryCount === 1 ? 1000 : Math.pow(2, retryCount) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }, [sessionId, currentUser]);

  const sendHeartbeat = useCallback(async () => {
    if (!sessionId || !currentUser) return;
    
    const startTime = Date.now();
    
    try {
      const result = await heartbeat(sessionId, currentUser);
      const responseTime = Date.now() - startTime;
      
      if (result.success) {
        setIsConnected(true);
        stabilityEnhancerRef.current?.recordSuccess('heartbeat', responseTime);
        
        // 记录自适应心跳结果
        if (typeof window !== 'undefined') {
          const { adaptiveHeartbeatManager } = await import('@/lib/adaptive-heartbeat-manager');
          adaptiveHeartbeatManager.recordHeartbeatResult(true, responseTime);
        }
      } else {
        console.warn("Heartbeat failed:", result.error);
        stabilityEnhancerRef.current?.recordFailure(result.error || 'Heartbeat failed', 'heartbeat');
        
        // 记录自适应心跳结果
        if (typeof window !== 'undefined') {
          const { adaptiveHeartbeatManager } = await import('@/lib/adaptive-heartbeat-manager');
          adaptiveHeartbeatManager.recordHeartbeatResult(false, responseTime);
        }
        
        setIsConnected(false);
      }
    } catch (error) {
      console.error("Heartbeat error:", error);
      const responseTime = Date.now() - startTime;
      
      stabilityEnhancerRef.current?.recordFailure(
        error instanceof Error ? error.message : 'Heartbeat error',
        'heartbeat'
      );
      
      // 记录自适应心跳结果
      if (typeof window !== 'undefined') {
        const { adaptiveHeartbeatManager } = await import('@/lib/adaptive-heartbeat-manager');
        adaptiveHeartbeatManager.recordHeartbeatResult(false, responseTime);
      }
      
      setIsConnected(false);
    }
  }, [sessionId, currentUser]);

  // 检查连接健康状态并尝试恢复
  useEffect(() => {
    if (!stabilityEnhancerRef.current) return;
    
    const healthCheckInterval = setInterval(() => {
      const health = stabilityEnhancerRef.current?.getHealth();
      if (health && stabilityEnhancerRef.current?.shouldRecover()) {
        console.log('Connection unhealthy, attempting recovery...');
        stabilityEnhancerRef.current.startRecovery().then(() => {
          // 恢复后重新轮询
          pollSession();
        });
      }
    }, 10000); // 每10秒检查一次健康状态
    
    return () => clearInterval(healthCheckInterval);
  }, [pollSession]);

  useEffect(() => {
    if (!isJoined || isRestoring) return;
    
    // 立即执行一次轮询
    pollSession();
    
    // 减少轮询频率，增加稳定性
    const pollInterval = setInterval(pollSession, 3000); // 从2秒增加到3秒
    const heartbeatInterval = setInterval(sendHeartbeat, 10000); // 从5秒增加到10秒
    
    return () => {
      clearInterval(pollInterval);
      clearInterval(heartbeatInterval);
    };
  }, [isJoined, isRestoring, pollSession, sendHeartbeat]);

  return {
    session,
    isJoined,
    isConnected,
    isLoading,
    setSession,
    setIsJoined,
    setIsConnected,
    setIsLoading,
    pollSession,
    sendHeartbeat,
  };
}
