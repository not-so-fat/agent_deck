import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useWebSocket } from '../../hooks/use-websocket'

// Mock WebSocket
const mockWebSocket = {
  send: vi.fn(),
  close: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  readyState: 1,
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3,
}

// Mock the toast hook
vi.mock('../../hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn()
  })
}))

describe('useWebSocket', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset WebSocket mock
    global.WebSocket = vi.fn().mockImplementation(() => mockWebSocket)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Initial State', () => {
    it('returns initial state correctly', () => {
      const { result } = renderHook(() => useWebSocket())

      expect(result.current.connectionStatus).toBe('disconnected')
      expect(typeof result.current.sendMessage).toBe('function')
      expect(typeof result.current.disconnect).toBe('function')
    })
  })

  describe('Connection Management', () => {
    it('attempts to connect on mount', () => {
      renderHook(() => useWebSocket())

      expect(global.WebSocket).toHaveBeenCalledWith('ws://localhost:5001/ws')
    })

    it('handles connection open event', () => {
      const { result } = renderHook(() => useWebSocket())

      // Simulate WebSocket open event
      const openCallback = mockWebSocket.addEventListener.mock.calls.find(
        call => call[0] === 'open'
      )?.[1]

      act(() => {
        openCallback?.()
      })

      expect(result.current.connectionStatus).toBe('connected')
    })

    it('handles connection close event', () => {
      const { result } = renderHook(() => useWebSocket())

      // Simulate WebSocket close event
      const closeCallback = mockWebSocket.addEventListener.mock.calls.find(
        call => call[0] === 'close'
      )?.[1]

      act(() => {
        closeCallback?.()
      })

      expect(result.current.connectionStatus).toBe('disconnected')
    })

    it('handles connection error event', () => {
      const { result } = renderHook(() => useWebSocket())

      // Simulate WebSocket error event
      const errorCallback = mockWebSocket.addEventListener.mock.calls.find(
        call => call[0] === 'error'
      )?.[1]

      act(() => {
        errorCallback?.()
      })

      expect(result.current.connectionStatus).toBe('error')
    })
  })

  describe('Message Handling', () => {
    it('handles incoming messages', () => {
      const { result } = renderHook(() => useWebSocket())

      // Simulate WebSocket message event
      const messageCallback = mockWebSocket.addEventListener.mock.calls.find(
        call => call[0] === 'message'
      )?.[1]

      const mockMessage = {
        data: JSON.stringify({ type: 'test', data: 'test message' })
      }

      act(() => {
        messageCallback?.(mockMessage)
      })

      // Should handle the message without throwing
      expect(result.current.connectionStatus).toBe('disconnected')
    })

    it('handles invalid JSON messages', () => {
      const { result } = renderHook(() => useWebSocket())

      // Simulate WebSocket message event with invalid JSON
      const messageCallback = mockWebSocket.addEventListener.mock.calls.find(
        call => call[0] === 'message'
      )?.[1]

      const mockMessage = {
        data: 'invalid json'
      }

      act(() => {
        messageCallback?.(mockMessage)
      })

      // Should handle invalid JSON without throwing
      expect(result.current.connectionStatus).toBe('disconnected')
    })

    it('sends messages when connected', () => {
      const { result } = renderHook(() => useWebSocket())

      // First connect
      const openCallback = mockWebSocket.addEventListener.mock.calls.find(
        call => call[0] === 'open'
      )?.[1]

      act(() => {
        openCallback?.()
      })

      // Then send a message
      act(() => {
        result.current.sendMessage({ type: 'test', data: 'test' })
      })

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({ type: 'test', data: 'test' })
      )
    })

    it('does not send messages when disconnected', () => {
      const { result } = renderHook(() => useWebSocket())

      // Try to send a message without connecting
      act(() => {
        result.current.sendMessage({ type: 'test', data: 'test' })
      })

      expect(mockWebSocket.send).not.toHaveBeenCalled()
    })
  })

  describe('Disconnection', () => {
    it('disconnects WebSocket when disconnect is called', () => {
      const { result } = renderHook(() => useWebSocket())

      act(() => {
        result.current.disconnect()
      })

      expect(mockWebSocket.close).toHaveBeenCalled()
    })
  })

  describe('Reconnection', () => {
    it('attempts to reconnect after connection loss', () => {
      const { result } = renderHook(() => useWebSocket())

      // First connect
      const openCallback = mockWebSocket.addEventListener.mock.calls.find(
        call => call[0] === 'open'
      )?.[1]

      act(() => {
        openCallback?.()
      })

      // Then disconnect
      const closeCallback = mockWebSocket.addEventListener.mock.calls.find(
        call => call[0] === 'close'
      )?.[1]

      act(() => {
        closeCallback?.()
      })

      // Should attempt to reconnect
      expect(global.WebSocket).toHaveBeenCalledTimes(2)
    })
  })

  describe('Error Handling', () => {
    it('handles WebSocket constructor errors', () => {
      // Mock WebSocket to throw an error
      global.WebSocket = vi.fn().mockImplementation(() => {
        throw new Error('WebSocket connection failed')
      })

      // Should not throw error
      expect(() => {
        renderHook(() => useWebSocket())
      }).not.toThrow()
    })

    it('handles missing event listeners', () => {
      const { result } = renderHook(() => useWebSocket())

      // Should not throw when trying to access non-existent callbacks
      expect(() => {
        act(() => {
          // Try to call a non-existent callback
          const nonExistentCallback = mockWebSocket.addEventListener.mock.calls.find(
            call => call[0] === 'nonexistent'
          )?.[1]
          nonExistentCallback?.()
        })
      }).not.toThrow()
    })
  })

  describe('Cleanup', () => {
    it('cleans up event listeners on unmount', () => {
      const { unmount } = renderHook(() => useWebSocket())

      unmount()

      // Should remove all event listeners
      expect(mockWebSocket.removeEventListener).toHaveBeenCalled()
    })
  })
})











