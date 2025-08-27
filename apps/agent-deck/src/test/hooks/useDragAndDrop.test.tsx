import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDragAndDrop } from '@/hooks/use-drag-and-drop'
import { Service } from '@agent-deck/shared'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

// Mock the toast hook
vi.mock('../../hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn()
  })
}))

// Mock the API request
vi.mock('../../lib/queryClient', () => ({
  apiRequest: vi.fn()
}))

// Create a test wrapper with QueryClient
const createTestWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}

describe('useDragAndDrop', () => {
  const mockService: Service = {
    id: 'test-service-1',
    name: 'Test Service',
    type: 'mcp',
    url: 'http://localhost:8000/mcp',
    health: 'healthy',
    description: 'A test service',
    cardColor: '#7ed4da',
    isConnected: true,
    lastPing: new Date().toISOString(),
    registeredAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Initial State', () => {
    it('returns initial state correctly', () => {
      const { result } = renderHook(() => useDragAndDrop(), {
        wrapper: createTestWrapper()
      })

      expect(result.current.isDraggingFromDeck).toBe(false)
      expect(typeof result.current.handleDragStart).toBe('function')
      expect(typeof result.current.handleDragEnd).toBe('function')
      expect(typeof result.current.handleDrop).toBe('function')
      expect(typeof result.current.handleGlobalDrop).toBe('function')
    })
  })

  describe('Drag Start', () => {
    it('handles drag start event', () => {
      const { result } = renderHook(() => useDragAndDrop(), {
        wrapper: createTestWrapper()
      })

      const mockDragEvent = {
        dataTransfer: {
          setData: vi.fn(),
          setDragImage: vi.fn()
        },
        preventDefault: vi.fn()
      } as any

      act(() => {
        result.current.handleDragStart(mockDragEvent, mockService)
      })

      expect(mockDragEvent.dataTransfer.setData).toHaveBeenCalledWith(
        'application/json',
        JSON.stringify(mockService)
      )
    })

    it('sets drag image when provided', () => {
      const { result } = renderHook(() => useDragAndDrop(), {
        wrapper: createTestWrapper()
      })

      const mockDragEvent = {
        dataTransfer: {
          setData: vi.fn(),
          setDragImage: vi.fn()
        },
        preventDefault: vi.fn()
      } as any

      const mockElement = document.createElement('div')

      act(() => {
        result.current.handleDragStart(mockDragEvent, mockService, mockElement)
      })

      expect(mockDragEvent.dataTransfer.setDragImage).toHaveBeenCalledWith(
        mockElement,
        0,
        0
      )
    })
  })

  describe('Drag End', () => {
    it('handles drag end event', () => {
      const { result } = renderHook(() => useDragAndDrop(), {
        wrapper: createTestWrapper()
      })

      const mockDragEvent = {
        dataTransfer: {
          clearData: vi.fn()
        },
        preventDefault: vi.fn()
      } as any

      act(() => {
        result.current.handleDragEnd(mockDragEvent)
      })

      expect(mockDragEvent.dataTransfer.clearData).toHaveBeenCalled()
    })
  })

  describe('Drop Handling', () => {
    it('handles drop event with valid service data', () => {
      const { result } = renderHook(() => useDragAndDrop(), {
        wrapper: createTestWrapper()
      })

      const mockDropEvent = {
        dataTransfer: {
          getData: vi.fn().mockReturnValue(JSON.stringify(mockService))
        },
        preventDefault: vi.fn()
      } as any

      const mockCallback = vi.fn()

      act(() => {
        result.current.handleDrop(mockDropEvent, mockCallback)
      })

      expect(mockDropEvent.preventDefault).toHaveBeenCalled()
      expect(mockCallback).toHaveBeenCalledWith(mockService)
    })

    it('handles drop event with invalid service data', () => {
      const { result } = renderHook(() => useDragAndDrop(), {
        wrapper: createTestWrapper()
      })

      const mockDropEvent = {
        dataTransfer: {
          getData: vi.fn().mockReturnValue('invalid-json')
        },
        preventDefault: vi.fn()
      } as any

      const mockCallback = vi.fn()

      act(() => {
        result.current.handleDrop(mockDropEvent, mockCallback)
      })

      expect(mockDropEvent.preventDefault).toHaveBeenCalled()
      expect(mockCallback).not.toHaveBeenCalled()
    })

    it('handles drop event with no data', () => {
      const { result } = renderHook(() => useDragAndDrop(), {
        wrapper: createTestWrapper()
      })

      const mockDropEvent = {
        dataTransfer: {
          getData: vi.fn().mockReturnValue('')
        },
        preventDefault: vi.fn()
      } as any

      const mockCallback = vi.fn()

      act(() => {
        result.current.handleDrop(mockDropEvent, mockCallback)
      })

      expect(mockDropEvent.preventDefault).toHaveBeenCalled()
      expect(mockCallback).not.toHaveBeenCalled()
    })
  })

  describe('Global Drop Handling', () => {
    it('handles global drop event', () => {
      const { result } = renderHook(() => useDragAndDrop(), {
        wrapper: createTestWrapper()
      })

      const mockDropEvent = {
        dataTransfer: {
          getData: vi.fn().mockReturnValue(JSON.stringify(mockService))
        },
        preventDefault: vi.fn()
      } as any

      const mockCallback = vi.fn()

      act(() => {
        result.current.handleGlobalDrop(mockDropEvent, mockCallback)
      })

      expect(mockDropEvent.preventDefault).toHaveBeenCalled()
      expect(mockCallback).toHaveBeenCalledWith(mockService)
    })

    it('handles global drop with invalid data', () => {
      const { result } = renderHook(() => useDragAndDrop(), {
        wrapper: createTestWrapper()
      })

      const mockDropEvent = {
        dataTransfer: {
          getData: vi.fn().mockReturnValue('invalid-json')
        },
        preventDefault: vi.fn()
      } as any

      const mockCallback = vi.fn()

      act(() => {
        result.current.handleGlobalDrop(mockDropEvent, mockCallback)
      })

      expect(mockDropEvent.preventDefault).toHaveBeenCalled()
      expect(mockCallback).not.toHaveBeenCalled()
    })
  })

  describe('Deck Dragging State', () => {
    it('tracks dragging from deck state', () => {
      const { result } = renderHook(() => useDragAndDrop(), {
        wrapper: createTestWrapper()
      })

      // Initially should be false
      expect(result.current.isDraggingFromDeck).toBe(false)

      // Simulate starting drag from deck
      const mockDragEvent = {
        dataTransfer: {
          setData: vi.fn(),
          setDragImage: vi.fn()
        },
        preventDefault: vi.fn()
      } as any

      act(() => {
        result.current.handleDragStart(mockDragEvent, mockService, undefined, true)
      })

      // Should now be true
      expect(result.current.isDraggingFromDeck).toBe(true)

      // Simulate ending drag
      const mockDropEvent = {
        dataTransfer: {
          getData: vi.fn().mockReturnValue(JSON.stringify(mockService))
        },
        preventDefault: vi.fn()
      } as any

      act(() => {
        result.current.handleDrop(mockDropEvent, vi.fn())
      })

      // Should be false again after drop
      expect(result.current.isDraggingFromDeck).toBe(false)
    })
  })

  describe('Error Handling', () => {
    it('handles JSON parse errors gracefully', () => {
      const { result } = renderHook(() => useDragAndDrop(), {
        wrapper: createTestWrapper()
      })

      const mockDropEvent = {
        dataTransfer: {
          getData: vi.fn().mockImplementation(() => {
            throw new Error('JSON parse error')
          })
        },
        preventDefault: vi.fn()
      } as any

      const mockCallback = vi.fn()

      // Should not throw error
      expect(() => {
        act(() => {
          result.current.handleDrop(mockDropEvent, mockCallback)
        })
      }).not.toThrow()

      expect(mockCallback).not.toHaveBeenCalled()
    })

    it('handles missing dataTransfer', () => {
      const { result } = renderHook(() => useDragAndDrop(), {
        wrapper: createTestWrapper()
      })

      const mockDropEvent = {
        preventDefault: vi.fn()
      } as any

      const mockCallback = vi.fn()

      // Should not throw error
      expect(() => {
        act(() => {
          result.current.handleDrop(mockDropEvent, mockCallback)
        })
      }).not.toThrow()

      expect(mockCallback).not.toHaveBeenCalled()
    })
  })
})




