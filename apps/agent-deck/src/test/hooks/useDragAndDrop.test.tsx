import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDragAndDrop } from '@/hooks/use-drag-and-drop'
import { createTestWrapper } from '../setup'

// Mock the API request function
vi.mock('@/lib/queryClient', () => ({
  apiRequest: vi.fn()
}))

// Mock the toast hook
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn()
  })
}))

const mockService = {
  id: 'test-service-1',
  name: 'Test Service',
  type: 'mcp' as const,
  url: 'http://localhost:8000/mcp',
  health: 'healthy' as const,
  description: 'A test service',
  cardColor: '#7ed4da',
  isConnected: true,
  lastPing: '2025-08-30T16:41:28.265Z',
  registeredAt: '2025-08-30T16:41:28.265Z',
  updatedAt: '2025-08-30T16:41:28.265Z'
}

describe('useDragAndDrop', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Initial State', () => {
    it('returns initial state correctly', () => {
      const { result } = renderHook(() => useDragAndDrop(), {
        wrapper: createTestWrapper()
      })

      expect(result.current.draggedService).toBe(null)
      expect(result.current.isDraggingFromDeck).toBe(false)
      expect(result.current.isDropping).toBe(false)
    })
  })

  describe('Drag Start', () => {
    it('handles drag start event from collection', () => {
      const { result } = renderHook(() => useDragAndDrop(), {
        wrapper: createTestWrapper()
      })

      const mockDragEvent = {
        dataTransfer: {
          setData: vi.fn(),
          effectAllowed: ''
        },
        currentTarget: {
          style: { opacity: '' }
        }
      } as any

      act(() => {
        result.current.handleDragStart(mockDragEvent, mockService, false)
      })

      expect(result.current.draggedService).toEqual(mockService)
      expect(result.current.isDraggingFromDeck).toBe(false)
      expect(mockDragEvent.dataTransfer.setData).toHaveBeenCalledWith(
        'text/plain',
        mockService.id
      )
      expect(mockDragEvent.dataTransfer.setData).toHaveBeenCalledWith(
        'application/json',
        JSON.stringify({ serviceId: mockService.id, fromDeck: false })
      )
      expect(mockDragEvent.dataTransfer.effectAllowed).toBe('copy')
    })

    it('handles drag start event from deck', () => {
      const { result } = renderHook(() => useDragAndDrop(), {
        wrapper: createTestWrapper()
      })

      const mockDragEvent = {
        dataTransfer: {
          setData: vi.fn(),
          effectAllowed: ''
        },
        currentTarget: {
          style: { opacity: '' }
        }
      } as any

      act(() => {
        result.current.handleDragStart(mockDragEvent, mockService, true)
      })

      expect(result.current.draggedService).toEqual(mockService)
      expect(result.current.isDraggingFromDeck).toBe(true)
      expect(mockDragEvent.dataTransfer.setData).toHaveBeenCalledWith(
        'text/plain',
        mockService.id
      )
      expect(mockDragEvent.dataTransfer.setData).toHaveBeenCalledWith(
        'application/json',
        JSON.stringify({ serviceId: mockService.id, fromDeck: true })
      )
      expect(mockDragEvent.dataTransfer.effectAllowed).toBe('move')
    })
  })

  describe('Drag End', () => {
    it('handles drag end event', () => {
      const { result } = renderHook(() => useDragAndDrop(), {
        wrapper: createTestWrapper()
      })

      // First start a drag
      const mockStartEvent = {
        dataTransfer: {
          setData: vi.fn(),
          effectAllowed: ''
        },
        currentTarget: {
          style: { opacity: '' }
        }
      } as any

      act(() => {
        result.current.handleDragStart(mockStartEvent, mockService, false)
      })

      expect(result.current.draggedService).toEqual(mockService)

      // Then end the drag
      const mockEndEvent = {
        currentTarget: {
          style: { opacity: '0.5' }
        }
      } as any

      act(() => {
        result.current.handleDragEnd(mockEndEvent)
      })

      expect(result.current.draggedService).toBe(null)
    })
  })

  describe('Drop Handling', () => {
    it('handles drop event with no service data', () => {
      const { result } = renderHook(() => useDragAndDrop(), {
        wrapper: createTestWrapper()
      })

      const mockDropEvent = {
        preventDefault: vi.fn(),
        dataTransfer: {
          getData: vi.fn().mockReturnValue('')
        }
      } as any

      act(() => {
        result.current.handleDrop(mockDropEvent)
      })

      expect(mockDropEvent.preventDefault).toHaveBeenCalled()
    })
  })

  describe('Global Drop Handling', () => {
    it('handles global drop with no service data', () => {
      const { result } = renderHook(() => useDragAndDrop(), {
        wrapper: createTestWrapper()
      })

      const mockDropEvent = {
        preventDefault: vi.fn(),
        dataTransfer: {
          getData: vi.fn().mockReturnValue('')
        }
      } as any

      act(() => {
        result.current.handleGlobalDrop(mockDropEvent)
      })

      expect(mockDropEvent.preventDefault).toHaveBeenCalled()
    })
  })
})




